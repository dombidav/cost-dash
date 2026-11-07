<script lang="ts">
  import { tick } from "svelte";
  import EntryInput from "../components/EntryInput.svelte";
  import Select from "../components/Select.svelte";
  import { carNameKey, normalizeCarName, type Car } from "./state";

  let {
    cars,
    selected,
    onselect,
    onadd,
    onrename,
  }: {
    cars: readonly Car[];
    selected: string;
    onselect: (id: string) => void;
    onadd: (name: string) => void;
    onrename: (name: string) => void;
  } = $props();

  let mode = $state<"add" | "rename" | null>(null);
  let draft = $state("");
  let error = $state("");
  const nameInput = "car-vehicle-name";

  async function open(next: "add" | "rename") {
    mode = next;
    draft =
      next === "rename"
        ? (cars.find((car) => car.id === selected)?.name ?? "")
        : "";
    error = "";
    await tick();
    document.getElementById(nameInput)?.focus();
  }

  async function close(focusId?: string) {
    mode = null;
    if (!focusId) return;
    await tick();
    document.getElementById(focusId)?.focus();
  }

  function save(event: SubmitEvent) {
    event.preventDefault();
    const name = normalizeCarName(draft);
    if (!name || name.length > 80) {
      error = "Adj meg egy legfeljebb 80 karakteres nevet vagy rendszámot.";
      return;
    }
    const key = carNameKey(name);
    if (
      cars.some(
        (car) =>
          (mode === "add" || car.id !== selected) &&
          carNameKey(car.name) === key,
      )
    ) {
      error = "Ez a név vagy rendszám már szerepel. Válassz egyedit.";
      return;
    }
    if (mode === "add") onadd(name);
    else if (mode === "rename") onrename(name);
    void close("car-select");
  }
</script>

<section class="card car-picker" aria-label="Autók kezelése">
  <div class="picker-controls">
    <Select
      id="car-select"
      label="Aktív autó"
      value={selected}
      options={cars.map((car) => ({ value: car.id, label: car.name }))}
      oncommit={(id) => {
        void close();
        onselect(id);
      }}
    />
    <div class="picker-actions">
      <button
        id="car-add"
        type="button"
        class="primary-button"
        onclick={() => open("add")}>Új autó</button
      >
      <button
        id="car-rename"
        type="button"
        class="text-button"
        onclick={() => open("rename")}>Átnevezés</button
      >
    </div>
  </div>
  <p class="picker-hint">
    Minden autóhoz külön napló és számítás tartozik. A Dashboard az összes autó
    kiadását összeadja.
  </p>
  {#if mode}
    <form onsubmit={save}>
      <EntryInput
        id={nameInput}
        label="Név / rendszám"
        bind:value={draft}
        placeholder="pl. Családi autó"
        required
        help={{
          what: "Az autó egyedi azonosítója a naplóban.",
          where:
            "Adj meg egy könnyen felismerhető nevet, vagy írd be a rendszámot.",
        }}
      />
      {#if error}<p class="field-error" role="alert">{error}</p>{/if}
      <div class="expense-actions">
        <button type="submit" class="primary-button"
          >{mode === "add" ? "Autó hozzáadása" : "Név mentése"}</button
        >
        <button
          type="button"
          class="text-button"
          onclick={() => close(mode === "add" ? "car-add" : "car-rename")}
          >Mégse</button
        >
      </div>
    </form>
  {/if}
</section>

<style>
  .car-picker,
  .picker-controls {
    display: grid;
    gap: 14px;
  }
  .picker-controls {
    grid-template-columns: minmax(0, 1fr);
    align-items: end;
  }
  .picker-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .picker-actions > button {
    width: auto;
    min-height: 46px;
    margin: 0;
  }
  .picker-actions .text-button {
    border: 1px solid var(--control-border);
    border-radius: 9px;
    padding: 0 16px;
    font-size: 12px;
    font-weight: 650;
  }
  .picker-hint {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
  }
  form {
    max-width: 32rem;
  }
  .expense-actions .primary-button {
    width: auto;
    margin: 0;
  }
  p.field-error {
    color: var(--danger);
    margin-top: 6px;
  }
  @media (min-width: 600px) {
    .picker-controls {
      grid-template-columns: minmax(0, 32rem) auto;
      justify-content: start;
    }
  }
</style>
