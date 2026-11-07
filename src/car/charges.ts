import { monthDays, validDate } from "../calendar";
import { nonnegative, shiftMonth } from "../lib/months";

export const chargeNames = {
  liability: "Kötelező biztosítás (KGFB)",
  casco: "Casco",
  tax: "Gépjárműadó",
} as const;
export type ChargeKind = keyof typeof chargeNames;
export const frequencies = {
  1: "Havi",
  3: "Negyedéves",
  6: "Féléves",
  12: "Éves",
} as const;
export type Charge = {
  kind: ChargeKind;
  firstDue: string;
  amount: number;
  months: keyof typeof frequencies;
};

export function validCharges(value: unknown): value is Charge[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item: Charge) =>
        item &&
        Object.hasOwn(chargeNames, item.kind) &&
        validDate(item.firstDue) &&
        nonnegative(item.amount) &&
        (item.kind === "tax"
          ? item.months === 12
          : item.amount > 0 &&
            typeof item.months === "number" &&
            Object.hasOwn(frequencies, item.months)),
    ) &&
    new Set(value.map((item: Charge) => item.kind)).size === value.length
  );
}

export function nextChargeDue(charge: Charge, from: string) {
  if (charge.firstDue >= from) return charge.firstDue;
  const firstMonth = charge.firstDue.slice(0, 7);
  const day = Number(charge.firstDue.slice(8));
  const monthIndex = (date: string) =>
    Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
  const elapsedMonths = monthIndex(from) - monthIndex(firstMonth);
  const offset = Math.ceil(elapsedMonths / charge.months) * charge.months;
  const dueAt = (offset: number) => {
    const month = shiftMonth(firstMonth, offset);
    const dueDay = Math.min(day, monthDays(`${month}-01`));
    return `${month}-${String(dueDay).padStart(2, "0")}`;
  };
  const due = dueAt(offset);
  return due < from ? dueAt(offset + charge.months) : due;
}
