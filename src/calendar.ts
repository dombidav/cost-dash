export const DAY = 86400000;
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const d = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(d.getTime()) &&
    d.toISOString().slice(0, 10) === value &&
    value >= "1900-01-01"
  );
}
export function parseNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value !== "string") return NaN;
  const text = value.replace(/\s/g, "").replace(",", ".");
  return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) ? Number(text) : NaN;
}
export function addDays(date: string, days: number) {
  return new Date(Date.parse(date) + days * DAY).toISOString().slice(0, 10);
}
export function days(start: string, end: string) {
  return (Date.parse(end) - Date.parse(start)) / DAY;
}
export function yearFor(date: string) {
  return Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 8 ? 1 : 0);
}
export function yearPeriod(year: number) {
  const start = `${year}-08-01`,
    end = `${year + 1}-08-01`;
  return { start, end, days: days(start, end) };
}
export function monthDays(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
}
export function monthPeriod(date = today()) {
  const start = `${date.slice(0, 7)}-01`;
  const end = addDays(start, monthDays(start));
  return { start, end };
}
export function sortByDate<T extends { date: string }>(items: readonly T[]) {
  return [...items].sort((a, b) => a.date.localeCompare(b.date));
}
export function previousYear(date: string) {
  const y = Number(date.slice(0, 4)) - 1,
    m = Number(date.slice(5, 7));
  return `${y}-${String(m).padStart(2, "0")}-${String(Math.min(Number(date.slice(8, 10)), new Date(Date.UTC(y, m, 0)).getUTCDate())).padStart(2, "0")}`;
}
