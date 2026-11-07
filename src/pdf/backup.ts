export type Category = "gas" | "electricity";

export const ATTACHMENT_NAME = "rezsipont-adatok.json";
const FORMAT = "rezsipont-backup";
const VERSION = 1;

export function backup(category: Category, data: unknown) {
  return new TextEncoder().encode(
    JSON.stringify({ format: FORMAT, version: VERSION, category, data }),
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
  if (!("version" in envelope) || envelope.version !== VERSION) {
    throw new Error("A mentés verzióját ez a RezsiPont-verzió nem támogatja.");
  }
  if (
    !("category" in envelope) ||
    (envelope.category !== "gas" && envelope.category !== "electricity")
  ) {
    throw new Error("A mentés kategóriája ismeretlen.");
  }
  if (envelope.category !== category) {
    throw new Error(
      envelope.category === "gas"
        ? "Ez gázmentés. A Gáz oldalon töltheted vissza."
        : "Ez árammentés. Az Áram oldalon töltheted vissza.",
    );
  }
  let data: T | null = null;
  try {
    if ("data" in envelope) data = parse(envelope.data);
  } catch {
    // State validators can reject malformed nested properties by throwing.
  }
  if (data === null)
    throw new Error("A mentés érvénytelen kalkulátoradatokat tartalmaz.");
  return data;
}
