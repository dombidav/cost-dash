<script lang="ts">
  import {
    DAYTIME_MARKET_RATE,
    ELECTRICITY_STORAGE_KEY,
  } from "../electricity/reference";
  import type { ElectricityState } from "../electricity/types";
  import { fmt, money } from "../lib/format";
  import type { Settings } from "../types";

  let {
    settings,
    usage,
  }: {
    settings: Settings;
    usage: { volume: number; kind: "measured" | "billing" | "unit" };
  } = $props();

  const boilerEfficiency = 90;
  const heatPumpCop = 3;
  const exampleVolume = 100;
  const basis = {
    measured: "Legutóbbi mért időszak",
    billing: "A kiválasztott számlázási időszak",
    unit: "Szemléltető példa",
  };

  function readDaytimeRate() {
    try {
      const raw = localStorage.getItem(ELECTRICITY_STORAGE_KEY);
      if (!raw) return undefined;
      const saved = JSON.parse(raw) as ElectricityState | null;
      if (saved?.version !== 1 || !Array.isArray(saved.points))
        return undefined;
      const daytime = saved.points.flatMap((point) => {
        const price = point?.rates?.market;
        if (
          (point?.tariff !== "A1" && point?.tariff !== "A2") ||
          typeof point.name !== "string" ||
          typeof price !== "number" ||
          !Number.isFinite(price) ||
          price < 0
        )
          return [];
        return [
          { id: point.id, name: point.name, tariff: point.tariff, price },
        ];
      });
      return daytime.find((point) => point.id === saved.selected) ?? daytime[0];
    } catch {
      return undefined;
    }
  }

  let daytime = $state(readDaytimeRate());
  let price = $derived(daytime?.price ?? DAYTIME_MARKET_RATE);
  let volume = $derived(usage.kind === "unit" ? exampleVolume : usage.volume);
  let usefulHeat = $derived(
    (volume * settings.heat * settings.correction * (boilerEfficiency / 100)) /
      3.6,
  );
  let heatPumpKwh = $derived(usefulHeat / heatPumpCop);
  const estimatedCost = (cost: number) =>
    money(cost >= 1000 ? Math.round(cost / 100) * 100 : cost);
</script>

<svelte:window
  onstorage={(event) => {
    if (event.key === ELECTRICITY_STORAGE_KEY || event.key === null)
      daytime = readDaytimeRate();
  }}
/>

<article class="card stat-card" id="gas-electric-heating">
  <div class="stat-top">
    <h3>Mi lenne, ha árammal fűtenél?</h3>
    <span class="stat-symbol" aria-hidden="true">ϟ</span>
  </div>
  <p class="stat-caption">{basis[usage.kind]}</p>
  <p class="stat-description">
    <strong>{fmt(volume)} m³</strong> földgázból egy {boilerEfficiency}%-os
    kazánnal kb. <strong>{fmt(usefulHeat, 0)} kWh hasznos hőt</strong>
    állíthatnál elő. Ugyanennyi hő villannyal:
  </p>
  <dl class="cost-breakdown">
    <div>
      <dt>Elektromos radiátor</dt>
      <dd>
        <strong>kb. {estimatedCost(usefulHeat * price)}</strong>
        <small>{fmt(usefulHeat, 0)} kWh áram</small>
      </dd>
    </div>
    <div>
      <dt>Fűtőklíma (COP {heatPumpCop})</dt>
      <dd>
        <strong>kb. {estimatedCost(heatPumpKwh * price)}</strong>
        <small>{fmt(heatPumpKwh, 0)} kWh áram</small>
      </dd>
    </div>
  </dl>
  <p class="stat-footnote">
    <strong>Durva becslés, tipikusnak vett hatásfokokkal.</strong>
    Egyetlen {`${fmt(price, 3)}\u00a0Ft/kWh`} díjjal számolunk a teljes mennyiségre.
    {#if daytime}
      Az ár forrása: <strong>{daytime.name}</strong> ({daytime.tariff}), mentett
      keret feletti díj.
    {:else}
      Ez a szemléltetéshez használt alapár.
    {/if}
    A valós fogyasztás a készüléktől és a kinti hőmérséklettől is függ.
  </p>
  <details class="heating-method">
    <summary>Hogyan számoltunk?</summary>
    <p>
      A gázmennyiséget megszorozzuk a fűtőértékeddel és a korrekciós
      tényeződdel. Az eredményt 3,6-tal osztva kWh-t kapunk, ebből {boilerEfficiency}%
      a becsült hasznos hő.
    </p>
    <p>
      A radiátornál 1 kWh áramból kb. 1 kWh hővel, a klímánál
      {heatPumpCop} kWh hővel számolunk. A szükséges áramot az egységárral szorozzuk.
      Az összegek csak az energiaköltséget mutatják.
    </p>
    <p>
      <a
        href="https://www.mvmnext.hu/foldgaz/contents/Documents/Ugyintezes/szamlamagyarazat/foldgazszamla-magyarazo.pdf?download="
        >Gázenergia számítása (MVM)</a
      >
      ·
      <a
        href="https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9"
        >MJ és kWh átváltása (NIST)</a
      >
      ·
      <a
        href="https://natural-resources.canada.ca/energy-efficiency/energy-star/heating-cooling-heat-pump"
        >A COP jelentése (NRCan)</a
      >
    </p>
  </details>
</article>

<style>
  .cost-breakdown dd {
    white-space: normal;
  }
  dd small {
    display: block;
    color: var(--muted);
  }
  .heating-method {
    margin-top: 8px;
    color: var(--muted);
    font-size: 11px;
  }
  summary {
    min-height: 32px;
    padding-block: 7px;
    cursor: pointer;
  }
  .heating-method a {
    color: var(--accent);
  }
</style>
