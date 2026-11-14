import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { createServer } from "vite";
import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

test("PDF backups preserve app data and reject unsafe restores", async (t) => {
  const server = await createServer({
    server: { middlewareMode: true, ws: false },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  t.after(() => server.close());
  const modules = {};
  for (const name of [
    "pdf/backup",
    "pdf/read",
    "pdf/write",
    "gas/state",
    "gas/report",
    "electricity/calculator",
    "electricity/report",
    "water/state",
    "water/report",
    "car/state",
    "car/report",
    "subscriptions/state",
    "subscriptions/report",
    "dashboard/backup",
    "dashboard/report",
    "calendar",
  ])
    Object.assign(modules, await server.ssrLoadModule(`/src/${name}.ts`));
  const {
    backup,
    restore,
    readBackup,
    writeReport,
    initialGas,
    initialState,
    initialWater,
    initialCar,
    createCar,
    addDays,
    readAppBackup,
    parseAppBackup,
    restoreAppBackup,
  } = modules;
  const gas = initialGas();
  gas.draft.value = "123,45";
  gas.readings = Array.from({ length: 130 }, (_, index) => ({
    id: `gas-${index}`,
    date: addDays("2025-01-01", index),
    value: 100 + index,
  }));
  const electricity = initialState();
  electricity.points[0].draft.peak = "456";
  const water = initialWater();
  water.readings = [
    { id: "water-1", date: "2025-01-01", value: 100 },
    { id: "water-2", date: "2025-02-01", value: 110 },
  ];
  water.months = [
    { month: "2024-12", volume: 8, sewerVolume: 6, rates: { ...water.rates } },
  ];
  const car = initialCar();
  car.cars.push(createCar("Második autó", "car-2"));
  car.selected = "car-2";
  car.cars[0].entries = [
    {
      id: "fuel-1",
      kind: "fuel",
      date: "2025-01-15",
      paid: 30000,
      km: 500,
      liters: 40,
      full: true,
      odometer: 120500,
    },
  ];
  car.cars[0].charges = [
    { kind: "liability", firstDue: "2025-02-01", amount: 25000, months: 3 },
  ];
  car.cars[1].entries = [
    {
      id: "expense-1",
      kind: "expense",
      name: "Árvíztűrő tükörfúrógép - javítás",
      date: "2025-01-20",
      paid: 10000,
    },
  ];
  const subscriptions = [
    {
      id: "old",
      name: "Régi internet",
      fee: 5000,
      start: "2024-01",
      end: "2024-12",
    },
    { id: "active", name: "Internet", fee: 7000, start: "2025-01", end: "" },
    { id: "future", name: "Későbbi díj", fee: 9000, start: "2030-01", end: "" },
  ];
  const full = { gas, electricity, water, car, subscriptions, budget: 150000 };
  const empty = {
    gas: null,
    electricity: null,
    water: null,
    car: null,
    subscriptions: null,
    budget: null,
  };
  const keys = {
    gas: "rezsi-calculator.v1",
    electricity: "rezsi-electricity.v1",
    water: "rezsipont.water.v1",
    car: "rezsipont.car.v1",
    subscriptions: "rezsipont.subscriptions.v1",
    budget: "rezsipont.dashboard.budget.v1",
  };
  const storageDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  let stored = new Map();
  let writes = 0;
  let failAt = Infinity;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => {
        if (++writes === failAt) throw new Error("Quota exceeded");
        stored.set(key, value);
      },
      removeItem: (key) => stored.delete(key),
    },
  });
  t.after(() => {
    if (storageDescriptor)
      Object.defineProperty(globalThis, "localStorage", storageDescriptor);
    else delete globalThis.localStorage;
  });
  const seed = (data) => {
    stored = new Map(
      Object.entries(data)
        .filter(([, value]) => value !== null)
        .map(([id, value]) => [keys[id], JSON.stringify(value)]),
    );
    stored.set("unrelated", "keep me");
    writes = 0;
    failAt = Infinity;
  };
  const cases = [
    ["gas", gas, modules.validGas, modules.gasReport],
    ["electricity", electricity, modules.validState, modules.electricityReport],
    ["water", water, modules.validWater, modules.waterReport],
    ["car", car, modules.validCar, modules.carReport],
    [
      "subscriptions",
      subscriptions,
      modules.validSubscriptions,
      modules.subscriptionsReport,
    ],
    [
      "dashboard",
      full,
      (value) => parseAppBackup(value) !== null,
      (value, detailed) => modules.dashboardReport(value, detailed, 2025, "0"),
    ],
  ];
  await t.test(
    "all category envelopes round-trip without losing records or settings",
    () => {
      for (const [category, data, validate] of cases) {
        assert(validate(data), category);
        const parse =
          category === "dashboard"
            ? parseAppBackup
            : (value) => (validate(value) ? value : null);
        assert.deepEqual(
          restore(backup(category, data), category, parse),
          data,
        );
        const wrong = category === "dashboard" ? "water" : "dashboard";
        assert.throws(
          () => restore(backup(category, data), wrong, () => null),
          /oldalon töltheted vissza/,
        );
      }
    },
  );
  await t.test(
    "malformed, incomplete and unknown backup data is rejected",
    () => {
      assert.equal(
        parseAppBackup({ ...full, water: { readings: [null] } }),
        null,
      );
      assert.equal(parseAppBackup({ ...full, budget: -1 }), null);
      assert.equal(parseAppBackup({ ...full, car: undefined }), null);
      assert.equal(parseAppBackup({ gas }), null);
      for (const category of ["unknown", "__proto__", "constructor"]) {
        assert.throws(
          () => restore(backup(category, full), "dashboard", parseAppBackup),
          /ismeretlen/,
        );
      }
      assert.throws(
        () => restore(new Uint8Array([255]), "dashboard", parseAppBackup),
        /sérült/,
      );
      const unsupported = new TextEncoder().encode(
        JSON.stringify({
          format: "rezsipont-backup",
          version: 999,
          category: "dashboard",
          data: full,
        }),
      );
      assert.throws(
        () => restore(unsupported, "dashboard", parseAppBackup),
        /verzióját/,
      );
    },
  );
  await t.test(
    "full restore replaces every app dataset and leaves unrelated storage intact",
    () => {
      seed(empty);
      restoreAppBackup(structuredClone(full));
      assert.deepEqual(readAppBackup(), full);
      assert.equal(readAppBackup().gas.readings.length, 130);
      assert.equal(stored.get("unrelated"), "keep me");
      restoreAppBackup(empty);
      assert.deepEqual(readAppBackup(), empty);
      assert.deepEqual([...stored], [["unrelated", "keep me"]]);
    },
  );
  await t.test("failed writes roll back previously written categories", () => {
    seed({ ...empty, water: initialWater(), budget: 100 });
    const original = new Map(stored);
    failAt = 4;
    assert.throws(
      () => restoreAppBackup(structuredClone(full)),
      /korábbi adatok megmaradtak/,
    );
    assert.deepEqual(stored, original);
  });
  await t.test(
    "unreadable local data cannot silently become an empty full backup",
    () => {
      seed(full);
      stored.set(keys.water, "broken JSON");
      const original = new Map(stored);
      assert.throws(() => readAppBackup(), /minden helyi adatnak olvashatónak/);
      assert.throws(() => restoreAppBackup(empty));
      assert.deepEqual(stored, original);
    },
  );
  await t.test(
    "original gas and electricity backup format remains supported",
    () => {
      for (const [category, data, validate] of cases.slice(0, 2)) {
        const legacy = new TextEncoder().encode(
          JSON.stringify({
            format: "rezsipont-backup",
            version: 1,
            category,
            data,
          }),
        );
        assert.deepEqual(
          restore(legacy, category, (value) =>
            validate(value) ? value : null,
          ),
          data,
        );
      }
    },
  );
  await t.test(
    "actual PDFs retain complete attachments in both export modes",
    async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url, options) => {
        const font = String(url).match(/NotoSans-(Regular|Bold)\.ttf/);
        return font
          ? new Response(await readFile(`src/assets/pdf/${font[0]}`))
          : originalFetch(url, options);
      };
      try {
        GlobalWorkerOptions.workerSrc = pathToFileURL(
          resolve("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs"),
        ).href;
        for (const [category, data, validate, makeReport] of cases) {
          for (const detailed of [false, true]) {
            const bytes = await writeReport(
              makeReport(data, detailed),
              category,
              "2026-11-14",
              backup(category, data),
            );
            const content = await readBackup(
              new File([Uint8Array.from(bytes)], "backup.pdf", {
                type: "application/pdf",
              }),
            );
            assert(content, category);
            assert.deepEqual(
              restore(content, category, (value) =>
                validate(value) ? value : null,
              ),
              data,
              category,
            );
          }
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );
});
