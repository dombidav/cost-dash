import { migrateCar, validCar } from "../car/state";
import { migrateState, validState } from "../electricity/calculator";
import { migrateGas, validGas } from "../gas/state";
import { validSubscriptions } from "../subscriptions/state";
import { migrateWater, validWater } from "../water/state";
import { sourceKeys, type Sources } from "./data";
import { BUDGET_KEY, validBudget } from "./state";

export type AppBackup = Omit<Sources, "errors"> & { budget: number | null };
const keys = { ...sourceKeys, budget: BUDGET_KEY };
const ids = Object.keys(keys) as (keyof AppBackup)[];

export function parseAppBackup(value: unknown): AppBackup | null {
  if (!value || typeof value !== "object") return null;
  const data = value as AppBackup;
  if (ids.some((id) => !Object.hasOwn(data, id))) return null;
  try {
    const gas = migrateGas(data.gas);
    const electricity = migrateState(data.electricity);
    const water = migrateWater(data.water);
    const car = migrateCar(data.car);
    if (
      (gas !== null && !validGas(gas)) ||
      (electricity !== null && !validState(electricity)) ||
      (water !== null && !validWater(water)) ||
      (car !== null && !validCar(car)) ||
      (data.subscriptions !== null &&
        !validSubscriptions(data.subscriptions)) ||
      !validBudget(data.budget)
    )
      return null;
    return {
      gas,
      electricity,
      water,
      car,
      subscriptions: data.subscriptions,
      budget: data.budget,
    } as AppBackup;
  } catch {
    return null;
  }
}

export function readAppBackup(): AppBackup {
  try {
    const values = Object.fromEntries(
      ids.map((id) => {
        const raw = localStorage.getItem(keys[id]);
        return [id, raw === null ? null : JSON.parse(raw)];
      }),
    );
    const data = parseAppBackup(values);
    if (data) return data;
  } catch {
    // Never turn unreadable data into an empty backup.
  }
  throw new Error(
    "A teljes mentéshez minden helyi adatnak olvashatónak kell lennie. Ellenőrizd az oldalak mentési figyelmeztetéseit.",
  );
}

export function restoreAppBackup(data: AppBackup) {
  const parsed = parseAppBackup(data);
  if (!parsed) throw new Error("A teljes mentés érvénytelen adatot tartalmaz.");
  readAppBackup();
  const previous = ids.map((id) => localStorage.getItem(keys[id]));
  const next = ids.map((id) =>
    parsed[id] === null ? null : JSON.stringify(parsed[id]),
  );
  const written: number[] = [];
  const write = (index: number, raw: string | null) => {
    const key = keys[ids[index]];
    if (raw === null) localStorage.removeItem(key);
    else localStorage.setItem(key, raw);
  };
  try {
    ids.forEach((_, index) => {
      if (previous[index] === next[index]) return;
      if (localStorage.getItem(keys[ids[index]]) !== previous[index])
        throw new Error("A helyi adatok másik lapon megváltoztak.");
      write(index, next[index]);
      written.push(index);
    });
  } catch {
    let rolledBack = true;
    for (const index of written.reverse()) {
      try {
        if (localStorage.getItem(keys[ids[index]]) !== next[index])
          throw new Error("Concurrent change");
        write(index, previous[index]);
      } catch {
        rolledBack = false;
      }
    }
    throw new Error(
      rolledBack
        ? "A teljes mentést nem sikerült eltárolni. A korábbi adatok megmaradtak. Ellenőrizd a szabad böngészőtárhelyet és a többi megnyitott lapot."
        : "A visszaállítás megszakadt, és nem minden korábbi adat állítható vissza. Őrizd meg a PDF-et, és töltsd újra az oldalt az adatok ellenőrzéséhez.",
    );
  }
}
