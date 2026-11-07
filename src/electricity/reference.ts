import type { Area, Tariff, Rates } from "./types";
export const ELECTRICITY_STORAGE_KEY = "rezsi-electricity.v1";
export const DAYTIME_MARKET_RATE = 70.104;
export const PRICE_SOURCE =
  "https://www.mvmnext.hu/aram/servlet/download?id=16214&type=file";
export const VERIFIED = "2026-11-06";
export const AREAS: Record<
  Area,
  { label: string; a1: number; peak: number; off: number; b: number }
> = {
  demasz: {
    label: "MVM Démász",
    a1: 36.386,
    peak: 41.085,
    off: 31.052,
    b: 22.962,
  },
  eon: {
    label: "E.ON DÉDÁSZ / ÉDÁSZ · OPUS TITÁSZ",
    a1: 35.293,
    peak: 43.409,
    off: 32.766,
    b: 23.52,
  },
  elmu: {
    label: "ELMŰ Hálózati",
    a1: 36.208,
    peak: 42.456,
    off: 32.169,
    b: 23.152,
  },
  emasz: { label: "MVM Émász", a1: 35.992, peak: 40.5, off: 30.988, b: 22.682 },
};
export const TARIFFS: Record<Tariff, string> = {
  A1: "A1 · egész napos",
  A2: "A2 · csúcs / völgy",
  B_BASIC: "B alap · vezérelt",
  B_COMFORT: "B Komfort · napi 12 óra",
  H: "H · hőszivattyús",
  B_GEO: "B GEO · meglévő szerződés",
  D: "D · dinamikus, 2027-től",
};
export function supported(area: Area, tariff: Tariff) {
  return tariff === "B_COMFORT"
    ? area === "demasz"
    : tariff === "B_GEO"
      ? area === "elmu" || area === "emasz"
      : true;
}
export function officialRates(area: Area, tariff: Tariff): Rates {
  const a = AREAS[area];
  return {
    low:
      tariff === "A2"
        ? a.peak
        : tariff === "B_GEO"
          ? 23.368
          : tariff === "B_COMFORT"
            ? 23.33
            : tariff === "B_BASIC" || tariff === "H"
              ? a.b
              : a.a1,
    second: tariff === "A2" ? a.off : a.a1,
    market:
      tariff === "D"
        ? null
        : tariff === "B_BASIC" || tariff === "B_COMFORT"
          ? 60.935
          : DAYTIME_MARKET_RATE,
    monthlyBase: ["A1", "A2", "D"].includes(tariff) ? 153.035 : 50.165,
    effective: "2022-08-01",
  };
}
// KSH 15.1.2.25, live 2025 column, retrieved 2026-11-06, updated 2026-10-30.
export const NATIONAL_MONTHLY = 205.7;
// Rounded starting estimate, not a measured value or the discounted allowance.
export const DEFAULT_ANNUAL_ESTIMATE =
  Math.round((NATIONAL_MONTHLY * 12) / 100) * 100;
export const ELECTRICITY_REGIONS: Record<string, number> = {
  Budapest: 190,
  Pest: 277.7,
  Fejér: 233.4,
  "Komárom-Esztergom": 228.8,
  Veszprém: 209.3,
  "Győr-Moson-Sopron": 215.5,
  Vas: 215.1,
  Zala: 162.8,
  Baranya: 187.2,
  Somogy: 179.2,
  Tolna: 218.5,
  "Borsod-Abaúj-Zemplén": 174.2,
  Heves: 192.6,
  Nógrád: 198.1,
  "Hajdú-Bihar": 207.3,
  "Jász-Nagykun-Szolnok": 203.3,
  "Szabolcs-Szatmár-Bereg": 216.8,
  "Bács-Kiskun": 186.2,
  Békés: 173.5,
  "Csongrád-Csanád": 171.2,
};
