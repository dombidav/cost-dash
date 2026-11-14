<script lang="ts">
  import EntryInput from "../components/EntryInput.svelte";
  import ExpenseMetrics from "../components/ExpenseMetrics.svelte";
  import { monthPeriod, parseNumber } from "../calendar";
  import { money } from "../lib/format";
  import { monthLabel, nonnegative } from "../lib/months";
  import { storage } from "../lib/storage.svelte";
  import { categoryIds, type MonthReport, type Sources } from "./data";
  import { carPayments } from "./schedule";
  import { BUDGET_KEY, validBudget } from "./state";

  let {
    row,
    sources,
    now,
  }: { row: MonthReport; sources: Sources; now: string } = $props();
  const disk = storage<number | null>(BUDGET_KEY, () => null, validBudget);
  let budget = $state(disk.data);
  let draft = $state(disk.data?.toString() ?? "");
  let feedback = $state("");
  let error = $state(false);
  let known = $derived(
    categoryIds
      .filter((id) => id !== "subscriptions")
      .map((id) => row.costs[id].value)
      .filter((value) => value !== null),
  );
  let spent = $derived(known.reduce((total, value) => total + value, 0));
  let planned = $derived(
    (row.costs.subscriptions.value ?? 0) +
      carPayments(sources, now, monthPeriod(now).end).reduce(
        (total, item) => total + item.amount,
        0,
      ),
  );
  let usedWidth = $derived(
    budget ? Math.min(100, Math.max(0, (spent / budget) * 100)) : 0,
  );
  let plannedWidth = $derived(
    budget ? Math.min(100, (planned / budget) * 100) : 0,
  );

  function save(event: SubmitEvent) {
    event.preventDefault();
    const value = draft.trim() ? parseNumber(draft) : null;
    if (value !== null && (!nonnegative(value) || value <= 0)) {
      error = true;
      feedback =
        "Adj meg 0 Ft-nál nagyobb, legfeljebb 1 milliárd Ft-os keretet.";
      return;
    }
    budget = value;
    error = !disk.save(value);
    feedback = error
      ? "A keret ebben a munkamenetben érvényes. A böngészőbe nem sikerült menteni."
      : value === null
        ? "A havi keretet kikapcsoltad."
        : "A havi keretet elmentetted.";
  }
</script>

<svelte:window onstorage={disk.onStorage} />
<section class="card" aria-labelledby="dashboard-budget">
  <h2 id="dashboard-budget">Beleférek a havi keretbe?</h2>
  <p class="expense-subtitle">
    Állíts be egy saját havi keretet. A sáv mindig az aktuális hónap adatait
    mutatja ({monthLabel(row.month)}).
  </p>
  {#if disk.warning}
    <p class="notice danger" role="alert">{disk.warning}</p>
  {/if}
  <form onsubmit={save}>
    <EntryInput
      id="dashboard-budget-amount"
      label="Havi keret · Ft"
      bind:value={draft}
      inputmode="decimal"
      placeholder="pl. 100 000"
      help={{
        what: "A havi kiadásokra szánt összeg. Mentés után ebben a böngészőben marad.",
        where:
          "Te adod meg. Ha kikapcsolnád, töröld az összeget és mentsd el üresen.",
      }}
    />
    <button type="submit" class="primary-button">Keret mentése</button>
  </form>
  <p class="feedback" class:danger={error} role="status">{feedback}</p>
  {#if budget !== null}
    <ExpenseMetrics
      items={[
        {
          label: "Rögzített és becsült tételek",
          value: known.length ? money(spent) : "Nincs adat",
        },
        { label: "Ütemezett díjak", value: money(planned) },
        { label: "Havi keret", value: money(budget) },
      ]}
    />
    <div class="budget-track" aria-hidden="true">
      <span class="used" style:width={`${usedWidth}%`}></span>
    </div>
    {#if planned > 0}
      <div class="budget-track planned-track" aria-hidden="true">
        <span class="planned" style:width={`${plannedWidth}%`}></span>
      </div>
    {/if}
    {#if known.length}
      <p>
        {#if spent > budget}
          A figyelembe vett tételek {money(spent - budget)} összeggel túllépik a keretet.
        {:else if spent === budget}
          A figyelembe vett tételek elérték a keretet.
        {:else}
          A keret és a figyelembe vett tételek különbözete {money(
            budget - spent,
          )}, a külön mutatott ütemezett díjak figyelembevétele előtt.
        {/if}
      </p>
    {/if}
    {#if planned > 0}
      <p class="field-hint">
        A csíkos sáv külön mutatja a havidíjakat és a hónap végéig esedékes
        autós díjakat. Az ütemezés a befizetés állapotától független. A
        havidíjak a fenti különbözetből még nincsenek levonva. Az autós díjak
        között már naplózott kifizetés is lehet, ezért a két sáv nem adható
        össze automatikusan.
      </p>
    {/if}
  {/if}
</section>

<style>
  form {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 8px 16px;
  }
  form :global(.field) {
    flex: 1 1 220px;
    min-width: 0;
    max-width: 320px;
  }
  form button {
    width: auto;
    margin: 0;
  }
  .feedback:empty {
    margin: 0;
  }
  .budget-track {
    display: flex;
    overflow: hidden;
    height: 14px;
    margin-top: 16px;
    border: 1px solid var(--muted);
    border-radius: 8px;
    background: var(--bg);
  }
  .used {
    background: var(--accent);
  }
  .planned-track {
    margin-top: 6px;
  }
  .planned {
    background: repeating-linear-gradient(
      135deg,
      var(--muted) 0 3px,
      var(--bg) 3px 6px
    );
  }
</style>
