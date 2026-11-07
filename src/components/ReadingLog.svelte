<script lang="ts">
  import Field from "./Field.svelte";
  import Chart from "./Chart.svelte";
  import { A2_PEAK_HELP } from "../lib/field-help";
  import { fmt } from "../lib/format";
  import { days, sortByDate } from "../calendar";
  let {
    id,
    rows,
    unit,
    columns,
    onedit,
    onremove,
    onopening,
  }: {
    id: string;
    rows: {
      id: string;
      date: string;
      values: (number | null)[];
      total: number | null;
    }[];
    unit: string;
    columns: string[];
    onedit: (
      id: string,
      field: number | "date",
      value: string,
    ) => string | void;
    onremove: (id: string) => void;
    onopening: () => void;
  } = $props();

  const previewSize = 3;
  const pageSize = 12;
  let expanded = $state(false);
  let page = $state(1);
  let ordered = $derived(sortByDate(rows));
  let pageCount = $derived(Math.max(1, Math.ceil(ordered.length / pageSize)));
  let currentPage = $derived(Math.min(page, pageCount));
  let pageEnd = $derived(
    ordered.length - (expanded ? (currentPage - 1) * pageSize : 0),
  );
  let visibleRows = $derived(
    ordered
      .slice(
        Math.max(0, pageEnd - (expanded ? pageSize : previewSize)),
        pageEnd,
      )
      .reverse(),
  );

  function toggleExpanded() {
    page = 1;
    expanded = !expanded;
  }

  let chartData = $derived(
    ordered
      .filter((row) => row.total !== null)
      .map((row) => ({ id: row.id, date: row.date, value: row.total! })),
  );
  let total = $derived(
    chartData.length > 1 ? chartData.at(-1)!.value - chartData[0].value : 0,
  );
</script>

<section class="card history-card" {id}>
  <div class="history-heading">
    <div>
      <div class="card-heading">
        <h2>Mérési napló</h2>
        <span class="count">{rows.length} mérés</span>
      </div>
      <p class="section-intro">
        Dátum szerint rendezett állások. Az érvényes módosítás mezőelhagyáskor
        mentődik.
      </p>
    </div>
    <button class="text-button" type="button" onclick={onopening}
      >Évkezdő állás megadása ↗</button
    >
  </div>
  {#if !rows.length}<div class="empty-state">
      <span class="empty-icon" aria-hidden="true">＋</span>
      <h3>Az első méréseddel kezdődik.</h3>
      <p>
        Rögzíts két állást, és már látod a fogyasztásodat. Korábbi dátum is
        megadható.
      </p>
    </div>{:else}
    <div class="chart-heading">
      <span>Összesített mért fogyasztás</span><span>{fmt(total)} {unit}</span>
    </div>
    <Chart
      id={`${id}-chart`}
      {unit}
      readings={chartData}
      label={`Mért fogyasztás: ${fmt(total)} ${unit}, ${chartData.length} mérés alapján.`}
    />
    <p class="field-hint">
      A pontok mérések, a köztük húzott vonal szemléltetés.
    </p>
    <div class="history-table-wrap" id={`${id}-table`}>
      <table>
        <caption class="sr-only">Szerkeszthető mérési napló</caption><thead
          ><tr
            ><th>Dátum</th>{#each columns as column (column)}<th
                >{column} / {unit}</th
              >{/each}<th>Fogyasztás / {unit}</th><th
              ><span class="sr-only">Műveletek</span></th
            ></tr
          ></thead
        ><tbody>
          {#each visibleRows as row, rowIndex (row.id)}
            {@const previous = ordered[pageEnd - rowIndex - 2]}
            <tr
              ><td data-label="Dátum"
                ><Field
                  id={`${id}-${row.id}-date`}
                  label={`${row.date} mérés dátuma`}
                  value={row.date}
                  hiddenLabel
                  oncommit={(value) => onedit(row.id, "date", value)}
                /></td
              >{#each columns as column, columnIndex (column)}<td
                  data-label={`${column} · ${unit}`}
                  ><Field
                    id={`${id}-${row.id}-${columnIndex}`}
                    label={`${row.date} ${column}`}
                    value={row.values[columnIndex]}
                    help={unit === "kWh" &&
                    columns.length === 2 &&
                    columnIndex === 0
                      ? A2_PEAK_HELP
                      : undefined}
                    decimal
                    hiddenLabel
                    oncommit={(value) => onedit(row.id, columnIndex, value)}
                  /></td
                >{/each}<td class="consumption-cell" data-label="Fogyasztás"
                >{previous && row.total !== null && previous.total !== null
                  ? `+${fmt(row.total - previous.total)}`
                  : "—"}<small
                  >{previous
                    ? `${days(previous.date, row.date)} nap alatt`
                    : "Kezdőállás"}</small
                ></td
              ><td class="row-actions"
                ><button
                  class="delete-button"
                  type="button"
                  aria-label={`${row.date} mérés törlése`}
                  onclick={() => onremove(row.id)}>×</button
                ></td
              ></tr
            >{/each}
        </tbody>
      </table>
    </div>
    {#if expanded}
      <nav class="history-pagination" aria-label="A mérési napló oldalai">
        <span role="status">{currentPage}. oldal, összesen {pageCount}</span>
        <div class="page-buttons">
          <button
            type="button"
            aria-label="Első oldal"
            disabled={currentPage === 1}
            onclick={() => (page = 1)}>Első</button
          >
          <button
            type="button"
            aria-label="Előző oldal"
            disabled={currentPage === 1}
            onclick={() => (page = currentPage - 1)}>Előző</button
          >
          <button
            type="button"
            aria-label="Következő oldal"
            disabled={currentPage === pageCount}
            onclick={() => (page = currentPage + 1)}>Következő</button
          >
          <button
            type="button"
            aria-label="Utolsó oldal"
            disabled={currentPage === pageCount}
            onclick={() => (page = pageCount)}>Utolsó</button
          >
        </div>
      </nav>
    {/if}
    {#if expanded || rows.length > previewSize}
      <button
        class="text-button history-toggle"
        type="button"
        aria-expanded={expanded}
        aria-controls={`${id}-table`}
        onclick={toggleExpanded}
        >{expanded ? "Mutass kevesebbet" : "Mutass többet"}</button
      >
    {/if}
  {/if}
</section>

<style>
  .history-pagination {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
    color: var(--muted);
    font-size: 12px;
  }
  .page-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .page-buttons button {
    min-height: 38px;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: transparent;
    color: var(--accent);
    font-size: 12px;
  }
  .page-buttons button:enabled:hover {
    border-color: var(--accent);
  }
  .page-buttons button:disabled {
    cursor: default;
  }
  .history-toggle {
    min-height: 40px;
    margin-top: 8px;
  }
</style>
