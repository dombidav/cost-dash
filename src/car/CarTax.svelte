<script lang="ts">
  import { untrack } from "svelte";
  import EntryInput from "../components/EntryInput.svelte";
  import Select from "../components/Select.svelte";
  import { parseNumber, today } from "../calendar";
  import { money } from "../lib/format";
  import { taxClasses, taxRates, vehicleTax, type TaxInput } from "./tax";

  let {
    saved,
    hasTax,
    onsave,
  }: {
    saved: TaxInput | undefined;
    hasTax: boolean;
    onsave: (input: TaxInput, amount: number) => void;
  } = $props();
  const initial = untrack(() => saved);
  let year = $state<TaxInput["year"]>(
    initial?.year ?? (today() >= "2027-01-01" ? 2027 : 2026),
  );
  let manufacture = $state(initial ? String(initial.manufacture) : "");
  let power = $state(initial ? String(initial.power) : "");
  let category = $state<TaxInput["category"]>(initial?.category ?? "standard");
  let input = $derived({
    year,
    manufacture: parseNumber(manufacture),
    power: parseNumber(power),
    category,
  });
  let result = $derived(vehicleTax(input));

  function save(event: SubmitEvent) {
    event.preventDefault();
    if (result) onsave(input, result.amount);
  }
</script>

<section class="card" aria-labelledby="car-tax-title">
  <h2 id="car-tax-title" tabindex="-1">Gépjárműadó-kalkulátor</h2>
  <p class="expense-subtitle">
    Belföldi személyautó teljes éves adójának becslése. Az egyedi kedvezményeket
    és az év közbeni változásokat a NAV határozata alapján add meg az
    ütemezésben.
  </p>
  <form onsubmit={save}>
    <div class="expense-fields">
      <Select
        id="car-tax-year"
        label="Adóév"
        value={year}
        options={Object.keys(taxRates).map((year) => ({
          value: year,
          label: year,
        }))}
        oncommit={(value) => (year = Number(value) as TaxInput["year"])}
      />
      <EntryInput
        id="car-tax-manufacture"
        label="Gyártási év"
        inputmode="numeric"
        bind:value={manufacture}
        placeholder="pl. 2018"
        required
        help={{
          what: "A gyártási év határozza meg az adósávot.",
          where:
            "A jármű nyilvántartási adatai vagy a NAV gépjárműadó-határozata. Az első forgalomba helyezés éve ettől eltérhet.",
        }}
      />
      <EntryInput
        id="car-tax-power"
        label="Motorteljesítmény · kW"
        inputmode="decimal"
        bind:value={power}
        placeholder="pl. 100"
        required
        help={{
          what: "A nyilvántartásban szereplő teljesítmény kilowattban.",
          where: "A forgalmi engedély P.2 mezőjében.",
        }}
      />
      <Select
        id="car-tax-class"
        label="Környezetvédelmi besorolás"
        value={category}
        options={Object.entries(taxClasses).map(([value, label]) => ({
          value,
          label,
        }))}
        oncommit={(value) => (category = value as TaxInput["category"])}
      />
    </div>
    <p aria-live="polite">
      {#if result}
        Becsült éves gépjárműadó: <strong>{money(result.amount)}</strong>
        {#if result.rate}
          · {result.rate} Ft/kW{:else}
          · Mentesség a megadott besorolás alapján{/if}
      {:else if manufacture && power}
        Ellenőrizd a gyártási évet, a teljesítményt és a besorolást.
      {:else}
        Add meg a gyártási évet és a teljesítményt.
      {/if}
    </p>
    <div class="expense-actions">
      <button type="submit" class="primary-button" disabled={!result}
        >{hasTax ? "Gépjárműadó frissítése" : "Gépjárműadó mentése"}</button
      >
    </div>
  </form>
  <p class="field-hint">
    <a href={taxRates[year].source}>NAV · {year}. évi adómérték</a> ·
    <a
      href="https://nav.gov.hu/gepjarmuado/adomentessegek/maganszemelyhez-kotheto-mentessegek"
      >Adómentességek</a
    >
  </p>
</section>
