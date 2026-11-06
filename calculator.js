/* Pure calculation and validation helpers, shared by the page and Node checks. */
(() => {
  'use strict';
  const ANNUAL_MJ = 63645;
  const DAY = 86400000;
  // MVM monthly fixed allowance (rounded MJ/month, effective 2024-08-01).
  // https://www.mvmnext.hu/lakossagirezsi/gyakorikerdesek-foldgaz
  const MONTHLY_MJ = Object.freeze([12365, 10421, 8915, 5145, 1827, 635, 512, 565, 1109, 3724, 7490, 10937]);
  const BILLING_MODES = Object.freeze(['flat', 'reading', 'temperature']);
  // Illustrative consumption weights, NOT the fixed allowance or an MVM weather model.
  const EXAMPLE_WEIGHTS = Object.freeze([19, 16, 13, 8, 3, 1, 1, 1, 2, 7, 12, 17]);
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= '1900-01-01';
  }
  function parseNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    if (typeof value !== 'string') return NaN;
    const text = value.trim().replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
    return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) ? Number(text) : NaN;
  }
  function yearFor(date) { return Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 8 ? 1 : 0); }
  function period(year) {
    const start = `${year}-08-01`, next = `${year + 1}-08-01`, end = `${year + 1}-07-31`;
    return { start, next, end, days: (Date.parse(next) - Date.parse(start)) / DAY };
  }
  function sorted(readings) { return [...readings].sort((a, b) => a.date.localeCompare(b.date)); }
  function addDays(date, days) { return new Date(Date.parse(date) + days * DAY).toISOString().slice(0, 10); }
  function defaultBilling(date = today()) {
    const start = `${date.slice(0, 7)}-01`;
    const d = new Date(`${start}T00:00:00Z`);
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
    return { mode: 'flat', annualEstimate: '', start, end, weights: [...EXAMPLE_WEIGHTS] };
  }
  function validateBilling(billing) {
    if (!billing || !BILLING_MODES.includes(billing.mode)) return 'Válassz érvényes számlázási módot.';
    if (!validDate(billing.start) || !validDate(billing.end)) return 'Adj meg érvényes kezdő és záró dátumot ÉÉÉÉ-HH-NN formátumban.';
    if (billing.start < '2024-08-01') return 'A kalkuláció 2024-08-01-től érvényes szabályokkal számol; válassz későbbi kezdőnapot.';
    const days = (Date.parse(billing.end) - Date.parse(billing.start)) / DAY;
    if (days <= 0) return 'A záró dátumnak későbbinek kell lennie a kezdő dátumnál.';
    if (days > 366) return 'Egyszerre legfeljebb 366 napos időszakot vizsgálhatsz.';
    if (typeof billing.annualEstimate !== 'string' || (billing.annualEstimate.trim() !== '' && (!Number.isFinite(parseNumber(billing.annualEstimate)) || parseNumber(billing.annualEstimate) < 0 || parseNumber(billing.annualEstimate) > 1e9))) return 'A becsült éves fogyasztás 0 és 1 000 000 000 közötti szám lehet.';
    if (!Array.isArray(billing.weights) || billing.weights.length !== 12 || billing.weights.some(w => !Number.isFinite(w) || w < 0 || w > 1000) || billing.weights.reduce((sum, w) => sum + w, 0) <= 0) return 'Adj meg 12 nemnegatív profilsúlyt (legfeljebb 1000); legalább az egyik legyen pozitív.';
    return '';
  }
  // Intervals are [start, end): the closing reading is the next period's opening.
  function allowanceBetween(start, end, mode) {
    let energy = 0;
    for (let date = start; date < end; date = addDays(date, 1)) {
      const d = new Date(`${date}T00:00:00Z`);
      const month = d.getUTCMonth();
      const monthDays = new Date(Date.UTC(d.getUTCFullYear(), month + 1, 0)).getUTCDate();
      energy += mode === 'flat' ? ANNUAL_MJ / period(yearFor(date)).days : MONTHLY_MJ[month] / monthDays;
    }
    return energy;
  }
  function calculateBilling(settings, readings, billing) {
    const message = validateBilling(billing);
    if (message) throw new RangeError(message);
    const factor = settings.heat * settings.correction;
    const days = (Date.parse(billing.end) - Date.parse(billing.start)) / DAY;
    const allowanceMJ = allowanceBetween(billing.start, billing.end, billing.mode);
    const allowance = allowanceMJ / factor;
    const opening = readings.find(r => r.date === billing.start);
    const closing = readings.find(r => r.date === billing.end);
    let consumption = null;
    if (billing.mode === 'reading') {
      if (opening && closing) consumption = closing.value - opening.value;
    } else if (billing.annualEstimate.trim() !== '') {
      const annual = parseNumber(billing.annualEstimate);
      const totalWeight = billing.weights.reduce((sum, weight) => sum + weight, 0);
      consumption = 0;
      for (let date = billing.start; date < billing.end; date = addDays(date, 1)) {
        const d = new Date(`${date}T00:00:00Z`);
        const month = d.getUTCMonth();
        const monthDays = new Date(Date.UTC(d.getUTCFullYear(), month + 1, 0)).getUTCDate();
        const share = billing.mode === 'flat' ? 1 / 12 : billing.weights[month] / totalWeight;
        consumption += annual * share / monthDays;
      }
    }
    const eligible = consumption === null ? null : Math.min(consumption, allowance);
    const over = consumption === null ? null : Math.max(0, consumption - allowance);
    return { days, allowanceMJ, allowance, consumption, eligible, over, opening, closing };
  }
  function validateReading(candidate, readings, latestDate = today()) {
    if (!validDate(candidate.date)) return 'Adj meg érvényes dátumot ÉÉÉÉ-HH-NN formátumban.';
    if (candidate.date > latestDate) return 'A rögzítés dátuma nem lehet jövőbeli.';
    if (!Number.isFinite(candidate.value) || candidate.value < 0 || candidate.value > 1e12) return 'A mérőállás 0 és 1 000 000 000 000 közötti szám lehet.';
    const others = sorted(readings.filter(r => r.id !== candidate.id));
    if (others.some(r => r.date === candidate.date)) return 'Erre a napra már van mérés. Módosítsd a naplóban a meglévő állást.';
    const before = others.filter(r => r.date < candidate.date).at(-1);
    const after = others.find(r => r.date > candidate.date);
    const format = n => new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 3 }).format(n);
    if (before && candidate.value < before.value) return `Az állás nem lehet kisebb a korábbi mérésnél (${before.date}: ${format(before.value)} m³).`;
    if (after && candidate.value > after.value) return `Az állás nem lehet nagyobb a következő mérésnél (${after.date}: ${format(after.value)} m³).`;
    return '';
  }
  function calculate(settings, readings, year) {
    const dates = period(year);
    const annual = ANNUAL_MJ / (settings.heat * settings.correction);
    // The next August 1 is a closing boundary reading for this year as well.
    const items = sorted(readings).filter(r => r.date >= dates.start && r.date <= dates.next);
    const first = items[0], last = items.at(-1);
    const consumed = items.length > 1 ? last.value - first.value : 0;
    const complete = !!first && first.date === dates.start;
    const remaining = Math.max(0, annual - consumed);
    return { ...dates, items, first, last, annual, daily: annual / dates.days, consumed, complete, remaining, over: Math.max(0, consumed - annual), percent: Math.max(0, Math.min(100, remaining / annual * 100)), energy: consumed * settings.heat * settings.correction };
  }
  globalThis.RezsiMath = Object.freeze({ ANNUAL_MJ, DAY, MONTHLY_MJ, BILLING_MODES, EXAMPLE_WEIGHTS, today, validDate, parseNumber, yearFor, period, sorted, addDays, defaultBilling, validateBilling, allowanceBetween, calculateBilling, validateReading, calculate });
})();
