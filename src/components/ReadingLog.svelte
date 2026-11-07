<script lang="ts">
  import Field from './Field.svelte';
  import Chart from './Chart.svelte';
  import { A2_PEAK_HELP } from '../lib/field-help';
  import { fmt } from '../lib/format';
  let { id, rows, unit, columns, onedit, onremove, onopening }: { id: string; rows: { id: string; date: string; values: (number | null)[]; total: number | null }[]; unit: string; columns: string[]; onedit: (id: string, field: number | 'date', value: string) => string | void; onremove: (id: string) => void; onopening: () => void } = $props();
  let ordered = $derived([...rows].sort((a, b) => a.date.localeCompare(b.date)));
  let chartData = $derived(ordered.filter(row => row.total !== null).map(row => ({ id: row.id, date: row.date, value: row.total! })));
  let total = $derived(chartData.length > 1 ? chartData.at(-1)!.value - chartData[0].value : 0);
</script>
<section class="card history-card" {id}>
  <div class="history-heading"><div><div class="card-heading"><h2>Mérési napló</h2><span class="count">{rows.length} mérés</span></div><p class="section-intro">Dátum szerint rendezett állások. Az érvényes módosítás mezőelhagyáskor mentődik.</p></div><button class="text-button" type="button" onclick={onopening}>Évkezdő állás megadása ↗</button></div>
  {#if !rows.length}<div class="empty-state"><span class="empty-icon" aria-hidden="true">＋</span><h3>Az első méréseddel kezdődik.</h3><p>Rögzíts két állást, és már látod a fogyasztásodat. Korábbi dátum is megadható.</p></div>{:else}
    <div class="chart-heading"><span>Összesített mért fogyasztás</span><span>{fmt(total)} {unit}</span></div>
    <Chart id={`${id}-chart`} unit={unit} readings={chartData} label={`Mért fogyasztás: ${fmt(total)} ${unit}, ${chartData.length} mérés alapján.`}/>
    <p class="field-hint">A pontok mérések, a köztük húzott vonal szemléltetés.</p>
    <div class="history-table-wrap"><table><caption class="sr-only">Szerkeszthető mérési napló</caption><thead><tr><th>Dátum</th>{#each columns as column}<th>{column} / {unit}</th>{/each}<th>Fogyasztás / {unit}</th><th><span class="sr-only">Műveletek</span></th></tr></thead><tbody>
    {#each [...ordered].reverse() as row (row.id)}{@const index = ordered.findIndex(r => r.id === row.id)}<tr><td data-label="Dátum"><Field id={`${id}-${row.id}-date`} label={`${row.date} mérés dátuma`} value={row.date} hiddenLabel oncommit={value => onedit(row.id, 'date', value)}/></td>{#each columns as column, columnIndex}<td data-label={`${column} · ${unit}`}><Field id={`${id}-${row.id}-${columnIndex}`} label={`${row.date} ${column}`} value={row.values[columnIndex]} help={unit === 'kWh' && columns.length === 2 && columnIndex === 0 ? A2_PEAK_HELP : undefined} decimal hiddenLabel oncommit={value => onedit(row.id, columnIndex, value)}/></td>{/each}<td class="consumption-cell" data-label="Fogyasztás">{index && row.total !== null && ordered[index - 1].total !== null ? `+${fmt(row.total - ordered[index - 1].total!)}` : '—'}<small>{index ? `${Math.round((Date.parse(row.date) - Date.parse(ordered[index - 1].date)) / 86400000)} nap alatt` : 'Kezdőállás'}</small></td><td class="row-actions"><button class="delete-button" type="button" aria-label={`${row.date} mérés törlése`} onclick={() => onremove(row.id)}>×</button></td></tr>{/each}
    </tbody></table></div>
  {/if}
</section>
