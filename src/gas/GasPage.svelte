<script lang="ts">
  import Help from "../components/Help.svelte";
  import {
    allowanceBetween,
    calculateBilling,
    calculateGasYear,
    readingError,
    validateBilling,
    validateReading,
  } from "../calculator";
  import { addDays, parseNumber, today, validDate, yearFor } from "../calendar";
  import { storage } from "../lib/storage.svelte";
  import { trimReadings } from "../lib/reading-limit";
  import { openingExplanation } from "../lib/seasonal-consumption";
  import { initialGas, validGas, migrateGas } from "./state";
  import { fmt, uid } from "../lib/format";
  import { toast } from "../lib/ui.svelte";
  import type {
    AppState,
    Billing,
    Settings,
    StatisticsSettings,
  } from "../types";
  import PdfActions from "../components/PdfActions.svelte";
  import { gasReport } from "./report";
  import Field from "../components/Field.svelte";
  import Select from "../components/Select.svelte";
  import Gauge from "../components/Gauge.svelte";
  import ReadingLog from "../components/ReadingLog.svelte";
  import GasStats from "./GasStats.svelte";
  const key = "rezsi-calculator.v1",
    disk = storage(key, initialGas, validGas, migrateGas);
  const initialRemoved = limitReadings(disk.data);
  if (initialRemoved) disk.save(disk.data);
  let removedReadings = $state(initialRemoved);
  let model = $state(disk.data);
  let draft = $state({ ...disk.data.draft }),
    formError = $state<ReturnType<typeof readingError>>();
  let meterInput = $state<HTMLInputElement>();
  let annual = $derived(
    calculateGasYear(model.settings, model.readings, model.year, model.billing),
  );
  let bill = $derived(
    calculateBilling(model.settings, model.readings, model.billing),
  );
  let years = $derived(
    [
      ...new Set([
        yearFor(today()),
        yearFor(today()) - 1,
        model.year,
        ...model.readings.map((r) => yearFor(r.date)),
      ]),
    ].sort((a, b) => b - a),
  );
  const modes = [
    {
      value: "flat",
      label: "Egyenletes részszámlázás (átalány)",
      subtitle: "Köznyelven: átalány",
      basis:
        "A várható éves fogyasztásból közel azonos havi mennyiség, egyszerűsítve az éves becslés 1/12-e.",
      allowance:
        "A havi részszámlákban naparányosan. Az éves elszámolásnál szezonális szabályok és korrekciók is számítanak.",
      action: "Havi diktálás nem kell; éves leolvasás és elszámolás van.",
      tradeoff:
        "Tervezhetőbb havi kiadás; a becslés eltérését az éves elszámolás rendezi.",
    },
    {
      value: "reading",
      label: "Havi diktálás",
      subtitle: "A tényleges használatot követi",
      basis:
        "A bejelentett mérőállások különbsége: aktuális állás mínusz előző állás.",
      allowance:
        "Fűtési profilnál rögzített szezonális mennyiségek: télen több, nyáron kevesebb kedvezmény, napokra arányosítva.",
      action: "Havonta diktálni kell a kijelölt időszakban.",
      tradeoff:
        "Közvetlenebb visszajelzés a fogyasztásról, rendszeres teendővel és magasabb téli számlákkal.",
    },
    {
      value: "temperature",
      label: "Hőmérsékletfüggő részszámlázás",
      subtitle: "Évszakokhoz igazodó részletek",
      basis:
        "A becsült éves fogyasztás fogyasztási és hőmérsékleti tényezők szerint oszlik el. Ez a profil különbözik a kedvezménygörbétől.",
      allowance: "A diktáláshoz hasonló, rögzített szezonális kedvezménygörbe.",
      action: "Havi diktálás nem kell; éves leolvasás és elszámolás van.",
      tradeoff:
        "Szezonális kiadások diktálás nélkül: télen magasabb, nyáron alacsonyabb részszámla.",
    },
  ];
  const months = [
    "Január",
    "Február",
    "Március",
    "Április",
    "Május",
    "Június",
    "Július",
    "Augusztus",
    "Szeptember",
    "Október",
    "November",
    "December",
  ];
  function limitReadings(data: AppState) {
    return trimReadings([data.readings]);
  }
  function save() {
    removedReadings += limitReadings(model);
    return disk.save($state.snapshot(model));
  }
  function saveDraft() {
    model.draft = {
      value: draft.value,
      date: validDate(draft.date) ? draft.date : model.draft.date,
    };
    save();
  }
  function setting(key: keyof Settings, raw: string) {
    const value = parseNumber(raw),
      max = key === "heat" ? 100 : 10;
    if (!Number.isFinite(value) || value <= 0 || value > max)
      return `Az érték 0-nál nagyobb, legfeljebb ${max} lehet.`;
    model.settings[key] = value;
    save();
  }
  function billing(key: keyof Omit<Billing, "weights">, raw: string) {
    const candidate = { ...model.billing, [key]: raw.trim() } as Billing,
      message = validateBilling(candidate);
    if (message) return message;
    model.billing = candidate;
    save();
  }
  function weight(index: number, raw: string) {
    const weights = [...model.billing.weights];
    weights[index] = parseNumber(raw);
    const candidate = { ...model.billing, weights },
      message = validateBilling(candidate);
    if (message) return message;
    model.billing = candidate;
    save();
  }
  function add(event: SubmitEvent) {
    event.preventDefault();
    const reading = {
      id: uid(),
      date: draft.date,
      value: parseNumber(draft.value),
    };
    formError = readingError(reading, model.readings);
    if (formError) return;
    model.readings.push(reading);
    model.year = yearFor(reading.date);
    draft = { value: "", date: today() };
    model.draft = { ...draft };
    const saved = save();
    toast(
      !model.readings.some((row) => row.id === reading.id)
        ? "Ez a mérés túl régi ahhoz, hogy beférjen a naplóba."
        : saved
          ? "Mérőállás rögzítve és elmentve."
          : "Mérőállás rögzítve, de a helyi mentés sikertelen.",
    );
  }
  function edit(id: string, field: number | "date", value: string) {
    const row = model.readings.find((r) => r.id === id)!;
    const candidate = {
      ...row,
      ...(field === "date" ? { date: value } : { value: parseNumber(value) }),
    };
    const error = validateReading(candidate, model.readings);
    if (error) return error;
    Object.assign(row, candidate);
    model.year = yearFor(row.date);
    save();
  }
  function remove(id: string) {
    const row = { ...model.readings.find((r) => r.id === id)! };
    model.readings = model.readings.filter((r) => r.id !== id);
    save();
    toast(
      "Mérés törölve.",
      () => {
        const error = validateReading(row, model.readings);
        if (error) {
          toast(error);
          return;
        }
        model.readings.push(row);
        model.year = yearFor(row.date);
        save();
        toast(
          model.readings.some((item) => item.id === row.id)
            ? "Mérés visszaállítva."
            : "Ez a mérés túl régi ahhoz, hogy beférjen a naplóba.",
        );
      },
      "gas-history-title",
    );
  }
  function opening() {
    draft.date = annual.start;
    saveDraft();
    meterInput?.focus();
  }
  function useReadings() {
    const rows = annual.items.slice(-2);
    if (rows.length < 2) {
      toast("Legalább két mérés szükséges a kiválasztott évhez.");
      return;
    }
    const candidate = {
        ...model.billing,
        start: rows[0].date,
        end: rows[1].date,
      },
      message = validateBilling(candidate);
    if (message) {
      toast(message);
      return;
    }
    model.billing = candidate;
    save();
  }
  function updateStats(candidate: StatisticsSettings) {
    model.stats = candidate;
    save();
  }
</script>

<svelte:window onstorage={disk.onStorage} />
{#if disk.warning}<p class="notice danger" role="alert">{disk.warning}</p>{/if}
<section class="page-heading">
  <div>
    <div class="eyebrow">
      <span class="tiny-line"></span>OTTHON, KÉZBEN TARTVA
    </div>
    <h1>Tudd, hol tartasz<span>.</span></h1>
    <p>A gázfogyasztásod és a kedvezményes kereted, egy helyen.</p>
  </div>
  <Select
    id="gas-year"
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
<section class="card mode-card">
  <Select
    id="gas-mode"
    label="Számlázási mód"
    value={model.billing.mode}
    options={modes}
    oncommit={(value) => {
      billing("mode", value);
    }}
  />
  <div class="mode-description">
    <p>
      {model.billing.mode === "flat"
        ? "Közel azonos havi mennyiség, naparányos kedvezmény a részszámlákban."
        : "Szezonális kedvezmény, a kiválasztott számlázási mód szerinti fogyasztással."}
    </p>
    <a href="#gas-comparison">Mi a különbség a módok között? ↓</a>
  </div>
</section>
<div class="overview-grid">
  <section class="card balance-card">
    <div class="card-heading">
      <h2>Kedvezményes keret</h2>
      <span class="badge"
        >{!annual.first
          ? "ÉVES ÁTTEKINTÉS"
          : annual.complete
            ? "ÉVKEZDÉSTŐL KÖVETVE"
            : annual.opening
              ? "ÉVKEZDET BECSÜLVE"
              : "HIÁNYOS IDŐSZAK"}</span
      >
    </div>
    <div class="balance-main">
      <div class="balance-copy">
        <p class="muted">
          {annual.opening
            ? "Becsült hátralévő keret"
            : "Hátralévő kedvezményes keret"}
        </p>
        <div class="big-number">
          <span>{fmt(annual.remaining)}</span><span class="big-unit">m³</span>
        </div>
        <p class="energy">
          {annual.remaining !== null
            ? `${fmt(annual.remaining * model.settings.heat * model.settings.correction, 0)} MJ energiának felel meg`
            : "A maradékhoz több adat kell."}
        </p>
        <div class="legend">
          <span class="status-dot"></span><span
            >{annual.over
              ? `${annual.opening ? "Becsült túllépés" : "Keret felett"} · ${fmt(annual.over)} m³`
              : "Éves energiakeret: 63 645 MJ"}</span
          >
        </div>
      </div>
      <Gauge percent={annual.percent} />
    </div>
    <div class="balance-stats">
      <div>
        <span>Mért fogyasztás</span><strong
          >{fmt(annual.measured)} <small>m³</small></strong
        >
      </div>
      <div>
        <span>Teljes éves keret</span><strong
          >{fmt(annual.annual)} <small>m³</small></strong
        >
      </div>
      {#if annual.opening}
        <div>
          <span>Becsült hiányzó fogyasztás</span><strong
            >{fmt(annual.opening.volume)} <small>m³</small></strong
          >
        </div>
      {:else}
        <div>
          <span>Éves napi keretátlag</span><strong
            >{fmt(annual.daily, 2)} <small>m³</small></strong
          >
        </div>
      {/if}
    </div>
    <p class="balance-note">
      {!annual.first
        ? `Az éves követéshez ${annual.start}-i kezdőállást adj meg.`
        : annual.complete
          ? `Követett időszak: ${annual.first.date} → ${annual.last!.date}. A maradék az utolsó mérés időpontjára vonatkozik.`
          : openingExplanation(annual.opening)}
      {#if annual.opening}A becsült keret az utolsó mérésre ({annual.last
          ?.date}) vonatkozik.{/if}
    </p>
  </section>
  <section class="card reading-card" id="gas-new-reading">
    <div class="card-heading">
      <h2>Új mérőállás</h2>
      <span class="icon-circle" aria-hidden="true">＋</span>
    </div>
    <form onsubmit={add}>
      <div class="field-label">
        <label for="gas-reading">Gázóra állása · m³</label><Help
          forId="gas-reading"
          label="Gázóra állása"
        />
      </div>
      <div class="input-unit meter-input">
        <input
          id="gas-reading"
          aria-required="true"
          aria-invalid={formError?.field === "value"}
          aria-describedby={`gas-reading-help${formError?.field === "value" ? " gas-reading-error" : ""}`}
          bind:this={meterInput}
          bind:value={draft.value}
          inputmode="decimal"
          type="text"
          placeholder="pl. 12 450,5"
          onblur={saveDraft}
          oninput={() => (formError = undefined)}
        /><span aria-hidden="true">m³</span>
      </div>
      <p class="field-hint">A mérőn látható teljes állás, nem a fogyasztás.</p>
      <div class="field-label">
        <label for="gas-date">Rögzítés dátuma · ÉÉÉÉ-HH-NN</label><Help
          forId="gas-date"
          label="Rögzítés dátuma · ÉÉÉÉ-HH-NN"
        />
      </div>
      <input
        id="gas-date"
        aria-required="true"
        aria-invalid={formError?.field === "date"}
        aria-describedby={`gas-date-help${formError?.field === "date" ? " gas-reading-error" : ""}`}
        type="text"
        bind:value={draft.date}
        onblur={saveDraft}
        maxlength="10"
        oninput={() => (formError = undefined)}
      />
      <p id="gas-reading-error" class="field-error" role="alert">
        {formError?.message ?? ""}
      </p>
      <button class="primary-button" type="submit"
        ><span>Mérőállás rögzítése</span><span aria-hidden="true">↗</span
        ></button
      >
      <p class="form-footnote">Adataid csak ebben a böngészőben maradnak.</p>
    </form>
  </section>
</div>
<div class="details-grid">
  <section class="card">
    <div class="card-heading">
      <h2>A számlád adatai</h2>
      <span class="subtle-icon" aria-hidden="true">⚙</span>
    </div>
    <p class="section-intro">
      Ezekből számoljuk ki, hány köbméter gáz fér bele a kedvezményes
      energiakeretedbe.
    </p>
    <div class="settings-fields">
      <Field
        id="gas-heat"
        label="Fűtőérték"
        value={model.settings.heat}
        unit="MJ/m³"
        decimal
        oncommit={(value) => setting("heat", value)}
      /><Field
        id="gas-correction"
        label="Korrekciós tényező"
        value={model.settings.correction}
        decimal
        oncommit={(value) => setting("correction", value)}
      />
    </div>
    <p class="field-hint">
      Nagyobb fűtőérték mellett ugyanannyi energiába kevesebb köbméter fér bele.
    </p>
  </section>
  <section class="card">
    <div class="card-heading">
      <h2>Keret a kezdőnaptól</h2>
      <span class="badge neutral"
        >{model.billing.mode === "flat" ? "NAPARÁNYOS" : "SZEZONÁLIS"} BECSLÉS</span
      >
    </div>
    <p class="section-intro">
      Nézd meg, mennyi gáz fér bele a kedvezménybe a következő napokban,
      {model.billing.start}-től számolva.
    </p>
    <div class="periods">
      {#each [1, 28, 30, 31] as d (d)}<div>
          <span>{d} nap</span><strong
            >{fmt(
              allowanceBetween(
                model.billing.start,
                addDays(model.billing.start, d),
                model.billing.mode,
              ) /
                (model.settings.heat * model.settings.correction),
              d === 1 ? 2 : 1,
            )}</strong
          ><small>m³</small>
        </div>{/each}
    </div>
  </section>
</div>
<section class="card billing-card">
  <div class="card-heading">
    <h2>Időszaki kalkuláció</h2>
    <span class="badge neutral"
      >{modes.find((m) => m.value === model.billing.mode)!.label}</span
    >
  </div>
  <p class="section-intro">
    Nézd meg, mennyi gáz fogyott vagy várható a választott időszakban, és ebből
    mennyi fér bele a kedvezményes keretbe.
  </p>
  <div class="billing-inputs">
    <Field
      id="gas-bill-start"
      label="Időszak kezdete"
      value={model.billing.start}
      oncommit={(value) => billing("start", value)}
    /><Field
      id="gas-bill-end"
      label="Záró dátum · már nem része"
      value={model.billing.end}
      oncommit={(value) => billing("end", value)}
    /><Field
      id="gas-annual-estimate"
      label="Becsült éves fogyasztás"
      value={model.billing.annualEstimate}
      unit="m³/év"
      placeholder="pl. 1800"
      decimal
      oncommit={(value) => billing("annualEstimate", value)}
    />
  </div>
  <button class="text-button" type="button" onclick={useReadings}
    >Utolsó két mérés időszakának használata ↗</button
  >
  <details class="profile-settings">
    <summary
      >Fogyasztási profilsúlyok szerkesztése <span aria-hidden="true">＋</span
      ></summary
    >
    <p class="field-hint">
      A súlyok megadják, az éves fogyasztás mekkora része jut egy hónapra. Az
      évkezdet becsléséhez is ezeket használjuk. Ha vannak saját havi
      fogyasztási adataid, megadhatod az arányukat.
    </p>
    <div class="profile-inputs">
      {#each months as month, index (month)}<Field
          id={`gas-profile-${index}`}
          label={month}
          value={model.billing.weights[index]}
          decimal
          oncommit={(value) => weight(index, value)}
        />{/each}
    </div>
  </details>
  <div class="billing-results">
    <div>
      <span
        >{model.billing.mode === "reading"
          ? "Mért időszaki fogyasztás"
          : "Becsült számlázott mennyiség"}</span
      ><strong>{fmt(bill.consumption)} <small>m³</small></strong>
      <p>
        {bill.consumption === null
          ? model.billing.mode === "reading"
            ? "Pontos határnapi mérések szükségesek."
            : "Add meg a becsült éves fogyasztást."
          : `${bill.days} napra számolva`}
      </p>
    </div>
    <div>
      <span>Időszakra jutó kedvezmény</span><strong
        >{fmt(bill.allowance)} <small>m³</small></strong
      >
      <p>{fmt(bill.allowanceMJ)} MJ</p>
    </div>
    <div>
      <span>Keretbe férő mennyiség</span><strong class="accent"
        >{fmt(bill.eligible)} <small>m³</small></strong
      >
      <p>Sávkorrekció nélküli becslés</p>
    </div>
    <div>
      <span>Keret feletti mennyiség</span><strong
        class:over-budget={(bill.over ?? 0) > 0}
        >{fmt(bill.over)} <small>m³</small></strong
      >
      <p>Nem végleges számlabesorolás</p>
    </div>
  </div>
  <p class="balance-note">
    {model.billing.mode === "temperature"
      ? "Szerkeszthető fogyasztási példaprofilból számolt részszámlabecslés; a szolgáltató időjárási algoritmusát nem modellezzük."
      : model.billing.mode === "flat"
        ? "Teljes naptári hónapra az éves mennyiség 1/12-e, törthónapra naparányosan. Az éves elszámolás eltérhet."
        : "A pontos kezdő és záró mérőállás különbsége; a korábbi megtakarítás sávkorrekciója nincs benne."}
  </p>
</section>
<GasStats {model} {annual} {bill} onstats={updateStats} />
{#key model.year}
  <ReadingLog
    id="gas-history"
    unit="m³"
    {removedReadings}
    rows={annual.items.map((r) => ({
      id: r.id,
      date: r.date,
      values: [r.value],
      total: r.value,
    }))}
    columns={["Mérőállás"]}
    onedit={edit}
    onremove={remove}
    onopening={opening}
  />
{/key}
<section class="comparison-section" id="gas-comparison">
  <div class="eyebrow">
    <span class="tiny-line"></span>ÉRTHETŐEN A SZÁMLÁZÁSRÓL
  </div>
  <h2>Mi a különbség a számlázási módok között?</h2>
  <p class="comparison-intro">
    Ugyanaz az éves kedvezmény, eltérő havi elosztás. A választás főleg az
    időzítést és a havi teendőidet befolyásolja.
  </p>
  <div class="comparison-grid">
    {#each modes as mode, index (mode.value)}<article
        class="card comparison-card"
        class:is-selected={model.billing.mode === mode.value}
      >
        <div class="comparison-top">
          <span>0{index + 1}</span>{#if model.billing.mode === mode.value}<span
              class="selected-mode">Kiválasztva</span
            >{/if}
        </div>
        <h3>{mode.label}</h3>
        <p class="mode-subtitle">{mode.subtitle}</p>
        <dl>
          <dt>A havi számla alapja</dt>
          <dd>{mode.basis}</dd>
          <dt>A kedvezmény elosztása</dt>
          <dd>{mode.allowance}</dd>
          <dt>Havi teendő</dt>
          <dd>{mode.action}</dd>
        </dl>
        <p class="mode-tradeoff">{mode.tradeoff}</p>
      </article>{/each}
  </div>
  <div class="comparison-footnote">
    <span class="info-icon" aria-hidden="true">i</span>
    <p>
      A bankkártya, átutalás, beszedés és csekk befizetési mód, nem külön
      kedvezmény. Az itt kiválasztott mód az MVM-szerződésedet nem módosítja.
    </p>
  </div>
</section>
<details class="info-panel">
  <summary
    ><span>ⓘ Hogyan számolunk?</span><span aria-hidden="true">＋</span></summary
  >
  <div class="info-content">
    <div>
      <h3>Energiából köbméter</h3>
      <p>
        Éves keret: 63 645 MJ, augusztus 1-től a következő augusztus 1-jéig.
        Köbméter = MJ ÷ (fűtőérték × korrekció). A napi keret az év tényleges
        365/366 napjával készül.
      </p>
    </div>
    <div>
      <h3>Mérésekből fogyasztás</h3>
      <p>
        Az év első és utolsó mérésének különbsége. A következő augusztus 1.
        záróállás is lehet. Évkezdő állás nélkül a hiányzó fogyasztást a havi
        fogyasztási profil alapján becsüljük. Mérőcsere és átfordulás nincs
        modellezve.
      </p>
    </div>
    <div>
      <h3>Becslés, nem számla</h3>
      <p>
        A szezonális kedvezmény az MVM kerekített havi MJ-táblázatából készül. A
        sávkorrekció, az éves elszámolás és az időben változó fűtőérték
        módosíthatja a számlát. A 2027-es becslés változatlan szabályokat és
        díjakat feltételez.
      </p>
      <a
        href="https://www.mvmnext.hu/foldgaz/egyetemes-szolgaltatas/ugyintezes/arak-dijszabasok/rogzitett-kedvezmeny-kalkulator"
        target="_blank"
        rel="noopener noreferrer">MVM hivatalos kalkulátor ↗</a
      >
    </div>
    <div>
      <h3>Helyi adatok</h3>
      <p>
        A napló, a piszkozat és a beállítások a böngésződben maradnak. Más
        eszközre nem szinkronizálódnak; a böngészőadatok törlésekor
        elveszhetnek.
      </p>
    </div>
  </div>
</details>
<PdfActions
  category="gas"
  getData={() => $state.snapshot(model)}
  report={gasReport}
  limit={limitReadings}
  parse={(value) => {
    const parsed = migrateGas(value);
    return validGas(parsed) ? parsed : null;
  }}
  describe={(data) => `${data.readings.length} gázmérés`}
  onrestore={(data: AppState) => {
    if (!disk.save(data)) return false;
    model = data;
    draft = { ...data.draft };
    formError = undefined;
    return true;
  }}
/>
