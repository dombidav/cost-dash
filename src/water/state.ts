import { parseNumber, today } from "../calendar";
import { nonnegative, validMonth } from "../lib/months";
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
export type WaterMonth = {
  month: string;
  volume: number;
  sewerVolume: number | null;
  rates: WaterRates;
};
export type WaterState = { rates: WaterRates; months: WaterMonth[] };
export const initialWater = (): WaterState => ({
  rates: { ...presets[0], base: 0, people: 2 },
  months: [],
});
const validRates = (rates: WaterRates) =>
  !!rates &&
  (rates.city === "" || presets.some((p) => p.city === rates.city)) &&
  nonnegative(rates.water, 1e6) &&
  nonnegative(rates.sewer, 1e6) &&
  nonnegative(rates.base, 1e7) &&
  Number.isInteger(rates.people) &&
  rates.people >= 1 &&
  rates.people <= 100;

export function validWaterMonth(item: WaterMonth) {
  return (
    !!item &&
    validMonth(item.month) &&
    item.month <= today().slice(0, 7) &&
    nonnegative(item.volume, 1e6) &&
    (item.sewerVolume === null || nonnegative(item.sewerVolume, 1e6)) &&
    validRates(item.rates)
  );
}

export function validWater(value: unknown): value is WaterState {
  const state = value as WaterState | null;
  return (
    !!state &&
    validRates(state.rates) &&
    Array.isArray(state.months) &&
    state.months.every(validWaterMonth) &&
    new Set(state.months.map((item) => item.month)).size === state.months.length
  );
}

export function waterBill({ volume, sewerVolume, rates }: WaterMonth) {
  const water = volume * rates.water;
  const sewer = (sewerVolume ?? volume) * rates.sewer;
  return { water, sewer, base: rates.base, total: water + sewer + rates.base };
}
