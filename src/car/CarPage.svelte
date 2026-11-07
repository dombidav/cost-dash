<script lang="ts">
  import { tick } from "svelte";
  import EntryInput from "../components/EntryInput.svelte";
  import ExpenseMetrics from "../components/ExpenseMetrics.svelte";
  import Field from "../components/Field.svelte";
  import Help from "../components/Help.svelte";
  import { parseNumber, today } from "../calendar";
  import { fmt, money, uid } from "../lib/format";
  import { nonnegative } from "../lib/months";
  import { storage } from "../lib/storage.svelte";
  import { toast } from "../lib/ui.svelte";
  import {
    CAR_KEY,
    carTotals,
    initialCar,
    validCar,
    validCarEntry,
    type CarEntry,
  } from "./state";

  const disk = storage(CAR_KEY, initialCar, validCar);
  let data = $state(disk.data);
  const now = today();
  let kind = $state<CarEntry["kind"]>("fuel");
  let date = $state(now);
  let paid = $state("");
  let km = $state("");
  let liters = $state("");
  let unitPrice = $state("");
  let name = $state("");
  let full = $state(false);
  let draftKm = $derived(parseNumber(km));
  let draftPaid = $derived(parseNumber(paid));
  let editing = $state("");
  let error = $state("");
  let totals = $derived(carTotals(data.entries, data.value));
  let log = $derived(
    [...data.entries].reverse().sort((a, b) => b.date.localeCompare(a.date)),
  );
  const europeanAverage = { petrol: 7.89, diesel: 6.88 };

  function reset() {
    date = now;
    paid = km = liters = unitPrice = name = editing = error = "";
    full = false;
  }

  async function edit(item: CarEntry) {
    reset();
    editing = item.id;
    date = item.date;
    paid = String(item.paid);
    kind = item.kind;
    if (item.kind === "fuel") {
      km = item.km === null ? "" : String(item.km);
      liters = item.liters === null ? "" : String(item.liters);
      full = item.full;
    } else {
      name = item.name;
    }
    await tick();
    document.getElementById("car-paid")?.focus();
  }

  function save(event: SubmitEvent) {
    event.preventDefault();
    const common = { id: editing || uid(), date, paid: parseNumber(paid) };
    const price = parseNumber(unitPrice);
    if (
      kind === "fuel" &&
      !liters.trim() &&
      unitPrice.trim() &&
      !(price > 0 && price <= 1e5)
    ) {
      error = "Adj meg pozitív literárat, vagy hagyd üresen a mezőt.";
      return;
    }
    const item: CarEntry =
      kind === "fuel"
        ? {
            ...common,
            kind,
            km: km.trim() ? parseNumber(km) : null,
            liters: liters.trim()
              ? parseNumber(liters)
              : unitPrice.trim()
                ? common.paid / price
                : null,
            full,
          }
        : { ...common, kind, name: name.trim() };
    if (!validCarEntry(item)) {
      error =
        full && kind === "fuel"
          ? "A fogyasztás számításához add meg a megtett utat és a litert vagy literárat. Ellenőrizd a dátumot és az összeget is."
          : "Ellenőrizd a dátumot, a pozitív összeget és a többi megadott mezőt.";
      return;
    }
    data.entries = [...data.entries.filter((row) => row.id !== editing), item];
    disk.save(data);
    reset();
    toast("Az autóköltség bekerült a naplóba.");
  }

  function remove(item: CarEntry) {
    if (editing === item.id) reset();
    data.entries = data.entries.filter((row) => row.id !== item.id);
    disk.save(data);
    toast(
      "A tételt törölted.",
      () => {
        data.entries = [...data.entries, item];
        disk.save(data);
      },
      "car-log",
    );
  }
</script>

<svelte:window onstorage={disk.onStorage} />
<div class="expense-page">
  <div class="expense-intro">
    <span class="eyebrow">AUTÓ · KIADÁSI NAPLÓ</span>
    <h1>Autóköltségek</h1>
    <p>
      Tankolás, szerviz és parkolás egy helyen. Nézd meg, mennyibe kerül az út
      és mennyit fogyaszt az autód.
    </p>
  </div>
  {#if disk.warning}<p class="notice danger" role="alert">
      {disk.warning}
    </p>{/if}
  <section class="card" aria-labelledby="car-summary">
    <h2 id="car-summary">Eddigi autóköltségeim</h2>
    <p class="expense-subtitle">
      Az összes rögzített kiadás és a hozzá tartozó út.
    </p>
    <ExpenseMetrics
      items={[
        { label: "Összes kifizetés", value: money(totals.paid) },
        { label: "Tankolás", value: money(totals.fuel) },
        { label: "Egyéb kiadás", value: money(totals.other) },
        { label: "Naplózott távolság", value: `${fmt(totals.distance, 0)} km` },
      ]}
    />
  </section>

  <section class="card" aria-labelledby="car-entry">
    <h2 id="car-entry">
      {editing ? "Kiadás szerkesztése" : "Autós kiadás rögzítése"}
    </h2>
    <p class="expense-subtitle">
      A fizetett összeg önmagában is menthető. A fogyasztáshoz add meg a megtett
      utat és a tankolt mennyiséget is.
    </p>
    <form onsubmit={save}>
      <div class="expense-fields">
        <div class="field">
          <div class="field-label">
            <label for="car-kind">Kiadás típusa</label><Help
              forId="car-kind"
              label="Kiadás típusa"
              content={{
                what: "Üzemanyag vagy egyéb egyszeri autós kiadás.",
                where: "A blokkon vagy számlán szereplő tétel alapján.",
              }}
            />
          </div>
          <select
            id="car-kind"
            bind:value={kind}
            aria-describedby="car-kind-help"
            ><option value="fuel">Tankolás</option><option value="expense"
              >Egyszeri kiadás</option
            ></select
          >
        </div>
        <EntryInput
          id="car-date"
          label="Fizetés napja"
          type="date"
          bind:value={date}
          max={now}
          required
          help={{
            what: "Ezen a napon jelenik meg a költség.",
            where: "A blokkon vagy számlán.",
          }}
        />
        <EntryInput
          id="car-paid"
          label="Fizetett összeg · Ft"
          inputmode="decimal"
          bind:value={paid}
          placeholder="pl. 25 000"
          required
          help={{
            what: "A teljes kifizetett bruttó összeg.",
            where:
              "A blokk végösszege. Tankolásnál csak az üzemanyag árát add meg.",
          }}
        />
        {#if kind === "fuel"}
          <EntryInput
            id="car-km"
            label="Megtett út tankolás óta · km"
            inputmode="decimal"
            bind:value={km}
            help={{
              what: "Az előző tankolás óta megtett út. Egy szakaszt csak egyszer számolj.",
              where:
                "A nullázott napi kilométer-számlálón vagy két óraállás különbségeként.",
            }}
          />
          <EntryInput
            id="car-liters"
            label="Tankolt mennyiség · liter"
            inputmode="decimal"
            bind:value={liters}
            help={{
              what: "A most tankolt üzemanyag mennyisége. Ha megadod, a literárat nem használjuk a számításhoz.",
              where: "A kút kijelzőjén vagy a blokkon.",
            }}
          />
          <EntryInput
            id="car-price"
            label="Vagy literár · Ft/liter"
            inputmode="decimal"
            bind:value={unitPrice}
            help={{
              what: "Ha nem tudod a litert, a fizetett összeg és az egységár hányadosából számoljuk.",
              where: "A blokkon az üzemanyag egységára.",
            }}
          />
        {:else}
          <EntryInput
            id="car-name"
            label="Kiadás neve"
            bind:value={name}
            placeholder="pl. Olajcsere"
            required
            help={{
              what: "Rövid név a naplóhoz.",
              where: "Például parkolás, autópálya-matrica vagy szerviz.",
            }}
          />
        {/if}
      </div>
      {#if kind === "fuel"}
        <div class="expense-checkbox">
          <label
            ><input
              id="car-full"
              type="checkbox"
              bind:checked={full}
              aria-describedby="car-full-help"
            /> Két egymást követő tele tankolás közötti út</label
          >
          <Help
            forId="car-full"
            label="Tele tankolás"
            content={{
              what: "A mostani és az előző tankolás is telire töltötte a tankot, és közben nem tankoltál.",
              where:
                "Jelöld be, ha a most tankolt mennyiség megfelel az úton elfogyasztottnak.",
            }}
          />
        </div>
      {/if}
      {#if kind === "fuel" && draftKm > 0 && draftPaid > 0}
        <p class="field-hint">
          A tankolás ára a megadott útra vetítve: <strong
            >{fmt(draftPaid / draftKm, 2)} Ft/km</strong
          >.
        </p>
      {/if}
      {#if error}<p class="field-error" role="alert">{error}</p>{/if}
      <div class="expense-actions">
        <button class="primary-button" type="submit"
          >{editing ? "Módosítás mentése" : "Kiadás mentése"}</button
        >
        {#if editing}<button class="text-button" type="button" onclick={reset}
            >Mégse</button
          >{/if}
      </div>
    </form>
  </section>

  <section class="card" aria-labelledby="car-stats">
    <h2 id="car-stats">Mit jelent ez az úton?</h2>
    <p class="expense-subtitle">
      A fogyasztás és a kilométerköltség a tele tankolással mért utak összes
      literéből, forintjából és kilométeréből készül.
    </p>
    {#if totals.consumption !== null && totals.fuelPerKm !== null}
      <ExpenseMetrics
        items={[
          {
            label: "Átlagfogyasztás",
            value: `${fmt(totals.consumption, 2)} l/100 km`,
          },
          {
            label: "Üzemanyag kilométerenként",
            value: `${fmt(totals.fuelPerKm, 1)} Ft/km`,
          },
          {
            label: "Egy 100 km-es kiruccanás üzemanyaga",
            value: money(totals.fuelPerKm * 100),
          },
        ]}
      />
    {:else}<p class="empty-state">
        A saját átlagodhoz rögzíts egy két tele tankolás közötti utat.
      </p>{/if}
    <p class="field-hint">
      <a
        href="https://climate.ec.europa.eu/document/download/b644dafe-1385-4b56-98d9-21e7e9f3601b_en?filename=report.pdf"
        >Európai Bizottság</a
      >: a 2021-ben forgalomba helyezett autók vizsgált mintájában a valós átlag
      benzineseknél {fmt(europeanAverage.petrol, 2)}, dízeleknél {fmt(
        europeanAverage.diesel,
        2,
      )} l/100 km volt.
    </p>
    <details class="expense-detail">
      <summary>Autókopás: a futás becsült hatása az értékre</summary>
      <p>
        A <a
          href="https://www.ksh.hu/s/kiserleti-statisztika/kiadvanyok/hasznaltautohu-ksh-2026-szeptember/"
          >KSH és a Használtautó.hu 2026. szeptemberi elemzése</a
        > szerint 1000 km nagyjából 0,2%-kal csökkenti a hirdetési árat, ha a többi
        tényező változatlan. A kiinduló 3 millió Ft példa, írd át a saját becslésedre.
      </p>
      <div class="expense-fields">
        <Field
          id="car-value"
          label="Az autó becsült értéke"
          unit="Ft"
          decimal
          value={data.value}
          help={{
            what: "Ebből és a naplózott kilométerekből készül a szemléltető értékvesztés.",
            where:
              "A saját autódhoz hasonló évjáratú és állapotú autók hirdetési árai alapján.",
          }}
          oncommit={(value) => {
            const next = parseNumber(value);
            if (!nonnegative(next)) return "Adj meg nemnegatív értéket.";
            data.value = next;
            disk.save(data);
          }}
        />
      </div>
      <ExpenseMetrics
        items={[
          {
            label: "Becsült értékvesztés kilométerenként",
            value: `${fmt(totals.wearPerKm, 2)} Ft/km`,
          },
          {
            label: "Naplózott utak becsült értékvesztése",
            value: money(totals.wear),
          },
        ]}
      />
      <p class="field-hint">
        Szemléltető becslés, amely a naplózott úttal arányos, legfeljebb az autó
        megadott értékéig. A kifizetésekbe nem számít bele.
      </p>
    </details>
  </section>

  <section class="card" aria-labelledby="car-log">
    <h2 id="car-log" tabindex="-1">Korábbi kiadások</h2>
    {#if log.length}
      <ul class="expense-list">
        {#each log as item (item.id)}
          <li>
            <div>
              <strong
                >{item.kind === "fuel" ? "Tankolás" : item.name} · {money(
                  item.paid,
                )}</strong
              >
              <p>
                {item.date}{#if item.kind === "fuel" && item.km !== null}
                  · {fmt(item.km, 0)} km{/if}{#if item.kind === "fuel" && item.full && item.liters !== null && item.km !== null}
                  · {fmt((item.liters / item.km) * 100, 2)} l/100 km{/if}
              </p>
            </div>
            <div class="expense-row-actions">
              <button
                class="text-button"
                type="button"
                aria-label={`Szerkesztés: ${item.date}, ${money(item.paid)}`}
                onclick={() => edit(item)}>Szerkesztés</button
              >
              <button
                class="text-button danger"
                type="button"
                aria-label={`Törlés: ${item.date}, ${money(item.paid)}`}
                onclick={() => remove(item)}>Törlés</button
              >
            </div>
          </li>
        {/each}
      </ul>
    {:else}<p class="empty-state">Még nincs mentett autós kiadás.</p>{/if}
  </section>
</div>
