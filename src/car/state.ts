import { today, validDate } from "../calendar";
import { uid } from "../lib/format";
import { nonnegative } from "../lib/months";
import { validCharges, type Charge } from "./charges";
import { validTaxInput, type TaxInput } from "./tax";

export const CAR_KEY = "rezsipont.car.v1";
export type Fuel = {
  kind: "fuel";
  km: number | null;
  liters: number | null;
  full: boolean;
};
export type CarEntry = {
  id: string;
  photoId?: string;
  date: string;
  paid: number;
  odometer?: number;
} & (Fuel | { kind: "expense"; name: string });
export type Car = {
  id: string;
  name: string;
  entries: CarEntry[];
  value: number;
  charges?: Charge[];
  taxInput?: TaxInput;
};
export type CarState = { selected: string; cars: Car[] };

const firstCarId = "car-1";
export const createCar = (name: string, id: string = uid()): Car => ({
  id,
  name,
  entries: [],
  value: 3_000_000,
});
export const initialCar = (): CarState => ({
  selected: firstCarId,
  cars: [createCar("Saját autó", firstCarId)],
});

export function migrateCar(value: unknown): unknown {
  if (
    !value ||
    typeof value !== "object" ||
    "cars" in value ||
    !("entries" in value) ||
    !("value" in value)
  )
    return value;
  return {
    selected: firstCarId,
    cars: [
      { ...initialCar().cars[0], entries: value.entries, value: value.value },
    ],
  };
}

export const normalizeCarName = (name: string) =>
  name.trim().replace(/\s+/g, " ").normalize("NFC");
export const carNameKey = (name: string) =>
  normalizeCarName(name).toLocaleLowerCase("hu-HU");

export function validCarEntry(item: CarEntry) {
  return (
    !!item &&
    typeof item.id === "string" &&
    validDate(item.date) &&
    item.date <= today() &&
    nonnegative(item.paid) &&
    item.paid > 0 &&
    (item.odometer === undefined || nonnegative(item.odometer)) &&
    (item.kind === "fuel"
      ? (item.km === null || nonnegative(item.km, 1e6)) &&
        (item.liters === null ||
          (nonnegative(item.liters, 1e5) && item.liters > 0)) &&
        typeof item.full === "boolean" &&
        (!item.full ||
          (item.km !== null && item.km > 0 && item.liters !== null))
      : item.kind === "expense" &&
        typeof item.name === "string" &&
        item.name.trim().length > 0 &&
        item.name.length <= 80)
  );
}

export function previousFuel(
  entries: readonly CarEntry[],
  date: string,
  editing: string,
) {
  if (!validDate(date)) return undefined;
  const editingIndex = entries.findIndex((item) => item.id === editing);
  let previous: (CarEntry & Fuel) | undefined;
  entries.forEach((item, index) => {
    if (item.kind !== "fuel" || item.id === editing || item.date > date) return;
    if (item.date === date && editingIndex !== -1 && index >= editingIndex)
      return;
    if (!previous || item.date >= previous.date) previous = item;
  });
  return previous;
}

function validVehicle(data: Car) {
  return (
    !!data &&
    typeof data.id === "string" &&
    data.id !== "" &&
    typeof data.name === "string" &&
    normalizeCarName(data.name).length > 0 &&
    data.name.length <= 80 &&
    nonnegative(data.value) &&
    Array.isArray(data.entries) &&
    data.entries.every(validCarEntry) &&
    (data.charges === undefined || validCharges(data.charges)) &&
    (data.taxInput === undefined || validTaxInput(data.taxInput)) &&
    new Set(data.entries.map((item) => item.id)).size === data.entries.length
  );
}

export function validCar(value: unknown): value is CarState {
  const data = value as CarState | null;
  return (
    !!data &&
    Array.isArray(data.cars) &&
    data.cars.every(validVehicle) &&
    data.cars.some((car) => car.id === data.selected) &&
    new Set(data.cars.map((car) => car.id)).size === data.cars.length &&
    new Set(data.cars.map((car) => carNameKey(car.name))).size ===
      data.cars.length
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
