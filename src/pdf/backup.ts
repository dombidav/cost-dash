import { photoIds } from "../lib/photos";

export const backupCategories = {
  gas: { label: "Gáz", slug: "gaz" },
  electricity: { label: "Áram", slug: "aram" },
  water: { label: "Víz", slug: "viz" },
  car: { label: "Autó", slug: "auto" },
  subscriptions: { label: "Havidíjak", slug: "havidijak" },
  dashboard: { label: "Dashboard", slug: "teljes-mentes" },
} as const;
export type Category = keyof typeof backupCategories;

export const ATTACHMENT_NAME = "rezsipont-adatok.json";
const FORMAT = "rezsipont-backup";
const VERSION = 1;

export function backup(category: Category, data: unknown) {
  return new TextEncoder().encode(
    JSON.stringify({
      format: FORMAT,
      version: photoIds(data).length ? 2 : VERSION,
      category,
      data,
    }),
  );
}

export function restore<T>(
  content: Uint8Array,
  category: Category,
  parse: (value: unknown) => T | null,
) {
  let envelope: unknown;
  try {
    envelope = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(content),
    );
  } catch {
    throw new Error("A PDF-ben lévő adatcsatolmány sérült.");
  }
  if (
    !envelope ||
    typeof envelope !== "object" ||
    !("format" in envelope) ||
    envelope.format !== FORMAT
  ) {
    throw new Error("A PDF csatolmánya nem RezsiPont-mentés.");
  }
  if (
    !("version" in envelope) ||
    (envelope.version !== VERSION && envelope.version !== 2)
  ) {
    throw new Error("A mentés verzióját ez a RezsiPont-verzió nem támogatja.");
  }
  if (
    !("category" in envelope) ||
    typeof envelope.category !== "string" ||
    !Object.hasOwn(backupCategories, envelope.category)
  ) {
    throw new Error("A mentés kategóriája ismeretlen.");
  }
  if (envelope.category !== category) {
    const { label } = backupCategories[envelope.category as Category];
    const article = /^[aáeéiíoóöőuúüű]/iu.test(label) ? "Az" : "A";
    throw new Error(
      `Ez ${label} mentés. ${article} ${label} oldalon töltheted vissza.`,
    );
  }
  let data: T | null = null;
  try {
    if ("data" in envelope) data = parse(envelope.data);
  } catch {
    // State validators can reject malformed nested properties by throwing.
  }
  if (data === null)
    throw new Error("A mentés érvénytelen alkalmazásadatokat tartalmaz.");
  photoIds(data);
  return data;
}
