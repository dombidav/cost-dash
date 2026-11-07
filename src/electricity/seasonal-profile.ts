import { yearFor, yearPeriod } from "../calendar";
import {
  evenMonthlyProfile as steady,
  monthlyProfile,
} from "../lib/seasonal-consumption";
import type { ElectricityPoint } from "./types";

export const consumptionProfiles = {
  steady: {
    label: "Közel egyenletes",
    weights: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  summer: {
    label: "Nyáron több · például klímával",
    weights: [1, 1, 1, 1, 1, 1.4, 1.8, 1.8, 1.3, 1, 1, 1],
  },
  winter: {
    label: "Télen több · például villanyfűtéssel",
    weights: [2, 1.8, 1.5, 1.2, 1, 1, 1, 1, 1, 1.2, 1.5, 1.8],
  },
};

const winter = monthlyProfile(consumptionProfiles.winter.weights);
const heatingStart = "10-15";
const heatingEnd = "04-16";

export function heating(date: string) {
  const monthAndDay = date.slice(5);
  return monthAndDay >= heatingStart || monthAndDay < heatingEnd;
}

export function electricityProfile(point: ElectricityPoint) {
  if (point.tariff !== "H") {
    const name =
      point.consumptionProfile ??
      (point.tariff === "B_GEO" ? "winter" : "steady");
    return monthlyProfile(consumptionProfiles[name].weights);
  }
  const heatingFraction = point.heatingPercent / 100;
  const seasons = new Map<
    number,
    {
      stop: string;
      heatStart: string;
      heatEnd: string;
      normalShare: number;
      winterShare: number;
    }
  >();
  return (start: string, end: string, normalOnly = false) => {
    let share = 0;
    for (let from = start; from < end;) {
      const year = yearFor(from);
      let season = seasons.get(year);
      if (!season) {
        const heatStart = `${year}-${heatingStart}`;
        const heatEnd = `${year + 1}-${heatingEnd}`;
        season = {
          stop: yearPeriod(year).end,
          heatStart,
          heatEnd,
          normalShare: 1 - steady(heatStart, heatEnd),
          winterShare: winter(heatStart, heatEnd),
        };
        seasons.set(year, season);
      }
      const { stop, heatStart, heatEnd, normalShare, winterShare } = season;
      const to = end < stop ? end : stop;
      const fromHeat = from > heatStart ? from : heatStart;
      const toHeat = to < heatEnd ? to : heatEnd;
      const normal = Math.max(0, steady(from, to) - steady(fromHeat, toHeat));
      share += ((1 - heatingFraction) * normal) / normalShare;
      if (!normalOnly)
        share += (heatingFraction * winter(fromHeat, toHeat)) / winterShare;
      from = to;
    }
    return share;
  };
}
