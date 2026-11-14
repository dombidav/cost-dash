import { today } from "../calendar";
import { quantity, type Report } from "../pdf/report";
import { activeIn, type Subscription } from "./state";

export function subscriptionsReport(
  data: Subscription[],
  detailed: boolean,
): Report {
  const month = today().slice(0, 7);
  const active = data.filter((item) => activeIn(item, month));
  const monthly = active.reduce((sum, item) => sum + item.fee, 0);
  return {
    category: "Havidíjak",
    title: detailed ? "Havidíjak és összesítés" : "Havidíjak",
    period: month,
    periodLabel: "Összesítés hónapja",
    summaryTitle: "Aktuális havidíjak",
    summary: detailed
      ? {
          rows: [
            ["Aktív tételek", quantity(active.length, "db", 0)],
            ["Havi összeg", quantity(monthly, "Ft", 0)],
            [
              "Éves egyenérték a mostani havidíjakkal",
              quantity(monthly * 12, "Ft", 0),
            ],
          ],
          note: "Az éves egyenérték a jelenlegi havi összeg tizenkétszerese, a kezdő és záró hónapokat nem veszi figyelembe.",
        }
      : undefined,
    meters: [
      {
        name: "Minden rögzített havidíj",
        columns: ["Megnevezés", "Ft/hó", "Első hónap", "Utolsó hónap"],
        columnWeights: [3, 1.4, 1.3, 1.3],
        alignments: ["left", "right", "left", "left"],
        readings: [...data]
          .sort(
            (a, b) =>
              a.start.localeCompare(b.start) ||
              a.name.localeCompare(b.name, "hu"),
          )
          .map((item) => [
            item.name,
            quantity(item.fee, "", 0),
            item.start,
            item.end || "Folyamatos",
          ]),
        emptyMessage: "Nincs rögzített havidíj.",
      },
    ],
  };
}
