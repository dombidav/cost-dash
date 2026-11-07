<script lang="ts">
  import ExpenseMetrics from "../components/ExpenseMetrics.svelte";
  import { money } from "../lib/format";
  import { monthLabel, shiftMonth } from "../lib/months";
  import type { Sources } from "./data";
  import { carPayments, subscriptionMonths } from "./schedule";

  let { sources, now }: { sources: Sources; now: string } = $props();
  let first = $derived(now.slice(0, 7));
  let end = $derived(`${shiftMonth(first, 12)}-01`);
  let car = $derived(carPayments(sources, `${first}-01`, end));
  let subscriptions = $derived(subscriptionMonths(sources, `${first}-01`, end));
  let plan = $derived(
    Array.from({ length: 12 }, (_, index) => {
      const month = shiftMonth(first, index);
      const fees =
        subscriptions.find((item) => item.month === month)?.items ?? [];
      const charges = car.filter((item) => item.due.startsWith(month));
      const regular =
        fees.reduce((total, item) => total + item.fee, 0) +
        charges.reduce(
          (total, item) => total + (item.frequency === 1 ? item.amount : 0),
          0,
        );
      const occasional = charges.reduce(
        (total, item) => total + (item.frequency > 1 ? item.amount : 0),
        0,
      );
      return { month, regular, occasional };
    }),
  );
  let regularAverage = $derived(
    plan.reduce((total, month) => total + month.regular, 0) / plan.length,
  );
  let occasionalAverage = $derived(
    plan.reduce((total, month) => total + month.occasional, 0) / plan.length,
  );
</script>

<section class="card" aria-labelledby="dashboard-monthly-plan">
  <h2 id="dashboard-monthly-plan">Mennyit tegyek félre havonta?</h2>
  <p class="expense-subtitle">
    A havidíjak és az ütemezett autós díjak havi átlaga, az aktuális hónaptól
    számított 12 hónapra.
  </p>
  {#if regularAverage || occasionalAverage}
    <ExpenseMetrics
      items={[
        {
          label: "Havonta fizetett díjak átlaga",
          value: money(regularAverage),
        },
        {
          label: "Ritkábban fizetett díjak havi része",
          value: money(occasionalAverage),
        },
        {
          label: "Havi tervezési összeg",
          value: money(regularAverage + occasionalAverage),
        },
      ]}
    />
    <details class="expense-detail">
      <summary>Melyik hónapban mennyit kell fizetni?</summary>
      <ul class="expense-list">
        {#each plan as month (month.month)}
          <li>
            <div>
              <strong>{monthLabel(month.month)}</strong>
              {#if month.occasional}
                <p>Ebből ritkábban fizetett díj: {money(month.occasional)}</p>
              {/if}
            </div>
            <span>{money(month.regular + month.occasional)}</span>
          </li>
        {/each}
      </ul>
    </details>
  {:else}
    <p class="empty-state">
      Adj meg havidíjat vagy ütemezett autós díjat a havi tervezéshez.
    </p>
  {/if}
</section>
