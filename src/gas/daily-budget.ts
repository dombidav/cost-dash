import type { calculateGasYear } from "../calculator";
import { addDays, days, parseNumber, today } from "../calendar";
import { monthlyProfile } from "../lib/seasonal-consumption";
import type { AppState } from "../types";

// Planning target for [date, date + 1), using the selected year's remaining budget.
// The editable consumption profile is independent of billing mode and allowances.
export function calculateDailyBudget(
  { billing }: AppState,
  annual: ReturnType<typeof calculateGasYear>,
  date = today(),
) {
  if (date < annual.start || date >= annual.next)
    return { status: "outside-year" as const, date };
  if (
    annual.remaining === null ||
    !annual.first ||
    !annual.last ||
    annual.last.date > date
  )
    return { status: "missing-readings" as const, date };

  const profile = monthlyProfile(billing.weights);
  const remainingShare = profile(date, annual.next);
  if (remainingShare <= 0) return { status: "missing-profile" as const, date };

  const elapsedShare = profile(annual.last.date, date);
  let sinceReading: number | null =
    elapsedShare > 0 && annual.remaining === 0 ? null : 0;
  let basis: "readings" | "annual" | "none" = "none";
  if (elapsedShare > 0 && annual.remaining > 0) {
    const observedShare = profile(annual.first.date, annual.last.date);
    let pace: number;
    if (observedShare > 0) {
      pace = (annual.last.value - annual.first.value) / observedShare;
      basis = "readings";
    } else {
      pace = parseNumber(billing.annualEstimate);
      if (!Number.isFinite(pace))
        return { status: "missing-pace" as const, date };
      basis = "annual";
    }
    sinceReading = pace * elapsedShare;
  }
  const remaining = Math.max(0, annual.remaining - (sinceReading ?? 0));
  const dailyShare = profile(date, addDays(date, 1));
  return {
    status: "ready" as const,
    date,
    daily: remaining * (dailyShare / remainingShare),
    remaining,
    sinceReading,
    basis,
    readingDate: annual.last.date,
    elapsedDays: days(annual.last.date, date),
    remainingDays: days(date, annual.next),
    estimatedOpening: !!annual.opening,
  };
}
