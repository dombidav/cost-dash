import { M } from '../calculator';
import { S } from '../statistics';
import type { AppState } from '../types';
export function initialGas(): AppState { return { version: 1, settings: { heat: 34.8, correction: 1 }, readings: [], draft: { value: '', date: M.today() }, year: M.yearFor(M.today()), billing: M.defaultBilling(), stats: S.defaults() }; }
export function migrateGas(data: unknown) {
  if (data && typeof data === 'object' && 'version' in data && data.version === 1) {
    if (!Object.hasOwn(data, 'billing')) Object.assign(data, { billing: M.defaultBilling() });
    if (!Object.hasOwn(data, 'stats')) Object.assign(data, { stats: S.defaults() });
  }
  return data;
}
export function validGas(data: unknown): data is AppState {
  try {
    const s = data as AppState;
    if (!s || s.version !== 1 || !s.settings || !Number.isFinite(s.settings.heat) || s.settings.heat <= 0 || s.settings.heat > 100 || !Number.isFinite(s.settings.correction) || s.settings.correction <= 0 || s.settings.correction > 10 || !Array.isArray(s.readings) || !s.draft || typeof s.draft.value !== 'string' || !M.validDate(s.draft.date) || !Number.isInteger(s.year) || s.year < 1899 || s.year > 9998) return false;
    if (new Set(s.readings.map(r => r.id)).size !== s.readings.length || s.readings.some(r => !r || typeof r.id !== 'string' || M.validateReading(r, s.readings))) return false;
    return !M.validateBilling(s.billing) && !S.validate(s.stats);
  } catch { return false; }
}
