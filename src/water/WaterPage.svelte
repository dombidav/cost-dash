<script lang="ts">
  import Chart from "../components/Chart.svelte";
  import EntryInput from "../components/EntryInput.svelte";
  import ExpenseMetrics from "../components/ExpenseMetrics.svelte";
  import PageIntro from "../components/PageIntro.svelte";
  import ReadingLog from "../components/ReadingLog.svelte";
  import ReadingPhoto from "../components/ReadingPhoto.svelte";
  import { commitPhoto, type Photo } from "../lib/photos";
  import { trimReadings } from "../lib/reading-limit";
  import PdfActions from "../components/PdfActions.svelte";
  import { waterReport } from "./report";
  import { readingError } from "../calculator";
  import { monthPeriod, parseNumber, today } from "../calendar";
  import { percentChange } from "../lib/consumption";
  import { fmt, money, signed, uid } from "../lib/format";
  import { monthLabel } from "../lib/months";
  import { storage } from "../lib/storage.svelte";
  import { toast } from "../lib/ui.svelte";
  import type { Reading } from "../types";
  import WaterExamples from "./WaterExamples.svelte";
  import WaterSettings from "./WaterSettings.svelte";
  import {
    initialWater,
    migrateWater,
    validWater,
    waterBill,
    waterIntervals,
    WATER_KEY,
  } from "./state";

  const disk = storage(WATER_KEY, initialWater, validWater, migrateWater);
  let data = $state(disk.data);
  let draftPhoto = $state<Photo | null>(null);
  let saving = $state(false);
  const now = today();
  let date = $state(now);
  let value = $state("");
  let error = $state("");
  let intervals = $derived(waterIntervals(data.readings));
  let latest = $derived(intervals.at(-1));
  let previous = $derived(intervals.at(-2));
  let history = $derived(
    data.readings.map((item) => ({
      ...item,
      values: [item.value],
      total: item.value,
    })),
  );
  let archive = $derived(
    [...data.months].sort((a, b) => b.month.localeCompare(a.month)),
  );
  const nationalLitersPerDay = 37_200 / 366;

  function writeReading(item: Reading) {
    const message = readingError(item, data.readings, now)?.message;
    if (message) return message;
    data.readings = [
      ...data.readings.filter((row) => row.id !== item.id),
      item,
    ];
    disk.save(data);
  }

  async function record(event: SubmitEvent) {
    event.preventDefault();
    if (saving) return;
    const item = { id: uid(), date, value: parseNumber(value) };
    error = readingError(item, data.readings, now)?.message ?? "";
    if (error) return;
    saving = true;
    try {
      await commitPhoto(draftPhoto, (photoId) => {
        const next = $state.snapshot(data);
        next.readings.push({ ...item, ...(photoId ? { photoId } : {}) });
        trimReadings([next.readings]);
        if (!next.readings.some((row) => row.id === item.id))
          throw new Error(
            "Ez a mérés túl régi ahhoz, hogy beférjen a naplóba.",
          );
        if (!disk.save(next)) return false;
        data = next;
        return true;
      });
      date = now;
      value = "";
      draftPhoto = null;
      toast("A vízóraállás bekerült a naplóba.");
    } catch (reason) {
      error = (reason as Error).message;
    } finally {
      saving = false;
    }
  }
  async function setPhoto(id: string, photo: Photo | null) {
    await commitPhoto(photo, (photoId) => {
      const next = $state.snapshot(data);
      const row = next.readings.find((item) => item.id === id);
      if (!row) throw new Error("A mérés már nem található.");
      if (photoId) row.photoId = photoId;
      else delete row.photoId;
      if (!disk.save(next)) return false;
      data = next;
      return true;
    });
  }

  function edit(id: string, field: number | "date", input: string) {
    const item = data.readings.find((row) => row.id === id);
    if (!item) return "Ez a mérés már nem található.";
    return writeReading(
      field === "date"
        ? { ...item, date: input.trim() }
        : { ...item, value: parseNumber(input) },
    );
  }

  function remove(id: string) {
    const item = data.readings.find((row) => row.id === id);
    if (!item) return;
    data.readings = data.readings.filter((row) => row.id !== id);
    disk.save(data);
    toast(
      "A vízóraállást törölted.",
      () => {
        const message = writeReading(item);
        if (message) toast(message);
      },
      "water-history-title",
    );
  }

  function removeArchived(month: string) {
    const item = data.months.find((row) => row.month === month);
    if (!item) return;
    data.months = data.months.filter((row) => row.month !== month);
    disk.save(data);
    toast(
      "A korábbi havi tételt törölted.",
      () => {
        data.months = [...data.months, item];
        disk.save(data);
      },
      "water-reading",
    );
  }
</script>

<svelte:window onstorage={disk.onStorage} />
<div class="expense-page">
  <PageIntro
    eyebrow="VÍZ, CSEPPRŐL CSEPPRE"
    title="Lásd, hová folyik"
    description="A vízórád állásaiból kiszámoljuk a fogyasztást, az ivóvíz díját és a csatornaköltséget."
  />
  {#if disk.warning}<p class="notice danger" role="alert">
      {disk.warning}
    </p>{/if}

  <WaterSettings
    rates={data.rates}
    onupdate={(rates) => {
      data.rates = rates;
      disk.save(data);
    }}
  />

  <section class="card" aria-labelledby="water-reading">
    <h2 id="water-reading" tabindex="-1">Vízóraállás rögzítése</h2>
    <p class="expense-subtitle">
      Két leolvasásból megmutatjuk, hány köbméter vizet használtál közöttük.
    </p>
    <form onsubmit={record}>
      <div class="expense-fields">
        <EntryInput
          id="water-date"
          label="Leolvasás dátuma"
          type="date"
          bind:value={date}
          min="1900-01-01"
          max={now}
          required
          help={{
            what: "A nap, amikor leolvastad az órát. Alapból a mai nap.",
            where:
              "A saját feljegyzésedben vagy a számlán a mérőállás mellett.",
          }}
        />
        <EntryInput
          id="water-value"
          label="Vízóra állása · m³"
          inputmode="decimal"
          bind:value
          placeholder="pl. 125,4"
          required
          help={{
            what: "A vízóra teljes állása, nem az időszaki fogyasztás. A tizedeseket vesszővel is megadhatod.",
            where: "A vízóra számlálóján vagy a számla mérőállásai között.",
          }}
        />
      </div>
      {#if error}<p class="field-error" role="alert">{error}</p>{/if}
      <ReadingPhoto bind:value={draftPhoto} />
      <div class="expense-actions">
        <button class="primary-button" type="submit" disabled={saving}
          >Mérőállás mentése</button
        >
      </div>
    </form>
  </section>

  <section class="card" aria-labelledby="water-usage">
    <h2 id="water-usage">Az utolsó két leolvasás között</h2>
    {#if latest}
      {@const cost = waterBill(
        latest.volume,
        latest.start,
        latest.end,
        data.rates,
      )}
      <p class="expense-subtitle">
        {latest.start} – {latest.end} · {latest.days} nap. A becslés a
        <a href="#water-settings">jelenlegi díjaiddal</a> készül.
      </p>
      <ExpenseMetrics
        items={[
          { label: "Elfogyasztott víz", value: `${fmt(latest.volume, 3)} m³` },
          { label: "Becsült összes díj", value: money(cost.total) },
          { label: "Ivóvíz", value: money(cost.water) },
          { label: "Csatorna", value: money(cost.sewer) },
          ...(data.rates.base
            ? [{ label: "Időarányos alapdíj", value: money(cost.base) }]
            : []),
        ]}
      />
    {:else}<p class="empty-state">
        A fogyasztáshoz és a díjbecsléshez két eltérő napra rögzített állás
        kell.
      </p>{/if}
  </section>

  <ReadingLog
    id="water-history"
    readingId="water-reading"
    rows={history}
    unit="m³"
    digits={3}
    columns={["Vízóraállás"]}
    onedit={edit}
    onremove={remove}
    onphoto={setPhoto}
  />

  {#if archive.length}
    <details class="card expense-detail">
      <summary>Korábban mentett havi fogyasztás ({archive.length})</summary>
      <p>
        A régi havi adatok megmaradtak. Ezekhez nem tartozik vízóraállás, ezért
        a mérési grafikonon nem jelennek meg.
      </p>
      <ul class="expense-list">
        {#each archive as item (item.month)}
          {@const period = monthPeriod(`${item.month}-01`)}
          <li>
            <strong>{monthLabel(item.month)} · {fmt(item.volume, 3)} m³</strong>
            <span
              >{money(
                waterBill(
                  item.volume,
                  period.start,
                  period.end,
                  data.rates,
                  item.sewerVolume ?? item.volume,
                ).total,
              )} · mai díjakkal</span
            >
            <button
              type="button"
              class="text-button danger"
              aria-label={`Havi tétel törlése: ${monthLabel(item.month)}`}
              onclick={() => removeArchived(item.month)}>Törlés</button
            >
          </li>
        {/each}
      </ul>
    </details>
  {/if}

  <section class="card" aria-labelledby="water-stats">
    <h2 id="water-stats">Fogyasztás érthetően</h2>
    <p class="expense-subtitle">
      Az utolsó mérési időszak napi átlagát a korábbi szokásaidhoz és az
      országos adathoz hasonlítjuk.
    </p>
    {#if latest}
      {@const perPerson = (latest.average * 1000) / data.rates.people}
      {@const trend = previous
        ? percentChange(latest.average, previous.average)
        : null}
      {@const yearlySaving =
        3.65 * data.rates.people * (data.rates.water + data.rates.sewer)}
      <ExpenseMetrics
        items={[
          {
            label: "Saját napi átlag fejenként",
            value: `${fmt(perPerson, 0)} liter`,
          },
          {
            label: "Országos napi átlag fejenként",
            value: `${fmt(nationalLitersPerDay, 0)} liter`,
          },
          ...(trend !== null
            ? [
                {
                  label:
                    "Napi fogyasztás változása az előző mérési időszakhoz képest",
                  value: signed(trend),
                },
              ]
            : []),
        ]}
      />
      <Chart
        id="water-benchmark"
        kind="benchmark"
        unit="liter/fő/nap"
        label="A háztartás fejenkénti napi vízfogyasztása az országos átlaghoz képest."
        bars={[
          {
            label: "Saját átlag",
            short: "Saját átlag",
            value: perPerson,
            own: true,
          },
          { label: "Országos átlag", value: nationalLitersPerDay, own: false },
        ]}
      />
      {#if latest.average * 1000 >= 10 * data.rates.people && yearlySaving > 0}
        <p class="field-hint">
          Ha fejenként napi 10 literrel kevesebb vizet használnátok, a jelenlegi
          díjakkal évente kb. <strong>{money(yearlySaving)}</strong> maradna meg.
          Az alapdíj változatlan.
        </p>
      {/if}
    {:else}<p class="empty-state">
        A saját összehasonlításhoz rögzíts legalább két vízóraállást.
      </p>{/if}
    <p class="field-hint">
      <a
        href="https://www.ksh.hu/evkonyvek/2024/magyar-statisztikai-evkonyv-2024/pdf/statevk2024_6.pdf"
        >KSH, 2024</a
      >: 37,2 m³/fő/év.
    </p>
  </section>
  <WaterExamples {intervals} {now} />
  <PdfActions
    category="water"
    getData={() => $state.snapshot(data)}
    report={waterReport}
    logLabel="Víznapló (PDF)"
    detailedLabel="Víznapló és összesítés (PDF)"
    parse={(value) => {
      const parsed = migrateWater(value);
      return validWater(parsed) ? parsed : null;
    }}
    describe={(saved) =>
      `${saved.readings.length} vízóraállás, ${saved.months.length} korábbi havi tétel és a vízdíj-beállítások`}
    onrestore={(saved) => {
      if (!disk.save(saved)) return false;
      data = saved;
      date = now;
      value = error = "";
      return true;
    }}
  />
</div>
