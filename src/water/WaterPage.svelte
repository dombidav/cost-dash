<script lang="ts">
  import { tick } from "svelte";
  import EntryInput from "../components/EntryInput.svelte";
  import ExpenseMetrics from "../components/ExpenseMetrics.svelte";
  import Help from "../components/Help.svelte";
  import { monthDays, parseNumber, today } from "../calendar";
  import { fmt, money } from "../lib/format";
  import { monthLabel } from "../lib/months";
  import { storage } from "../lib/storage.svelte";
  import { toast } from "../lib/ui.svelte";
  import {
    initialWater,
    presets,
    validWater,
    validWaterMonth,
    waterBill,
    WATER_KEY,
    type WaterMonth,
    type WaterRates,
  } from "./state";

  const disk = storage(WATER_KEY, initialWater, validWater);
  let data = $state(disk.data);
  const currentMonth = today().slice(0, 7);
  let month = $state(currentMonth);
  let volume = $state("");
  let sewerVolume = $state("");
  let city = $state(disk.data.rates.city);
  let water = $state(String(disk.data.rates.water));
  let sewer = $state(String(disk.data.rates.sewer));
  let base = $state(String(disk.data.rates.base));
  let people = $state(String(disk.data.rates.people));
  let editing = $state("");
  let error = $state("");
  let input = $derived({
    month,
    volume: parseNumber(volume),
    sewerVolume: sewerVolume.trim() ? parseNumber(sewerVolume) : null,
    rates: {
      city,
      water: parseNumber(water),
      sewer: parseNumber(sewer),
      base: parseNumber(base),
      people: parseNumber(people),
    },
  });
  let preview = $derived(validWaterMonth(input) ? waterBill(input) : null);
  let history = $derived(
    [...data.months].sort((a, b) => b.month.localeCompare(a.month)),
  );
  let latest = $derived(history[0]);
  const annualAverage = 37.2;

  function applyRates(rates: WaterRates) {
    city = rates.city;
    water = String(rates.water);
    sewer = String(rates.sewer);
    base = String(rates.base);
    people = String(rates.people);
  }

  function selectCity(value: string) {
    city = value;
    const preset = presets.find((item) => item.city === value);
    if (preset) {
      water = String(preset.water);
      sewer = String(preset.sewer);
    }
  }

  function reset() {
    editing = "";
    month = currentMonth;
    volume = sewerVolume = error = "";
    applyRates(data.rates);
  }

  async function edit(item: WaterMonth) {
    editing = month = item.month;
    volume = String(item.volume);
    sewerVolume = item.sewerVolume === null ? "" : String(item.sewerVolume);
    applyRates(item.rates);
    error = "";
    await tick();
    document.getElementById("water-volume")?.focus();
  }

  function save(event: SubmitEvent) {
    event.preventDefault();
    if (!validWaterMonth(input)) {
      error =
        "Ellenőrizd a hónapot, a nemnegatív mennyiségeket és díjakat, valamint a létszámot (1–100 fő).";
      return;
    }
    if (data.months.some((item) => item.month === month && month !== editing)) {
      error =
        "Ez a hónap már szerepel a naplóban. Módosításhoz válaszd a Szerkesztés gombot a tételnél.";
      return;
    }
    const item = { ...input, rates: { ...input.rates } };
    data = {
      rates: editing ? data.rates : item.rates,
      months: [...data.months.filter((row) => row.month !== editing), item],
    };
    disk.save(data);
    reset();
    toast("A vízfogyasztás bekerült a naplóba.");
  }

  function remove(item: WaterMonth) {
    if (editing === item.month) reset();
    data.months = data.months.filter((row) => row.month !== item.month);
    disk.save(data);
    toast(
      "A víztételt törölted.",
      () => {
        if (data.months.some((row) => row.month === item.month)) return;
        data.months = [...data.months, item];
        disk.save(data);
      },
      "water-log",
    );
  }
</script>

<svelte:window onstorage={disk.onStorage} />
<div class="expense-page">
  <div class="expense-intro">
    <span class="eyebrow">VÍZ · HAVI NAPLÓ</span>
    <h1>Vízkalkulátor</h1>
    <p>
      Nézd meg, mennyibe kerül az elfogyasztott víz, és mennyi ebből a
      csatornadíj.
    </p>
  </div>
  {#if disk.warning}<p class="notice danger" role="alert">
      {disk.warning}
    </p>{/if}

  <section class="card" aria-labelledby="water-title">
    <h2 id="water-title">
      {editing
        ? "Havi vízfogyasztás szerkesztése"
        : "Havi vízfogyasztás rögzítése"}
    </h2>
    <p class="expense-subtitle">
      A havi fogyasztást a számláról vagy két egymást követő mérőállás
      különbségéből adhatod meg.
    </p>
    <form onsubmit={save}>
      <div class="expense-fields">
        <EntryInput
          id="water-month"
          label="Hónap"
          type="month"
          bind:value={month}
          max={currentMonth}
          required
          help={{
            what: "A fogyasztás hónapja.",
            where: "A számla elszámolási időszakánál.",
          }}
        />
        <EntryInput
          id="water-volume"
          label="Ivóvízfogyasztás · m³"
          inputmode="decimal"
          bind:value={volume}
          placeholder="pl. 6,2"
          required
          help={{
            what: "A felhasznált vízmennyiség köbméterben.",
            where:
              "A számla részletezőjén vagy két vízóraállás különbségeként.",
          }}
        />
        <div class="field">
          <div class="field-label">
            <label for="water-city">Település</label><Help
              forId="water-city"
              label="Település"
              content={{
                what: "A választás betölti a 2026-os díjtáblázat egységárait.",
                where:
                  "Válaszd a fogyasztási helyet, vagy add meg egyedileg a számlád díjait.",
              }}
            />
          </div>
          <select
            id="water-city"
            value={city}
            onchange={(event) => selectCity(event.currentTarget.value)}
            aria-describedby="water-city-help"
          >
            {#each presets as preset (preset.city)}<option value={preset.city}
                >{preset.city}</option
              >{/each}
            <option value="">Egyedi díjak</option>
          </select>
        </div>
        <EntryInput
          id="water-rate"
          label="Ivóvízdíj · Ft/m³"
          inputmode="decimal"
          bind:value={water}
          required
          help={{
            what: "Egy köbméter ivóvíz bruttó díja.",
            where: "A számlán az ivóvíz díjtételénél.",
          }}
        />
        <EntryInput
          id="water-sewer-rate"
          label="Csatornadíj · Ft/m³"
          inputmode="decimal"
          bind:value={sewer}
          required
          help={{
            what: "A szennyvízelvezetés és vízterhelés bruttó egységára együtt. Csatorna nélkül nulla.",
            where: "A számlán a szennyvíz és vízterhelés sorában.",
          }}
        />
      </div>
      <details class="expense-detail">
        <summary>Alapdíj, eltérő csatornamennyiség és háztartásméret</summary>
        <div class="expense-fields">
          <EntryInput
            id="water-base"
            label="Havi alapdíj · Ft"
            inputmode="decimal"
            bind:value={base}
            help={{
              what: "Az ivóvíz és a csatorna havi bruttó alapdíja együtt, ha van.",
              where: "A számla alapdíj sorainál. Ha nincs, hagyd nullán.",
            }}
          />
          <EntryInput
            id="water-sewer-volume"
            label="Csatornamennyiség · m³"
            inputmode="decimal"
            bind:value={sewerVolume}
            placeholder="Alapból az ivóvíz mennyisége"
            help={{
              what: "Csak akkor add meg, ha a csatornára elszámolt mennyiség eltér az ivóvízfogyasztástól.",
              where:
                "A számla szennyvíz sorában, például locsolási kedvezménynél.",
            }}
          />
          <EntryInput
            id="water-people"
            label="Háztartás létszáma · fő"
            inputmode="numeric"
            bind:value={people}
            help={{
              what: "Csak az egy főre jutó összehasonlítást befolyásolja.",
              where:
                "Add meg, hányan használják rendszeresen a háztartásban a vizet.",
            }}
          />
        </div>
      </details>
      {#if preview}
        <ExpenseMetrics
          items={[
            { label: "Ivóvíz", value: money(preview.water) },
            { label: "Csatorna", value: money(preview.sewer) },
            { label: "Alapdíj", value: money(preview.base) },
            { label: "Becsült havi díj", value: money(preview.total) },
          ]}
        />
      {/if}
      {#if error}<p class="field-error" role="alert">{error}</p>{/if}
      <div class="expense-actions">
        <button class="primary-button" type="submit"
          >{editing ? "Módosítás mentése" : "Mentés a naplóba"}</button
        >
        {#if editing}<button type="button" class="text-button" onclick={reset}
            >Mégse</button
          >{/if}
      </div>
    </form>
    <p class="field-hint">
      A 2026-os táblázat bruttó egységárakat tartalmaz, alapdíj nélkül. Mindig a
      saját számlád díjai az irányadók.
    </p>
  </section>

  <section class="card" aria-labelledby="water-stats">
    <h2 id="water-stats">Fogyasztás érthetően</h2>
    <p class="expense-subtitle">
      Az országos átlaghoz és hétköznapi példákhoz viszonyítjuk a legutóbbi
      mentett hónapot.
    </p>
    {#if latest}
      {@const liters = latest.volume * 1000}
      {@const daily =
        liters / monthDays(`${latest.month}-01`) / latest.rates.people}
      <ExpenseMetrics
        items={[
          {
            label: "Saját napi átlag fejenként",
            value: `${fmt(daily, 0)} liter`,
          },
          {
            label: "Országos napi átlag fejenként",
            value: `${fmt((annualAverage * 1000) / 366, 0)} liter`,
          },
          {
            label: "8 perces zuhanynak felel meg",
            value: `kb. ${fmt(liters / 64, 0)} alkalom`,
          },
        ]}
      />
    {:else}<p class="empty-state">
        A példákhoz ments el egy havi fogyasztást.
      </p>{/if}
    <p class="field-hint">
      <a
        href="https://www.ksh.hu/evkonyvek/2024/magyar-statisztikai-evkonyv-2024/pdf/statevk2024_6.pdf"
        >KSH, 2024</a
      >: 37,2 m³/fő/év. A zuhany becslése 8 liter/perc vízhozammal számol.
    </p>
  </section>

  <section class="card" aria-labelledby="water-log">
    <h2 id="water-log" tabindex="-1">Korábbi vízfogyasztás</h2>
    {#if history.length}
      <ul class="expense-list">
        {#each history as item (item.month)}
          <li>
            <div>
              <strong
                >{monthLabel(item.month)} · {fmt(item.volume, 2)} m³</strong
              >
              <p>
                {item.rates.city || "Egyedi díjak"} · {money(
                  waterBill(item).total,
                )}
              </p>
            </div>
            <div class="expense-row-actions">
              <button
                class="text-button"
                type="button"
                aria-label={`Szerkesztés: ${monthLabel(item.month)}`}
                onclick={() => edit(item)}>Szerkesztés</button
              >
              <button
                class="text-button danger"
                type="button"
                aria-label={`Törlés: ${monthLabel(item.month)}`}
                onclick={() => remove(item)}>Törlés</button
              >
            </div>
          </li>
        {/each}
      </ul>
    {:else}<p class="empty-state">Még nincs mentett vízfogyasztás.</p>{/if}
  </section>
</div>
