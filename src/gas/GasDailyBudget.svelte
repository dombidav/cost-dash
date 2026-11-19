<script lang="ts">
  import { onMount } from "svelte";
  import type { calculateGasYear } from "../calculator";
  import { today } from "../calendar";
  import { fmt } from "../lib/format";
  import type { AppState } from "../types";
  import { calculateDailyBudget } from "./daily-budget";

  let {
    model,
    annual,
    date,
  }: {
    model: AppState;
    annual: ReturnType<typeof calculateGasYear>;
    date?: string;
  } = $props();
  let currentDay = $state(today());
  let result = $derived(
    calculateDailyBudget(model, annual, date ?? currentDay),
  );

  onMount(() => {
    const refresh = () => {
      currentDay = today();
    };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  });
</script>

<section class="card daily-budget" aria-labelledby="gas-daily-budget-title">
  <div class="card-heading">
    <h2 id="gas-daily-budget-title">Mai szezonális fogyasztási cél</h2>
    <span class="badge">{result.date} · BECSLÉS</span>
  </div>
  {#if result.status === "ready"}
    <div class="daily-summary">
      <div>
        <p class="muted">Ma ennyit célozhatsz meg az éves kereten belül</p>
        <div class="big-number">
          <span>{fmt(result.daily, 2)}</span><span class="big-unit">m³/nap</span
          >
        </div>
      </div>
      <dl>
        <div>
          <dt>Becsült keret ma, a nap kezdetén</dt>
          <dd>{fmt(result.remaining)} m³</dd>
        </div>
        <div>
          <dt>Hátralévő idő, a mai nappal együtt</dt>
          <dd>{result.remainingDays} nap</dd>
        </div>
      </dl>
    </div>
    <p class="balance-note">
      {#if result.remaining === 0}
        A mért és becsült fogyasztás alapján elfogyott az éves kedvezményes
        keret.
      {:else}
        A maradék keretet a hátralévő napok havi profilsúlyai szerint osztjuk
        el: télen több, nyáron kevesebb jut egy napra. A cél új méréssel és az
        idő múlásával változik.
      {/if}
    </p>
    <p class="daily-basis">
      Utolsó mérés: {result.readingDate} ({result.elapsedDays} napja).
      {#if result.elapsedDays > 0}
        {#if result.sinceReading === null}A keret már az utolsó méréskor
          elfogyott.
        {:else}Azóta máig {fmt(result.sinceReading)} m³ becsült fogyasztást vettünk
          figyelembe.{/if}
        {#if result.basis === "readings"}A becslés alapja az idei mért szakasz
          fogyasztása és a havi profil.
        {:else if result.basis === "annual"}A becslés alapja a megadott éves
          fogyasztás és a havi profil.{/if}
        Friss mérőállással pontosíthatod a célt.
      {:else}
        A mai méréshez igazítva, a mai nap fogyasztása előtt.
      {/if}
      {#if result.estimatedOpening}Az évkezdet fogyasztása is becsült.{/if}
    </p>
  {:else}
    <p class="balance-note">
      {#if result.status === "outside-year"}
        A mai célhoz válaszd a mai napot tartalmazó kedvezményes évet. A
        kiválasztott időszak: {annual.start} → {annual.end}.
      {:else if result.status === "missing-profile"}
        A hátralévő hónapok profilsúlya nulla. Adj meg fogyasztási arányokat a
        havi profilban.
      {:else if result.status === "missing-pace"}
        A mai keret becsléséhez rögzíts újabb mérőállást, vagy add meg a becsült
        éves fogyasztást.
      {:else}
        A napi célhoz mérőállás és ismert vagy becsülhető évkezdő fogyasztás
        szükséges.
      {/if}
    </p>
  {/if}
  <p class="daily-basis">
    A <a href="#gas-profile-settings">szerkeszthető havi fogyasztási profilt</a> használjuk;
    az alapérték fűtési példaprofil, saját havi arányaidra szabhatod. A cél az éves
    keret beosztását segíti. A tényleges számlabesorolás és sávkorrekció eltérhet.
  </p>
</section>

<style>
  .daily-budget {
    margin-bottom: 18px;
  }
  .daily-summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 40px;
  }
  .daily-summary > div {
    min-width: 0;
  }
  .daily-summary .big-number {
    flex-wrap: wrap;
  }
  .daily-summary .big-unit {
    font-size: 20px;
  }
  .daily-summary dl {
    display: grid;
    gap: 12px;
    margin: 16px 0 0;
  }
  dt,
  .daily-basis {
    color: var(--muted);
    font-size: 11px;
    line-height: 1.6;
  }
  dd {
    margin: 3px 0 0;
    font-size: 18px;
    font-variant-numeric: tabular-nums;
  }
  .daily-basis {
    margin: 12px 0 0;
  }
  .daily-basis a {
    color: var(--accent);
  }
</style>
