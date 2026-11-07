import {
  defaultBilling,
  validateBilling,
  validateReading,
} from "../calculator";
import { today, validDate, yearFor } from "../calendar";
import { defaultStatistics, validateStatistics } from "../statistics";
import type { AppState } from "../types";
export function initialGas(): AppState {
  return {
    version: 1,
    settings: { heat: 34.8, correction: 1 },
    readings: [],
    draft: { value: "", date: today() },
    year: yearFor(today()),
    billing: defaultBilling(),
    stats: defaultStatistics(),
  };
}
export function migrateGas(data: unknown) {
  if (
    data &&
    typeof data === "object" &&
    "version" in data &&
    data.version === 1
  ) {
    if (!Object.hasOwn(data, "billing"))
      Object.assign(data, { billing: defaultBilling() });
    if (!Object.hasOwn(data, "stats"))
      Object.assign(data, { stats: defaultStatistics() });
  }
  return data;
}
export function validGas(data: unknown): data is AppState {
  try {
    const s = data as AppState;
    if (
      !s ||
      s.version !== 1 ||
      !s.settings ||
      !Number.isFinite(s.settings.heat) ||
      s.settings.heat <= 0 ||
      s.settings.heat > 100 ||
      !Number.isFinite(s.settings.correction) ||
      s.settings.correction <= 0 ||
      s.settings.correction > 10 ||
      !Array.isArray(s.readings) ||
      !s.draft ||
      typeof s.draft.value !== "string" ||
      !validDate(s.draft.date) ||
      !Number.isInteger(s.year) ||
      s.year < 1899 ||
      s.year > 9998
    )
      return false;
    if (
      new Set(s.readings.map((r) => r.id)).size !== s.readings.length ||
      s.readings.some(
        (r) => !r || typeof r.id !== "string" || validateReading(r, s.readings),
      )
    )
      return false;
    return !validateBilling(s.billing) && !validateStatistics(s.stats);
  } catch {
    return false;
  }
}
