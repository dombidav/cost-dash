<script lang="ts">
  import { tick } from "svelte";
  import EntryInput from "../components/EntryInput.svelte";
  import ExpenseMetrics from "../components/ExpenseMetrics.svelte";
  import Field from "../components/Field.svelte";
  import Help from "../components/Help.svelte";
  import PageIntro from "../components/PageIntro.svelte";
  import PdfActions from "../components/PdfActions.svelte";
  import ReadingPhoto from "../components/ReadingPhoto.svelte";
  import { commitPhoto, type Photo } from "../lib/photos";
  import { carReport } from "./report";
  import { parseNumber, today, validDate } from "../calendar";
  import { fmt, money, uid } from "../lib/format";
  import { nonnegative } from "../lib/months";
  import { storage } from "../lib/storage.svelte";
  import { toast } from "../lib/ui.svelte";
  import CarCharges from "./CarCharges.svelte";
  import CarGuide from "./CarGuide.svelte";
  import CarInsights from "./CarInsights.svelte";
  import CarPicker from "./CarPicker.svelte";
  import CarTax from "./CarTax.svelte";
  import { chargeNames, type Charge } from "./charges";
  import type { TaxInput } from "./tax";
  import {
    CAR_KEY,
    carTotals,
    createCar,
    initialCar,
    migrateCar,
    previousFuel,
    validCar,
    validCarEntry,
    type CarEntry,
  } from "./state";

  const disk = storage(CAR_KEY, initialCar, validCar, migrateCar);
  let data = $state(disk.data);
  let draftPhoto = $state<Photo | null>(null);
  let draftPhotoId = $state<string>();
  let saving = $state(false);
  let car = $derived(data.cars.find((item) => item.id === data.selected)!);
  const now = today();
  let kind = $state<CarEntry["kind"]>("fuel");
  let date = $state(now);
  let paid = $state("");
  let km = $state("");
  let odometer = $state("");
  let changed = $state<"km" | "odometer" | null>(null);
  let liters = $state("");
  let unitPrice = $state("");
  let name = $state("");
  let full = $state(false);
  let draftPaid = $derived(parseNumber(paid));
  let editing = $state("");
  let error = $state("");
  let prior = $derived(
    kind === "fuel" ? previousFuel(car.entries, date, editing) : undefined,
  );
  let reference = $derived(prior?.odometer);
  let enteredKm = $derived(km.trim() ? parseNumber(km) : null);
  let enteredOdometer = $derived(
    odometer.trim() ? parseNumber(odometer) : null,
  );
  let fromOdometer = $derived(
    reference !== undefined && changed === "odometer",
  );
  let fromDistance = $derived(reference !== undefined && changed === "km");
  let draftKm = $derived(
    fromOdometer
      ? enteredOdometer === null
        ? null
        : enteredOdometer - reference!
      : enteredKm,
  );
  let draftOdometer = $derived(
    fromDistance
      ? enteredKm === null
        ? null
        : reference! + enteredKm
      : enteredOdometer,
  );
  let totals = $derived(carTotals(car.entries, car.value));
  let log = $derived(
    [...car.entries].reverse().sort((a, b) => b.date.localeCompare(a.date)),
  );

  function reset() {
    draftPhoto = null;
    draftPhotoId = undefined;
    date = now;
    paid = km = odometer = liters = unitPrice = name = editing = error = "";
    changed = null;
    full = false;
  }

  function selectCar(id: string) {
    if (id === data.selected) return;
    reset();
    kind = "fuel";
    data.selected = id;
    disk.save(data);
  }

  function addCar(name: string) {
    const newCar = createCar(name);
    data.cars.push(newCar);
    selectCar(newCar.id);
  }

  function renameCar(name: string) {
    car.name = name;
    disk.save(data);
  }

  function saveCharge(charge: Charge, taxInput?: TaxInput) {
    car.charges = [
      ...(car.charges ?? []).filter((item) => item.kind !== charge.kind),
      charge,
    ];
    if (taxInput) car.taxInput = { ...taxInput };
    const saved = disk.save(data);
    toast(
      saved
        ? `${chargeNames[charge.kind]} ütemezése mentve.`
        : "Az ütemezés csak ebben a munkamenetben érvényes. A helyi mentés sikertelen.",
    );
  }

  function saveTax(input: TaxInput, amount: number) {
    const current = car.charges?.find((charge) => charge.kind === "tax");
    const candidate = `${input.year}${current?.firstDue.slice(4) ?? "-04-15"}`;
    const firstDue = validDate(candidate) ? candidate : `${input.year}-02-28`;
    saveCharge({ kind: "tax", firstDue, amount, months: 12 }, input);
  }

  function removeCharge(charge: Charge) {
    const owner = car;
    owner.charges = (owner.charges ?? []).filter(
      (item) => item.kind !== charge.kind,
    );
    const saved = disk.save(data);
    toast(
      saved
        ? `${chargeNames[charge.kind]} ütemezése törölve.`
        : "Az ütemezés csak ebben a munkamenetben törlődött. A helyi mentés sikertelen.",
      () => {
        if (owner.charges?.some((item) => item.kind === charge.kind)) return;
        owner.charges = [...(owner.charges ?? []), charge];
        if (!disk.save(data))
          toast(
            "Az ütemezés visszaállítása csak ebben a munkamenetben érvényes. A helyi mentés sikertelen.",
          );
      },
      "car-recurring",
    );
  }

  const inputNumber = new Intl.NumberFormat("hu-HU", {
    maximumFractionDigits: 2,
    useGrouping: false,
  });

  function displayNumber(value: number | null) {
    return value !== null && Number.isFinite(value) && value >= 0
      ? inputNumber.format(value)
      : "";
  }

  function formatInput(input: string) {
    return displayNumber(parseNumber(input)) || input;
  }

  function setKm(input: string) {
    km = input;
    if (reference !== undefined) odometer = "";
    changed = "km";
  }

  function setOdometer(input: string) {
    odometer = input;
    if (reference !== undefined) km = "";
    changed = "odometer";
  }

  async function edit(item: CarEntry) {
    reset();
    draftPhotoId = item.photoId;
    editing = item.id;
    date = item.date;
    paid = String(item.paid);
    kind = item.kind;
    odometer = item.odometer === undefined ? "" : String(item.odometer);
    if (item.kind === "fuel") {
      km = item.km === null ? "" : String(item.km);
      changed = km && !odometer ? "km" : odometer && !km ? "odometer" : null;
      liters = item.liters === null ? "" : String(item.liters);
      full = item.full;
    } else {
      name = item.name;
    }
    await tick();
    document.getElementById("car-paid")?.focus();
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (saving) return;
    const common = {
      id: editing || uid(),
      date,
      paid: parseNumber(paid),
      odometer: draftOdometer ?? undefined,
    };
    if (
      kind === "fuel" &&
      !fromOdometer &&
      enteredKm !== null &&
      !nonnegative(enteredKm, 1e6)
    ) {
      error = "A megtett út 0 és 1 000 000 km közötti szám lehet.";
      return;
    }
    if (draftOdometer !== null && !nonnegative(draftOdometer)) {
      error = "A kilométeróra állása 0 és 1 000 000 000 km közötti szám lehet.";
      return;
    }
    if (
      reference !== undefined &&
      draftOdometer !== null &&
      draftOdometer < reference
    ) {
      error =
        "A kilométeróra állása nem lehet kisebb az előző tankolásnál rögzített értéknél.";
      return;
    }
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
            km: draftKm,
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
    const owner = car.id;
    const existingPhotoId = draftPhotoId;
    const editedId = editing;
    saving = true;
    try {
      await commitPhoto(draftPhoto, (newPhotoId) => {
        const next = $state.snapshot(data);
        const target = next.cars.find((entry) => entry.id === owner);
        if (
          !target ||
          (editedId && !target.entries.some((row) => row.id === editedId))
        )
          throw new Error("Az autó vagy a kiadás már nem található.");
        const photoId = newPhotoId ?? existingPhotoId;
        const entry = { ...item, ...(photoId ? { photoId } : {}) };
        target.entries = editedId
          ? target.entries.map((row) => (row.id === editedId ? entry : row))
          : [...target.entries, entry];
        if (!disk.save(next)) return false;
        data = next;
        return true;
      });
      reset();
      toast("Az autóköltség bekerült a naplóba.");
    } catch (reason) {
      error = (reason as Error).message;
    } finally {
      saving = false;
    }
  }
  async function setPhoto(id: string, photo: Photo | null) {
    const owner = car.id;
    await commitPhoto(photo, (photoId) => {
      const next = $state.snapshot(data);
      const row = next.cars
        .find((entry) => entry.id === owner)
        ?.entries.find((entry) => entry.id === id);
      if (!row) throw new Error("A kiadás már nem található.");
      if (photoId) row.photoId = photoId;
      else delete row.photoId;
      if (!disk.save(next)) return false;
      data = next;
      if (editing === id) {
        draftPhotoId = photoId;
        draftPhoto = null;
      }
      return true;
    });
  }

  function remove(item: CarEntry) {
    if (editing === item.id) reset();
    const owner = car;
    const index = owner.entries.findIndex((row) => row.id === item.id);
    owner.entries = owner.entries.filter((row) => row.id !== item.id);
    const saved = disk.save(data);
    toast(
      saved
        ? "A tételt törölted."
        : "A tétel csak ebben a munkamenetben törlődött. A helyi mentés sikertelen.",
      () => {
        const target = data.cars.find((entry) => entry.id === owner.id);
        if (!target || target.entries.some((entry) => entry.id === item.id))
          return;
        target.entries = [
          ...target.entries.slice(0, index),
          item,
          ...target.entries.slice(index),
        ];
        if (!disk.save(data))
          toast(
            "A tétel visszaállítása csak ebben a munkamenetben érvényes. A helyi mentés sikertelen.",
          );
      },
      "car-log",
    );
  }
</script>

<svelte:window onstorage={disk.onStorage} />
<div class="expense-page car-page">
  <PageIntro
    eyebrow="ÚTON, TISZTÁN LÁTVA"
    title="Tudd, mennyibe kerül az út"
    description="Tankolás, szerviz és parkolás egy helyen. Kövesd a fogyasztásod és a kilométerenkénti költséged."
  />
  {#if disk.warning}<p class="notice danger" role="alert">
      {disk.warning}
    </p>{/if}
  <CarPicker
    cars={data.cars}
    selected={data.selected}
    onselect={selectCar}
    onadd={addCar}
    onrename={renameCar}
  />
  <section class="card" aria-labelledby="car-summary">
    <h2 id="car-summary">{car.name} kiadásai</h2>
    <p class="expense-subtitle">
      Az összes rögzített kiadás és a hozzá tartozó út. <a
        href="#car-guide-title">Autós tudnivalók ↓</a
      >
    </p>
    <ExpenseMetrics
      items={[
        { label: "Összes kifizetés", value: money(totals.paid) },
        { label: "Tankolás", value: money(totals.fuel) },
        { label: "Egyéb kiadás", value: money(totals.other) },
        {
          label: "Naplózott távolság",
          value: `${fmt(totals.distance, 2, 0)} km`,
        },
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
    <form onsubmit={save} aria-busy={saving}>
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
          bind:value={
            () => date,
            (next) => {
              date = next;
              if (!changed) changed = odometer ? "odometer" : km ? "km" : null;
            }
          }
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
          format={formatInput}
          placeholder="pl. 25 000"
          required
          help={{
            what: "A teljes kifizetett bruttó összeg.",
            where:
              "A blokk végösszege. Tankolásnál csak az üzemanyag árát add meg.",
          }}
        />
        <EntryInput
          id="car-odometer"
          label="Kilométeróra állása · km"
          inputmode="decimal"
          bind:value={
            () => (fromDistance ? displayNumber(draftOdometer) : odometer),
            setOdometer
          }
          format={formatInput}
          placeholder="pl. 124 500"
          help={{
            what: "Az autó teljes kilométeróra-állása. Ha az előző tankolásnál is megadtad, az út és az óraállás egymásból számolódik.",
            where:
              "A műszerfalon az összes megtett kilométert keresd, vagy nézd meg a szerviz munkalapján.",
          }}
        />
        {#if kind === "fuel"}
          <EntryInput
            id="car-km"
            label="Megtett út tankolás óta · km"
            inputmode="decimal"
            bind:value={
              () => (fromOdometer ? displayNumber(draftKm) : km), setKm
            }
            format={formatInput}
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
            format={formatInput}
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
            format={formatInput}
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
        {#if reference !== undefined}
          <p class="field-hint">
            Előző tankolás ({prior?.date}):
            <strong>{fmt(reference, 2, 0)} km</strong>. Bármelyik kilométermezőt
            átírhatod, a másik azonnal frissül.
          </p>
        {:else}
          <p class="field-hint">
            Ha az előző tankolásnál nincs óraállás, a két mezőt külön töltheted
            ki.
          </p>
        {/if}
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
      {#if kind === "fuel" && draftKm !== null && draftKm > 0 && draftPaid > 0}
        <p class="field-hint">
          A tankolás ára a megadott útra vetítve: <strong
            >{fmt(draftPaid / draftKm, 2, 0)} Ft/km</strong
          >.
        </p>
      {/if}
      {#if error}<p class="field-error" role="alert">{error}</p>{/if}
      <ReadingPhoto
        value={draftPhoto}
        photoId={draftPhotoId}
        label="Blokk vagy számla képe"
        oncommit={async (photo) => {
          draftPhoto = photo;
          draftPhotoId = undefined;
        }}
      />
      <div class="expense-actions">
        <button class="primary-button" type="submit" disabled={saving}
          >{editing ? "Módosítás mentése" : "Kiadás mentése"}</button
        >
        {#if editing}<button class="text-button" type="button" onclick={reset}
            >Mégse</button
          >{/if}
      </div>
    </form>
  </section>

  {#key car.id}
    <CarCharges
      charges={car.charges ?? []}
      onsave={saveCharge}
      onremove={removeCharge}
    />
    <CarTax
      saved={car.taxInput}
      hasTax={car.charges?.some((charge) => charge.kind === "tax") ?? false}
      onsave={saveTax}
    />
  {/key}

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
            value: `${fmt(totals.consumption, 2, 0)} l/100 km`,
          },
          {
            label: "Üzemanyag kilométerenként",
            value: `${fmt(totals.fuelPerKm, 2, 0)} Ft/km`,
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
        {#key car.id}
          <Field
            id="car-value"
            label="Az autó becsült értéke"
            unit="Ft"
            decimal
            value={car.value}
            help={{
              what: "Ebből és a naplózott kilométerekből készül a szemléltető értékvesztés.",
              where:
                "A saját autódhoz hasonló évjáratú és állapotú autók hirdetési árai alapján.",
            }}
            oncommit={(value) => {
              const next = parseNumber(value);
              if (!nonnegative(next)) return "Adj meg nemnegatív értéket.";
              car.value = next;
              disk.save(data);
            }}
          />
        {/key}
      </div>
      <ExpenseMetrics
        items={[
          {
            label: "Becsült értékvesztés kilométerenként",
            value: `${fmt(totals.wearPerKm, 2, 0)} Ft/km`,
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

  <CarInsights
    entries={car.entries}
    {now}
    consumption={totals.consumption}
    fuelPerKm={totals.fuelPerKm}
  />

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
                {item.date}{#if item.odometer !== undefined}
                  {` · Óraállás: ${fmt(item.odometer, 2, 0)} km`}{/if}{#if item.kind === "fuel" && item.km !== null}
                  {` · Megtett út: ${fmt(item.km, 2, 0)} km`}{/if}{#if item.kind === "fuel" && item.full && item.liters !== null && item.km !== null}
                  {` · ${fmt((item.liters / item.km) * 100, 2, 0)} l/100 km`}{/if}
              </p>
            </div>
            <div class="expense-row-actions">
              <ReadingPhoto
                photoId={item.photoId}
                label={`${item.date} bizonylata`}
                oncommit={(photo) => setPhoto(item.id, photo)}
              />
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
  <CarGuide />
  <PdfActions
    category="car"
    getData={() => $state.snapshot(data)}
    report={carReport}
    description="A PDF minden autód naplóját, ütemezett díjait és beállításait menti. A visszaállítás az összes jelenlegi autót lecseréli."
    logLabel="Autós naplók (PDF)"
    detailedLabel="Naplók és összesítés (PDF)"
    parse={(value) => {
      const parsed = migrateCar(value);
      return validCar(parsed) ? parsed : null;
    }}
    describe={(saved) =>
      `${saved.cars.length} autó, ${saved.cars.reduce((sum, item) => sum + item.entries.length, 0)} naplóbejegyzés, az ütemezett díjak és beállítások`}
    onrestore={(saved) => {
      if (!disk.save(saved)) return false;
      data = saved;
      reset();
      return true;
    }}
  />
</div>

<style>
  .car-page :global(.expense-actions > .primary-button) {
    width: auto;
    margin: 0;
    justify-content: center;
  }
</style>
