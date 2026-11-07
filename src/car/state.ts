import { today, validDate } from "../calendar";
import { nonnegative } from "../lib/months";

export const CAR_KEY = "rezsipont.car.v1";
export type Fuel = {
  kind: "fuel";
  km: number | null;
  liters: number | null;
  full: boolean;
};
export type CarEntry = { id: string; date: string; paid: number } & (
  Fuel | { kind: "expense"; name: string }
);
export type CarState = { entries: CarEntry[]; value: number };
export const initialCar = (): CarState => ({ entries: [], value: 3_000_000 });

export function validCarEntry(item: CarEntry) {
  return (
    !!item &&
    typeof item.id === "string" &&
    validDate(item.date) &&
    item.date <= today() &&
    nonnegative(item.paid) &&
    item.paid > 0 &&
    (item.kind === "fuel"
      ? (item.km === null || (nonnegative(item.km, 1e6) && item.km > 0)) &&
        (item.liters === null ||
          (nonnegative(item.liters, 1e5) && item.liters > 0)) &&
        typeof item.full === "boolean" &&
        (!item.full || (item.km !== null && item.liters !== null))
      : item.kind === "expense" &&
        typeof item.name === "string" &&
        item.name.trim().length > 0 &&
        item.name.length <= 80)
  );
}

export function validCar(value: unknown): value is CarState {
  const data = value as CarState | null;
  return (
    !!data &&
    nonnegative(data.value) &&
    Array.isArray(data.entries) &&
    data.entries.every(validCarEntry) &&
    new Set(data.entries.map((item) => item.id)).size === data.entries.length
  );
}

export function carTotals(entries: readonly CarEntry[], value: number) {
  let fuel = 0,
    other = 0,
    distance = 0,
    comparableDistance = 0,
    comparableLiters = 0,
    comparablePaid = 0;
  for (const item of entries) {
    if (item.kind === "expense") {
      other += item.paid;
      continue;
    }
    fuel += item.paid;
    distance += item.km ?? 0;
    if (item.full && item.km !== null && item.liters !== null) {
      comparableDistance += item.km;
      comparableLiters += item.liters;
      comparablePaid += item.paid;
    }
  }
  const wearPerKm = (value * 0.002) / 1000;
  return {
    fuel,
    other,
    distance,
    paid: fuel + other,
    wearPerKm,
    wear: Math.min(value, distance * wearPerKm),
    consumption: comparableDistance
      ? (comparableLiters / comparableDistance) * 100
      : null,
    fuelPerKm: comparableDistance ? comparablePaid / comparableDistance : null,
  };
}
