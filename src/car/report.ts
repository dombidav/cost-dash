import { quantity, type Report } from "../pdf/report";
import { chargeNames, frequencies } from "./charges";
import { carTotals, type CarState } from "./state";

export function carReport(data: CarState, detailed: boolean): Report {
  return {
    category: "Autó",
    title: detailed ? "Autós kiadások és összesítés" : "Autós kiadási napló",
    note: "A mentés minden autó naplóját, ütemezett díjait és adóbeállításait tartalmazza. Az értékvesztés becslés, nem kifizetés.",
    meters: data.cars.flatMap((car) => {
      const totals = carTotals(car.entries, car.value);
      const meters: Report["meters"] = [
        {
          name: car.name,
          columns: ["Dátum", "Tétel", "Fizetett (Ft)", "Út (km)", "Liter"],
          columnWeights: [1.3, 2.8, 1.4, 1, 0.8],
          alignments: ["left", "left", "right", "right", "right"],
          emptyMessage: "Nincs mentett autós kiadás.",
          readings: [...car.entries]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((item) => [
              item.date,
              `${item.kind === "fuel" ? (item.full ? "Tankolás (tele)" : "Tankolás") : item.name}${item.odometer === undefined ? "" : `; óra: ${quantity(item.odometer, "km", 2)}`}`,
              quantity(item.paid, "", 0),
              quantity(item.kind === "fuel" ? item.km : null, "", 2),
              quantity(item.kind === "fuel" ? item.liters : null, "", 2),
            ]),
          statistics: detailed
            ? {
                rows: [
                  ["Üzemanyag", quantity(totals.fuel, "Ft", 0)],
                  ["Egyéb kifizetés", quantity(totals.other, "Ft", 0)],
                  ["Összes kifizetés", quantity(totals.paid, "Ft", 0)],
                  ["Rögzített megtett út", quantity(totals.distance, "km", 2)],
                  [
                    "Tele tankolások közötti fogyasztás",
                    quantity(totals.consumption, "l/100 km", 2),
                  ],
                  ["Autó megadott értéke", quantity(car.value, "Ft", 0)],
                  ["Becsült értékvesztés", quantity(totals.wear, "Ft", 0)],
                ],
              }
            : undefined,
        },
      ];
      if (detailed && car.charges?.length)
        meters.push({
          name: `${car.name} - ütemezett díjak`,
          columns: ["Díj", "Első esedékesség", "Gyakoriság", "Összeg (Ft)"],
          columnWeights: [2, 1.5, 1.2, 1.3],
          alignments: ["left", "left", "left", "right"],
          readings: car.charges.map((item) => [
            chargeNames[item.kind],
            item.firstDue,
            frequencies[item.months],
            quantity(item.amount, "", 0),
          ]),
        });
      return meters;
    }),
  };
}
