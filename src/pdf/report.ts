import { fmt } from "../lib/format";

export interface ReportStatistics {
  note?: string;
  rows: [label: string, value: string][];
}

export interface ReportMeter {
  name: string;
  tariff?: string;
  statistics?: ReportStatistics;
  columns: string[];
  readings: string[][];
  columnWeights?: number[];
  alignments?: ("left" | "right")[];
  emptyMessage?: string;
  tableTitle?: string;
}

export interface Report {
  category: string;
  period?: string;
  summary?: ReportStatistics;
  meters: ReportMeter[];
  title?: string;
  periodLabel?: string;
  summaryTitle?: string;
  note?: string;
}

export function quantity(
  value: number | null | undefined,
  unit = "",
  digits = 1,
) {
  if (value == null || !Number.isFinite(value)) return "-";
  return [fmt(value, digits), unit].filter(Boolean).join(" ");
}
