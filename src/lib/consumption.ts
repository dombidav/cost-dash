import { days } from "../calendar";

export function consumptionInterval(
  start: string,
  end: string,
  volume: number,
) {
  const length = days(start, end);
  return length > 0
    ? { start, end, days: length, volume, average: volume / length }
    : null;
}

export function percentChange(current: number, previous: number) {
  if (previous > 0) return (current / previous - 1) * 100;
  return current === 0 ? 0 : null;
}
