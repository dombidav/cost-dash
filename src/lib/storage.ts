import { ui } from './ui.svelte';
export function storage<T>(key: string, initial: () => T, validate: (value: unknown) => value is T, migrate?: (value: unknown) => unknown) {
  let data = initial(), warning = '', locked = false;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const parsed = migrate ? migrate(JSON.parse(raw)) : JSON.parse(raw);
      if (!validate(parsed)) throw new Error('invalid local data');
      data = parsed;
    }
  } catch {
    locked = true; warning = 'A korábbi helyi adat nem olvasható, vagy a tárhely nem érhető el. A tárolt adatot nem írjuk felül. Az új módosítások ebben a munkamenetben működnek, de nem mentődnek.';
    ui.status = 'A helyi mentés nem működik'; ui.storageError = true;
  }
  return {
    data,
    get warning() { return warning; },
    lock() { locked = true; },
    save(value: T) {
      if (locked) return false;
      try { localStorage.setItem(key, JSON.stringify(value)); ui.status = 'Minden módosítás mentve'; ui.storageError = false; return true; }
      catch { ui.status = 'A helyi mentés sikertelen'; ui.storageError = true; return false; }
    },
  };
}
