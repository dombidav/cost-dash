<script lang="ts">
  import { addDays } from "../calendar";
  import { money } from "../lib/format";
  import { monthLabel } from "../lib/months";
  import { categories } from "../lib/pages";
  import type { Sources } from "./data";
  import { carPayments, subscriptionMonths } from "./schedule";

  let { sources, now }: { sources: Sources; now: string } = $props();
  let end = $derived(addDays(now, 30));
  let dated = $derived(carPayments(sources, now, end));
  let monthly = $derived(subscriptionMonths(sources, now, end));
  const dateFormat = new Intl.DateTimeFormat("hu-HU", {
    dateStyle: "long",
    timeZone: "UTC",
  });
  const dateLabel = (date: string) => dateFormat.format(new Date(date));
</script>

<section class="card" aria-labelledby="dashboard-upcoming">
  <h2 id="dashboard-upcoming">Mi esedékes a következő 30 napban?</h2>
  <p class="expense-subtitle">
    Tervezett díjak {dateLabel(now)} és {dateLabel(addDays(end, -1))} között, a megadott
    ütemezés alapján.
  </p>
  {#if dated.length}
    <h3>Napra pontos díjak</h3>
    <ul class="expense-list payments">
      {#each dated as item (item.id)}
        <li>
          <div>
            <a class="car-link" href={`${categories.car.href}#car-recurring`}
              >{item.name}</a
            >
            <p>
              {item.car} ·
              <time datetime={item.due}>{dateLabel(item.due)}</time>
            </p>
          </div>
          <strong>{money(item.amount)}</strong>
        </li>
      {/each}
    </ul>
  {/if}
  {#if monthly.length}
    <h3>Havidíjak hónap szerint</h3>
    <p class="field-hint">
      A havidíjakhoz csak hónap van megadva, így a pontos fizetési nap eltérhet
      a fenti időszaktól.
    </p>
    {#each monthly as { month, items } (month)}
      <h4>{monthLabel(month)}</h4>
      <ul class="expense-list payments">
        {#each items as item (item.id)}
          <li>
            <a
              class="subscription-link"
              href={`${categories.subscriptions.href}#subscriptions-log`}
              >{item.name}</a
            >
            <strong>{money(item.fee)}</strong>
          </li>
        {/each}
      </ul>
    {/each}
  {/if}
  {#if !dated.length && !monthly.length}
    <p class="empty-state">
      Ebben az időszakban nincs ütemezett díj a rögzített adatok között.
    </p>
  {/if}
</section>

<style>
  h3,
  h4 {
    margin: 16px 0 8px;
    font-size: 1rem;
  }
  .payments li {
    flex-wrap: wrap;
  }
  .payments li > :first-child {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .car-link {
    color: var(--category-car);
  }
  .subscription-link {
    color: var(--category-subscriptions);
  }
</style>
