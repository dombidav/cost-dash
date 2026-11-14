import { ui } from "./ui.svelte";
import { photoIds } from "./photos";
import { schedulePhotoCleanup } from "./photo-cleanup";
export function storage<T>(
  key: string,
  initial: () => T,
  validate: (value: unknown) => value is T,
  migrate?: (value: unknown) => unknown,
) {
  let data = initial();
  let warning = $state("");
  let locked = false;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const saved: unknown = JSON.parse(raw);
      const parsed = migrate ? migrate(saved) : saved;
      photoIds(parsed);
      if (!validate(parsed)) throw new Error("invalid local data");
      data = parsed;
    }
  } catch {
    locked = true;
    warning =
      "A korábbi helyi adat nem olvasható, vagy a tárhely nem érhető el. A tárolt adatot nem írjuk felül. Az új módosítások ebben a munkamenetben működnek, de nem mentődnek.";
    ui.status = "A helyi mentés nem működik";
    ui.storageError = true;
  }
  return {
    data,
    get warning() {
      return warning;
    },
    onStorage(event: StorageEvent) {
      if (event.key !== null && event.key !== key) return;
      locked = true;
      warning =
        "Az adatok másik böngészőlapon megváltoztak. Töltsd újra az oldalt a mentés folytatásához.";
      ui.status = "Újratöltés szükséges";
      ui.storageError = true;
    },
    save(value: T) {
      if (locked) return false;
      try {
        photoIds(value);
        localStorage.setItem(key, JSON.stringify(value));
        schedulePhotoCleanup(() => ui.undo !== null);
        ui.status = "Minden módosítás mentve";
        ui.storageError = false;
        return true;
      } catch {
        ui.status = "A helyi mentés sikertelen";
        ui.storageError = true;
        return false;
      }
    },
  };
}
