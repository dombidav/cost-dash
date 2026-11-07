import { addDays, sortByDate, yearPeriod } from "../calendar";
import { quantity, type Report } from "../pdf/report";
import { annual, total } from "./calculator";
import { TARIFFS } from "./reference";
import type { ElectricityState } from "./types";

export function electricityReport(
  data: ElectricityState,
  detailed: boolean,
): Report {
  const report: Report = {
    category: "Villamos energia",
    meters: data.points.map((point) => {
      const readings = sortByDate(point.readings);
      const hasOff = point.tariff === "A2";
      return {
        name: point.name,
        tariff: TARIFFS[point.tariff],
        columns: [
          "Rögzítés dátuma",
          ...(hasOff
            ? ["Csúcsállás (kWh)", "Völgyállás (kWh)"]
            : ["Mérőállás (kWh)"]),
          "Fogyasztás (kWh)",
        ],
        readings: readings.map((reading, i) => {
          const current = total(point, reading);
          const previous = i ? total(point, readings[i - 1]) : null;
          return [
            reading.date,
            quantity(reading.peak, "", 3),
            ...(hasOff ? [quantity(reading.off, "", 3)] : []),
            quantity(
              current !== null && previous !== null ? current - previous : null,
              "",
              3,
            ),
          ];
        }),
      };
    }),
  };
  if (!detailed) return report;

  const period = yearPeriod(data.year);
  report.period = `${period.start} – ${addDays(period.end, -1)}`;
  const years = data.points.map((point) => annual(point, data.year));
  years.forEach((year, index) => {
    const tariff = data.points[index].tariff;
    const unlimited = tariff === "B_GEO" && year.active > 0;
    const qualifier = tariff === "H" ? " (fűtési idényen kívül)" : "";
    report.meters[index].statistics = {
      note: year.opening
        ? "A kezdő mérés hiányzik. A hiányzó fogyasztást havi súlyozással becsültük."
        : year.seasonSplitEstimated
          ? "Az idényhatárt átfogó mért fogyasztást naparányosan osztottuk meg."
          : undefined,
      rows: [
        [
          `Kedvezményes keret${qualifier}`,
          unlimited
            ? "Korlátlan"
            : quantity(year.active ? year.quota.cap : null, "kWh"),
        ],
        [
          `${year.remainingEstimated ? "Becsült hátralévő keret" : "Hátralévő keret"}${qualifier}`,
          unlimited ? "Korlátlan" : quantity(year.remaining, "kWh"),
        ],
        ["Utolsó mérés a kedvezményes évben", year.last?.date ?? "-"],
        ["Mért fogyasztás", quantity(year.measuredVolume, "kWh")],
        ...(year.opening
          ? [
              [
                "Becsült hiányzó fogyasztás",
                quantity(year.opening.volume, "kWh"),
              ] as [string, string],
            ]
          : []),
        [
          "Legutóbbi mért szakasz napi átlaga",
          quantity(year.latest?.average, "kWh/nap", 2),
        ],
        [
          year.measuredFull
            ? "Mért éves fogyasztás"
            : "Becsült éves fogyasztás",
          quantity(year.volume, "kWh"),
        ],
        ["Becsült éves költség", quantity(year.annualCost?.total, "Ft", 0)],
      ],
    };
  });
  if (years.length > 1) {
    const volume = years.every((year) => year.volume !== null)
      ? years.reduce((sum, year) => sum + (year.volume ?? 0), 0)
      : null;
    const cost = years.every((year) => year.annualCost?.total != null)
      ? years.reduce((sum, year) => sum + (year.annualCost?.total ?? 0), 0)
      : null;
    report.summary = {
      rows: [
        [
          years.every((year) => year.measuredFull)
            ? "Összes mért éves fogyasztás"
            : "Összes becsült éves fogyasztás",
          quantity(volume, "kWh"),
        ],
        ["Összes becsült éves költség", quantity(cost, "Ft", 0)],
      ],
    };
  }
  return report;
}
