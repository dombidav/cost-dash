<script lang="ts">
  import { untrack } from "svelte";
  import Help from "../components/Help.svelte";
  import { A2_PEAK_HELP } from "../lib/field-help";
  import TariffGuide from "./TariffGuide.svelte";
  import PointSettings from "./PointSettings.svelte";
  import {
    initialState,
    validState,
    migrateState,
    createPoint,
    validatePoint,
    validateReading,
    readingError,
    annual,
    total,
    periodResult,
  } from "./calculator";
  import {
    AREAS,
    TARIFFS,
    supported,
    officialRates,
    ELECTRICITY_REGIONS,
    ELECTRICITY_STORAGE_KEY,
  } from "./reference";
  import { today, validDate, parseNumber, yearFor, days } from "../calendar";
  import { fmt, money, uid } from "../lib/format";
  import { storage } from "../lib/storage.svelte";
  import { trimReadings } from "../lib/reading-limit";
  import { openingExplanation } from "../lib/seasonal-consumption";
  import { toast } from "../lib/ui.svelte";
  import type {
    ElectricityPoint,
    ElectricityState,
    Area,
    Tariff,
  } from "./types";
  import Field from "../components/Field.svelte";
  import Select from "../components/Select.svelte";
  import Gauge from "../components/Gauge.svelte";
  import Chart from "../components/Chart.svelte";
  import ReadingLog from "../components/ReadingLog.svelte";
  import ReadingPhoto from "../components/ReadingPhoto.svelte";
  import { commitPhoto, type Photo } from "../lib/photos";
  import ElectricStats from "./ElectricStats.svelte";
  import PdfActions from "../components/PdfActions.svelte";
  import { electricityReport } from "./report";
  const disk = storage(
    ELECTRICITY_STORAGE_KEY,
    initialState,
    validState,
    migrateState,
  );
  const initialRemoved = limitReadings(disk.data);
  if (initialRemoved) disk.save(disk.data);
  let removedReadings = $state(initialRemoved);
  let model = $state(disk.data);
  let draftPhoto = $state<Photo | null>(null);
  let photoError = $state("");
  let saving = $state(false);
  let point = $derived(model.points.find((p) => p.id === model.selected)!);
  let hasMultiplePoints = $derived(model.points.length > 1);
  let configuredTariffs = $derived(new Set(model.points.map((p) => p.tariff)));
  let hasSolar = $derived(model.points.some((p) => p.solar !== "none"));
  let bill = $derived(periodResult(point));
  let years = $derived(
    [
      ...new Set([
        yearFor(today()) + 1,
        yearFor(today()),
        yearFor(today()) - 1,
        model.year,
        ...model.points.flatMap((p) => p.readings.map((r) => yearFor(r.date))),
      ]),
    ].sort((a, b) => b - a),
  );
  let draft = $state({ date: today(), peak: "", off: "" }),
    formError = $state<ReturnType<typeof readingError>>();
  let readingInput = $state<HTMLInputElement>();
  $effect(() => {
    const selectedPoint = point;
    draftPhoto = null;
    draft = untrack(() => ({ ...selectedPoint.draft }));
    formError = undefined;
  });
  let annualRows = $derived(
    model.points.map((point) => ({ point, annual: annual(point, model.year) })),
  );
  let yearly = $derived(
    annualRows.find((row) => row.point.id === point.id)!.annual,
  );
  let combinedAnnualVolume = $derived(
    annualRows.length > 1 &&
      annualRows.every(
        (row) => row.annual.volume !== null && row.annual.fullPeriod,
      )
      ? annualRows.reduce((sum, row) => sum + (row.annual.volume ?? 0), 0)
      : null,
  );
  let allRows = $derived(
    annualRows.map((row) => ({
      ...row,
      period: periodResult(
        row.point,
        model.aggregate.start,
        model.aggregate.end,
      ),
    })),
  );
  let completeVolume = $derived(allRows.every((r) => r.period.volume !== null));
  let pricedPointCount = $derived(
    allRows.filter((r) => r.period.total !== null).length,
  );
  let completeCost = $derived(pricedPointCount === allRows.length);
  let completeAnnual = $derived(
    allRows.every(
      (r) =>
        r.annual.annualCost?.total !== null &&
        r.annual.annualCost?.total !== undefined,
    ),
  );
  let knownCost = $derived(
    allRows.reduce((n, r) => n + (r.period.total ?? 0), 0),
  );
  let aggregateBars = $derived(
    allRows
      .filter((r) => r.period.volume !== null)
      .map((r) => ({
        label: r.point.name,
        short:
          r.point.name.length > 20
            ? `${r.point.name.slice(0, 18)}…`
            : r.point.name,
        value: r.period.volume!,
        own: r.point.id === model.selected,
      })),
  );
  const scheduleOptions = [
    { value: "flat", label: "Egyenletes részszámla / átalány" },
    { value: "actual", label: "Tényleges fogyasztás utólag" },
    { value: "prepaid", label: "Előre fizetős fogyasztásbecslés" },
  ];
  const meteringOptions = [
    { value: "manual", label: "Hagyományos / kézi diktálás" },
    { value: "smart", label: "Okosmérős / idősoros" },
  ];
  const sourceOptions = [
    { value: "readings", label: "Napló pontos határnapi méréseiből" },
    { value: "period", label: "Időszaki tény-kWh megadása" },
  ];
  function limitReadings(data: ElectricityState) {
    return trimReadings(data.points.map((p) => p.readings));
  }
  function save() {
    removedReadings += limitReadings(model);
    return disk.save($state.snapshot(model));
  }
  function selectPoint(id: string) {
    model.selected = id;
    save();
  }
  function commit(key: string, raw: string) {
    const p = structuredClone($state.snapshot(point));
    switch (key) {
      case "name":
        p.name = raw.trim();
        break;
      case "annualEstimate":
        p.annualEstimate = raw.trim();
        break;
      case "consumptionProfile":
        p.consumptionProfile = raw as ElectricityPoint["consumptionProfile"];
        break;
      case "low":
        p.rates.low = parseNumber(raw);
        break;
      case "second":
        p.rates.second = parseNumber(raw);
        break;
      case "market":
        p.rates.market = parseNumber(raw);
        break;
      case "monthlyBase":
        p.rates.monthlyBase = parseNumber(raw);
        break;
      case "effective":
        p.rates.effective = raw.trim();
        break;
      case "eligibleFrom":
        p.eligibleFrom = raw.trim();
        break;
      case "eligibleTo":
        p.eligibleTo = raw.trim();
        break;
      case "extraAnnual":
        p.extraAnnual = parseNumber(raw);
        break;
      case "extraFrom":
        p.extraFrom = raw.trim();
        break;
      case "extraTo":
        p.extraTo = raw.trim();
        break;
      case "offPercent":
        p.offPercent = parseNumber(raw);
        break;
      case "heatingPercent":
        p.heatingPercent = parseNumber(raw);
        break;
      case "solar":
        p.solar = raw as ElectricityPoint["solar"];
        break;
      case "schedule":
        p.billing.schedule = raw as ElectricityPoint["billing"]["schedule"];
        break;
      case "metering":
        p.billing.metering = raw as ElectricityPoint["billing"]["metering"];
        break;
      case "source":
        p.billing.source = raw as ElectricityPoint["billing"]["source"];
        break;
      case "start":
        p.billing.start = raw.trim();
        break;
      case "end":
        p.billing.end = raw.trim();
        break;
      case "peak":
        p.billing.peak = raw.trim();
        break;
      case "off":
        p.billing.off = raw.trim();
        break;
      case "credit":
        p.billing.credit = parseNumber(raw);
        break;
      case "balance":
        p.billing.balance = raw.trim();
        break;
    }
    const message = validatePoint(p);
    if (message) return message;
    model.points[model.points.findIndex((x) => x.id === p.id)] = p;
    save();
  }
  function tariff(area: Area, tariff: Tariff) {
    const p = structuredClone($state.snapshot(point));
    p.area = area;
    p.tariff = supported(area, tariff) ? tariff : "A1";
    p.rates = officialRates(p.area, p.tariff);
    model.points[model.points.findIndex((x) => x.id === p.id)] = p;
    save();
  }
  function addPoint() {
    if (model.points.length >= 20) {
      toast("Legfeljebb 20 mérési pont kezelhető.");
      return;
    }
    const p = createPoint(model.points.length + 1);
    model.points.push(p);
    model.selected = p.id;
    const saved = save();
    toast(
      saved
        ? "Új önálló mérési pont hozzáadva. Állítsd be a tarifáját."
        : "Az új mérési pont csak ebben a munkamenetben érhető el. A helyi mentés sikertelen.",
    );
  }
  function removePoint() {
    if (model.points.length === 1) {
      toast("Legalább egy mérési pontnak maradnia kell.");
      return;
    }
    const removed = structuredClone($state.snapshot(point)),
      index = model.points.findIndex((p) => p.id === removed.id);
    model.points = model.points.filter((p) => p.id !== removed.id);
    model.selected = model.points[0].id;
    const saved = save();
    toast(
      saved
        ? "Mérési pont eltávolítva."
        : "A mérési pont csak ebben a munkamenetben lett eltávolítva. A helyi mentés sikertelen.",
      () => {
        if (model.points.some((p) => p.id === removed.id)) return;
        model.points.splice(index, 0, removed);
        model.selected = removed.id;
        const restored = save();
        toast(
          restored
            ? "Mérési pont visszaállítva."
            : "A mérési pont csak ebben a munkamenetben állt vissza. A helyi mentés sikertelen.",
        );
      },
      "electricity-point-select",
    );
  }
  function saveDraft() {
    point.draft = {
      peak: draft.peak,
      off: draft.off,
      date: validDate(draft.date) ? draft.date : point.draft.date,
    };
    save();
  }
  async function addReading(event: SubmitEvent) {
    event.preventDefault();
    if (saving) return;
    const row = {
      id: uid(),
      date: draft.date,
      peak: parseNumber(draft.peak),
      off: point.tariff === "A2" ? parseNumber(draft.off) : null,
    };
    formError = readingError(point, row);
    if (formError) return;
    const owner = point.id;
    saving = true;
    photoError = "";
    try {
      await commitPhoto(draftPhoto, (photoId) => {
        const next = $state.snapshot(model);
        const target = next.points.find((item) => item.id === owner);
        if (!target) throw new Error("A mérési pont már nem található.");
        target.readings.push({ ...row, ...(photoId ? { photoId } : {}) });
        next.year = yearFor(row.date);
        const removed = limitReadings(next);
        if (!target.readings.some((item) => item.id === row.id))
          throw new Error(
            "Ez a mérés túl régi ahhoz, hogy beférjen a naplóba.",
          );
        target.draft = { date: today(), peak: "", off: "" };
        if (!disk.save(next)) return false;
        removedReadings += removed;
        model = next;
        return true;
      });
      if (point.id === owner) {
        draft = { ...point.draft };
        draftPhoto = null;
      }
      toast("Villanyóraállás rögzítve és elmentve.");
    } catch (reason) {
      photoError = (reason as Error).message;
    } finally {
      saving = false;
    }
  }
  async function setPhoto(id: string, photo: Photo | null) {
    const owner = point.id;
    await commitPhoto(photo, (photoId) => {
      const next = $state.snapshot(model);
      const row = next.points
        .find((item) => item.id === owner)
        ?.readings.find((item) => item.id === id);
      if (!row) throw new Error("A mérés már nem található.");
      if (photoId) row.photoId = photoId;
      else delete row.photoId;
      if (!disk.save(next)) return false;
      model = next;
      return true;
    });
  }
  function editReading(id: string, field: number | "date", raw: string) {
    const current = point.readings.find((r) => r.id === id)!;
    const candidate = {
      ...current,
      ...(field === "date"
        ? { date: raw }
        : field === 0
          ? { peak: parseNumber(raw) }
          : { off: parseNumber(raw) }),
    };
    const message = validateReading(point, candidate);
    if (message) return message;
    Object.assign(current, candidate);
    model.year = yearFor(candidate.date);
    save();
  }
  function removeReading(id: string) {
    const pId = point.id,
      row = { ...point.readings.find((r) => r.id === id)! };
    point.readings = point.readings.filter((r) => r.id !== id);
    const saved = save();
    toast(
      saved
        ? "Mérés törölve."
        : "A mérés csak ebben a munkamenetben törlődött. A helyi mentés sikertelen.",
      () => {
        const p = model.points.find((p) => p.id === pId);
        if (!p) {
          toast("A mérési pont már nincs a listában.");
          return;
        }
        const error = validateReading(p, row, false);
        if (error) {
          toast(error);
          return;
        }
        p.readings.push(row);
        model.selected = p.id;
        model.year = yearFor(row.date);
        const restored = save();
        toast(
          p.readings.some((item) => item.id === row.id)
            ? restored
              ? "Mérés visszaállítva."
              : "A mérés csak ebben a munkamenetben állt vissza. A helyi mentés sikertelen."
            : "Ez a mérés túl régi ahhoz, hogy beférjen a naplóba.",
        );
      },
      "electricity-history-title",
    );
  }
  function opening() {
    draft.date = yearly.activeStart;
    saveDraft();
    readingInput?.focus();
  }
  function useReadings() {
    const rows = yearly.items.slice(-2);
    if (rows.length < 2) {
      toast("Legalább két mérés szükséges a kiválasztott évhez.");
      return;
    }
    point.billing.start = rows[0].date;
    point.billing.end = rows[1].date;
    save();
  }
  function aggregate(field: "start" | "end", value: string) {
    const next = { ...model.aggregate, [field]: value.trim() };
    if (
      !validDate(next.start) ||
      !validDate(next.end) ||
      next.start < "2022-08-01" ||
      days(next.start, next.end) <= 0 ||
      days(next.start, next.end) > 366
    )
      return "Adj meg 2022-08-01 utáni, 1–366 napos közös időszakot, kizáró végdátummal.";
    model.aggregate = next;
    save();
  }
  function stats(candidate: ElectricityState["stats"]) {
    for (const key of ["people", "floorArea"] as const)
      if (
        candidate[key].trim() &&
        (!Number.isFinite(parseNumber(candidate[key])) ||
          parseNumber(candidate[key]) <= 0 ||
          parseNumber(candidate[key]) > 1e6 ||
          (key === "people" && !Number.isInteger(parseNumber(candidate[key]))))
      )
        return "A létszám pozitív egész, az alapterület pozitív szám lehet. Üresen is hagyhatod.";
    if (
      candidate.region !== "country" &&
      !Object.hasOwn(ELECTRICITY_REGIONS, candidate.region)
    )
      return "Válassz érvényes területet.";
    if (
      !Number.isFinite(candidate.deviceWatts) ||
      candidate.deviceWatts <= 0 ||
      candidate.deviceWatts > 1e7 ||
      !Number.isFinite(candidate.dailyHours) ||
      candidate.dailyHours <= 0 ||
      candidate.dailyHours > 24 ||
      !Number.isFinite(candidate.saving) ||
      candidate.saving < 0 ||
      candidate.saving > 100
    )
      return "Érvényes teljesítmény, 0-nál több és legfeljebb 24 óra, illetve 0–100% megtakarítás adható meg.";
    model.stats = candidate;
    save();
  }
  const comparison = [
    {
      key: "flat",
      title: "Egyenletes részszámla",
      subtitle: "Kiszámíthatóbb havi ütemezés",
      basis:
        "A becsült éves kWh havi része, egyszerűsítve 1/12-e. Az okosmérő mellett is elérhető lehet.",
      action:
        "Jellemzően 11 részszámla és 1 éves elszámoló. A tényleges mérés rendezi a különbözetet.",
      benefit: "Naparányos kedvezmény a számlázott napokra.",
      note: "Az alacsonyabbra állított becslés nem csökkenti a tényleges energia költségét.",
    },
    {
      key: "manual",
      title: "Havi diktálás",
      subtitle: "A bejelentett állásokat követi",
      basis:
        "Két mérőállás különbsége, kWh-ban. Nincs gázos fűtőérték vagy fűtési jelleggörbe.",
      action:
        "A kijelölt diktálási időszakban állást kell közölni; kimaradáskor becslés készülhet.",
      benefit: "Naparányos keret, esetleges göngyölítéssel és sávkorrekcióval.",
      note: "Közvetlenebb visszajelzés, rendszeres havi teendővel.",
    },
    {
      key: "smart",
      title: "Okosmérős / idősoros",
      subtitle: "Távleolvasott mérési adatok",
      basis:
        "A mérő jellemzően 15 perces adatai. Tényalapú havi elszámolás vagy elérhető részszámlás ütemezés.",
      action:
        "Kézi diktálás jellemzően nincs. Itt a szolgáltatói időszaki összes kWh-t adhatod meg; élő kapcsolat nincs.",
      benefit:
        "Az idősoros mérés nem azonos a D tarifával; A1 áron is működhet.",
      note: "D-nél a sáv feletti árhoz külön negyedórás fogyasztási és áradatok szükségesek.",
    },
    {
      key: "prepaid",
      title: "Előre fizetős mérő",
      subtitle: "Előbb feltöltés, utána fogyasztás",
      basis:
        "A tarifa és az elhasznált kWh. A feltöltött pénz és a fogyasztási mennyiség két külön adat.",
      action:
        "A megadott aktuális egyenlegből, ismert napi költség mellett becsülhető, meddig elegendő.",
      benefit:
        "A tarifa és a jogosultság szerinti keret; nem jár új kedvezmény a feltöltéssel.",
      note: "A kalkulátor nem kapcsolódik a mérőhöz, nem tölt fel és nem von le pénzt.",
    },
  ];
</script>

<svelte:window onstorage={disk.onStorage} />
{#if disk.warning}<p class="notice danger" role="alert">{disk.warning}</p>{/if}
<section class="page-heading">
  <div>
    <div class="eyebrow">
      <span class="tiny-line"></span>ENERGIA, ÁTLÁTHATÓAN
    </div>
    <h1>Kapcsolj több rálátásra<span>.</span></h1>
    <p>Az áramfogyasztásod, a tarifáid és a kereted, egy helyen.</p>
  </div>
  <Select
    id="electricity-year"
    label="Kedvezményes év"
    value={model.year}
    options={years.map((y) => ({
      value: String(y),
      label: `${y}. aug. – ${y + 1}. júl.`,
    }))}
    oncommit={(value) => {
      model.year = Number(value);
      save();
    }}
  />
</section>
<section class="card point-picker" id="electricity-point">
  <Select
    id="electricity-point-select"
    label="Aktív mérési pont"
    value={model.selected}
    options={model.points.map((p) => ({
      value: p.id,
      label: `${p.name} · ${TARIFFS[p.tariff]}`,
    }))}
    oncommit={selectPoint}
  /><button
    id="electricity-add-point"
    type="button"
    class="primary-button"
    onclick={addPoint}
    ><span>Új mérési pont</span><span aria-hidden="true">＋</span></button
  >
  <p>
    Itt válthatsz a mérőid között. Mindegyikhez külön napló és kalkuláció
    tartozik.
    {#if hasMultiplePoints}<a href="#electricity-aggregate"
        >Minden mérő együtt ↓</a
      > ·{/if}
    <a href="#electricity-tariffs">Áramtarifák összehasonlítása ↓</a>
  </p>
</section>
{#key point.id}
  <div class="overview-grid">
    <section class="card balance-card">
      <div class="card-heading">
        <h2>{point.name} kerete</h2>
        <span class="badge"
          >{point.tariff === "B_GEO"
            ? "KORLÁTMENTES TARIFA"
            : yearly.complete
              ? "KEZDŐÁLLÁSTÓL KÖVETVE"
              : yearly.opening
                ? "ÉVKEZDET BECSÜLVE"
                : "HIÁNYOS MÉRÉSI IDŐSZAK"}</span
        >
      </div>
      <div class="balance-main">
        <div class="balance-copy">
          <p class="muted">
            {point.tariff === "B_GEO"
              ? "Korlátlan kedvezményes fogyasztás"
              : yearly.remainingEstimated
                ? "Becsült hátralévő keret"
                : "Hátralévő kedvezményes keret"}
          </p>
          <div class="big-number">
            <span>{point.tariff === "B_GEO" ? "∞" : fmt(yearly.remaining)}</span
            >{#if point.tariff !== "B_GEO"}<span class="big-unit">kWh</span
              >{/if}
          </div>
          <p class="energy">
            {point.tariff === "H"
              ? "A fűtési idény fogyasztása nem csökkenti a normál keretet."
              : point.tariff === "B_GEO"
                ? "Meglévő szerződésnél nincs 2523-as fogyasztási határ."
                : `${fmt(yearly.quota.cap)} kWh keret a jogosult éves napokra.`}
          </p>
          <div class="legend">
            <span class="status-dot"></span><span
              >{TARIFFS[point.tariff]} · {AREAS[point.area].label}</span
            >
          </div>
        </div>
        <Gauge
          percent={point.tariff === "B_GEO"
            ? 100
            : yearly.remaining === null || yearly.quota.cap === 0
              ? null
              : (yearly.remaining / yearly.quota.cap) * 100}
        />
      </div>
      <div class="balance-stats">
        <div>
          <span>Mért összfogyasztás</span><strong
            >{fmt(yearly.measuredVolume)}
            <small>kWh</small></strong
          >
          {#if yearly.first && yearly.last}<p class="field-hint">
              {yearly.first.date} → {yearly.last.date}
            </p>{/if}
        </div>
        <div>
          <span
            >{yearly.fullPeriod
              ? "Normál éves keret"
              : "Keret a jogosult időszakra"}</span
          ><strong
            >{point.tariff === "B_GEO" ? "∞" : fmt(yearly.quota.cap)}
            <small>kWh</small></strong
          >
        </div>
        {#if yearly.opening}
          <div>
            <span>Becsült hiányzó fogyasztás</span><strong
              >{fmt(yearly.opening.volume)} <small>kWh</small></strong
            >
          </div>
        {:else}
          <div>
            <span
              >{yearly.fullPeriod
                ? yearly.measuredFull
                  ? "Mért éves fogyasztás"
                  : "Becsült éves fogyasztás"
                : yearly.measuredFull
                  ? "Mért időszaki fogyasztás"
                  : "Becsült időszaki fogyasztás"}</span
            ><strong>{fmt(yearly.volume)} <small>kWh</small></strong>
          </div>
        {/if}
      </div>
      <p class="balance-note">
        {#if yearly.active === 0}
          Ebben a kedvezményes évben nincs megadott <a
            href="#electricity-eligible-from">jogosult nap</a
          >.
        {:else if !yearly.first}
          A pontos követéshez <a href="#electricity-reading-peak"
            >{yearly.activeStart}-i kezdőállás</a
          > szükséges.
        {:else}
          {yearly.complete
            ? `Követett időszak: ${yearly.first.date} → ${yearly.last!.date}.`
            : openingExplanation(
                yearly.opening,
                yearly.start !== yearly.activeStart,
              )}
        {/if}
        {#if yearly.remaining !== null}A keret az utolsó mérésre ({yearly.last
            ?.date}) vonatkozik.{/if}
        {#if yearly.seasonSplitEstimated}Az idényhatárt átfogó mért fogyasztást
          naparányosan osztottuk meg.{/if}
      </p>
    </section>
    <section class="card reading-card" id="electricity-new-reading">
      <div class="card-heading">
        <h2>Új villanyóraállás</h2>
        <span class="icon-circle" aria-hidden="true">＋</span>
      </div>
      <form onsubmit={addReading} aria-busy={saving}>
        <div class="field-label">
          <label for="electricity-reading-peak"
            >{point.tariff === "A2"
              ? "Csúcsidős regiszter állása"
              : "Mérőállás"} · kWh</label
          ><Help
            forId="electricity-reading-peak"
            label={point.tariff === "A2"
              ? "Csúcsidős regiszter állása"
              : "Mérőállás"}
            content={point.tariff === "A2" ? A2_PEAK_HELP : undefined}
          />
        </div>
        <div class="input-unit meter-input">
          <input
            id="electricity-reading-peak"
            aria-required="true"
            aria-invalid={formError?.field === "peak"}
            aria-describedby={`electricity-reading-peak-help${formError?.field === "peak" ? " electricity-reading-error" : ""}`}
            type="text"
            inputmode="decimal"
            bind:this={readingInput}
            bind:value={draft.peak}
            placeholder="pl. 12 450,5"
            onblur={saveDraft}
            oninput={() => (formError = undefined)}
          /><span aria-hidden="true">kWh</span>
        </div>
        {#if point.tariff === "A2"}<div class="field-label">
            <label for="electricity-reading-off"
              >Völgyidős regiszter állása · kWh</label
            ><Help
              forId="electricity-reading-off"
              label="Völgyidős regiszter állása"
            />
          </div>
          <div class="input-unit">
            <input
              id="electricity-reading-off"
              aria-required="true"
              aria-invalid={formError?.field === "off"}
              aria-describedby={`electricity-reading-off-help${formError?.field === "off" ? " electricity-reading-error" : ""}`}
              type="text"
              inputmode="decimal"
              bind:value={draft.off}
              onblur={saveDraft}
              oninput={() => (formError = undefined)}
            /><span aria-hidden="true">kWh</span>
          </div>{/if}
        <p class="field-hint">
          A mérőn látható teljes állást add meg.
          {#if point.tariff === "A2"}A csúcs- és a völgyidős állás is szükséges.{/if}
        </p>
        <div class="field-label">
          <label for="electricity-reading-date">Rögzítés dátuma</label><Help
            forId="electricity-reading-date"
            label="Rögzítés dátuma"
          />
        </div>
        <input
          id="electricity-reading-date"
          aria-required="true"
          aria-invalid={formError?.field === "date"}
          aria-describedby={`electricity-reading-date-help${formError?.field === "date" ? " electricity-reading-error" : ""}`}
          type="date"
          min="1900-01-01"
          max={today()}
          bind:value={draft.date}
          onblur={saveDraft}
          onchange={saveDraft}
          oninput={() => (formError = undefined)}
        />
        <p class="field-error" id="electricity-reading-error" role="alert">
          {formError?.message ?? ""}
          {#if formError?.duplicate}
            <a
              href="#electricity-history-title"
              onclick={() => {
                model.year = yearFor(draft.date);
                save();
              }}>Szerkesztés a mérési naplóban</a
            >
          {/if}
        </p>
        <ReadingPhoto bind:value={draftPhoto} />
        {#if photoError}<p class="field-error" role="alert">
            {photoError}
          </p>{/if}
        <button class="primary-button" type="submit" disabled={saving}
          ><span>Mérőállás rögzítése</span><span aria-hidden="true">↗</span
          ></button
        >
        <p class="form-footnote">
          Csak ebben a böngészőben, ehhez a mérési ponthoz.
        </p>
      </form>
    </section>
  </div>
  <PointSettings
    {point}
    canRemove={model.points.length > 1}
    oncommit={commit}
    ontariff={tariff}
    onremove={removePoint}
  />
  <section class="card billing-card">
    <div class="card-heading">
      <h2>Időszaki áramkalkuláció</h2>
      <span class="badge neutral">{point.name}</span>
    </div>
    <p class="section-intro">
      Becsüld meg, mennyi áramot használsz fel kedvezményes áron és mennyibe
      kerül az aktív mérő fogyasztása a választott időszakban.
    </p>
    <div class="e-form-grid">
      <Select
        id="electricity-schedule"
        label="Számlázási ütemezés"
        value={point.billing.schedule}
        options={scheduleOptions}
        oncommit={(v) => {
          commit("schedule", v);
        }}
      /><Select
        id="electricity-metering"
        label="Mérés módja"
        value={point.billing.metering}
        options={meteringOptions}
        oncommit={(v) => {
          commit("metering", v);
        }}
      /><Field
        id="electricity-start"
        type="date"
        label="Időszak kezdete"
        value={point.billing.start}
        oncommit={(v) => commit("start", v)}
      /><Field
        id="electricity-end"
        type="date"
        label="Záró dátum · már nem része"
        value={point.billing.end}
        oncommit={(v) => commit("end", v)}
      />
      {#if point.billing.schedule !== "flat"}<Select
          id="electricity-source"
          label="Tényfogyasztás forrása"
          value={point.billing.source}
          options={sourceOptions}
          oncommit={(v) => {
            commit("source", v);
          }}
        />{#if point.billing.source === "period"}<Field
            id="electricity-period-peak"
            label={point.tariff === "A2"
              ? "Időszaki csúcsfogyasztás · kWh"
              : "Időszaki tényfogyasztás · kWh"}
            value={point.billing.peak}
            decimal
            oncommit={(v) => commit("peak", v)}
          />{#if point.tariff === "A2"}<Field
              id="electricity-period-off"
              label="Időszaki völgyfogyasztás · kWh"
              value={point.billing.off}
              decimal
              oncommit={(v) => commit("off", v)}
            />{/if}{/if}{/if}<Field
        id="electricity-credit"
        label="Visszaigazolt időszaki jóváírás · Ft"
        value={point.billing.credit}
        decimal
        oncommit={(v) => commit("credit", v)}
      />{#if point.billing.schedule === "prepaid"}<Field
          id="electricity-balance"
          label="Aktuális feltöltött egyenleg · Ft"
          value={point.billing.balance}
          placeholder="Nem kötelező"
          decimal
          oncommit={(v) => commit("balance", v)}
        />{/if}
    </div>
    <button class="text-button" type="button" onclick={useReadings}
      >Utolsó két mérés időszakának használata ↗</button
    >
    <div class="billing-results">
      <div>
        <span>Időszaki fogyasztás</span><strong
          >{fmt(bill.volume)} <small>kWh</small></strong
        >
        <p>
          {point.billing.schedule === "flat"
            ? "Az éves becslés havi része"
            : point.billing.source === "period"
              ? "Megadott időszaki tényadat"
              : "Pontos határnapi mérésekből"}
        </p>
      </div>
      <div>
        <span>Kedvezményes fogyasztás</span><strong class="accent"
          >{bill.cheap === null ? "—" : fmt(bill.cheap + (bill.unlimited ?? 0))}
          <small>kWh</small></strong
        >
        <p>
          {#if bill.cap > 0 || bill.unlimitedDays === 0}
            {fmt(bill.cap)} kWh normál keret
          {/if}
          {#if bill.unlimitedDays > 0}
            {bill.cap > 0 ? " · " : ""}{bill.unlimitedDays} nap fogyasztási korlát
            nélkül
          {/if}
        </p>
      </div>
      {#if point.tariff !== "B_GEO"}<div>
          <span>Keret feletti mennyiség</span><strong
            >{fmt(bill.over)} <small>kWh</small></strong
          >
          <p>Csak a sáv feletti rész drágább</p>
        </div>{/if}
      <div>
        <span>Becsült időszaki összeg</span><strong
          >{fmt(bill.total, 0)} <small>Ft</small></strong
        >
        <p>{bill.credit ? "Alapdíjjal és jóváírással" : "Alapdíjjal együtt"}</p>
      </div>
    </div>
    <div class="e-cost-details">
      {#if bill.lowCost !== null}
        <span
          >Kedvezményes energiadíj: <strong>{money(bill.lowCost)}</strong></span
        >
      {/if}
      {#if bill.highCost !== null && bill.highCost > 0}
        <span
          >Keret feletti energiadíj: <strong>{money(bill.highCost)}</strong
          ></span
        >
      {/if}
      <span>Alapdíj: <strong>{money(bill.base)}</strong></span>
      {#if bill.credit > 0}
        <span>Jóváírás: <strong>−{money(bill.credit)}</strong></span>
      {/if}
    </div>
    <p class="balance-note">
      {#if bill.outside}
        A fogyasztás egy része a megadott <a href="#electricity-eligible-from"
          >lakossági jogosultságon</a
        >
        kívülre esik, ezért nincs teljes költség.
      {:else if bill.dynamicMissing}
        D tarifa: 2027 előtti időszak vagy dinamikus áradatok nélküli
        kerettúllépés miatt nincs teljes forintösszeg.
      {:else if point.solar === "balance"}
        Szaldós napelemhez ez a költségmodell nem alkalmazható.
      {:else if bill.volume === null}
        {#if point.billing.schedule === "flat"}
          Az átalányhoz <a href="#electricity-annual-estimate">éves becslés</a> szükséges.
        {:else if point.billing.source === "period"}
          Add meg az <a href="#electricity-period-peak">időszaki fogyasztást</a
          >.
        {:else}
          Rögzíts <a href="#electricity-reading-peak"
            >pontos határnapi mérőállásokat</a
          >.
        {/if}
      {:else if point.solar === "gross"}
        Csak a hálózatból vételezett energia költsége látható, a betáplálási
        bevétel nélkül.
      {:else if point.billing.schedule === "prepaid"}
        Ez a fogyasztás költségbecslése, nem a feltöltés összege vagy egy élő
        egyenleg.
      {:else}
        Sávkorrekció nélküli becslés. A korábbi megtakarítás és az éves
        elszámolás módosíthatja.
      {/if}
    </p>
    {#if point.tariff === "H"}
      <p class="field-hint e-long-hint">
        Ha két mérés között vált a fűtési idény, naparányosan osztjuk meg a
        fogyasztást. Az idényhatáron rögzített mérés pontosítja a becslést.
      </p>
    {:else if point.tariff === "A2"}
      <p class="field-hint e-long-hint">
        A becslésben a kedvezményes mennyiséget a csúcs- és völgyfogyasztás
        arányában osztjuk meg.
      </p>
    {/if}
  </section>
{/key}
{#if hasMultiplePoints}<section
    class="card aggregate-card"
    id="electricity-aggregate"
    tabindex="-1"
  >
    <div class="card-heading">
      <h2>Minden mérőd, egy helyen</h2>
      <span class="badge">{model.points.length} MÉRÉSI PONT</span>
    </div>
    <p class="section-intro">
      Hasonlítsd össze a mérőid fogyasztását ugyanarra az időszakra, és nézd meg
      a közös költséget. Minden mérő a saját keretével számol.
    </p>
    <div class="e-aggregate-dates">
      <Field
        id="electricity-all-start"
        type="date"
        label="Közös időszak kezdete"
        value={model.aggregate.start}
        oncommit={(v) => aggregate("start", v)}
      /><Field
        id="electricity-all-end"
        type="date"
        label="Közös záró dátum · kizáró"
        value={model.aggregate.end}
        oncommit={(v) => aggregate("end", v)}
      /><button
        class="text-button"
        type="button"
        onclick={() => {
          model.aggregate = {
            start: point.billing.start,
            end: point.billing.end,
          };
          save();
        }}>Aktív mérő időszakának átvétele ↗</button
      >
    </div>
    <div class="e-aggregate-metrics">
      <div>
        <span>Összes időszaki fogyasztás</span><strong
          >{completeVolume
            ? fmt(allRows.reduce((n, r) => n + r.period.volume!, 0))
            : "—"} <small>kWh</small></strong
        >
      </div>
      <div>
        <span>Összes időszaki költség</span><strong
          >{completeCost ? money(knownCost) : "—"}</strong
        >
      </div>
      <div>
        <span
          >{annualRows.every((row) => row.annual.fullPeriod)
            ? "Összes éves költségbecslés"
            : "Költségbecslés a jogosultsági időszakokra"}</span
        ><strong
          >{completeAnnual
            ? money(
                allRows.reduce((n, r) => n + r.annual.annualCost!.total!, 0),
              )
            : "—"}</strong
        >
      </div>
    </div>
    {#if !completeCost}<p class="field-hint">
        {#if pricedPointCount}
          {pricedPointCount}/{allRows.length} mérő költsége számolható. Ezek időszaki
          részösszege: {money(knownCost)}.
        {:else}
          A közös időszakra még nincs számolható költség.
        {/if}
      </p>{/if}
    {#if aggregateBars.length > 1}<Chart
        id="electricity-aggregate-chart"
        kind="benchmark"
        unit="kWh"
        bars={aggregateBars}
        label="A mérési pontok időszaki áramfogyasztása"
      />{/if}
    <div class="point-summaries">
      {#each allRows as row (row.point.id)}<article
          class="point-summary"
          class:is-selected={row.point.id === model.selected}
        >
          <div>
            <h3>{row.point.name}</h3>
            <p>{TARIFFS[row.point.tariff]} · {AREAS[row.point.area].label}</p>
          </div>
          <dl>
            <div>
              <dt>Közös időszak</dt>
              <dd>{fmt(row.period.volume)} kWh · {money(row.period.total)}</dd>
            </div>
            <div>
              <dt>Kedvezményes fogyasztás</dt>
              <dd>
                {row.period.cheap === null
                  ? "—"
                  : fmt(row.period.cheap + (row.period.unlimited ?? 0))} kWh
              </dd>
            </div>
            {#if row.point.tariff !== "B_GEO"}<div>
                <dt>Keret felett</dt>
                <dd>{fmt(row.period.over)} kWh</dd>
              </div>{/if}
            <div>
              <dt>Éves adat / költségbecslés</dt>
              <dd>
                {fmt(row.annual.volume)} kWh · {money(
                  row.annual.annualCost?.total,
                )}
              </dd>
            </div>
          </dl>
          <a href="#electricity-name" onclick={() => selectPoint(row.point.id)}
            >{row.point.name} beállításai ↑</a
          >
        </article>{/each}
    </div>
    <p class="field-hint e-long-hint">
      Ha az időszaki tényadatot más dátumokra adtad meg, a közös időszakra új
      adat kell. A visszaigazolt jóváírás csak a saját pontos időszakában
      szerepel. Új pontot kizárólag valóban önálló mérési pontra vegyél fel:
      ugyanaz a mérő más néven nem kap új keretet.
    </p>
  </section>{/if}
<ElectricStats
  settings={model.stats}
  {point}
  {yearly}
  {combinedAnnualVolume}
  onstats={stats}
/>
{#key `${point.id}-${model.year}`}
  <ReadingLog
    id="electricity-history"
    readingId="electricity-reading-peak"
    unit="kWh"
    {removedReadings}
    rows={yearly.items.map((r) => ({
      id: r.id,
      photoId: r.photoId,
      date: r.date,
      values: point.tariff === "A2" ? [r.peak, r.off] : [r.peak],
      total: total(point, r),
    }))}
    columns={point.tariff === "A2"
      ? ["Csúcsregiszter", "Völgyregiszter"]
      : ["Mérőállás"]}
    onedit={editReading}
    onremove={removeReading}
    onphoto={setPhoto}
    onopening={opening}
  />
{/key}
<TariffGuide active={point.tariff} area={point.area} />
<section class="comparison-section" id="electricity-comparison">
  <div class="eyebrow">
    <span class="tiny-line"></span>ÉRTHETŐEN A SZÁMLÁZÁSRÓL
  </div>
  <h2>Mi a különbség az áram számlázási módjai között?</h2>
  <p class="comparison-intro">
    A tarifa az árat, a mérés az adatforrást, a számlázás a havi elszámolást
    határozza meg. Az okosmérő mellett is lehet egyenletes részszámla.
  </p>
  <div class="comparison-grid e-comparison-grid">
    {#each comparison as mode, index (mode.key)}<article
        class="card comparison-card"
        class:is-selected={mode.key === point.billing.schedule ||
          (point.billing.schedule === "actual" &&
            mode.key === point.billing.metering)}
      >
        <div class="comparison-top"><span>0{index + 1}</span></div>
        <h3>{mode.title}</h3>
        <p class="mode-subtitle">{mode.subtitle}</p>
        <dl>
          <dt>A számítás alapja</dt>
          <dd>{mode.basis}</dd>
          <dt>Teendő és elszámolás</dt>
          <dd>{mode.action}</dd>
          <dt>Keret / árszabás</dt>
          <dd>{mode.benefit}</dd>
        </dl>
        <p class="mode-tradeoff">{mode.note}</p>
      </article>{/each}
  </div>
  <div class="comparison-footnote">
    <span class="info-icon" aria-hidden="true">i</span>
    <p>
      A bankkártya, átutalás, beszedés és csekk befizetési mód, nem külön
      tarifa. Az itt választott beállítás az MVM-szerződésedet nem módosítja.
    </p>
  </div>
</section>
<details class="info-panel">
  <summary
    ><span>ⓘ Hogyan számol az áramkalkulátor?</span><span aria-hidden="true"
      >＋</span
    ></summary
  >
  <div class="info-content">
    <div>
      <h3>Normál keret és külön pontok</h3>
      <p>
        A mérő éves keretét a kedvezményes év 365 vagy 366 napjára osztjuk. Csak
        a megadott jogosultsági napokkal számolunk. Ha két mérés közé évhatár
        esik, a fogyasztást a két időszak napjainak arányában osztjuk meg.
      </p>
      <a
        href="https://www.mvmnext.hu/lakossagirezsi/gyakorikerdesek-aram"
        target="_blank"
        rel="noopener noreferrer">MVM keret és jogosultság ↗</a
      >
    </div>
    {#if configuredTariffs.has("H")}<div>
        <h3>H tarifa</h3>
        <p>
          A H-idényt október 15. → április 16. kizáró végdátummal modellezzük: a
          fűtési időszak kWh-ja korlátmentes. Az idényen kívül naparányos normál
          kerettel és A1-jellegű árral számolunk.
        </p>
      </div>{/if}
    {#if configuredTariffs.has("D")}<div>
        <h3>Dinamikus ár</h3>
        <p>
          D-nél 2027 előtt, illetve sáv felett negyedórás adatsor nélkül nincs
          teljes összeg.
        </p>
      </div>{/if}
    {#if hasSolar}<div>
        <h3>Napelemes elszámolás</h3>
        <p>
          Bruttó elszámolásnál a hálózatból vételezett áram költségét becsüljük.
          Szaldós elszámolásnál a kalkulátor a fogyasztást mutatja.
        </p>
      </div>{/if}
    <div>
      <h3>A becslés alapja</h3>
      <p>
        A kiválasztott időszakra a jelenlegi mérőbeállításokat használjuk. A
        korábbi tarifaváltás és az éves számlakorrekció eltérést okozhat.
      </p>
      <a
        href="https://www.mvmnext.hu/aram/pages/aloldal.jsp?id=14098370"
        target="_blank"
        rel="noopener noreferrer">MVM számlázás ↗</a
      >
    </div>
  </div>
</details>
<PdfActions
  category="electricity"
  getData={() => $state.snapshot(model)}
  report={electricityReport}
  limit={limitReadings}
  parse={(value) => {
    const parsed = migrateState(value);
    return validState(parsed) ? parsed : null;
  }}
  describe={(data) =>
    `${data.points.length} mérési pont, ${data.points.reduce((sum, point) => sum + point.readings.length, 0)} árammérés`}
  onrestore={(data: ElectricityState) => {
    if (!disk.save(data)) return false;
    model = data;
    return true;
  }}
/>
