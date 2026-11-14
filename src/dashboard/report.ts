import { today } from "../calendar";
import { categories } from "../lib/pages";
import { quantity, type Report } from "../pdf/report";
import type { AppBackup } from "./backup";
import { categoryIds, reports, summarize, type Sources } from "./data";

export function dashboardReport(
  data: AppBackup,
  detailed: boolean,
  year: number,
  monthIndex = "year",
): Report {
  const sources: Sources = { ...data, errors: [] };
  const months = reports(sources, year);
  const selected =
    monthIndex === "year"
      ? months
      : months.slice(Number(monthIndex), Number(monthIndex) + 1);
  const summary = summarize(selected);
  const amount = (value: number | null) =>
    value === null ? "Nincs adat" : quantity(value, "Ft", 0);
  return {
    category: "Dashboard - teljes appmentés",
    title: "Háztartási kiadások",
    period:
      monthIndex === "year"
        ? `${year}. év${year === Number(today().slice(0, 4)) ? " az aktuális hónappal" : ""}`
        : (selected[0]?.month ?? String(year)),
    periodLabel: "Kimutatás időszaka",
    summaryTitle: "Rögzített és becsült költségek összesítése",
    note: "A PDF csatolmánya a teljes app minden tárolt adatát tartalmazza, a kiválasztott kimutatási időszaktól függetlenül. A közműdíjak becslések, a havidíjak ütemezett összegek; a hiányzó adatok nem nullás kiadások. Az aktuális hónap teljes havi becslést is tartalmazhat.",
    summary: {
      rows: [
        ...summary.costs.map((item): [string, string] => [
          categories[item.id].label,
          `${amount(item.value)}${item.partial ? " (részleges)" : ""}`,
        ]),
        ["Ismert összegek együtt", amount(summary.total)],
        [
          "Beállított havi keret",
          data.budget === null ? "Nincs beállítva" : amount(data.budget),
        ],
      ],
    },
    meters: detailed
      ? categoryIds.map((id) => ({
          name: categories[id].label,
          columns: ["Hónap", "Ismert összeg", "Adat jellege"],
          columnWeights: [1.2, 2, 3.5],
          alignments: ["left", "right", "left"],
          readings: months.map((row) => {
            const item = row.costs[id];
            return [
              row.month,
              amount(item.value),
              item.value === null
                ? "Nincs adat"
                : `${id === "car" ? "Rögzített kifizetés" : id === "subscriptions" ? "Ütemezett havidíj" : "Becsült díj"}${item.partial ? " (részleges)" : ""}`,
            ];
          }),
        }))
      : [],
  };
}
