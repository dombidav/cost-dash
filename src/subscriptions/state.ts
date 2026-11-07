import { nonnegative, validMonth } from "../lib/months";

export const SUBSCRIPTIONS_KEY = "rezsipont.subscriptions.v1";
export type Subscription = {
  id: string;
  name: string;
  fee: number;
  start: string;
  end: string;
};
export const initialSubscriptions = (): Subscription[] => [];

export function validSubscription(item: Subscription) {
  return (
    !!item &&
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    item.name.trim().length > 0 &&
    item.name.length <= 80 &&
    nonnegative(item.fee) &&
    item.fee > 0 &&
    validMonth(item.start) &&
    (item.end === "" || (validMonth(item.end) && item.end >= item.start))
  );
}

export function validSubscriptions(value: unknown): value is Subscription[] {
  return (
    Array.isArray(value) &&
    value.every(validSubscription) &&
    new Set(value.map((item) => item.id)).size === value.length
  );
}

export const activeIn = (item: Subscription, month: string) =>
  item.start <= month && (!item.end || month <= item.end);
