(() => {
  'use strict';
  const M = globalThis.RezsiMath;
  const R = globalThis.RezsiReferences;
  function defaults() {
    return { low: R.tariff.low, high: R.tariff.high, annualBase: R.tariff.annualBase, effective: R.tariff.effective, area: null, region: 'country', savingPercent: 5, heaterPower: 2, efficiency: 90 };
  }
  function validate(stats) {
    if (!stats || !Number.isFinite(stats.low) || stats.low < 0 || stats.low > 100000 || !Number.isFinite(stats.high) || stats.high < stats.low || stats.high > 100000) return 'A bruttó egységárak 0 és 100 000 Ft/MJ közöttiek lehetnek; a magasabb díj nem lehet kisebb a kedvezményesnél.';
    if (!Number.isFinite(stats.annualBase) || stats.annualBase < 0 || stats.annualBase > 1e8) return 'Az éves alapdíj 0 és 100 000 000 Ft közötti összeg lehet.';
    if (!M.validDate(stats.effective)) return 'Adj meg érvényes díjérvényességi dátumot ÉÉÉÉ-HH-NN formátumban.';
    if (stats.area !== null && (!Number.isFinite(stats.area) || stats.area <= 0 || stats.area > 1e6)) return 'Az alapterület legyen 0-nál nagyobb, legfeljebb 1 000 000 m². Üresen is hagyhatod.';
    if (stats.region !== 'country' && !Object.hasOwn(R.ksh.regions, stats.region)) return 'Válassz érvényes területet.';
    if (!Number.isFinite(stats.savingPercent) || stats.savingPercent < 0 || stats.savingPercent > 100) return 'A megtakarítás 0 és 100% közötti lehet.';
    if (!Number.isFinite(stats.heaterPower) || stats.heaterPower <= 0 || stats.heaterPower > 100) return 'A szemléltető fűtőtest teljesítménye 0-nál nagyobb, legfeljebb 100 kW lehet.';
    if (!Number.isFinite(stats.efficiency) || stats.efficiency <= 0 || stats.efficiency > 100) return 'A feltételezett kazánhatásfok 0-nál nagyobb, legfeljebb 100% lehet.';
    return '';
  }
  function profileShare(start, end, weights) {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let share = 0;
    for (let date = start; date < end; date = M.addDays(date, 1)) {
      const d = new Date(`${date}T00:00:00Z`);
      const days = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      share += weights[d.getUTCMonth()] / total / days;
    }
    return share;
  }
  function baseBetween(start, end, annualBase) {
    let base = 0;
    for (let date = start; date < end; date = M.addDays(date, 1)) {
      const year = Number(date.slice(0, 4));
      const days = (Date.parse(`${year + 1}-01-01`) - Date.parse(`${year}-01-01`)) / M.DAY;
      base += annualBase / days;
    }
    return base;
  }
  function cost(volume, allowanceMJ, settings, stats, base = 0) {
    if (volume === null) return null;
    const energy = volume * settings.heat * settings.correction;
    const eligibleMJ = Math.min(energy, allowanceMJ);
    const overMJ = Math.max(0, energy - allowanceMJ);
    const low = eligibleMJ * stats.low, high = overMJ * stats.high;
    return { energy, eligibleMJ, overMJ, low, high, base, variable: low + high, total: low + high + base };
  }
  function interval(a, b) {
    if (!a || !b) return null;
    const days = (Date.parse(b.date) - Date.parse(a.date)) / M.DAY;
    return days > 0 ? { start: a.date, end: b.date, days, volume: b.value - a.value, average: (b.value - a.value) / days } : null;
  }
  function percentChange(current, previous) { return previous > 0 ? (current / previous - 1) * 100 : current === 0 ? 0 : null; }
  function previousYear(date) {
    const year = Number(date.slice(0, 4)) - 1;
    const month = Number(date.slice(5, 7));
    const day = Math.min(Number(date.slice(8, 10)), new Date(Date.UTC(year, month, 0)).getUTCDate());
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  function calculate(state) {
    const { settings, readings, billing } = state;
    const stats = state.stats;
    const annual = M.calculate(settings, readings, state.year);
    const items = annual.items;
    const latest = interval(items.at(-2), items.at(-1));
    const previous = interval(items.at(-3), items.at(-2));
    const change = latest && previous ? percentChange(latest.average, previous.average) : null;
    const tracked = interval(items[0], items.at(-1));
    const fullYear = !!tracked && annual.complete && annual.last.date === annual.next;
    const share = tracked ? profileShare(tracked.start, tracked.end, billing.weights) : 0;
    const canForecast = !!tracked && tracked.days >= 30 && share >= .05;
    let annualVolume = null, annualKind = 'missing';
    if (fullYear) { annualVolume = tracked.volume; annualKind = 'measured'; }
    else if (canForecast) { annualVolume = tracked.volume / share; annualKind = 'forecast'; }
    else if (billing.annualEstimate.trim() !== '') { annualVolume = M.parseNumber(billing.annualEstimate); annualKind = 'manual'; }
    const remainingDays = annual.last ? (Date.parse(annual.next) - Date.parse(annual.last.date)) / M.DAY : null;
    const headroom = annual.complete && remainingDays > 0 ? annual.remaining / remainingDays : null;
    const priorStart = tracked ? previousYear(tracked.start) : null;
    const priorEnd = tracked ? previousYear(tracked.end) : null;
    const prior = tracked ? interval(readings.find(r => r.date === priorStart), readings.find(r => r.date === priorEnd)) : null;
    const yearChange = prior && tracked ? percentChange(tracked.average, prior.average) : null;
    const bill = M.calculateBilling(settings, readings, billing);
    const billingCost = cost(bill.consumption, bill.allowanceMJ, settings, stats, baseBetween(billing.start, billing.end, stats.annualBase));
    const latestCost = latest ? cost(latest.volume, M.allowanceBetween(latest.start, latest.end, billing.mode), settings, stats, baseBetween(latest.start, latest.end, stats.annualBase)) : null;
    const annualCost = cost(annualVolume, M.ANNUAL_MJ, settings, stats, stats.annualBase);
    const reducedVolume = annualVolume === null ? null : annualVolume * (1 - stats.savingPercent / 100);
    const reducedCost = cost(reducedVolume, M.ANNUAL_MJ, settings, stats, stats.annualBase);
    const savings = annualCost ? Math.max(0, annualCost.total - reducedCost.total) : null;
    const national = R.ksh.nationalMonthly * 12;
    const regional = stats.region === 'country' ? null : R.ksh.regions[stats.region] * 12;
    const nationalChange = annualVolume === null ? null : percentChange(annualVolume, national);
    const regionalChange = annualVolume === null || regional === null ? null : percentChange(annualVolume, regional);
    const perArea = annualVolume !== null && stats.area !== null ? { volume: annualVolume / stats.area, kwh: annualVolume * settings.heat * settings.correction / 3.6 / stats.area } : null;
    const equivalentVolume = latest ? latest.volume : bill.consumption ?? 1;
    const equivalentKwh = equivalentVolume * settings.heat * settings.correction / 3.6;
    const equivalence = { volume: equivalentVolume, kwh: equivalentKwh, hours: equivalentKwh / stats.heaterPower, usefulHeat: equivalentKwh * stats.efficiency / 100, kind: latest ? 'measured' : bill.consumption === null ? 'unit' : 'billing' };
    const anomaly = latest && previous ? previous.average === 0 ? latest.average > 0 ? 'new' : 'stable' : change >= 50 ? 'increase' : change <= -50 ? 'decrease' : 'stable' : 'missing';
    return { annual, latest, previous, change, tracked, fullYear, share, canForecast, annualVolume, annualKind, remainingDays, headroom, priorStart, priorEnd, prior, yearChange, bill, billingCost, latestCost, annualCost, reducedVolume, reducedCost, savings, national, regional, nationalChange, regionalChange, perArea, equivalence, anomaly };
  }
  globalThis.RezsiStats = Object.freeze({ defaults, validate, profileShare, baseBetween, cost, interval, percentChange, previousYear, calculate });
})();
