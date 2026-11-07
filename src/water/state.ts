import {
  days,
  monthPeriod,
  parseNumber,
  sortByDate,
  today,
  validDate,
} from "../calendar";
import { nonnegative, validMonth } from "../lib/months";
import { consumptionInterval } from "../lib/consumption";
import type { Reading } from "../types";
import csv from "./rates.csv?raw";

export const WATER_KEY = "rezsipont.water.v1";
export const presets = csv
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((row) => {
    const [city, water, sewer] = row.split(";");
    return { city, water: parseNumber(water), sewer: parseNumber(sewer) };
  });

export type WaterRates = {
  city: string;
  water: number;
  sewer: number;
  base: number;
  people: number;
};
type WaterMonth = {
  month: string;
  volume: number;
  sewerVolume: number | null;
  rates: WaterRates;
};
export type WaterState = {
  rates: WaterRates;
  months: WaterMonth[];
  readings: Reading[];
};
export const initialWater = (): WaterState => ({
  rates: { ...presets[0], base: 0, people: 2 },
  months: [],
  readings: [],
});
export const validRates = (rates: WaterRates) =>
  !!rates &&
  (rates.city === "" || presets.some((p) => p.city === rates.city)) &&
  nonnegative(rates.water, 1e6) &&
  nonnegative(rates.sewer, 1e6) &&
  nonnegative(rates.base, 1e7) &&
  Number.isInteger(rates.people) &&
  rates.people >= 1 &&
  rates.people <= 100;

function validWaterMonth(item: WaterMonth) {
  return (
    !!item &&
    validMonth(item.month) &&
    item.month <= today().slice(0, 7) &&
    nonnegative(item.volume, 1e6) &&
    (item.sewerVolume === null || nonnegative(item.sewerVolume, 1e6)) &&
    validRates(item.rates)
  );
}

export function migrateWater(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "months" in value &&
    !("readings" in value)
  )
    return { ...value, readings: [] };
  return value;
}

export function validWater(value: unknown): value is WaterState {
  const state = value as WaterState | null;
  if (
    !state ||
    !validRates(state.rates) ||
    !Array.isArray(state.months) ||
    !state.months.every(validWaterMonth) ||
    new Set(state.months.map((item) => item.month)).size !==
      state.months.length ||
    !Array.isArray(state.readings)
  )
    return false;
  const now = today();
  if (
    !state.readings.every(
      (item) =>
        item &&
        typeof item.id === "string" &&
        validDate(item.date) &&
        item.date <= now &&
        nonnegative(item.value, 1e12),
    ) ||
    new Set(state.readings.map((item) => item.id)).size !==
      state.readings.length
  )
    return false;
  return sortByDate(state.readings).every(
    (item, i, sorted) =>
      i === 0 ||
      (item.date > sorted[i - 1].date && item.value >= sorted[i - 1].value),
  );
}

export function waterBill(
  volume: number,
  start: string,
  end: string,
  rates: WaterRates,
  sewerVolume = volume,
) {
  const water = volume * rates.water;
  const sewer = sewerVolume * rates.sewer;
  let base = 0;
  for (let from = start; rates.base > 0 && from < end;) {
    const month = monthPeriod(from);
    const to = month.end < end ? month.end : end;
    base += (rates.base * days(from, to)) / days(month.start, month.end);
    from = to;
  }
  return { water, sewer, base, total: water + sewer + base };
}

export function waterIntervals(readings: readonly Reading[]) {
  const ordered = sortByDate(readings);
  return ordered.slice(1).map((reading, index) => {
    const before = ordered[index];
    return consumptionInterval(
      before.date,
      reading.date,
      reading.value - before.value,
    )!;
  });
}

export function waterUsageBetween(
  intervals: ReturnType<typeof waterIntervals>,
  start: string,
  end: string,
) {
  let volume = 0,
    from = end,
    to = start;
  for (const interval of intervals) {
    const left = interval.start > start ? interval.start : start;
    const right = interval.end < end ? interval.end : end;
    if (left >= right) continue;
    volume += interval.average * days(left, right);
    if (left < from) from = left;
    if (right > to) to = right;
  }
  return from < to ? { volume, from, to } : null;
}

export function estimateWaterMonth(
  state: WaterState,
  intervals: ReturnType<typeof waterIntervals>,
  start: string,
  end: string,
) {
  const usage = waterUsageBetween(intervals, start, end);
  const partial = !usage || usage.from !== start || usage.to !== end;
  if (partial) {
    const old = state.months.find((item) => item.month === start.slice(0, 7));
    if (old)
      return {
        value: waterBill(
          old.volume,
          start,
          end,
          state.rates,
          old.sewerVolume ?? old.volume,
        ).total,
      };
  }
  return usage
    ? {
        value: waterBill(usage.volume, usage.from, usage.to, state.rates).total,
        partial,
      }
    : null;
}
