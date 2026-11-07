<script lang="ts">
  import Help from "../components/Help.svelte";
  import { fmt } from "../lib/format";
  import { monthLabel } from "../lib/months";
  import { categories } from "../lib/pages";
  import { utilities, utilityMonths, type Utility } from "./consumption";
  import type { MonthReport, Sources } from "./data";

  let {
    sources,
    months,
    year,
  }: { sources: Sources; months: MonthReport[]; year: number } = $props();
  const ids = Object.keys(utilities) as Utility[];
  const metrics = {
    cost: "Becsült díj",
    volume: "Fogyasztás",
    daily: "Napi átlag",
  } as const;
  let id = $state<Utility>("gas");
  let metric = $state<keyof typeof metrics>("cost");
  let rows = $derived(utilityMonths(sources, months, id));
  let unit = $derived(
    metric === "cost"
      ? "Ft"
      : metric === "daily"
        ? `${utilities[id]}/nap`
        : utilities[id],
  );
  let points = $derived(
    rows.map((row) => ({
      month: row.month,
      value: row[metric],
      partial: metric === "cost" ? row.costPartial : row.usagePartial,
    })),
  );
  let hasData = $derived(points.some((point) => point.value !== null));
  let canvas = $state<HTMLCanvasElement>();
  let failed = $state(false);

  $effect(() => {
    if (!canvas) return;
    const target = canvas;
    const current = { points, id, unit };
    let stopped = false;
    let dispose: (() => void) | undefined;
    void import("./chart")
      .then(({ drawUtilityChart }) => {
        if (stopped) return;
        dispose = drawUtilityChart(
          target,
          current.points,
          current.id,
          current.unit,
        );
        failed = false;
      })
      .catch(() => {
        if (!stopped) failed = true;
      });
    return () => {
      stopped = true;
      dispose?.();
    };
  });
</script>

<section class="card" aria-labelledby="dashboard-utilities">
  <h2 id="dashboard-utilities">Többet fogyasztottam, vagy többe került?</h2>
  <p class="expense-subtitle">
    Nézd meg ugyanazt az évet a becsült díj, a fogyasztás vagy a napi átlag
    alapján.
  </p>
  <div class="expense-fields">
    <div class="field">
      <div class="field-label">
        <label for="dashboard-utility">Közmű</label>
        <Help
          forId="dashboard-utility"
          label="Közmű"
          content={{
            what: "A grafikonon látható közmű.",
            where:
              "A grafikon a kiválasztott oldalra mentett adatokból készül.",
          }}
        />
      </div>
      <select
        id="dashboard-utility"
        bind:value={id}
        aria-describedby="dashboard-utility-help"
      >
        {#each ids as option (option)}
          <option value={option}>{categories[option].label}</option>
        {/each}
      </select>
    </div>
    <div class="field">
      <div class="field-label">
        <label for="dashboard-utility-metric">Nézet</label>
        <Help
          forId="dashboard-utility-metric"
          label="Nézet"
          content={{
            what: "A becsült díj, az adott havi fogyasztás vagy a lefedett napokra jutó átlag.",
            where:
              "A díj a Dashboard becslése. A mennyiséget a rögzített mérőállásokból vagy a megadott időszaki fogyasztásból számoljuk.",
          }}
        />
      </div>
      <select
        id="dashboard-utility-metric"
        bind:value={metric}
        aria-describedby="dashboard-utility-metric-help"
      >
        <option value="cost">{metrics.cost} · Ft</option>
        <option value="volume">{metrics.volume} · {utilities[id]}</option>
        <option value="daily">{metrics.daily} · {utilities[id]}/nap</option>
      </select>
    </div>
  </div>
  {#if hasData}
    {#if failed}
      <p class="field-hint">
        A grafikon nem tölthető be. Az értékeket alább találod.
      </p>
    {/if}
    <div
      class="utility-chart"
      role="img"
      aria-label={`${year}. év · ${categories[id].label} · ${metrics[metric]} (${unit})`}
    >
      <canvas bind:this={canvas} aria-hidden="true"></canvas>
    </div>
    {#if points.some((point) => point.partial && point.value !== null)}
      <p class="field-hint">A körvonalas oszlop részleges adatot jelöl.</p>
    {/if}
    <details class="expense-detail">
      <summary>A grafikon adatai szövegesen</summary>
      <ul class="expense-list">
        {#each points as point (point.month)}
          <li>
            <span>{monthLabel(point.month)}</span>
            <strong>
              {#if point.value === null}
                Nincs adat
              {:else}
                {fmt(point.value, metric === "cost" ? 0 : 2, 0)}
                {unit}{point.partial ? " · részleges" : ""}
              {/if}
            </strong>
          </li>
        {/each}
      </ul>
    </details>
  {:else}
    <p class="empty-state">
      Ehhez a nézethez nincs adat a kiválasztott évben.
      <a href={categories[id].href}
        >Megnyitom a(z) {categories[id].label} oldalt</a
      >.
    </p>
  {/if}
  <p class="field-hint">
    {#if metric === "cost"}
      A becslés a jelenlegi díjbeállításokkal készül.
    {:else}
      A két mérőállás közötti fogyasztást a napok arányában osztjuk el.
      {#if metric === "daily" && id === "electricity"}
        Több mérőnél csak akkor mutatunk közös napi átlagot, ha mindegyik
        érintett mérő adatai lefedik a rá eső időszakot.
      {/if}
    {/if}
  </p>
</section>

<style>
  .utility-chart {
    position: relative;
    height: clamp(200px, 30vw, 310px);
    width: 100%;
    overflow: hidden;
    margin-top: 12px;
  }
</style>
