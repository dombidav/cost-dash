export interface Settings { heat: number; correction: number }
export interface Reading { id: string; date: string; value: number }
export type BillingMode = 'flat' | 'reading' | 'temperature';
export interface Billing {
  mode: BillingMode;
  annualEstimate: string;
  start: string;
  end: string;
  weights: number[];
}
export interface StatisticsSettings {
  low: number;
  high: number;
  annualBase: number;
  effective: string;
  area: number | null;
  region: string;
  savingPercent: number;
  heaterPower: number;
  efficiency: number;
}
export interface AppState {
  version: 1;
  settings: Settings;
  readings: Reading[];
  draft: { value: string; date: string };
  year: number;
  billing: Billing;
  stats: StatisticsSettings;
}
