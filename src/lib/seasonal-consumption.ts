import { days, monthPeriod } from "../calendar";

export function monthlyProfile(weights: readonly number[]) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return (start: string, end: string) => {
    let share = 0;
    for (let date = start; date < end;) {
      const month = monthPeriod(date);
      const stop = month.end < end ? month.end : end;
      const index = Number(date.slice(5, 7)) - 1;
      share +=
        (weights[index] / total) *
        (days(date, stop) / days(month.start, month.end));
      date = stop;
    }
    return share;
  };
}
export const evenMonthlyProfile = monthlyProfile(Array<number>(12).fill(1));

export function estimateOpening(
  start: string,
  first: { date: string; value: number } | undefined,
  previous: { date: string; value: number } | undefined,
  tracked: { end: string; volume: number } | null,
  share: (start: string, end: string) => number,
  annualEstimate: number,
) {
  if (!first || first.date <= start) return null;
  const gap = share(start, first.date);
  let volume: number;
  let basis: "bracket" | "readings" | "annual";
  if (previous) {
    const weight = share(previous.date, first.date);
    const ratio =
      weight > 0
        ? gap / weight
        : evenMonthlyProfile(start, first.date) /
          evenMonthlyProfile(previous.date, first.date);
    volume = (first.value - previous.value) * ratio;
    basis = "bracket";
  } else {
    const observed = tracked ? share(first.date, tracked.end) : 0;
    if (tracked && observed > 0) {
      volume = (tracked.volume * gap) / observed;
      basis = "readings";
    } else if (Number.isFinite(annualEstimate)) {
      volume = annualEstimate * gap;
      basis = "annual";
    } else return null;
  }
  return {
    start,
    end: first.date,
    volume: Math.min(first.value, Math.max(0, volume)),
    basis,
  };
}

export function openingExplanation(
  estimate: ReturnType<typeof estimateOpening>,
  lateEligibility = false,
) {
  const start = lateEligibility
    ? "a jogosultság kezdetén"
    : "a kedvezményes év kezdetén";
  if (!estimate)
    return `Nincs mérés ${start}. A becsléshez további mérés vagy megadott éves fogyasztás kell.`;
  const basis = {
    bracket: "a kezdőnapot közrefogó két mérésből",
    readings: "a későbbi mérésekből",
    annual: "az éves fogyasztási beállításból",
  }[estimate.basis];
  return `Nincs mérés ${start}. A hiányzó fogyasztást (${estimate.start} – ${estimate.end}) ${basis}, havi súlyozással becsültük.`;
}
