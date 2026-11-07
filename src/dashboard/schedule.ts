import { addDays } from "../calendar";
import { chargeNames, nextChargeDue } from "../car/charges";
import { shiftMonth } from "../lib/months";
import { activeIn } from "../subscriptions/state";
import type { Sources } from "./data";

export function carPayments(sources: Sources, start: string, end: string) {
  return (sources.car?.cars ?? [])
    .flatMap((car) =>
      (car.charges ?? []).flatMap((charge) => {
        if (charge.amount === 0) return [];
        const payments = [];
        for (
          let due = nextChargeDue(charge, start);
          due < end;
          due = nextChargeDue(charge, addDays(due, 1))
        ) {
          payments.push({
            id: `${car.id}-${charge.kind}-${due}`,
            name: chargeNames[charge.kind],
            car: car.name,
            due,
            amount: charge.amount,
          });
        }
        return payments;
      }),
    )
    .sort((a, b) => a.due.localeCompare(b.due));
}

export function subscriptionMonths(
  sources: Sources,
  start: string,
  end: string,
) {
  const months = [];
  for (
    let month = start.slice(0, 7);
    `${month}-01` < end;
    month = shiftMonth(month, 1)
  ) {
    const items = (sources.subscriptions ?? []).filter((item) =>
      activeIn(item, month),
    );
    if (items.length) months.push({ month, items });
  }
  return months;
}
