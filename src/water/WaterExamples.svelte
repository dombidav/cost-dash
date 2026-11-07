<script lang="ts">
  import Select from "../components/Select.svelte";
  import { addDays } from "../calendar";
  import { fmt } from "../lib/format";
  import { waterUsageBetween, type waterIntervals } from "./state";

  let {
    intervals,
    now,
  }: { intervals: ReturnType<typeof waterIntervals>; now: string } = $props();
  const examples = {
    pool: {
      label: "Olimpiai úszómedence",
      unit: "olimpiai medencényi víz",
      liters: 50 * 25 * 2.5 * 1000,
      note: "A példamedence 50 méter hosszú, 25 méter széles és 2,5 méter mély. Ez 3125 m³ víz.",
      source: "https://www.worldaquatics.com/rules/competition-regulations",
    },
    shower: {
      label: "Nyolcperces zuhany",
      unit: "nyolcperces zuhany",
      liters: 8 * 8,
      note: "Egy nyolcperces zuhanyhoz percenként 8 literrel számoltunk.",
      source: "",
    },
    bath: {
      label: "Tele fürdőkád",
      unit: "kádnyi víz",
      liters: 150,
      note: "A példában egy fürdéshez 150 liter vizet engedünk a kádba.",
      source: "",
    },
    bottle: {
      label: "Másfél literes palack",
      unit: "másfél literes palack",
      liters: 1.5,
      note: "A vízmennyiséget 1,5 literes palackokba töltve képzeljük el.",
      source: "",
    },
    rain: {
      label: "Tíz milliméter eső",
      unit: "m²-re jutó eső",
      liters: 10,
      note: "Tíz milliméter eső négyzetméterenként tíz liter víz.",
      source: "",
    },
  };
  type ExampleId = keyof typeof examples;
  const options = Object.entries(examples).map(([value, example]) => ({
    value,
    label: example.label,
  }));
  let selection = $state<ExampleId>("pool");
  let example = $derived(examples[selection]);
  let start = $derived(addDays(now, -30));
  let usage = $derived(waterUsageBetween(intervals, start, now));
  let volume = $derived(usage?.volume ?? 6);
  let count = $derived((volume * 1000) / example.liters);
  let asPercent = $derived(selection === "pool" && count < 1);
  let shown = $derived(asPercent ? count * 100 : count);
  let result = $derived(
    shown > 0 && shown < 0.01
      ? "kevesebb mint 0,01"
      : `kb. ${fmt(shown, 2, 0)}`,
  );
</script>

<section class="card" aria-labelledby="water-examples-title">
  <h2 id="water-examples-title">Ennyi vízzel mit tölthetnél meg?</h2>
  <p class="expense-subtitle">
    {#if usage}
      Az elmúlt 30 nap leolvasásokkal lefedett részén ({usage.from} – {usage.to})
      <strong>{fmt(volume, 3, 0)} m³</strong> víz fogyott.
    {:else}
      Az elmúlt 30 napból nincs számolható fogyasztás. A hasonlatokhoz <strong
        >{volume} m³</strong
      > példafogyasztást mutatunk.
    {/if}
  </p>
  <Select
    id="water-example"
    label="Miben mérjük a vizet?"
    value={selection}
    {options}
    oncommit={(value) => (selection = value as ExampleId)}
  />
  <output for="water-example" class="stat-number">
    <span>{result}{asPercent ? "%" : ""}</span>
    <small
      >{asPercent ? "egy olimpiai medence térfogatából" : example.unit}</small
    >
  </output>
  <p class="field-hint">
    {example.note}
    {#if example.source}<a href={example.source}
        >World Aquatics · medenceméretek</a
      >{/if}
  </p>
  {#if usage && intervals.some((interval) => interval.start < start && interval.end > start)}
    <p class="field-hint">
      A 30 nap kezdete két leolvasás közé esett. Az érintett mérési szakasz
      fogyasztását naparányosan osztottuk fel.
    </p>
  {/if}
</section>
