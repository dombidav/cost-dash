import { uid } from "../lib/format";
import { consumptionInterval } from "../lib/consumption";
import {
  today,
  validDate,
  parseNumber,
  addDays,
  days,
  yearFor,
  yearPeriod,
  monthDays,
  monthPeriod,
  previousYear,
  sortByDate,
} from "../calendar";
import {
  AREAS,
  TARIFFS,
  supported,
  officialRates,
  DEFAULT_ANNUAL_ESTIMATE,
} from "./reference";
import type {
  ElectricityPoint,
  ElectricityReading,
  ElectricityState,
  DailyConsumption,
} from "./types";
export const ANNUAL_CAP = 2523;
export function createPoint(index = 1): ElectricityPoint {
  const { start, end } = monthPeriod();
  return {
    id: uid(),
    name: index === 1 ? "Nappali mérő" : `${index}. mérési pont`,
    area: "elmu",
    tariff: "A1",
    rates: officialRates("elmu", "A1"),
    eligibleFrom: "2022-08-01",
    eligibleTo: "",
    extraAnnual: 0,
    extraFrom: "2022-08-01",
    extraTo: "",
    annualEstimate: String(DEFAULT_ANNUAL_ESTIMATE),
    offPercent: 50,
    heatingPercent: 80,
    solar: "none",
    billing: {
      schedule: "flat",
      metering: "manual",
      source: "readings",
      start,
      end,
      peak: "",
      off: "",
      credit: 0,
      balance: "",
    },
    readings: [],
    draft: { date: today(), peak: "", off: "" },
  };
}
export function initialState(): ElectricityState {
  const point = createPoint();
  return {
    version: 1,
    annualEstimateDefaultVersion: 1,
    selected: point.id,
    year: yearFor(today()),
    points: [point],
    aggregate: { start: point.billing.start, end: point.billing.end },
    stats: {
      people: "",
      floorArea: "",
      region: "country",
      saving: 5,
      deviceWatts: 2000,
      dailyHours: 1,
    },
  };
}
export function migrateState(data: unknown) {
  if (!validState(data) || data.annualEstimateDefaultVersion === 1) return data;
  for (const point of data.points)
    if (point.annualEstimate.trim() === "")
      point.annualEstimate = String(DEFAULT_ANNUAL_ESTIMATE);
  data.annualEstimateDefaultVersion = 1;
  return data;
}
export function heating(date: string) {
  const md = date.slice(5);
  return md >= "10-15" || md <= "04-15";
}
export function eligible(p: ElectricityPoint, date: string) {
  return date >= p.eligibleFrom && (!p.eligibleTo || date < p.eligibleTo);
}
export function total(p: ElectricityPoint, r: ElectricityReading) {
  return p.tariff === "A2" && r.off === null
    ? null
    : r.peak + (p.tariff === "A2" ? (r.off ?? 0) : 0);
}
export function validateReading(
  p: ElectricityPoint,
  r: ElectricityReading,
  requireOff = p.tariff === "A2",
) {
  if (!validDate(r.date))
    return "Adj meg érvényes dátumot ÉÉÉÉ-HH-NN formátumban.";
  if (r.date > today()) return "Jövőbeli mérőállás nem rögzíthető.";
  if (
    !Number.isFinite(r.peak) ||
    r.peak < 0 ||
    r.peak > 1e12 ||
    (r.off !== null &&
      (!Number.isFinite(r.off) || r.off < 0 || r.off > 1e12)) ||
    (requireOff && r.off === null)
  )
    return "Adj meg érvényes, nemnegatív mérőállást; A2-nél mindkét regiszter szükséges.";
  const others = sortByDate(p.readings).filter((x) => x.id !== r.id);
  if (others.some((x) => x.date === r.date))
    return "Erre a napra már van mérés. Szerkeszd a naplóban a meglévőt.";
  const before = others.filter((x) => x.date < r.date).at(-1),
    after = others.find((x) => x.date > r.date);
  for (const field of ["peak", "off"] as const) {
    const value = r[field];
    if (value === null) continue;
    const label = field === "off" ? "A völgyregiszter" : "A mérőállás";
    if (before && before[field] !== null && value < before[field]!)
      return `${label} nem lehet kisebb a korábbi (${before.date}: ${before[field]} kWh) értéknél.`;
    if (after && after[field] !== null && value > after[field]!)
      return `${label} nem lehet nagyobb a későbbi (${after.date}: ${after[field]} kWh) értéknél.`;
  }
  return "";
}
export function validatePoint(p: ElectricityPoint) {
  if (!p.name.trim() || p.name.length > 80)
    return "A mérési pont neve 1–80 karakter lehet.";
  if (
    !Object.hasOwn(AREAS, p.area) ||
    !Object.hasOwn(TARIFFS, p.tariff) ||
    !supported(p.area, p.tariff)
  )
    return "Ez a tarifa a kiválasztott elosztónál nem szerepel a hivatalos táblázatban.";
  if (
    !validDate(p.eligibleFrom) ||
    (p.eligibleTo &&
      (!validDate(p.eligibleTo) || p.eligibleTo <= p.eligibleFrom))
  )
    return "Ellenőrizd a jogosultság kezdő és záró dátumát; a záró nap már nem jogosult nap.";
  if (
    !validDate(p.extraFrom) ||
    (p.extraTo && (!validDate(p.extraTo) || p.extraTo <= p.extraFrom))
  )
    return "Ellenőrizd a többletkeret érvényességi dátumait.";
  if (
    !Number.isFinite(p.extraAnnual) ||
    p.extraAnnual < 0 ||
    p.extraAnnual > 1e6
  )
    return "Az igazolt éves többletkeret 0 és 1 000 000 kWh között lehet.";
  if (
    p.annualEstimate.trim() !== "" &&
    (!Number.isFinite(parseNumber(p.annualEstimate)) ||
      parseNumber(p.annualEstimate) > 1e9)
  )
    return "A becsült éves fogyasztás érvényes, legfeljebb 1 000 000 000 kWh érték lehet.";
  if (
    ![p.offPercent, p.heatingPercent].every(
      (v) => Number.isFinite(v) && v >= 0 && v <= 100,
    )
  )
    return "A fogyasztási arányok 0 és 100% közé eshetnek.";
  if (
    ![p.rates.low, p.rates.second, p.rates.monthlyBase].every(
      (v) => Number.isFinite(v) && v >= 0 && v <= 1e6,
    ) ||
    (p.rates.market !== null &&
      (!Number.isFinite(p.rates.market) ||
        p.rates.market < 0 ||
        p.rates.market > 1e6)) ||
    !validDate(p.rates.effective)
  )
    return "Adj meg érvényes, nemnegatív bruttó díjakat és érvényességi dátumot.";
  const b = p.billing;
  if (
    !["flat", "actual", "prepaid"].includes(b.schedule) ||
    !["manual", "smart"].includes(b.metering) ||
    !["readings", "period"].includes(b.source) ||
    !["none", "gross", "balance"].includes(p.solar)
  )
    return "Érvénytelen számlázási beállítás.";
  if (
    !validDate(b.start) ||
    !validDate(b.end) ||
    b.start < "2022-08-01" ||
    days(b.start, b.end) <= 0 ||
    days(b.start, b.end) > 366
  )
    return "Adj meg 2022-08-01 utáni, 1–366 napos időszakot. A záró dátum már a következő időszak kezdete.";
  for (const value of [b.peak, b.off, b.balance])
    if (
      value.trim() !== "" &&
      (!Number.isFinite(parseNumber(value)) || parseNumber(value) > 1e12)
    )
      return "Az időszaki mennyiség és az egyenleg nemnegatív szám lehet.";
  if (!Number.isFinite(b.credit) || b.credit < 0 || b.credit > 1e9)
    return "A visszaigazolt időszaki jóváírás nemnegatív összeg lehet.";
  return "";
}
export function dailyCap(p: ElectricityPoint, date: string) {
  if (!eligible(p, date)) return 0;
  if (p.tariff === "B_GEO" || (p.tariff === "H" && heating(date))) return null;
  const extra =
    ["A1", "A2"].includes(p.tariff) &&
    date >= p.extraFrom &&
    (!p.extraTo || date < p.extraTo)
      ? p.extraAnnual
      : 0;
  return (ANNUAL_CAP + extra) / yearPeriod(yearFor(date)).days;
}
export function quota(p: ElectricityPoint, start: string, end: string) {
  let cap = 0,
    unlimitedDays = 0,
    activeDays = 0;
  for (let date = start; date < end; date = addDays(date, 1)) {
    if (eligible(p, date)) activeDays++;
    const amount = dailyCap(p, date);
    if (amount === null) unlimitedDays++;
    else cap += amount;
  }
  return { cap, unlimitedDays, activeDays };
}
function distribute(
  start: string,
  end: string,
  peak: number,
  off: number,
): DailyConsumption[] {
  const length = days(start, end),
    result: DailyConsumption[] = [];
  for (let date = start; date < end; date = addDays(date, 1))
    result.push({ date, peak: peak / length, off: off / length });
  return result;
}
export function measured(p: ElectricityPoint, start: string, end: string) {
  const items = sortByDate(p.readings).filter(
    (r) => r.date >= start && r.date <= end,
  );
  if (
    items.length < 2 ||
    items[0].date !== start ||
    items.at(-1)!.date !== end ||
    items.some((r) => total(p, r) === null)
  )
    return null;
  return items
    .slice(1)
    .flatMap((r, i) =>
      distribute(
        items[i].date,
        r.date,
        r.peak - items[i].peak,
        p.tariff === "A2" ? r.off! - items[i].off! : 0,
      ),
    );
}
export function sum(data: DailyConsumption[]) {
  return data.reduce((n, d) => n + d.peak + d.off, 0);
}
export function cost(
  p: ElectricityPoint,
  start: string,
  end: string,
  data: DailyConsumption[] | null,
  credit = 0,
) {
  const q = quota(p, start, end);
  let base = 0;
  for (let date = start; date < end; date = addDays(date, 1))
    if (eligible(p, date)) base += p.rates.monthlyBase / monthDays(date);
  const groups = new Map<number, { peak: number; off: number; cap: number }>();
  let unlimited = 0,
    specialCost = 0,
    outside = false;
  const byDay = new Map(data?.map((d) => [d.date, d]) ?? []);
  for (let date = start; date < end; date = addDays(date, 1)) {
    const d = byDay.get(date) ?? { peak: 0, off: 0 },
      cap = dailyCap(p, date);
    if (!eligible(p, date) && d.peak + d.off > 1e-8) outside = true;
    if (cap === null) {
      unlimited += d.peak + d.off;
      specialCost += (d.peak + d.off) * p.rates.low;
      continue;
    }
    const year = yearFor(date),
      group = groups.get(year) ?? { peak: 0, off: 0, cap: 0 };
    group.peak += d.peak;
    group.off += d.off;
    group.cap += cap;
    groups.set(year, group);
  }
  let cheap = 0,
    over = 0,
    lowCost = specialCost;
  for (const group of groups.values()) {
    const total = group.peak + group.off,
      ratio = total ? Math.min(1, group.cap / total) : 0;
    cheap += total * ratio;
    over += total * (1 - ratio);
    const price = p.tariff === "H" ? p.rates.second : p.rates.low;
    lowCost +=
      group.peak * ratio * price +
      group.off * ratio * (p.tariff === "A2" ? p.rates.second : price);
  }
  const dynamicMissing =
    p.tariff === "D" && (start < "2027-01-01" || over > 1e-7);
  const unknown = !data || outside || p.solar === "balance" || dynamicMissing;
  const highCost = over * (p.rates.market ?? 0);
  return {
    ...q,
    volume: data ? sum(data) : null,
    cheap: data ? cheap : null,
    over: data ? over : null,
    unlimited: data ? unlimited : null,
    lowCost: data ? lowCost : null,
    highCost: data && !dynamicMissing ? highCost : null,
    base,
    total: unknown ? null : lowCost + highCost + base - credit,
    beforeCredit: unknown ? null : lowCost + highCost + base,
    outside,
    dynamicMissing,
    credit,
  };
}
export function periodData(p: ElectricityPoint) {
  const b = p.billing;
  if (b.schedule === "flat") {
    if (p.annualEstimate.trim() === "") return null;
    const annual = parseNumber(p.annualEstimate),
      result: DailyConsumption[] = [];
    for (let date = b.start; date < b.end; date = addDays(date, 1)) {
      const total = eligible(p, date) ? annual / 12 / monthDays(date) : 0,
        off = p.tariff === "A2" ? (total * p.offPercent) / 100 : 0;
      result.push({ date, peak: total - off, off });
    }
    return result;
  }
  if (b.source === "readings") return measured(p, b.start, b.end);
  if (b.peak.trim() === "" || (p.tariff === "A2" && b.off.trim() === ""))
    return null;
  return distribute(
    b.start,
    b.end,
    parseNumber(b.peak),
    p.tariff === "A2" ? parseNumber(b.off) : 0,
  );
}
export function periodResult(
  p: ElectricityPoint,
  start = p.billing.start,
  end = p.billing.end,
) {
  const matching = start === p.billing.start && end === p.billing.end;
  const copy = { ...p, billing: { ...p.billing, start, end } };
  const data =
    !matching && p.billing.schedule !== "flat" && p.billing.source === "period"
      ? null
      : periodData(copy);
  return cost(copy, start, end, data, matching ? p.billing.credit : 0);
}
function interval(
  p: ElectricityPoint,
  a?: ElectricityReading,
  b?: ElectricityReading,
) {
  if (!a || !b || total(p, a) === null || total(p, b) === null) return null;
  return consumptionInterval(a.date, b.date, total(p, b)! - total(p, a)!);
}
export function annual(p: ElectricityPoint, year: number) {
  const period = yearPeriod(year),
    start = p.eligibleFrom > period.start ? p.eligibleFrom : period.start,
    end = p.eligibleTo && p.eligibleTo < period.end ? p.eligibleTo : period.end;
  const active = end > start ? days(start, end) : 0;
  const items = sortByDate(p.readings).filter(
    (r) => r.date >= period.start && r.date <= period.end,
  );
  const usable = items.filter((r) => r.date >= start && r.date <= end);
  const first = usable[0],
    last = usable.at(-1),
    tracked = interval(p, first, last);
  const latest = interval(p, usable.at(-2), usable.at(-1)),
    previous = interval(p, usable.at(-3), usable.at(-2));
  const complete = !!first && first.date === start;
  const measuredFull = !!tracked && complete && last?.date === end;
  let volume: number | null = null,
    kind: "missing" | "measured" | "linear" | "manual" = "missing";
  if (measuredFull) {
    volume = tracked!.volume;
    kind = "measured";
  } else if (p.tariff !== "H" && tracked && tracked.days >= 30) {
    volume = tracked.average * active;
    kind = "linear";
  } else if (p.annualEstimate.trim() !== "") {
    volume = (parseNumber(p.annualEstimate) * active) / period.days;
    kind = "manual";
  }
  let projected: DailyConsumption[] | null = null;
  if (measuredFull) projected = measured(p, start, end);
  else if (volume !== null && active > 0) {
    const offRatio =
      p.tariff === "A2"
        ? kind === "linear" && first && last
          ? (last.off! - first.off!) / (tracked!.volume || 1)
          : p.offPercent / 100
        : 0;
    if (p.tariff === "H") {
      let heatDays = 0;
      for (let date = start; date < end; date = addDays(date, 1))
        if (heating(date)) heatDays++;
      const heatShare =
        heatDays === 0 ? 0 : heatDays === active ? 1 : p.heatingPercent / 100;
      projected = [];
      for (let date = start; date < end; date = addDays(date, 1))
        projected.push({
          date,
          peak: heating(date)
            ? (volume * heatShare) / heatDays
            : (volume * (1 - heatShare)) / (active - heatDays),
          off: 0,
        });
    } else
      projected = distribute(
        start,
        end,
        volume * (1 - offRatio),
        volume * offRatio,
      );
  }
  const annualCost = active > 0 ? cost(p, start, end, projected) : null;
  const observed = tracked ? measured(p, tracked.start, tracked.end) : null;
  const usedNormal =
    observed
      ?.filter((d) => dailyCap(p, d.date) !== null)
      .reduce((n, d) => n + d.peak + d.off, 0) ??
    (complete && first === last ? 0 : null);
  const q =
    active > 0
      ? quota(p, start, end)
      : { cap: 0, unlimitedDays: 0, activeDays: 0 };
  const remaining =
    usedNormal === null ? null : Math.max(0, q.cap - usedNormal);
  const remainingDays = last && end > last.date ? days(last.date, end) : 0;
  const priorStart = tracked ? previousYear(tracked.start) : null,
    priorEnd = tracked ? previousYear(tracked.end) : null;
  const prior = tracked
    ? interval(
        p,
        p.readings.find((r) => r.date === priorStart),
        p.readings.find((r) => r.date === priorEnd),
      )
    : null;
  return {
    ...period,
    activeStart: start,
    activeEnd: end,
    active,
    items,
    first,
    last,
    tracked,
    latest,
    previous,
    complete,
    measuredFull,
    volume,
    kind,
    projected,
    annualCost,
    usedNormal,
    remaining,
    remainingDays,
    quota: q,
    prior,
    priorStart,
    priorEnd,
  };
}
export function validState(data: unknown): data is ElectricityState {
  if (!data || typeof data !== "object") return false;
  const s = data as ElectricityState;
  if (
    s.version !== 1 ||
    (s.annualEstimateDefaultVersion !== undefined &&
      s.annualEstimateDefaultVersion !== 1) ||
    !Number.isInteger(s.year) ||
    s.year < 2022 ||
    s.year > 9998 ||
    !Array.isArray(s.points) ||
    !s.points.length ||
    s.points.length > 20 ||
    !s.points.some((p) => p.id === s.selected) ||
    new Set(s.points.map((p) => p.id)).size !== s.points.length ||
    !s.stats
  )
    return false;
  for (const p of s.points) {
    if (
      !p ||
      typeof p.id !== "string" ||
      typeof p.name !== "string" ||
      !p.rates ||
      !p.billing ||
      !Array.isArray(p.readings) ||
      !p.draft ||
      !validDate(p.draft.date) ||
      typeof p.draft.peak !== "string" ||
      typeof p.draft.off !== "string" ||
      validatePoint(p)
    )
      return false;
    if (
      new Set(p.readings.map((r) => r.id)).size !== p.readings.length ||
      p.readings.some(
        (r) => typeof r.id !== "string" || validateReading(p, r, false),
      )
    )
      return false;
  }
  if (
    !s.aggregate ||
    !validDate(s.aggregate.start) ||
    !validDate(s.aggregate.end) ||
    s.aggregate.start < "2022-08-01" ||
    days(s.aggregate.start, s.aggregate.end) <= 0 ||
    days(s.aggregate.start, s.aggregate.end) > 366
  )
    return false;
  return (
    ["people", "floorArea"].every((k) => {
      const value = s.stats[k as "people" | "floorArea"];
      return (
        typeof value === "string" &&
        (value.trim() === "" ||
          (Number.isFinite(parseNumber(value)) &&
            parseNumber(value) > 0 &&
            parseNumber(value) <= 1e6))
      );
    }) &&
    Number.isFinite(s.stats.saving) &&
    s.stats.saving >= 0 &&
    s.stats.saving <= 100 &&
    Number.isFinite(s.stats.deviceWatts) &&
    s.stats.deviceWatts > 0 &&
    s.stats.deviceWatts <= 1e7 &&
    Number.isFinite(s.stats.dailyHours) &&
    s.stats.dailyHours > 0 &&
    s.stats.dailyHours <= 24 &&
    typeof s.stats.region === "string"
  );
}
