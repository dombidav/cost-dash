<script lang="ts">
  import Chart from "../components/Chart.svelte";
  import ExpenseMetrics from "../components/ExpenseMetrics.svelte";
  import { addDays } from "../calendar";
  import { percentChange } from "../lib/consumption";
  import { fmt, money, signed } from "../lib/format";
  import CarExamples from "./CarExamples.svelte";
  import type { CarEntry } from "./state";

  let {
    entries,
    now,
    consumption,
    fuelPerKm,
  }: {
    entries: readonly CarEntry[];
    now: string;
    consumption: number | null;
    fuelPerKm: number | null;
  } = $props();
  const reference = { petrol: 7.89, diesel: 6.88 };
  let boundary = $derived(addDays(now, -29));
  let previousStart = $derived(addDays(boundary, -30));
  let recent = $derived(entries.filter((item) => item.date >= boundary));
  let previous = $derived(
    entries.filter(
      (item) => item.date >= previousStart && item.date < boundary,
    ),
  );
  let recentPaid = $derived(recent.reduce((sum, item) => sum + item.paid, 0));
  let previousPaid = $derived(
    previous.reduce((sum, item) => sum + item.paid, 0),
  );
  let change = $derived(
    recent.length && previous.length
      ? percentChange(recentPaid, previousPaid)
      : null,
  );
  let averageFuelPrice = $derived(
    consumption && fuelPerKm !== null ? (fuelPerKm * 100) / consumption : null,
  );
</script>

<section class="card" aria-labelledby="car-spending-trend">
  <h2 id="car-spending-trend">Hogyan változtak az autós kiadásaid?</h2>
  <p class="expense-subtitle">
    Két egyforma hosszú időszakot hasonlítunk össze: az elmúlt 30 napot és az
    előtte lévő 30 napot.
  </p>
  {#if recent.length || previous.length}
    <ExpenseMetrics
      items={[
        {
          label: "Elmúlt 30 nap",
          value: recent.length ? money(recentPaid) : "Nincs tétel",
        },
        {
          label: "Előző 30 nap",
          value: previous.length ? money(previousPaid) : "Nincs tétel",
        },
        ...(change === null
          ? []
          : [{ label: "Változás", value: signed(change, 2, 0) }]),
      ]}
    />
    <p class="field-hint">
      A naplózott kifizetéseket számoljuk. Egy nagyobb egyszeri szerviz is
      meglátszik az eltérésen.
    </p>
  {:else}
    <p class="empty-state">
      A kiadások összevetéséhez rögzíts egy tételt az elmúlt 60 napból.
    </p>
  {/if}
</section>

<CarExamples entries={recent} />

<section class="card" aria-labelledby="car-benchmark">
  <h2 id="car-benchmark">Hol állsz a fogyasztással?</h2>
  <p class="expense-subtitle">
    Az átlagod az EU-ban vizsgált benzines és dízel autók valós fogyasztása
    mellett.
  </p>
  {#if consumption !== null}
    <Chart
      id="car-consumption-benchmark"
      kind="benchmark"
      unit="l/100 km"
      digits={2}
      minimumDigits={0}
      label={`Saját átlag: ${fmt(consumption, 2, 0)} liter száz kilométerenként, az európai benzines és dízel mintával összevetve.`}
      bars={[
        {
          label: "Saját átlag",
          short: "Saját átlag",
          value: consumption,
          own: true,
        },
        { label: "Benzines minta", value: reference.petrol, own: false },
        { label: "Dízel minta", value: reference.diesel, own: false },
      ]}
    />
    {#if averageFuelPrice !== null && consumption >= 1}
      <p class="field-hint">
        Ha 1 l/100 km-rel csökkenne a fogyasztásod, 1000 km-en <strong
          >10 literrel</strong
        >
        kevesebb üzemanyagot használnál. Ez a naplózott átlagos literáradon kb.
        <strong>{money(averageFuelPrice * 10)}</strong> megtakarítás.
      </p>
    {/if}
  {:else}
    <p class="empty-state">
      A saját átlagod akkor jelenik meg, ha naplóztál két tele tankolás között
      mért utat.
    </p>
  {/if}
  <p class="field-hint">
    <a
      href="https://climate.ec.europa.eu/document/download/b644dafe-1385-4b56-98d9-21e7e9f3601b_en?filename=report.pdf"
      >Európai Bizottság</a
    >, 2021-ben forgalomba helyezett autók mintája: benzines {fmt(
      reference.petrol,
      2,
      0,
    )}, dízel {fmt(reference.diesel, 2, 0)} l/100 km. Az útvonal és az autó típusa
    befolyásolja az összevetést.
  </p>
</section>
