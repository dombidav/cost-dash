import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";

test("today's gas target allocates the remaining annual budget seasonally", async (t) => {
  const server = await createServer({
    cacheDir: `tmp/vite-gas-daily-tests-${process.pid}`,
    server: { middlewareMode: true, ws: false },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  t.after(() => server.close());
  const load = (path) => server.ssrLoadModule(`/src/${path}`);
  const { calculateDailyBudget } = await load("gas/daily-budget.ts");
  const { calculateGasYear } = await load("calculator.ts");
  const { monthlyProfile } = await load("lib/seasonal-consumption.ts");
  const { addDays } = await load("calendar.ts");
  const { initialGas } = await load("gas/state.ts");
  const { render } = await server.ssrLoadModule("svelte/server");
  const { default: GasDailyBudget } = await load("gas/GasDailyBudget.svelte");
  const state = (year = 2025) => ({
    ...initialGas(),
    year,
    settings: { heat: 63.645, correction: 1 }, // Exactly 1000 m³ per year.
    readings: [{ id: "opening", date: `${year}-08-01`, value: 10000 }],
  });
  const annual = (model) =>
    calculateGasYear(model.settings, model.readings, model.year, model.billing);
  const result = (model, date) =>
    calculateDailyBudget(model, annual(model), date);
  const near = (actual, expected) =>
    assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);
  const addReading = (model, date, consumed) =>
    model.readings.push({ id: date, date, value: 10000 + consumed });

  await t.test(
    "winter gets more than summer and each day's targets exhaust exactly one annual budget",
    () => {
      const model = state();
      const profile = monthlyProfile(model.billing.weights);
      let sum = 0,
        winter,
        summer;
      for (
        let date = "2025-08-01";
        date < "2026-08-01";
        date = addDays(date, 1)
      ) {
        const sample = state();
        if (date !== "2025-08-01")
          addReading(sample, date, 1000 * profile("2025-08-01", date));
        const target = result(sample, date);
        assert.equal(target.status, "ready");
        near(target.daily, 1000 * profile(date, addDays(date, 1)));
        sum += target.daily;
        if (date === "2026-01-15") winter = target.daily;
        if (date === "2026-07-15") summer = target.daily;
      }
      near(sum, 1000);
      assert.ok(winter > summer * 10);
    },
  );

  await t.test(
    "today uses measured remaining budget and all future seasonal weights",
    () => {
      const model = state();
      addReading(model, "2026-01-15", 400);
      const profile = monthlyProfile(model.billing.weights);
      const target = result(model, "2026-01-15");
      near(target.remaining, 600);
      near(
        target.daily,
        (600 * profile("2026-01-15", "2026-01-16")) /
          profile("2026-01-15", "2026-08-01"),
      );
      assert.equal(target.sinceReading, 0);
      assert.equal(target.basis, "none");
      assert.equal(target.remainingDays, 198);
      const higher = state();
      addReading(higher, "2026-01-15", 700);
      near(result(higher, "2026-01-15").daily, target.daily / 2);
    },
  );

  await t.test(
    "stale readings are extrapolated to today with a seasonal pace, including across months",
    () => {
      const model = state();
      const profile = monthlyProfile(model.billing.weights);
      addReading(
        model,
        "2025-10-20",
        700 * profile("2025-08-01", "2025-10-20"),
      );
      const target = result(model, "2025-11-19");
      near(target.sinceReading, 700 * profile("2025-10-20", "2025-11-19"));
      near(target.remaining, 1000 - 700 * profile("2025-08-01", "2025-11-19"));
      assert.equal(target.basis, "readings");
      assert.equal(target.elapsedDays, 30);
      assert.ok(target.remaining < annual(model).remaining);
    },
  );

  await t.test(
    "one stale reading needs an annual estimate; a fresh reading needs no extrapolation",
    () => {
      const model = state();
      assert.equal(result(model, "2025-11-19").status, "missing-pace");
      assert.equal(result(model, "2025-08-01").status, "ready");
      model.billing.annualEstimate = "800";
      const target = result(model, "2025-11-19");
      near(
        target.sinceReading,
        800 * monthlyProfile(model.billing.weights)("2025-08-01", "2025-11-19"),
      );
      assert.equal(target.basis, "annual");
      model.billing.annualEstimate = "0";
      near(result(model, "2025-11-19").sinceReading, 0);
    },
  );

  await t.test(
    "estimated year opening is included and measured pace takes precedence over manual input",
    () => {
      const model = state();
      model.readings = [
        { id: "first", date: "2025-09-01", value: 10000 },
        { id: "last", date: "2025-10-01", value: 10050 },
      ];
      model.billing.annualEstimate = "9000";
      const target = result(model, "2025-11-19");
      assert.equal(target.status, "ready");
      assert.equal(target.estimatedOpening, true);
      const profile = monthlyProfile(model.billing.weights);
      near(
        target.remaining,
        1000 -
          (50 / profile("2025-09-01", "2025-10-01")) *
            profile("2025-08-01", "2025-11-19"),
      );
      assert.equal(target.basis, "readings");
    },
  );

  await t.test(
    "exhaustion, overuse and a zero measured pace never create negative or nonfinite targets",
    () => {
      for (const consumed of [0, 1000, 1200]) {
        const model = state();
        addReading(model, "2025-11-01", consumed);
        const target = result(model, "2025-11-19");
        assert.equal(target.status, "ready");
        assert.ok(Number.isFinite(target.daily));
        assert.ok(target.daily >= 0);
        if (consumed >= 1000) assert.equal(target.daily, 0);
        else near(target.sinceReading, 0);
      }
      const model = state();
      addReading(model, "2025-09-01", 500);
      assert.equal(result(model, "2026-01-01").daily, 0);
    },
  );

  await t.test(
    "zero profile months, missing data, historical years and the August boundary are explicit",
    () => {
      const model = state();
      assert.equal(
        result({ ...model, readings: [] }, "2025-11-19").status,
        "missing-readings",
      );
      assert.equal(result(model, "2025-07-31").status, "outside-year");
      assert.equal(result(model, "2026-08-01").status, "outside-year");
      model.billing.weights = Array(12).fill(0);
      model.billing.weights[0] = 1;
      model.billing.annualEstimate = "500";
      assert.equal(result(model, "2025-11-19").daily, 0);
      assert.equal(result(model, "2026-02-01").status, "missing-profile");
      assert.equal(result(model, "2025-11-19").sinceReading, 0);
      assert.equal(result(model, "2025-08-01").daily, 0);
    },
  );

  await t.test("leap day and the final day use actual calendar days", () => {
    const model = state(2027);
    const profile = monthlyProfile(model.billing.weights);
    addReading(model, "2028-02-29", 1000 * profile("2027-08-01", "2028-02-29"));
    const target = result(model, "2028-02-29");
    near(
      target.daily,
      (1000 * model.billing.weights[1]) /
        model.billing.weights.reduce((a, b) => a + b) /
        29,
    );
    addReading(model, "2028-07-31", 975);
    near(result(model, "2028-07-31").daily, 25);
  });

  await t.test(
    "custom summer usage and heat/correction factors influence the target, billing mode does not",
    () => {
      const model = state();
      model.billing.weights = [
        300, 250, 150, 60, 10, 1, 1, 1, 10, 60, 150, 250,
      ];
      addReading(model, "2026-06-01", 998);
      near(result(model, "2026-06-01").daily, 1 / 30);
      const baseline = result(model, "2026-06-01").daily;
      for (const mode of ["flat", "reading", "temperature"]) {
        model.billing.mode = mode;
        near(result(model, "2026-06-01").daily, baseline);
      }
      const opening = state();
      const before = result(opening, "2025-08-01").daily;
      opening.settings.correction = 2;
      near(result(opening, "2025-08-01").daily, before / 2);
    },
  );

  await t.test(
    "the UI shows today's date, basis, stale-reading age and actionable empty states",
    () => {
      const model = state();
      addReading(model, "2025-10-20", 50);
      const html = (date) =>
        render(GasDailyBudget, {
          props: { model, annual: annual(model), date },
        }).body;
      const ready = html("2025-11-19");
      assert.match(ready, /Mai szezonális fogyasztási cél/);
      assert.match(ready, /2025-11-19/);
      assert.match(ready, /30 napja/);
      assert.match(ready, /m³\/nap/);
      assert.match(ready, /sávkorrekció/);
      assert.match(html("2026-08-01"), /válaszd a mai napot tartalmazó/);
      model.readings = [];
      assert.match(html("2025-11-19"), /mérőállás és ismert vagy becsülhető/);
    },
  );
});
