export type Tariff =
  "A1" | "A2" | "B_BASIC" | "B_COMFORT" | "H" | "B_GEO" | "D";
export type Area = "demasz" | "eon" | "elmu" | "emasz";
export type Schedule = "flat" | "actual" | "prepaid";
export interface ElectricityReading {
  id: string;
  date: string;
  peak: number;
  off: number | null;
}
export interface Rates {
  low: number;
  second: number;
  market: number | null;
  monthlyBase: number;
  effective: string;
}
export interface ElectricityPoint {
  id: string;
  name: string;
  area: Area;
  tariff: Tariff;
  rates: Rates;
  eligibleFrom: string;
  eligibleTo: string;
  extraAnnual: number;
  extraFrom: string;
  extraTo: string;
  annualEstimate: string;
  consumptionProfile?: "steady" | "summer" | "winter";
  offPercent: number;
  heatingPercent: number;
  solar: "none" | "gross" | "balance";
  billing: {
    schedule: Schedule;
    metering: "manual" | "smart";
    source: "readings" | "period";
    start: string;
    end: string;
    peak: string;
    off: string;
    credit: number;
    balance: string;
  };
  readings: ElectricityReading[];
  draft: { date: string; peak: string; off: string };
}
export interface ElectricityState {
  version: 1;
  selected: string;
  year: number;
  points: ElectricityPoint[];
  annualEstimateDefaultVersion?: 1;
  aggregate: { start: string; end: string };
  stats: {
    people: string;
    floorArea: string;
    region: string;
    saving: number;
    deviceWatts: number;
    dailyHours: number;
  };
}
export interface DailyConsumption {
  date: string;
  peak: number;
  off: number;
}
