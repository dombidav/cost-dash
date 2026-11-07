<script lang="ts">
  import Help from "../components/Help.svelte";
  import { money } from "../lib/format";
  import { monthLabel, shiftMonth } from "../lib/months";
  import { categories } from "../lib/pages";
  import {
    categoryColorProperty,
    categoryIds,
    reports,
    type MonthReport,
    type Sources,
  } from "./data";

  let {
    row,
    sources,
    now,
  }: { row: MonthReport; sources: Sources; now: string } = $props();

  let offset = $state(-1);
  let referenceMonth = $derived(shiftMonth(row.month, offset));
  let reference = $derived(
    reports(sources, Number(referenceMonth.slice(0, 4)), now)[
      Number(referenceMonth.slice(5, 7)) - 1
    ],
  );
  let changes = $derived(
    categoryIds.flatMap((id) => {
      const current = row.costs[id];
      const earlier = reference?.costs[id];
      if (
        current.value === null ||
        earlier?.value == null ||
        current.partial ||
        earlier.partial
      )
        return [];
      return [{ id, delta: current.value - earlier.value }];
    }),
  );
  let total = $derived(changes.reduce((sum, item) => sum + item.delta, 0));
  let largest = $derived(
    [...changes].sort((a, b) =>
      total < 0 ? a.delta - b.delta : b.delta - a.delta,
    )[0],
  );
  let scale = $derived(
    Math.max(1, ...changes.map((item) => Math.abs(item.delta))),
  );
  const signedMoney = (value: number) =>
    `${value > 0 ? "+" : ""}${money(value)}`;
</script>

<section class="card" aria-labelledby="dashboard-comparison">
  <h2 id="dashboard-comparison">Mi változott a kiadásokban?</h2>
  <p class="expense-subtitle">
    Nézd meg, melyik kategória húzta fel vagy le a havi összeget.
  </p>
  <div class="field comparison-field">
    <div class="field-label">
      <label for="dashboard-comparison-period">Viszonyítási időszak</label>
      <Help
        forId="dashboard-comparison-period"
        label="Viszonyítási időszak"
        content={{
          what: "Ehhez a hónaphoz viszonyítjuk a fent kiválasztott hónapot.",
          where:
            "Idényjellegű kiadásoknál, például fűtésnél, válaszd a tavalyi azonos hónapot.",
        }}
      />
    </div>
    <select
      id="dashboard-comparison-period"
      bind:value={offset}
      aria-describedby="dashboard-comparison-period-help"
    >
      <option value={-1}>Előző hónap</option>
      <option value={-12}>Tavalyi azonos hónap</option>
    </select>
  </div>
  {#if changes.length}
    <p>
      <strong>{monthLabel(row.month)}</strong> és
      <strong>{monthLabel(referenceMonth)}</strong>
      között
      {#if total === 0}
        az összehasonlítható kiadások összesen nem változtak.
      {:else}
        <strong>{money(Math.abs(total))}</strong> az eltérés
        {total > 0 ? "növekedés" : "csökkenés"} irányában. A legnagyobb {total >
        0
          ? "növekedés"
          : "csökkenés"}:
        <strong
          >{categories[largest.id].label}, {signedMoney(largest.delta)}</strong
        >.
      {/if}
    </p>
    <ul
      class="expense-list comparison-list"
      aria-label="Kiadások változása kategóriánként"
    >
      {#each changes as { id, delta } (id)}
        <li style:--category-color={`var(${categoryColorProperty(id)})`}>
          <span>{categories[id].label}</span>
          <strong>{signedMoney(delta)}</strong>
          <span class="delta-track" aria-hidden="true">
            <span
              class="delta-fill"
              class:negative={delta < 0}
              style:width={`${(Math.abs(delta) / scale) * 50}%`}
            ></span>
          </span>
        </li>
      {/each}
    </ul>
    <p class="field-hint">
      Az összegben az a {changes.length} kategória szerepel, amelyikhez mindkét hónapban
      van használható, teljes adat.
    </p>
  {:else}
    <p class="empty-state">
      {monthLabel(referenceMonth)} és {monthLabel(row.month)} között még nincs összehasonlítható
      kategória.
    </p>
  {/if}
</section>

<style>
  .comparison-field {
    max-width: 320px;
  }
  .comparison-list li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px 16px;
  }
  .comparison-list strong {
    color: var(--category-color);
  }
  .delta-track {
    position: relative;
    grid-column: 1 / -1;
    height: 8px;
    background: var(--bg);
    border-radius: 8px;
  }
  .delta-track::before {
    position: absolute;
    left: 50%;
    height: 100%;
    border-left: 1px solid var(--muted);
    content: "";
  }
  .delta-fill {
    position: absolute;
    left: 50%;
    height: 100%;
    border-radius: inherit;
    background: var(--category-color);
  }
  .delta-fill.negative {
    right: 50%;
    left: auto;
  }
</style>
