import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";

test("cost labels distinguish measured, estimated and partial-year values", async (t) => {
  const storageDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) =>
        key === "rezsipont.dashboard.budget.v1" ? "100000" : null,
      setItem: () => {},
    },
  });
  t.after(() => {
    if (storageDescriptor)
      Object.defineProperty(globalThis, "localStorage", storageDescriptor);
    else delete globalThis.localStorage;
  });
  const server = await createServer({
    cacheDir: `tmp/vite-copy-tests-${process.pid}`,
    server: { middlewareMode: true, ws: false },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  t.after(() => server.close());
  const load = (name) => server.ssrLoadModule(`/src/${name}`);
  const { render } = await server.ssrLoadModule("svelte/server");
  const { initialState, annual } = await load("electricity/calculator.ts");
  const { electricityReport } = await load("electricity/report.ts");
  const { initialGas } = await load("gas/state.ts");
  const { calculateGasYear, calculateBilling } = await load("calculator.ts");
  const { calculateStatistics } = await load("statistics.ts");
  const { default: ElectricStats } = await load(
    "electricity/ElectricStats.svelte",
  );
  const { default: GasStats } = await load("gas/GasStats.svelte");
  const { default: PdfActions } = await load("components/PdfActions.svelte");
  const { default: MonthlyBudget } = await load(
    "dashboard/MonthlyBudget.svelte",
  );
  const { default: MonthComparison } = await load(
    "dashboard/MonthComparison.svelte",
  );
  const { initialCar } = await load("car/state.ts");
  const { reports } = await load("dashboard/data.ts");
  const html = (component, props) => render(component, { props }).body;
  const electricity = initialState();
  electricity.year = 2025;
  const point = electricity.points[0];
  point.annualEstimate = "2400";
  point.eligibleFrom = "2025-11-01";
  point.eligibleTo = "2025-12-01";
  const partial = annual(point, 2025);
  assert.equal(partial.fullPeriod, false);
  assert.equal(partial.active, 30);
  assert.equal(Math.round(partial.volume), 200);
  const props = {
    settings: { ...electricity.stats, people: "2", floorArea: "100" },
    point,
    combinedAnnualVolume: null,
    onstats: () => {},
  };
  const partialHtml = html(ElectricStats, { ...props, yearly: partial });
  assert.match(partialHtml, /Fogyasztás a jogosultsági időszakban/);
  assert.match(partialHtml, /kWh\/fő\/időszak/);
  assert.match(partialHtml, /nem hasonlítjuk az éves országos átlaghoz/);
  assert.doesNotMatch(partialHtml, /az országos átlaghoz képest\./);
  assert.doesNotMatch(partialHtml, /Aktív mérő éves adata/);
  const report = electricityReport(electricity, true);
  assert(
    report.meters[0].statistics.rows.some(
      ([label]) => label === "Becsült időszaki fogyasztás",
    ),
  );
  assert.match(report.meters[0].statistics.note, /2025-11-01 – 2025-11-30/);
  point.eligibleFrom = "2022-08-01";
  point.eligibleTo = "";
  point.annualEstimate = "2500";
  const full = annual(point, 2025);
  assert.equal(full.fullPeriod, true);
  const fullHtml = html(ElectricStats, { ...props, yearly: full });
  assert.match(fullHtml, /BEÁLLÍTOTT ÉVES BECSLÉS/);
  assert.match(fullHtml, /kiinduló éves becslése/);
  assert.match(fullHtml, /kWh\/fő\/év/);
  assert.match(fullHtml, /az országos átlaghoz képest\./);

  const gas = initialGas();
  gas.year = 2025;
  gas.billing.annualEstimate = "100";
  gas.readings = [
    { id: "start", date: "2025-08-01", value: 1000 },
    { id: "end", date: "2025-08-10", value: 1200 },
  ];
  const year = calculateGasYear(
    gas.settings,
    gas.readings,
    gas.year,
    gas.billing,
  );
  const bill = calculateBilling(gas.settings, gas.readings, gas.billing);
  const stats = calculateStatistics(gas, year, bill);
  assert.equal(stats.manualAdjusted, true);
  assert.equal(stats.annualVolume, 200);
  const gasHtml = html(GasStats, {
    model: gas,
    annual: year,
    bill,
    onstats: () => {},
  });
  assert.match(
    gasHtml,
    /beállított éves becslés.*kisebb az évkezdet óta számolt fogyasztásnál/,
  );
  assert.match(gasHtml, /Kedvezményes energiadíj/);
  assert.doesNotMatch(gasHtml, /<dt>Kedvezményes fogyasztás<\/dt>/);
  gas.billing.annualEstimate = "500";
  assert.equal(calculateStatistics(gas, year, bill).manualAdjusted, false);

  const pdfProps = {
    getData: () => [],
    report: () => ({}),
    parse: () => [],
    describe: () => "",
    onrestore: () => true,
  };
  assert.doesNotMatch(
    html(PdfActions, { ...pdfProps, category: "subscriptions" }),
    /külön fájlcsatolmányként/,
  );
  assert.match(
    html(PdfActions, { ...pdfProps, category: "gas" }),
    /külön fájlcsatolmányként/,
  );
  const sources = {
    gas: null,
    electricity: null,
    water: null,
    car: initialCar(),
    subscriptions: [
      { id: "fee", name: "Internet", fee: 20000, start: "2025-01", end: "" },
    ],
    errors: [],
  };
  sources.car.cars[0].entries = [
    {
      id: "oct",
      date: "2025-10-10",
      kind: "expense",
      name: "Szerviz",
      paid: 10000,
    },
    {
      id: "nov",
      date: "2025-11-10",
      kind: "expense",
      name: "Parkolás",
      paid: 5000,
    },
  ];
  const row = reports(sources, 2025, "2025-11-14").at(-1);
  const budgetHtml = html(MonthlyBudget, { row, sources, now: "2025-11-14" });
  assert.match(
    budgetHtml,
    /a külön mutatott ütemezett díjak figyelembevétele előtt/,
  );
  assert.match(
    budgetHtml,
    /havidíjak a fenti különbözetből még nincsenek levonva/,
  );
  assert.doesNotMatch(budgetHtml, /marad a keretből/);
  const comparisonHtml = html(MonthComparison, {
    row,
    sources,
    now: "2025-11-14",
  });
  assert.match(comparisonHtml, /aktuális hónap még folyamatban van/);
  assert.match(comparisonHtml, /nem igazolja, hogy minden kifizetést/);
  assert.doesNotMatch(comparisonHtml, /használható, teljes adat/);
});
