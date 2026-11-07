<script lang="ts">
  import Select from "../components/Select.svelte";
  import { fmt, money } from "../lib/format";
  import type { CarEntry } from "./state";

  let { entries }: { entries: readonly CarEntry[] } = $props();
  const examples = {
    bus: "Helyközi busszal",
    bike: "Kerékpárral",
    walk: "Gyalog",
    marathon: "Maratoni távban",
    track: "Futópályakörökben",
  } as const;
  type ExampleId = keyof typeof examples;
  const options = Object.entries(examples).map(([value, label]) => ({
    value,
    label,
  }));
  const busFares = { 10: 400, 20: 500, 50: 930 } as const;
  const tripOptions = Object.keys(busFares).map((value) => ({
    value,
    label: `${value} km`,
  }));
  const passengerOptions = [1, 2, 3, 4, 5].map((people) => ({
    value: String(people),
    label: `${people} fő`,
  }));
  const equivalents = {
    bike: {
      km: 15,
      unit: "óra kerékpározás",
      note: "A példában 15 km/h-s tempóval és megállás nélküli tekeréssel számolunk.",
    },
    walk: {
      km: 5,
      unit: "óra gyaloglás",
      note: "A példában 5 km/h-s sétatempóval számolunk, pihenők nélkül.",
    },
    marathon: {
      km: 42.195,
      unit: "maratoni táv",
      note: "Egy maraton hossza 42,195 km.",
    },
    track: {
      km: 0.4,
      unit: "futópályakör",
      note: "A példában egy kör 400 méter.",
    },
  };
  let selection = $state<ExampleId>("bus");
  let tripLength = $state<keyof typeof busFares>(20);
  let passengers = $state(1);
  let recorded = $derived.by(() => {
    let distance = 0;
    let fuelPaid = 0;
    for (const item of entries) {
      if (item.kind === "fuel" && item.km !== null && item.km > 0) {
        distance += item.km;
        fuelPaid += item.paid;
      }
    }
    return { distance, fuelPaid };
  });
  let distance = $derived(recorded.distance || 200);
  let busEstimate = $derived(
    (distance / tripLength) * busFares[tripLength] * passengers,
  );
</script>

<section class="card" aria-labelledby="car-examples-title">
  <h2 id="car-examples-title">Milyen messzire jutottál?</h2>
  <p class="expense-subtitle">
    {#if recorded.distance}
      Az elmúlt 30 napban rögzített tankolásokhoz <strong
        >{fmt(distance, 2, 0)} km</strong
      > megtett út tartozik.
    {:else}
      Az elmúlt 30 napból nincs tankoláshoz rögzített táv. A hasonlatokhoz <strong
        >{distance} km</strong
      > példaúttal számolunk.
    {/if}
  </p>
  <div class="expense-fields">
    <Select
      id="car-example"
      label="Mivel hasonlítsuk össze?"
      value={selection}
      {options}
      oncommit={(value) => (selection = value as ExampleId)}
    />
    {#if selection === "bus"}
      <Select
        id="car-bus-distance"
        label="Egy buszút hossza"
        value={tripLength}
        options={tripOptions}
        oncommit={(value) =>
          (tripLength = Number(value) as keyof typeof busFares)}
      />
      <Select
        id="car-bus-passengers"
        label="Utasok száma"
        value={passengers}
        options={passengerOptions}
        oncommit={(value) => (passengers = Number(value))}
      />
    {/if}
  </div>

  {#if selection === "bus"}
    <output
      for="car-example car-bus-distance car-bus-passengers"
      class="stat-number"
    >
      <span>kb. {money(busEstimate)}</span>
      <small>helyközi busszal {passengers} főnek</small>
    </output>
    {#if recorded.distance}
      <p class="field-hint">
        Ezeknél a tankolásoknál <strong>{money(recorded.fuelPaid)}</strong> szerepel
        a naplóban.
      </p>
    {/if}
    <p class="field-hint">
      A távot {tripLength} km-es utakra vetítjük, {money(
        busFares[tripLength],
      )}/fő teljes árú jeggyel. Ez arányos becslés, kedvezmény, bérlet és
      helyjegy nélkül.
      <a
        href="https://www.mavcsoport.hu/sites/default/files/upload/page/helykozi_menetdijtablazat_2026_10_01.pdf"
        >MÁV · 2026. októberi menetdíjtáblázat</a
      >
    </p>
  {:else}
    {@const example = equivalents[selection]}
    {@const amount = distance / example.km}
    <output for="car-example" class="stat-number">
      <span
        >{amount < 0.01
          ? "kevesebb mint 0,01"
          : `kb. ${fmt(amount, 2, 0)}`}</span
      >
      <small>{example.unit}</small>
    </output>
    <p class="field-hint">
      {example.note}
      {#if selection === "marathon"}<a
          href="https://worldathletics.org/disciplines/roadrunning/marathon"
          >World Athletics</a
        >{/if}
    </p>
  {/if}
</section>
