<script lang="ts">
  import { tick } from "svelte";
  import EntryInput from "../components/EntryInput.svelte";
  import Help from "../components/Help.svelte";
  import { parseNumber, today } from "../calendar";
  import { money } from "../lib/format";
  import {
    chargeNames,
    frequencies,
    nextChargeDue,
    validCharges,
    type Charge,
    type ChargeKind,
  } from "./charges";

  let {
    charges,
    onsave,
    onremove,
  }: {
    charges: readonly Charge[];
    onsave: (charge: Charge) => void;
    onremove: (charge: Charge) => void;
  } = $props();

  const kinds = Object.keys(chargeNames) as ChargeKind[];
  const now = today();
  const dateLabel = new Intl.DateTimeFormat("hu-HU", {
    dateStyle: "long",
    timeZone: "UTC",
  });
  let editing = $state<ChargeKind | null>(null);
  let firstDue = $state("");
  let amount = $state("");
  let months = $state<Charge["months"]>(12);
  let error = $state("");

  async function edit(kind: ChargeKind, item?: Charge) {
    editing = kind;
    firstDue = item?.firstDue ?? now;
    amount = item ? String(item.amount) : "";
    months = item?.months ?? 12;
    error = "";
    await tick();
    document.getElementById("car-charge-date")?.focus();
  }

  async function close() {
    const kind = editing;
    editing = null;
    await tick();
    document.getElementById(`car-charge-edit-${kind}`)?.focus();
  }

  function save(event: SubmitEvent) {
    event.preventDefault();
    if (!editing) return;
    const item = {
      kind: editing,
      firstDue,
      amount: parseNumber(amount),
      months,
    };
    if (!validCharges([item])) {
      error =
        "Ellenőrizd a dátumot és a díjat. A biztosítási díj legyen pozitív, az éves adó lehet nulla is.";
      return;
    }
    onsave(item);
    void close();
  }
</script>

<section class="card" aria-labelledby="car-recurring">
  <h2 id="car-recurring" tabindex="-1">Rendszeres autós kiadások</h2>
  <p class="expense-subtitle">
    Add meg az első esedékességet és az alkalmanként fizetendő díjat. Itt a
    tervezett tételek szerepelnek. A befizetéseidet a kiadási naplóban
    rögzítheted.
  </p>
  <ul class="expense-list">
    {#each kinds as kind (kind)}
      {@const item = charges.find((charge) => charge.kind === kind)}
      <li>
        <div>
          <strong>{chargeNames[kind]}</strong>
          {#if item}
            <p>
              {money(item.amount)} · {frequencies[item.months]} · Következő esedékesség:
              {dateLabel.format(
                new Date(`${nextChargeDue(item, now)}T00:00:00Z`),
              )}
            </p>
          {:else}
            <p>Nincs beállítva</p>
          {/if}
        </div>
        <div class="expense-row-actions">
          <button
            type="button"
            class="text-button"
            id={`car-charge-edit-${kind}`}
            aria-label={`${chargeNames[kind]} ${item ? "szerkesztése" : "hozzáadása"}`}
            onclick={() => edit(kind, item)}
            >{item ? "Szerkesztés" : "Hozzáadás"}</button
          >
          {#if item}
            <button
              type="button"
              class="text-button danger"
              aria-label={`${chargeNames[kind]} törlése`}
              onclick={() => {
                if (editing === kind) editing = null;
                onremove(item);
              }}>Törlés</button
            >
          {/if}
        </div>
      </li>
    {/each}
  </ul>

  {#if editing}
    <form onsubmit={save} class="charge-form">
      <h3>{chargeNames[editing]} beállítása</h3>
      <div class="expense-fields">
        <EntryInput
          id="car-charge-date"
          label="Fordulónap / első esedékesség"
          type="date"
          min="1900-01-01"
          max="9999-12-31"
          bind:value={firstDue}
          required
          help={{
            what: "A terv első fizetési napja. A következő alkalmak innen ismétlődnek.",
            where:
              "A biztosítás díjértesítőjén vagy a NAV-határozatban keresd az esedékességet.",
          }}
        />
        <EntryInput
          id="car-charge-amount"
          label="Díj fizetésenként · Ft"
          inputmode="decimal"
          bind:value={amount}
          required
          help={{
            what: "Az egy alkalommal fizetendő összeg.",
            where: "A díjértesítőn vagy a NAV-határozatban szereplő összeg.",
          }}
        />
        {#if editing === "tax"}
          <div>
            <strong>Fizetési gyakoriság</strong>
            <p class="field-hint">Éves</p>
          </div>
        {:else}
          <div class="field">
            <div class="field-label">
              <label for="car-charge-frequency">Fizetési gyakoriság</label>
              <Help
                forId="car-charge-frequency"
                label="Fizetési gyakoriság"
                content={{
                  what: "Megadja, hány havonta ismétlődjön a díj.",
                  where: "A biztosítási kötvényen vagy a díjértesítőn keresd.",
                }}
              />
            </div>
            <select
              id="car-charge-frequency"
              bind:value={months}
              aria-describedby="car-charge-frequency-help"
            >
              <option value={1}>Havi</option>
              <option value={3}>Negyedéves</option>
              <option value={6}>Féléves</option>
              <option value={12}>Éves</option>
            </select>
          </div>
        {/if}
      </div>
      {#if error}<p class="field-error" role="alert">{error}</p>{/if}
      <div class="expense-actions">
        <button type="submit" class="primary-button">Ütemezés mentése</button>
        <button type="button" class="text-button" onclick={close}>Mégse</button>
      </div>
    </form>
  {/if}
</section>

<style>
  .charge-form {
    margin-top: 16px;
  }
</style>
