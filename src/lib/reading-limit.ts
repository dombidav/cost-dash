import { sortByDate } from "../calendar";

export const READING_LIMIT = 120;

export function trimReadings<T extends { date: string }>(groups: T[][]) {
  const readings = groups.flat();
  const excess = readings.length - READING_LIMIT;
  if (excess <= 0) return 0;

  const removed = new Set(sortByDate(readings).slice(0, excess));
  for (const group of groups) {
    const retained = group.filter((reading) => !removed.has(reading));
    if (retained.length < group.length)
      group.splice(0, group.length, ...retained);
  }
  return excess;
}
