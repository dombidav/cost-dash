export function fmt(
  value: number | null | undefined,
  digits = 1,
  minimumDigits = digits,
) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : new Intl.NumberFormat("hu-HU", {
        minimumFractionDigits: minimumDigits,
        maximumFractionDigits: digits,
      }).format(value);
}
export const money = (value: number | null | undefined) =>
  `${fmt(value, 0)} Ft`;
export const signed = (
  value: number | null,
  digits = 1,
  minimumDigits = digits,
) =>
  value === null
    ? "—"
    : `${value > 0 ? "+" : ""}${fmt(value, digits, minimumDigits)}%`;
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
