const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../calculator.js');
const M = globalThis.RezsiMath;
const settings = { heat: 34.8, correction: 1 };
const readings = [
  { id: 'a', date: '2026-08-01', value: 10000 },
  { id: 'b', date: '2026-09-01', value: 10100 },
  { id: 'c', date: '2026-10-01', value: 10250 }
];

test('Hungarian decimals and invalid numbers', () => {
  assert.equal(M.parseNumber('12 450,5'), 12450.5);
  assert.equal(M.parseNumber('1,0200'), 1.02);
  for (const value of ['', ' ', '-1', 'Infinity', '12x', '1.2.3', '1,2,3']) assert.ok(Number.isNaN(M.parseNumber(value)));
});
test('Actual calendar dates, leap days and benefit-year boundaries', () => {
  assert.equal(M.validDate('2026-02-29'), false);
  assert.equal(M.validDate('2028-02-29'), true);
  assert.equal(M.validDate('2026-04-31'), false);
  assert.equal(M.yearFor('2026-07-31'), 2025);
  assert.equal(M.yearFor('2026-08-01'), 2026);
  assert.equal(M.period(2026).days, 365);
  assert.equal(M.period(2027).days, 366);
});
test('Annual energy conversion and remaining allowance use exact MJ', () => {
  const result = M.calculate(settings, readings, 2026);
  assert.ok(Math.abs(result.annual - 63645 / 34.8) < 1e-9);
  assert.equal(result.consumed, 250);
  assert.equal(result.energy, 8700);
  assert.equal(result.remaining, result.annual - 250);
  assert.equal(result.complete, true);
  const corrected = M.calculate({ ...settings, correction: 1.02 }, readings, 2026);
  assert.ok(corrected.annual < result.annual);
  assert.ok(Math.abs(result.daily * 365 - result.annual) < 1e-9);
});
test('Chronology is checked on both sides, including edits and backdated entries', () => {
  assert.match(M.validateReading({ id: 'd', date: '2026-09-15', value: 10099 }, readings, '2026-11-06'), /kisebb/);
  assert.match(M.validateReading({ id: 'd', date: '2026-09-15', value: 10251 }, readings, '2026-11-06'), /nagyobb/);
  assert.equal(M.validateReading({ id: 'd', date: '2026-09-15', value: 10150 }, readings, '2026-11-06'), '');
  assert.match(M.validateReading({ ...readings[1], value: 10300 }, readings, '2026-11-06'), /nagyobb/);
  assert.match(M.validateReading({ ...readings[1], date: '2026-10-15' }, readings, '2026-11-06'), /kisebb/);
  assert.equal(M.validateReading({ ...readings[1], value: 10000 }, readings, '2026-11-06'), '');
});
test('Duplicate dates, future dates, negatives and invalid dates are rejected', () => {
  assert.match(M.validateReading({ id: 'd', date: '2026-09-01', value: 10100 }, readings, '2026-11-06'), /már van/);
  assert.match(M.validateReading({ id: 'd', date: '2026-11-07', value: 11000 }, readings, '2026-11-06'), /jövőbeli/);
  assert.match(M.validateReading({ id: 'd', date: '2026-11-01', value: -1 }, readings, '2026-11-06'), /közötti/);
  assert.match(M.validateReading({ id: 'd', date: '2026-02-30', value: 0 }, readings, '2026-11-06'), /érvényes/);
  assert.equal(M.validateReading({ id: 'zero', date: '2026-01-01', value: 0 }, [], '2026-11-06'), '');
});
test('Missing opening reading is marked incomplete, and years are never mixed', () => {
  assert.equal(M.calculate(settings, readings.slice(1), 2026).complete, false);
  const mixed = [...readings, { id: 'previous', date: '2026-07-31', value: 9990 }, { id: 'next', date: '2027-08-01', value: 11000 }];
  assert.equal(M.calculate(settings, mixed, 2026).consumed, 250);
  assert.equal(M.calculate(settings, mixed, 2027).consumed, 0);
  assert.equal(M.calculate(settings, [], 2026).items.length, 0);
});
test('Overuse shows zero remaining and a separate overrun; unchanged meters are allowed', () => {
  const over = M.calculate(settings, [readings[0], { id: 'last', date: '2026-11-01', value: 13000 }], 2026);
  assert.equal(over.remaining, 0);
  assert.equal(over.percent, 0);
  assert.ok(over.over > 0);
  assert.equal(M.validateReading({ id: 'd', date: '2026-11-01', value: 10250 }, readings, '2026-11-06'), '');
});

const billing = (mode, start = '2027-01-01', end = '2027-02-01') => ({ ...M.defaultBilling(), mode, start, end, annualEstimate: '1800' });
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

test('Official seasonal monthly allowances: January and June, including conversion', () => {
  assert.equal(M.MONTHLY_MJ.reduce((sum, value) => sum + value, 0), M.ANNUAL_MJ);
  const january = M.calculateBilling(settings, [], billing('reading'));
  const june = M.calculateBilling(settings, [], billing('temperature', '2027-06-01', '2027-07-01'));
  closeTo(january.allowanceMJ, 12365);
  closeTo(january.allowance, 12365 / 34.8);
  closeTo(june.allowanceMJ, 635);
  closeTo(june.allowance, 635 / 34.8);
  assert.ok(january.allowance > june.allowance * 19);
});
test('Seasonal intervals split at month boundaries, and the end date is excluded', () => {
  closeTo(M.allowanceBetween('2027-01-15', '2027-02-10', 'reading'), 17 * 12365 / 31 + 9 * 10421 / 28);
  closeTo(M.allowanceBetween('2027-01-31', '2027-02-01', 'temperature'), 12365 / 31);
  closeTo(M.allowanceBetween('2028-02-01', '2028-03-01', 'reading'), 10421);
  closeTo(M.allowanceBetween('2028-02-29', '2028-03-01', 'reading'), 10421 / 29);
});
test('All modes preserve the annual allowance, including a leap benefit year', () => {
  for (const year of [2026, 2027]) for (const mode of M.BILLING_MODES) {
    const dates = M.period(year);
    const result = M.calculateBilling(settings, [], billing(mode, dates.start, dates.next));
    closeTo(result.allowanceMJ, 63645);
    if (mode !== 'reading') closeTo(result.consumption, 1800);
  }
  const crossYear = M.allowanceBetween('2027-07-20', '2027-08-10', 'flat');
  closeTo(crossYear, 12 * 63645 / 365 + 9 * 63645 / 366);
});
test('Flat monthly estimates stay equal for full months and prorate partial months', () => {
  closeTo(M.calculateBilling(settings, [], billing('flat')).consumption, 150);
  closeTo(M.calculateBilling(settings, [], billing('flat', '2027-02-01', '2027-03-01')).consumption, 150);
  closeTo(M.calculateBilling(settings, [], billing('flat', '2027-01-15', '2027-02-10')).consumption, 150 * 17 / 31 + 150 * 9 / 28);
  assert.equal(M.calculateBilling(settings, [], { ...billing('flat'), annualEstimate: '' }).consumption, null);
  assert.equal(M.calculateBilling(settings, [], { ...billing('flat'), annualEstimate: '0' }).consumption, 0);
});
test('Temperature consumption has its own normalized profile, separate from allowance', () => {
  const example = M.calculateBilling(settings, [], billing('temperature'));
  closeTo(example.consumption, 342);
  const uniform = M.calculateBilling(settings, [], { ...billing('temperature'), weights: Array(12).fill(5) });
  closeTo(uniform.consumption, 150);
  closeTo(example.allowanceMJ, uniform.allowanceMJ);
  const summer = M.calculateBilling(settings, [], billing('temperature', '2027-06-01', '2027-07-01'));
  closeTo(summer.consumption, 18);
});
test('Dictation uses only actual readings on both boundaries, never annual estimates', () => {
  const range = billing('reading', '2026-08-01', '2026-10-01');
  const actual = M.calculateBilling(settings, readings, range);
  assert.equal(actual.consumption, 250);
  closeTo(actual.eligible + actual.over, actual.consumption);
  assert.ok(actual.over > 0);
  assert.equal(M.calculateBilling(settings, readings.slice(1), range).consumption, null);
  assert.equal(M.calculateBilling(settings, readings, billing('reading', '2026-08-02', '2026-10-01')).consumption, null);
  assert.equal(M.calculateBilling(settings, readings, { ...range, annualEstimate: '9999' }).consumption, 250);
});
test('Billing validation rejects reversed, invalid, historical and excessive date ranges', () => {
  assert.match(M.validateBilling(billing('flat', '2026-11-01', '2026-11-01')), /későbbinek/);
  assert.match(M.validateBilling(billing('flat', '2026-11-02', '2026-11-01')), /későbbinek/);
  assert.match(M.validateBilling(billing('reading', '2026-02-30', '2026-03-01')), /érvényes/);
  assert.match(M.validateBilling(billing('reading', '2024-07-31', '2024-09-01')), /2024-08-01/);
  assert.match(M.validateBilling(billing('flat', '2026-11-01', '2027-11-03')), /366/);
  assert.throws(() => M.calculateBilling(settings, [], billing('unknown')), RangeError);
});
test('Billing validation rejects invalid estimates and profiles, allows zero month weights', () => {
  for (const annualEstimate of ['-1', 'abc', '1,2,3', '1000000001']) assert.match(M.validateBilling({ ...billing('flat'), annualEstimate }), /éves fogyasztás/);
  assert.match(M.validateBilling({ ...billing('temperature'), weights: Array(12).fill(0) }), /profilsúlyt/);
  assert.match(M.validateBilling({ ...billing('temperature'), weights: [1] }), /profilsúlyt/);
  assert.equal(M.validateBilling({ ...billing('temperature'), weights: [1, ...Array(11).fill(0)] }), '');
});
