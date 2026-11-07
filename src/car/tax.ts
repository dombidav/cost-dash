import { nonnegative } from "../lib/months";

export const taxRates = {
  2026: {
    amounts: [375, 325, 250, 205, 150],
    source:
      "https://nav.gov.hu/ugyfeliranytu/adokulcsok_jarulekmertekek/valorizalt-adomertekek/belfoldi-gepjarmuado/belfoldi-gepjarmuado",
  },
  2027: {
    amounts: [380, 330, 255, 205, 150],
    source:
      "https://nav.gov.hu/ugyfeliranytu/adokulcsok_jarulekmertekek/valorizalt-adomertekek/belfoldi-gepjarmuado/belfoldi-gepjarmuado-2027",
  },
} as const;
export const taxClasses = {
  standard: "Általános",
  electric: "5E / 5Z · Nulla emisszió",
  earlyHybrid: "5P / 5N · 2025 előtt",
} as const;
export type TaxInput = {
  year: keyof typeof taxRates;
  manufacture: number;
  power: number;
  category: keyof typeof taxClasses;
};

export function validTaxInput(input: TaxInput) {
  return (
    !!input &&
    typeof input.year === "number" &&
    Object.hasOwn(taxRates, input.year) &&
    Number.isInteger(input.manufacture) &&
    input.manufacture >= 1900 &&
    input.manufacture <= input.year &&
    nonnegative(input.power, 1e4) &&
    input.power > 0 &&
    Object.hasOwn(taxClasses, input.category) &&
    (input.category !== "earlyHybrid" || input.manufacture < 2025)
  );
}

export function vehicleTax(input: TaxInput) {
  if (!validTaxInput(input)) return null;
  if (
    input.category === "electric" ||
    (input.category === "earlyHybrid" && input.year === 2026)
  )
    return { amount: 0, rate: 0 };
  const age = input.year - input.manufacture;
  const bracket = [3, 7, 11, 15, Infinity].findIndex((limit) => age <= limit);
  const rate = taxRates[input.year].amounts[bracket];
  return { amount: Math.round(rate * input.power), rate };
}
