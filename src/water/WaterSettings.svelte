<script lang="ts">
  import Field from "../components/Field.svelte";
  import Help from "../components/Help.svelte";
  import { parseNumber } from "../calendar";
  import { fmt } from "../lib/format";
  import { presets, validRates, type WaterRates } from "./state";

  let {
    rates,
    onupdate,
  }: { rates: WaterRates; onupdate: (rates: WaterRates) => void } = $props();
  const fields = [
    {
      key: "water",
      label: "Ivóvízdíj",
      unit: "Ft/m³",
      what: "Az ivóvíz bruttó egységára.",
      where: "A számla ivóvízdíj sorában.",
    },
    {
      key: "sewer",
      label: "Csatornadíj",
      unit: "Ft/m³",
      what: "A szennyvízelvezetés és vízterhelés bruttó egységára együtt. Csatorna nélkül nulla.",
      where: "A számla szennyvíz és vízterhelés sorában.",
    },
    {
      key: "base",
      label: "Havi alapdíj",
      unit: "Ft/hó",
      what: "Az ivóvíz és a csatorna fix havi bruttó díja együtt, ha van.",
      where: "A számla alapdíj sorainál. Ha nincs, hagyd nullán.",
    },
    {
      key: "people",
      label: "Háztartás létszáma",
      unit: "fő",
      what: "A háztartásban élők száma. Csak a fejenkénti összehasonlítást befolyásolja.",
      where: "Add meg, hányan használják rendszeresen a vizet a háztartásban.",
    },
  ] as const;

  function selectCity(city: string) {
    const preset = presets.find((item) => item.city === city);
    onupdate(preset ? { ...rates, ...preset } : { ...rates, city });
  }

  function update(key: (typeof fields)[number]["key"], value: string) {
    const next = { ...rates, [key]: parseNumber(value) };
    if (!validRates(next))
      return key === "people"
        ? "Adj meg 1 és 100 közötti egész számot."
        : "Adj meg érvényes, nemnegatív díjat.";
    onupdate(next);
  }
</script>

<details class="card water-settings">
  <summary id="water-settings">
    <strong>Település és vízdíjak</strong>
    <span
      >{rates.city || "Egyedi díjak"} · {fmt(rates.water + rates.sewer, 2)} Ft/m³</span
    >
  </summary>
  <p class="expense-subtitle">
    A vízoldal és a Dashboard minden becslése az itt megadott díjakat használja.
    A módosítások mezőelhagyáskor mentődnek.
  </p>
  <div class="expense-fields">
    <div class="field">
      <div class="field-label">
        <label for="water-city">Település</label>
        <Help
          forId="water-city"
          label="Település"
          content={{
            what: "A kiválasztott település betölti a 2026-os táblázat bruttó egységárait.",
            where:
              "Válaszd a fogyasztási helyet vagy az Egyedi díjak lehetőséget, és ellenőrizd az árakat a számládon.",
          }}
        />
      </div>
      <select
        id="water-city"
        value={rates.city}
        aria-describedby="water-city-help"
        onchange={(event) => selectCity(event.currentTarget.value)}
      >
        {#each presets as { city } (city)}<option value={city}>{city}</option
          >{/each}
        <option value="">Egyedi díjak</option>
      </select>
    </div>
    {#each fields as { key, label, unit, what, where } (key)}
      <Field
        id={`water-rate-${key}`}
        {label}
        {unit}
        help={{ what, where }}
        value={rates[key]}
        decimal
        oncommit={(value) => update(key, value)}
      />
    {/each}
  </div>
  <p class="field-hint">
    Az előre kitöltött egységárak alapdíjat nem tartalmaznak. A saját számlád
    díjai az irányadók.
  </p>
</details>

<style>
  summary {
    cursor: pointer;
  }
  summary span {
    display: block;
    color: var(--muted);
    margin-top: 3px;
  }
  .expense-subtitle {
    margin-top: 16px;
  }
</style>
