import { validDate } from "../calendar";

const format = new Intl.DateTimeFormat("hu-HU", {
  year: "numeric",
  month: "long",
  timeZone: "UTC",
});

export const validMonth = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}$/.test(value) &&
  validDate(`${value}-01`);

export const monthLabel = (month: string) =>
  format.format(new Date(`${month}-01T00:00:00Z`));

export function shiftMonth(month: string, offset: number) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export const nonnegative = (value: unknown, max = 1e9): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= max;
