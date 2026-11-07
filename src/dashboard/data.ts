import { days, monthPeriod, sortByDate, today } from "../calendar";
import { allowanceBetween, calculateBilling } from "../calculator";
import { CAR_KEY, migrateCar, validCar } from "../car/state";
import {
  cost,
  measured,
  migrateState,
  periodResult,
  validState,
} from "../electricity/calculator";
import { ELECTRICITY_STORAGE_KEY } from "../electricity/reference";
import { GAS_STORAGE_KEY, migrateGas, validGas } from "../gas/state";
import { baseBetween, gasCost } from "../statistics";
import { categories } from "../lib/pages";
import {
  activeIn,
  SUBSCRIPTIONS_KEY,
  validSubscriptions,
} from "../subscriptions/state";
import {
  estimateWaterMonth,
  migrateWater,
  validWater,
  waterIntervals,
  WATER_KEY,
} from "../water/state";
import type { ElectricityPoint } from "../electricity/types";
import type { AppState } from "../types";

export type Category = keyof typeof categories;
export const categoryIds = Object.keys(categories) as Category[];
export const categoryColorProperty = (id: Category) => `--category-${id}`;
const keys: Record<Category, string> = {
  gas: GAS_STORAGE_KEY,
  electricity: ELECTRICITY_STORAGE_KEY,
  water: WATER_KEY,
  car: CAR_KEY,
  subscriptions: SUBSCRIPTIONS_KEY,
};

export function readSources() {
  const errors: Category[] = [];
  function read<T>(
    id: Category,
    validate: (data: unknown) => data is T,
    migrate = (data: unknown) => data,
  ) {
    try {
      const raw = localStorage.getItem(keys[id]);
      if (raw === null) return null;
      const data = migrate(JSON.parse(raw));
      if (validate(data)) return data;
    } catch {
      // Leave unreadable data untouched.
    }
    errors.push(id);
    return null;
  }
  return {
    gas: read("gas", validGas, migrateGas),
    electricity: read("electricity", validState, migrateState),
    water: read("water", validWater, migrateWater),
    car: read("car", validCar, migrateCar),
    subscriptions: read("subscriptions", validSubscriptions),
    errors,
  };
}

export type Sources = ReturnType<typeof readSources>;
type Amount = {
  value: number | null;
  partial?: boolean;
  fromAnnualEstimate?: boolean;
  coveredDays?: number;
  meters?: { included: number; expected: number };
};
const missing: Amount = { value: null };

export type MonthReport = {
  month: string;
  costs: Record<Category, Amount>;
  total: number | null;
};

function meterAt<T extends { date: string }>(
  ordered: readonly T[],
  date: string,
  interpolate: (before: T, after: T, share: number) => T,
) {
  const index = ordered.findIndex((reading) => reading.date >= date);
  const after = ordered[index];
  if (after?.date === date) return after;
  const before = ordered[index - 1];
  if (!before || !after) return null;
  return interpolate(
    before,
    after,
    days(before.date, date) / days(before.date, after.date),
  );
}

function gasMonth(
  state: AppState,
  start: string,
  end: string,
  current: boolean,
): Amount {
  if (start < "2024-08-01") return missing;
  const { readings, settings, stats, billing } = state;
  const sorted = sortByDate(readings);
  const at = (date: string) =>
    meterAt(sorted, date, (a, b, share) => ({
      id: "",
      date,
      value: a.value + (b.value - a.value) * share,
    }));
  const opening = at(start);
  const closing = at(end);
  const matching = start === billing.start && end === billing.end;
  const volume =
    opening && closing
      ? closing.value - opening.value
      : matching || current
        ? calculateBilling(settings, readings, { ...billing, start, end })
            .consumption
        : null;
  const estimate = gasCost(
    volume,
    allowanceBetween(start, end, billing.mode),
    settings,
    stats,
    baseBetween(start, end, stats.annualBase),
  );
  return {
    value: estimate?.total ?? null,
    fromAnnualEstimate:
      !(opening && closing) && billing.mode !== "reading" && volume !== null,
  };
}

function electricityMonth(
  points: ElectricityPoint[],
  start: string,
  end: string,
  current: boolean,
): Amount {
  let sum = 0;
  let count = 0;
  let missed = 0;
  let fromAnnualEstimate = false;
  for (const point of points) {
    const first = point.eligibleFrom > start ? point.eligibleFrom : start;
    const last =
      point.eligibleTo && point.eligibleTo < end ? point.eligibleTo : end;
    if (last <= first) continue;
    const matching = point.billing.start === start && point.billing.end === end;
    let value = matching ? periodResult(point).total : null;
    let annual = value !== null && point.billing.schedule === "flat";
    if (value === null) {
      const readings = sortByDate(point.readings);
      const at = (date: string) =>
        meterAt(readings, date, (a, b, share) => ({
          id: "",
          date,
          peak: a.peak + (b.peak - a.peak) * share,
          off:
            a.off === null || b.off === null
              ? null
              : a.off + (b.off - a.off) * share,
        }));
      const opening = at(first);
      const closing = at(last);
      if (opening && closing) {
        const bounds = [
          opening,
          ...readings.filter(
            (reading) => reading.date > first && reading.date < last,
          ),
          closing,
        ];
        value = cost(
          point,
          first,
          last,
          measured({ ...point, readings: bounds }, first, last),
          matching ? point.billing.credit : 0,
        ).total;
      }
    }
    if (value === null && current && point.billing.schedule === "flat") {
      value = periodResult(point, start, end).total;
      annual = value !== null;
    }
    if (value === null) missed++;
    else {
      sum += value;
      count++;
      fromAnnualEstimate ||= annual;
    }
  }
  return {
    value: count ? sum : null,
    partial: count > 0 && missed > 0,
    meters: { included: count, expected: count + missed },
    fromAnnualEstimate,
  };
}

function sumKnown(values: (number | null)[]) {
  const known = values.filter((value) => value !== null);
  return known.length ? known.reduce((sum, value) => sum + value, 0) : null;
}

export function reports(
  sources: Sources,
  year: number,
  now = today(),
): MonthReport[] {
  const current = now.slice(0, 7);
  const count = year === Number(now.slice(0, 4)) ? Number(now.slice(5, 7)) : 12;
  const waterUsage = waterIntervals(sources.water?.readings ?? []);
  const carEntries = sources.car?.cars.flatMap((car) => car.entries) ?? [];
  return Array.from({ length: count }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    const { start, end } = monthPeriod(`${month}-01`);
    const car = carEntries.filter((item) => item.date.startsWith(month));
    const recurring =
      sources.subscriptions?.filter((item) => activeIn(item, month)) ?? [];
    const costs: MonthReport["costs"] = {
      gas: sources.gas
        ? gasMonth(sources.gas, start, end, month === current)
        : missing,
      electricity: sources.electricity
        ? electricityMonth(
            sources.electricity.points,
            start,
            end,
            month === current,
          )
        : missing,
      water: sources.water
        ? (estimateWaterMonth(sources.water, waterUsage, start, end) ?? missing)
        : missing,
      car: { value: sumKnown(car.map((item) => item.paid)) },
      subscriptions: { value: sumKnown(recurring.map((item) => item.fee)) },
    };
    return {
      month,
      costs,
      total: sumKnown(categoryIds.map((id) => costs[id].value)),
    };
  });
}

export function reportYears(sources: Sources, now = today()) {
  const current = Number(now.slice(0, 4));
  const dates = [
    now,
    sources.gas?.billing.start,
    ...(sources.gas?.readings.map((item) => item.date) ?? []),
    ...(sources.electricity?.points.flatMap((point) => [
      point.billing.start,
      ...point.readings.map((item) => item.date),
    ]) ?? []),
    ...(sources.water?.months.map((item) => item.month) ?? []),
    ...(sources.water?.readings.map((item) => item.date) ?? []),
    ...(sources.car?.cars.flatMap((car) =>
      car.entries.map((item) => item.date),
    ) ?? []),
    ...(sources.subscriptions?.map((item) => item.start) ?? []),
  ];
  const earliest = dates.reduce(
    (year, date) => (date ? Math.min(year, Number(date.slice(0, 4))) : year),
    current,
  );
  return Array.from(
    { length: current - earliest + 1 },
    (_, index) => current - index,
  );
}

export function summarize(rows: MonthReport[]) {
  const costs = categoryIds.map((id) => {
    const amounts = rows.map((row) => row.costs[id]);
    return {
      id,
      value: sumKnown(amounts.map((item) => item.value)),
      known: amounts.filter((item) => item.value !== null).length,
      partial: amounts.some((item) => item.partial),
    };
  });
  return { costs, total: sumKnown(costs.map((item) => item.value)) };
}
