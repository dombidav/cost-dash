<script lang="ts">
  import { tick } from "svelte";
  import Chart from "../components/Chart.svelte";
  import EntryInput from "../components/EntryInput.svelte";
  import ExpenseMetrics from "../components/ExpenseMetrics.svelte";
  import PageIntro from "../components/PageIntro.svelte";
  import PdfActions from "../components/PdfActions.svelte";
  import { subscriptionsReport } from "./report";
  import { parseNumber, today } from "../calendar";
  import { money, uid } from "../lib/format";
  import { monthLabel, shiftMonth } from "../lib/months";
  import { storage } from "../lib/storage.svelte";
  import { toast } from "../lib/ui.svelte";
  import {
    activeIn,
    initialSubscriptions,
    SUBSCRIPTIONS_KEY,
    validSubscription,
    validSubscriptions,
    type Subscription,
  } from "./state";

  const disk = storage(
    SUBSCRIPTIONS_KEY,
    initialSubscriptions,
    validSubscriptions,
  );
  let rows = $state(disk.data);
  const month = today().slice(0, 7);
  let name = $state("");
  let fee = $state("");
  let start = $state(month);
  let end = $state("");
  let editing = $state("");
  let error = $state("");
  let active = $derived(
    rows.filter((item) => activeIn(item, month)).sort((a, b) => b.fee - a.fee),
  );
  let inactive = $derived(
    rows
      .filter((item) => !activeIn(item, month))
      .sort((a, b) => b.start.localeCompare(a.start)),
  );
  let monthly = $derived(active.reduce((sum, item) => sum + item.fee, 0));
  let annual = $derived(monthly * 12);
  const nextMonths = Array.from({ length: 3 }, (_, index) =>
    shiftMonth(month, index + 1),
  );
  let forecast = $derived(
    nextMonths.map((month) => ({
      month,
      value: rows.reduce(
        (total, item) => (activeIn(item, month) ? total + item.fee : total),
        0,
      ),
    })),
  );

  function reset() {
    name = fee = end = editing = error = "";
    start = month;
  }

  async function edit(item: Subscription) {
    editing = item.id;
    name = item.name;
    fee = String(item.fee);
    start = item.start;
    end = item.end;
    error = "";
    await tick();
    document.getElementById("subscription-name")?.focus();
  }

  function save(event: SubmitEvent) {
    event.preventDefault();
    const item = {
      id: editing || uid(),
      name: name.trim(),
      fee: parseNumber(fee),
      start,
      end,
    };
    if (!validSubscription(item)) {
      error =
        "Adj meg nevet, pozitív havidíjat és érvényes első hónapot. Az utolsó hónap nem lehet korábbi az elsőnél.";
      return;
    }
    const next = [...rows.filter((row) => row.id !== editing), item];
    if (!disk.save(next)) {
      error =
        "A havidíjat nem sikerült elmenteni. A megadott mezők megmaradtak; a korábbi napló nem változott.";
      return;
    }
    rows = next;
    reset();
    toast("A havidíjat elmentetted.");
  }

  function remove(item: Subscription) {
    const next = rows.filter((row) => row.id !== item.id);
    if (!disk.save(next)) {
      toast(
        "A havidíjat nem sikerült törölni a helyi mentésből. A korábbi tétel megmaradt.",
      );
      return;
    }
    if (editing === item.id) reset();
    rows = next;
    toast(
      "A havidíjat minden hónapból törölted.",
      () => {
        if (rows.some((row) => row.id === item.id)) return;
        const restored = [...rows, item];
        if (!disk.save(restored)) {
          toast("A havidíjat nem sikerült visszaállítani a helyi mentésbe.");
          return;
        }
        rows = restored;
      },
      "subscriptions-log",
    );
  }
</script>

<svelte:window onstorage={disk.onStorage} />
<div class="expense-page">
  <PageIntro
    eyebrow="HAVIDÍJAK, EGY HELYEN"
    title="Tudd, mi jön minden hónapban"
    description="A telefon, az internet és a többi rendszeres díj együtt mutatja meg, mire számíthatsz."
  />
  {#if disk.warning}<p class="notice danger" role="alert">
      {disk.warning}
    </p>{/if}
  <section class="card" aria-labelledby="subscription-summary">
    <h2 id="subscription-summary">Rendszeres kiadások ebben a hónapban</h2>
    <p class="expense-subtitle">
      {monthLabel(month)} · Az éves összeg megmutatja, mire számíthatsz, ha a mostani
      tételek 12 hónapig változatlanok.
    </p>
    <ExpenseMetrics
      items={[
        { label: "Havi összeg", value: money(monthly) },
        { label: "Évente ezen a szinten", value: money(annual) },
        { label: "Egy napra vetítve", value: money(annual / 365) },
      ]}
    />
    {#if active[0]}<p class="field-hint">
        Ha egy évig kihagynád a(z) <strong>{active[0].name}</strong> tételt, {money(
          active[0].fee * 12,
        )} maradna meg.
      </p>{/if}
  </section>

  <section class="card" aria-labelledby="subscription-form">
    <h2 id="subscription-form">
      {editing ? "Havidíj szerkesztése" : "Új havidíj"}
    </h2>
    <p class="expense-subtitle">
      A díj az első és az utolsó hónapban is számít. Ha folyamatos, hagyd üresen
      az utolsó hónapot.
    </p>
    <form onsubmit={save}>
      <div class="expense-fields">
        <EntryInput
          id="subscription-name"
          label="Megnevezés"
          bind:value={name}
          placeholder="pl. Otthoni internet"
          required
          help={{
            what: "A díj neve a listában.",
            where:
              "Használd a szolgáltatás nevét a számláról, vagy adj saját nevet.",
          }}
        />
        <EntryInput
          id="subscription-fee"
          label="Havidíj · Ft"
          bind:value={fee}
          inputmode="decimal"
          placeholder="pl. 4 990"
          required
          help={{
            what: "A havonta esedékes bruttó összeg.",
            where:
              "A számlán vagy a szerződésben. Negyedéves díjnál a havi tervezéshez oszd el hárommal.",
          }}
        />
        <EntryInput
          id="subscription-start"
          label="Első elszámolási hónap"
          type="month"
          bind:value={start}
          required
          help={{
            what: "Ettől a hónaptól számoljuk a díjat.",
            where:
              "A szolgáltatás első elszámolási hónapja vagy az új díj kezdete.",
          }}
        />
        <EntryInput
          id="subscription-end"
          label="Utolsó elszámolási hónap"
          type="month"
          bind:value={end}
          min={start || undefined}
          help={{
            what: "Az utolsó hónap, amelyre még fizetned kell.",
            where:
              "A lemondás visszaigazolásán vagy a szerződés lejáratánál. Folyamatos díjnál hagyd üresen.",
          }}
        />
      </div>
      {#if editing}<p class="field-hint">
          A módosítás a tétel teljes időszakára érvényes. A befizetés állapotát
          nem tartjuk nyilván. Díjemelésnél zárd le a régi tételt, majd vedd fel
          külön az új árat.
        </p>{/if}
      {#if error}<p class="field-error" role="alert">{error}</p>{/if}
      <div class="expense-actions">
        <button class="primary-button" type="submit"
          >{editing ? "Módosítás mentése" : "Havidíj mentése"}</button
        >
        {#if editing}<button class="text-button" type="button" onclick={reset}
            >Mégse</button
          >{/if}
      </div>
    </form>
  </section>

  <section class="card" aria-labelledby="subscription-forecast">
    <h2 id="subscription-forecast">Mi várható a következő hónapokban?</h2>
    <p class="expense-subtitle">
      A már megadott kezdések és lejáratok alapján, a következő hónaptól
      számolva.
    </p>
    {#if monthly || forecast.some((item) => item.value > 0)}
      <ExpenseMetrics
        items={[
          { label: "Következő hónap", value: money(forecast[0].value) },
          {
            label: "Ha a mostani havidíj 12 hónapig változatlan lenne",
            value: money(annual),
          },
        ]}
      />
      <Chart
        id="subscription-forecast-chart"
        kind="benchmark"
        unit="Ft"
        digits={0}
        label="A jelenlegi hónap és a következő három hónap ütemezett havidíjai."
        bars={[
          {
            label: "Ez a hónap",
            short: "Ez a hónap",
            value: monthly,
            own: true,
          },
          ...forecast.map((item) => ({
            label: monthLabel(item.month),
            value: item.value,
            own: false,
          })),
        ]}
      />
    {:else}
      <p class="empty-state">
        Az előrejelzéshez adj hozzá egy mostani vagy a következő három hónapban
        esedékes havidíjat.
      </p>
    {/if}
  </section>

  {#snippet list(items: Subscription[])}
    <ul class="expense-list">
      {#each items as item (item.id)}
        <li>
          <div>
            <strong>{item.name} · {money(item.fee)}/hó</strong>
            <p>
              {monthLabel(item.start)} – {item.end
                ? monthLabel(item.end)
                : "folyamatos"}
            </p>
          </div>
          <div class="expense-row-actions">
            <button
              type="button"
              class="text-button"
              aria-label={`Szerkesztés: ${item.name}`}
              onclick={() => edit(item)}>Szerkesztés</button
            >
            <button
              type="button"
              class="text-button danger"
              aria-label={`Törlés minden hónapból: ${item.name}`}
              onclick={() => remove(item)}>Törlés</button
            >
          </div>
        </li>
      {/each}
    </ul>
  {/snippet}

  <section class="card" aria-labelledby="subscriptions-log">
    <h2 id="subscriptions-log" tabindex="-1">Rögzített havidíjak</h2>
    {#if active.length}{@render list(active)}{:else}<p class="empty-state">
        Ebben a hónapban nincs aktív havidíj.
      </p>{/if}
    {#if inactive.length}
      <details class="expense-detail">
        <summary>Korábbi és később induló tételek ({inactive.length})</summary>
        {@render list(inactive)}
      </details>
    {/if}
  </section>
  <PdfActions
    category="subscriptions"
    getData={() => $state.snapshot(rows)}
    report={subscriptionsReport}
    description="A PDF a korábbi, az aktív és a később induló havidíjakat is menti, a teljes érvényességi időszakukkal együtt."
    logLabel="Havidíjak (PDF)"
    detailedLabel="Havidíjak és összesítés (PDF)"
    parse={(value) => (validSubscriptions(value) ? value : null)}
    describe={(saved) =>
      `${saved.length} havidíj, a díjak és az érvényességi időszakok`}
    onrestore={(saved) => {
      if (!disk.save(saved)) return false;
      rows = saved;
      reset();
      return true;
    }}
  />
</div>
