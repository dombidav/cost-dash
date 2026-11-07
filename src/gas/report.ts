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

  const annual = calculateGasYear(data.settings, readings, data.year);
  const bill = calculateBilling(data.settings, readings, data.billing);
  const stats = calculateStatistics(data, annual, bill);
  const hasBalance = annual.items.length > 1 || annual.complete;
  report.period = `${annual.start} – ${annual.end}`;
  meter.statistics = {
    note:
      hasBalance && !annual.complete
        ? "Az év eleji mérőállás hiányzik, ezért a hátralévő keret felső becslés."
        : undefined,
    rows: [
      ["Éves kedvezményes keret", quantity(annual.annual, "m³")],
      [
        "Hátralévő kedvezményes keret",
        quantity(hasBalance ? annual.remaining : null, "m³"),
      ],
      ["Utolsó mérés a kedvezményes évben", annual.last?.date ?? "-"],
      [
        "Követett fogyasztás",
        quantity(hasBalance ? annual.consumed : null, "m³"),
      ],
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
