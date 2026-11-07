import { days, monthPeriod, sortByDate } from "../calendar";
import { periodResult, total } from "../electricity/calculator";
import { estimateWaterMonth, waterIntervals } from "../water/state";
import { meterAt, type MonthReport, type Sources } from "./data";

export const utilities = {
  gas: "m³",
  electricity: "kWh",
  water: "m³",
} as const;
export type Utility = keyof typeof utilities;

type Usage = {
  volume: number;
  coveredDays: number;
  partial?: boolean;
  daily?: number | null;
};

function fromReadings(
  ordered: { date: string; value: number }[],
  start: string,
  end: string,
): Usage | null {
  const first = ordered[0];
  const last = ordered.at(-1);
  if (!first || !last) return null;
  const from = start > first.date ? start : first.date;
  const to = end < last.date ? end : last.date;
  if (from >= to) return null;
  const at = (date: string) =>
    meterAt(ordered, date, (a, b, share) => ({
      date,
      value: a.value + (b.value - a.value) * share,
    }));
  const opening = at(from);
  const closing = at(to);
  return opening && closing
    ? { volume: closing.value - opening.value, coveredDays: days(from, to) }
    : null;
}

function electricityUsage(
  meters: ReturnType<typeof electricityReadings>,
  start: string,
  end: string,
): Usage | null {
  const active = meters.flatMap(({ point, readings }) => {
    const from = point.eligibleFrom > start ? point.eligibleFrom : start;
    const to =
      point.eligibleTo && point.eligibleTo < end ? point.eligibleTo : end;
    if (from >= to) return [];
    const expectedDays = days(from, to);
    let usage = fromReadings(readings, from, to);
    const billing = point.billing;
    if (
      (!usage || usage.coveredDays < expectedDays) &&
      from === start &&
      to === end &&
      billing.start === start &&
      billing.end === end &&
      billing.schedule !== "flat" &&
      billing.source === "period"
    ) {
      const volume = periodResult(point).volume;
      if (volume !== null) usage = { volume, coveredDays: expectedDays };
    }
    return [{ expectedDays, usage }];
  });
  const known = active.flatMap(({ usage }) => (usage ? [usage] : []));
  if (!known.length) return null;
  const volume = known.reduce((sum, item) => sum + item.volume, 0);
  const partial = active.some(
    ({ usage, expectedDays }) => usage?.coveredDays !== expectedDays,
  );
  const coveredDays =
    active.length === 1 ? known[0].coveredDays : days(start, end);
  return {
    volume,
    coveredDays,
    partial,
    daily: active.length > 1 && partial ? null : volume / coveredDays,
  };
}

function electricityReadings(sources: Sources) {
  return (sources.electricity?.points ?? []).map((point) => ({
    point,
    readings: sortByDate(point.readings).flatMap((reading) => {
      const value = total(point, reading);
      return value === null ? [] : [{ date: reading.date, value }];
    }),
  }));
}

export function utilityMonths(
  sources: Sources,
  rows: MonthReport[],
  id: Utility,
) {
  const gas = id === "gas" ? sortByDate(sources.gas?.readings ?? []) : [];
  const meters = id === "electricity" ? electricityReadings(sources) : [];
  const water =
    id === "water" ? waterIntervals(sources.water?.readings ?? []) : [];
  return rows.map((row) => {
    const { start, end } = monthPeriod(row.month);
    const usage: Usage | null =
      id === "gas"
        ? fromReadings(gas, start, end)
        : id === "electricity"
          ? electricityUsage(meters, start, end)
          : sources.water
            ? estimateWaterMonth(sources.water, water, start, end)
            : null;
    return {
      month: row.month,
      cost: row.costs[id].value,
      costPartial: row.costs[id].partial ?? false,
      volume: usage?.volume ?? null,
      daily: usage
        ? usage.daily === undefined
          ? usage.volume / usage.coveredDays
          : usage.daily
        : null,
      usagePartial: usage
        ? (usage.partial ?? usage.coveredDays < days(start, end))
        : false,
    };
  });
}
