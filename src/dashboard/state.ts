import { nonnegative } from "../lib/months";

export const BUDGET_KEY = "rezsipont.dashboard.budget.v1";
export const validBudget = (value: unknown): value is number | null =>
  value === null || (nonnegative(value) && value > 0);
