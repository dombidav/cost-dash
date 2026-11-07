import {
  addDays,
  days,
  monthDays,
  monthPeriod,
  parseNumber,
  sortByDate,
  today,
  validDate,
  yearFor,
  yearPeriod,
} from "./calendar";
import type { Settings, Reading, Billing, BillingMode } from "./types";
import { consumptionInterval } from "./lib/consumption";
import { estimateOpening, monthlyProfile } from "./lib/seasonal-consumption";
/* Calculation and validation helpers. */
export const ANNUAL_MJ = 63645;
// MVM monthly fixed allowance (rounded MJ/month, effective 2024-08-01).
// https://www.mvmnext.hu/lakossagirezsi/gyakorikerdesek-foldgaz
const MONTHLY_MJ = Object.freeze([
  12365, 10421, 8915, 5145, 1827, 635, 512, 565, 1109, 3724, 7490, 10937,
]);
const BILLING_MODES = Object.freeze(["flat", "reading", "temperature"]);
// Illustrative consumption weights, NOT the fixed allowance or an MVM weather model.
const EXAMPLE_WEIGHTS = Object.freeze([
  19, 16, 13, 8, 3, 1, 1, 1, 2, 7, 12, 17,
]);
export function defaultBilling(date = today()): Billing {
  return {
    mode: "flat",
    annualEstimate: "",
    ...monthPeriod(date),
    weights: [...EXAMPLE_WEIGHTS],
  };
}
export function validateBilling(billing: Billing) {
  if (!billing || !BILLING_MODES.includes(billing.mode))
    return "Válassz érvényes számlázási módot.";
  if (!validDate(billing.start) || !validDate(billing.end))
    return "Adj meg érvényes kezdő és záró dátumot ÉÉÉÉ-HH-NN formátumban.";
  if (billing.start < "2024-08-01")
    return "A kalkuláció 2024-08-01-től érvényes szabályokkal számol; válassz későbbi kezdőnapot.";
  const length = days(billing.start, billing.end);
  if (length <= 0)
    return "A záró dátumnak későbbinek kell lennie a kezdő dátumnál.";
  if (length > 366)
    return "Egyszerre legfeljebb 366 napos időszakot vizsgálhatsz.";
  if (
    typeof billing.annualEstimate !== "string" ||
    (billing.annualEstimate.trim() !== "" &&
      (!Number.isFinite(parseNumber(billing.annualEstimate)) ||
        parseNumber(billing.annualEstimate) < 0 ||
        parseNumber(billing.annualEstimate) > 1e9))
  )
    return "A becsült éves fogyasztás 0 és 1 000 000 000 közötti szám lehet.";
  if (
    !Array.isArray(billing.weights) ||
    billing.weights.length !== 12 ||
    billing.weights.some((w) => !Number.isFinite(w) || w < 0 || w > 1000) ||
    billing.weights.reduce((sum, w) => sum + w, 0) <= 0
  )
    return "Adj meg 12 nemnegatív profilsúlyt (legfeljebb 1000); legalább az egyik legyen pozitív.";
  return "";
}
// Intervals are [start, end): the closing reading is the next period's opening.
export function allowanceBetween(
  start: string,
  end: string,
  mode: BillingMode,
) {
  let energy = 0;
  for (let date = start; date < end; date = addDays(date, 1)) {
    const month = Number(date.slice(5, 7)) - 1;
    energy +=
      mode === "flat"
        ? ANNUAL_MJ / yearPeriod(yearFor(date)).days
        : MONTHLY_MJ[month] / monthDays(date);
  }
  return energy;
}
export function calculateBilling(
  settings: Settings,
  readings: Reading[],
  billing: Billing,
) {
  const message = validateBilling(billing);
  if (message) throw new RangeError(message);
  const factor = settings.heat * settings.correction;
  const length = days(billing.start, billing.end);
  const allowanceMJ = allowanceBetween(
    billing.start,
    billing.end,
    billing.mode,
  );
  const allowance = allowanceMJ / factor;
  const opening = readings.find((r) => r.date === billing.start);
  const closing = readings.find((r) => r.date === billing.end);
  let consumption: number | null = null;
  if (billing.mode === "reading") {
    if (opening && closing) consumption = closing.value - opening.value;
  } else if (billing.annualEstimate.trim() !== "") {
    const annual = parseNumber(billing.annualEstimate);
    const totalWeight = billing.weights.reduce(
      (sum, weight) => sum + weight,
      0,
    );
    consumption = 0;
    for (
      let date = billing.start;
      date < billing.end;
      date = addDays(date, 1)
    ) {
      const month = Number(date.slice(5, 7)) - 1;
      const share =
        billing.mode === "flat" ? 1 / 12 : billing.weights[month] / totalWeight;
      consumption += (annual * share) / monthDays(date);
    }
  }
  const eligible =
    consumption === null ? null : Math.min(consumption, allowance);
  const over =
    consumption === null ? null : Math.max(0, consumption - allowance);
  return {
    days: length,
    allowanceMJ,
    allowance,
    consumption,
    eligible,
    over,
    opening,
    closing,
  };
}
export function validateReading(
  candidate: Reading,
  readings: Reading[],
  latestDate = today(),
) {
  return readingError(candidate, readings, latestDate)?.message ?? "";
}

export function readingError(
  candidate: Reading,
  readings: Reading[],
  latestDate = today(),
):
  | { field: "date" | "value"; message: string; duplicate?: boolean }
  | undefined {
  if (!validDate(candidate.date))
    return {
      field: "date",
      message: "Adj meg érvényes dátumot ÉÉÉÉ-HH-NN formátumban.",
    };
  if (candidate.date > latestDate)
    return { field: "date", message: "A rögzítés dátuma nem lehet jövőbeli." };
  if (
    !Number.isFinite(candidate.value) ||
    candidate.value < 0 ||
    candidate.value > 1e12
  )
    return {
      field: "value",
      message: "A mérőállás 0 és 1 000 000 000 000 közötti szám lehet.",
    };
  const others = sortByDate(readings.filter((r) => r.id !== candidate.id));
  if (others.some((r) => r.date === candidate.date))
    return {
      field: "date",
      message: "Erre a napra már van mérés.",
      duplicate: true,
    };
  const before = others.filter((r) => r.date < candidate.date).at(-1);
  const after = others.find((r) => r.date > candidate.date);
  const format = (n: number) =>
    new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 3 }).format(n);
  if (before && candidate.value < before.value)
    return {
      field: "value",
      message: `Az állás nem lehet kisebb a korábbi mérésnél (${before.date}: ${format(before.value)} m³).`,
    };
  if (after && candidate.value > after.value)
    return {
      field: "value",
      message: `Az állás nem lehet nagyobb a következő mérésnél (${after.date}: ${format(after.value)} m³).`,
    };
}
export function calculateGasYear(
  settings: Settings,
  readings: Reading[],
  year: number,
  billing: Billing,
) {
  const { start, end: next, days: length } = yearPeriod(year);
  const annual = ANNUAL_MJ / (settings.heat * settings.correction);
  // The next August 1 is a closing boundary reading for this year as well.
  const ordered = sortByDate(readings);
  const items = ordered.filter((r) => r.date >= start && r.date <= next);
  const first = items[0],
    last = items.at(-1);
  const tracked =
    first && last
      ? consumptionInterval(first.date, last.date, last.value - first.value)
      : null;
  const complete = !!first && first.date === start;
  const opening = estimateOpening(
    start,
    first,
    ordered.filter((r) => r.date < start).at(-1),
    tracked,
    monthlyProfile(billing.weights),
    parseNumber(billing.annualEstimate),
  );
  const measured = tracked?.volume ?? (complete ? 0 : null);
  const consumed =
    complete || opening ? (measured ?? 0) + (opening?.volume ?? 0) : null;
  const remaining = consumed === null ? null : Math.max(0, annual - consumed);
  return {
    start,
    next,
    end: addDays(next, -1),
    days: length,
    items,
    first,
    last,
    annual,
    daily: annual / length,
    consumed,
    measured,
    opening,
    complete,
    remaining,
    over: consumed === null ? null : Math.max(0, consumed - annual),
    percent:
      remaining === null
        ? null
        : Math.max(0, Math.min(100, (remaining / annual) * 100)),
  };
}
