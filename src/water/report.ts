import { monthPeriod, sortByDate } from "../calendar";
import { quantity, type Report } from "../pdf/report";
import { waterBill, waterIntervals, type WaterState } from "./state";

export function waterReport(data: WaterState, detailed: boolean): Report {
  const ordered = sortByDate(data.readings);
  const latest = waterIntervals(ordered).at(-1);
  const report: Report = {
    category: "Víz",
    title: detailed ? "Vízfogyasztás és összesítés" : "Víznapló",
    summaryTitle: "Összesítés",
    note: "A mérések díjbecslése a jelenlegi díjakkal készül. A teljes adatmentés a PDF csatolmányában van.",
    meters: [
      {
        name: "Vízóra",
        columns: ["Dátum", "Mérőállás (m³)", "Fogyasztás (m³)"],
        readings: ordered.map((item, i) => [
          item.date,
          quantity(item.value, "", 3),
          i ? quantity(item.value - ordered[i - 1].value, "", 3) : "-",
        ]),
      },
      {
        name: "Korábbi havi tételek",
        tariff:
          "Az itt feltüntetett díjak a tételhez mentett korábbi egységárakkal készültek.",
        columns: ["Hónap", "Víz (m³)", "Csatorna (m³)", "Mentett díj (Ft)"],
        readings: [...data.months]
          .sort((a, b) => a.month.localeCompare(b.month))
          .map((item) => {
            const { start, end } = monthPeriod(`${item.month}-01`);
            return [
              item.month,
              quantity(item.volume, "", 3),
              quantity(item.sewerVolume ?? item.volume, "", 3),
              quantity(
                waterBill(
                  item.volume,
                  start,
                  end,
                  item.rates,
                  item.sewerVolume ?? item.volume,
                ).total,
                "",
                0,
              ),
            ];
          }),
        emptyMessage: "Nincs korábbi havi tétel.",
      },
    ],
  };
  if (detailed)
    report.summary = {
      rows: [
        ["Település", data.rates.city || "Egyedi díjak"],
        ["Ivóvíz egységára", quantity(data.rates.water, "Ft/m³", 2)],
        ["Csatorna egységára", quantity(data.rates.sewer, "Ft/m³", 2)],
        ["Havi alapdíj", quantity(data.rates.base, "Ft", 0)],
        ["Háztartás létszáma", quantity(data.rates.people, "fő", 0)],
        [
          "Utolsó mért időszak",
          latest ? `${latest.start} - ${latest.end}` : "-",
        ],
        ["Utolsó időszak fogyasztása", quantity(latest?.volume, "m³", 3)],
        [
          "Becsült díj az utolsó időszakra",
          quantity(
            latest
              ? waterBill(latest.volume, latest.start, latest.end, data.rates)
                  .total
              : null,
            "Ft",
            0,
          ),
        ],
      ],
    };
  return report;
}
