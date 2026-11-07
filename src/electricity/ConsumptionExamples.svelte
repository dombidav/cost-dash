<script lang="ts">
  import Select from "../components/Select.svelte";
  import { fmt } from "../lib/format";
  import { recentConsumption } from "./calculator";
  import type { ElectricityPoint } from "./types";

  let {
    point,
    value,
    onselect,
  }: {
    point: ElectricityPoint;
    value?: string;
    onselect: (value: string) => void;
  } = $props();

  const examples = {
    led: { label: "LED-izzó", unit: "nap világítás", watts: 9, hours: 24 },
    tv: { label: "TV", unit: "óra tévézés", watts: 80, hours: 1 },
    laptop: { label: "Laptop", unit: "óra használat", watts: 50, hours: 1 },
    router: {
      label: "Wi-Fi-router",
      unit: "nap működés",
      watts: 10,
      hours: 24,
    },
    car: {
      label: "Elektromos autó",
      unit: "km autózás",
      referenceKwh: 14.3,
      referenceCount: 100,
      referenceUnit: "km",
      model: "Tesla Model 3 Long Range AWD",
      source: "https://www.tesla.com/hu_HU/model3",
    },
    stove: {
      label: "Villanytűzhely · egy főzőzóna",
      unit: "óra főzés",
      watts: 2000,
      hours: 1,
    },
    fridge: {
      label: "Hűtőgép",
      unit: "nap működés",
      referenceKwh: 180,
      referenceCount: 365,
      referenceUnit: "nap",
      source:
        "https://energy-efficient-products.ec.europa.eu/product-list/fridges-and-freezers_en",
    },
    washer: {
      label: "Mosógép · Eco 40–60",
      unit: "mosási ciklus",
      referenceKwh: 60,
      referenceCount: 100,
      referenceUnit: "ciklus",
      source:
        "https://energy-efficient-products.ec.europa.eu/product-list/washing-machines_en",
    },
    dishwasher: {
      label: "Mosogatógép · Eco",
      unit: "mosogatási ciklus",
      referenceKwh: 80,
      referenceCount: 100,
      referenceUnit: "ciklus",
      source:
        "https://energy-efficient-products.ec.europa.eu/product-list/dishwashers_en",
    },
  };
  type ExampleId = keyof typeof examples;
  const options = Object.entries(examples).map(([value, example]) => ({
    value,
    label: example.label,
  }));
  let selection = $derived(
    value && Object.hasOwn(examples, value) ? (value as ExampleId) : "led",
  );
  let example = $derived(examples[selection]);
  let recent = $derived(recentConsumption(point));
  const exampleKwh = 10;
  let energy = $derived(recent?.volume ?? exampleKwh);
  let energyPerUnit = $derived(
    "watts" in example
      ? (example.watts * example.hours) / 1000
      : example.referenceKwh / example.referenceCount,
  );
</script>

<article class="card stat-card" id="electricity-consumption-examples">
  <div class="stat-top">
    <h3>Fogyasztás érthetően</h3>
    <span class="stat-symbol" aria-hidden="true">≈</span>
  </div>
  <p class="stat-caption">{point.name} · Elmúlt 30 nap</p>
  <p class="stat-description">
    {#if recent}
      <strong>{fmt(energy)} kWh</strong>
      {recent.estimated ? "részben becsült" : "mért"} fogyasztás a leolvasásokkal
      lefedett időszakban ({recent.start} – {recent.end}).
    {:else}
      Erre az időszakra nincs számolható fogyasztás.
      <strong>{exampleKwh} kWh</strong> szemléltető példát mutatunk.
    {/if}
  </p>
  <Select
    id="electricity-consumption-example"
    label="Mivel hasonlítsuk össze?"
    value={selection}
    {options}
    oncommit={onselect}
  />
  <output for="electricity-consumption-example" class="stat-number">
    <span>kb. {fmt(energy / energyPerUnit)}</span>
    <small>{example.unit}</small>
  </output>
  <p class="stat-footnote">
    Szemléltető becslés. A készülékek tényleges fogyasztása modellenként és
    használattól függően változik.
  </p>
  <details class="example-method">
    <summary>Hogyan számoltuk?</summary>
    {#if recent?.estimated}
      <p>
        A 30 nap kezdete két leolvasás közé esik, ezért az első szakasz
        fogyasztását a napok arányában osztottuk fel.
      </p>
    {/if}
    {#if "watts" in example}
      <p>
        A példakészülék teljesítménye {example.watts} W. Egy
        {example.hours === 24 ? "nap (24 óra)" : "óra"} alatt
        {fmt(energyPerUnit, 3)} kWh-t használna folyamatos működés mellett. Ezzel
        osztjuk el a {fmt(energy)} kWh-t.
      </p>
    {:else}
      <p>
        {#if "model" in example}
          A {example.model} gyári WLTP-adata
          {fmt(example.referenceKwh)} kWh / {example.referenceCount}
          {example.referenceUnit}. A tényleges hatótáv a vezetéstől és az
          időjárástól is függ.
        {:else}
          A példához {example.referenceKwh} kWh fogyasztással számolunk
          {example.referenceCount}
          {example.referenceUnit} alatt.
        {/if}
        A {fmt(energy)} kWh-t elosztjuk az egy egységre jutó fogyasztással, ami kb.
        {fmt(energyPerUnit, 3)} kWh.
        <a href={example.source}>
          {"model" in example
            ? "Gyártói fogyasztási adat"
            : "Az EU energiacímke magyarázata"}
        </a>
      </p>
    {/if}
  </details>
</article>

<style>
  .example-method {
    margin-top: 8px;
    color: var(--muted);
    font-size: 11px;
  }
  summary {
    min-height: 32px;
    padding-block: 7px;
    cursor: pointer;
  }
  a {
    color: var(--accent);
  }
</style>
