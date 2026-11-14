import { calculateBilling, calculateGasYear } from "../calculator";
import { sortByDate } from "../calendar";
import { quantity, type Report } from "../pdf/report";
import { calculateStatistics } from "../statistics";
import type { AppState } from "../types";

export function gasReport(data: AppState, detailed: boolean): Report {
  const readings = sortByDate(data.readings);
  const meter: Report["meters"][number] = {
    name: "Gázmérő",
    columns: ["Rögzítés dátuma", "Mérőállás (m³)", "Fogyasztás (m³)"],
    readings: readings.map((reading, i) => [
      reading.date,
      quantity(reading.value, "", 3),
      i ? quantity(reading.value - readings[i - 1].value, "", 3) : "-",
    ]),
  };
  const report: Report = { category: "Földgáz", meters: [meter] };
  if (!detailed) return report;

  const annual = calculateGasYear(
    data.settings,
    readings,
    data.year,
    data.billing,
  );
  const bill = calculateBilling(data.settings, readings, data.billing);
  const stats = calculateStatistics(data, annual, bill);
  report.period = `${annual.start} – ${annual.end}`;
  meter.statistics = {
    note:
      [
        annual.opening
          ? "Az évkezdő mérés hiányzik. A hiányzó fogyasztást havi súlyozással becsültük."
          : "",
        stats.manualAdjusted
          ? "A beállított éves becslésnél nagyobb, már követett fogyasztást alsó korlátként használjuk."
          : "",
      ]
        .filter(Boolean)
        .join(" ") || undefined,
    rows: [
      ["Éves kedvezményes keret", quantity(annual.annual, "m³")],
      [
        annual.opening
          ? "Becsült hátralévő keret"
          : "Hátralévő kedvezményes keret",
        quantity(annual.remaining, "m³"),
      ],
      ["Utolsó mérés a kedvezményes évben", annual.last?.date ?? "-"],
      ["Mért fogyasztás", quantity(annual.measured, "m³")],
      ...(annual.opening
        ? [
            [
              "Becsült hiányzó fogyasztás",
              quantity(annual.opening.volume, "m³"),
            ] as [string, string],
          ]
        : []),
      [
        "Legutóbbi mért szakasz napi átlaga",
        quantity(stats.latest?.average, "m³/nap", 2),
      ],
      [
        stats.fullYear ? "Mért éves fogyasztás" : "Becsült éves fogyasztás",
        quantity(stats.annualVolume, "m³"),
      ],
      ["Becsült éves költség", quantity(stats.annualCost?.total, "Ft", 0)],
    ],
  };
  return report;
}
