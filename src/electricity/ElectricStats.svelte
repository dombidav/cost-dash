<script lang="ts">
  import Help from "../components/Help.svelte";
  import type { ElectricityState, ElectricityPoint } from "./types";
  import { type annual, cost, measured, heating } from "./calculator";
  import { addDays, parseNumber } from "../calendar";
  import { percentChange } from "../lib/consumption";
  import { fmt, money, signed } from "../lib/format";
  import { regionLabel, regionOptions } from "../lib/regions";
  import {
    NATIONAL_MONTHLY,
    ELECTRICITY_REGIONS,
    DEFAULT_ANNUAL_ESTIMATE,
  } from "./reference";
  import Field from "../components/Field.svelte";
  import Select from "../components/Select.svelte";
  import Chart from "../components/Chart.svelte";
  import ConsumptionExamples from "./ConsumptionExamples.svelte";
  let {
    settings,
    yearly,
    combinedAnnualVolume,
    point,
    onstats,
  }: {
    settings: ElectricityState["stats"];
    yearly: ReturnType<typeof annual>;
    combinedAnnualVolume: number | null;
    point: ElectricityPoint;
    onstats: (value: ElectricityState["stats"]) => string | void;
  } = $props();
  let saving = $derived(settings.saving);
  let reduced = $derived(
    yearly.projected
      ? cost(
          point,
          yearly.activeStart,
          yearly.activeEnd,
          yearly.projected.map((d) => ({
            ...d,
            peak: d.peak * (1 - saving / 100),
            off: d.off * (1 - saving / 100),
          })),
        )
      : null,
  );
  let savings = $derived(
    yearly.annualCost?.total !== null &&
      yearly.annualCost?.total !== undefined &&
      reduced?.total !== null &&
      reduced?.total !== undefined
      ? Math.max(0, yearly.annualCost.total - reduced.total)
      : null,
  );
  let latestChange = $derived(
    yearly.latest && yearly.previous
      ? percentChange(yearly.latest.average, yearly.previous.average)
      : null,
  );
  let yoy = $derived(
    yearly.prior && yearly.tracked
      ? percentChange(yearly.tracked.average, yearly.prior.average)
      : null,
  );
  const regions = regionOptions(ELECTRICITY_REGIONS);
  const setRegion = (value: string) => update("region", value);
  let region = $derived(
    Object.hasOwn(ELECTRICITY_REGIONS, settings.region)
      ? settings.region
      : "country",
  );
  let regional = $derived(
    region === "country" ? null : ELECTRICITY_REGIONS[region] * 12,
  );
  let bars = $derived([
    ...(yearly.fullPeriod && yearly.volume !== null
      ? [
          {
            label: "Aktív mérő éves adata",
            short: "Aktív mérő",
            value: yearly.volume,
            own: true,
          },
        ]
      : []),
    ...(combinedAnnualVolume !== null
      ? [
          {
            label: "Összes mérő éves adata",
            short: "Összes mérő",
            value: combinedAnnualVolume,
            own: true,
          },
        ]
      : []),
    {
      label: "Országos átlag · 2025",
      value: NATIONAL_MONTHLY * 12,
      own: false,
    },
    ...(regional !== null
      ? [
          {
            label: `${regionLabel(region)} · 2025`,
            value: regional,
            own: false,
          },
        ]
      : []),
  ]);
  let eqVolume = $derived(yearly.latest?.volume ?? 1);
  let deviceMonthly = $derived(
    (settings.deviceWatts / 1000) * settings.dailyHours * 30,
  );
  let deviceRate = $derived(
    point.tariff === "H" && !heating(point.billing.start)
      ? point.rates.second
      : point.tariff === "A2"
        ? point.rates.low * (1 - point.offPercent / 100) +
          (point.rates.second * point.offPercent) / 100
        : point.rates.low,
  );
  let headroom = $derived(
    point.tariff !== "B_GEO" &&
      yearly.remainingDays > 0 &&
      yearly.remaining !== null
      ? yearly.remaining / yearly.remainingDays
      : null,
  );
  let latestCost = $derived(
    yearly.latest
      ? cost(
          point,
          yearly.latest.start,
          yearly.latest.end,
          measured(point, yearly.latest.start, yearly.latest.end),
        )
      : null,
  );
  let balanceDays = $derived(
    point.billing.balance.trim() !== "" &&
      latestCost?.total !== null &&
      latestCost?.total !== undefined &&
      latestCost.total > 0 &&
      yearly.latest
      ? parseNumber(point.billing.balance) /
          (latestCost.total / yearly.latest.days)
      : null,
  );
  const basis = {
    missing: "KEVÉS ADAT",
    measured: "TELJES MÉRT IDŐSZAK",
    seasonal: "SZEZONÁLIS BECSLÉS",
    manual: "BEÁLLÍTOTT ÉVES BECSLÉS",
  };
  function update(key: keyof ElectricityState["stats"], raw: string) {
    const value = ["people", "floorArea", "region"].includes(key)
      ? raw.trim()
      : parseNumber(raw);
    return onstats({ ...settings, [key]: value });
  }
</script>

<section class="statistics-section" id="electricity-statistics">
  <div class="statistics-heading">
    <div>
      <div class="eyebrow"><span class="tiny-line"></span>A SZÁMOK MÖGÖTT</div>
      <h2>A fogyasztásod, új megvilágításban.</h2>
      <p class="section-intro">
        Kövesd az aktív mérő fogyasztását, vesd össze a hazai átlaggal, és
        próbáld ki, mennyit spórolhatsz kevesebb fogyasztással.
      </p>
    </div>
    <span class="badge neutral">{basis[yearly.kind]}</span>
  </div>
  <details class="card statistics-settings">
    <summary
      >Személyes összehasonlítás és készülékpélda <span aria-hidden="true"
        >＋</span
      ></summary
    >
    <div class="stats-input-grid">
      <Field
        id="electricity-people"
        label="Háztartás létszáma · fő"
        value={settings.people}
        placeholder="Nem kötelező"
        decimal
        oncommit={(value) => update("people", value)}
      /><Field
        id="electricity-floor-area"
        label="Lakás alapterülete · m²"
        value={settings.floorArea}
        placeholder="Nem kötelező"
        decimal
        oncommit={(value) => update("floorArea", value)}
      /><Select
        id="electricity-region"
        label="KSH területi referencia"
        value={region}
        options={regions}
        oncommit={setRegion}
      /><Field
        id="electricity-watts"
        label="Példakészülék teljesítménye · W"
        value={settings.deviceWatts}
        decimal
        oncommit={(value) => update("deviceWatts", value)}
      /><Field
        id="electricity-hours"
        label="Készülék napi használata · óra"
        value={settings.dailyHours}
        decimal
        oncommit={(value) => update("dailyHours", value)}
      />
    </div>
  </details>
  <div class="statistics-grid">
    <article class="card stat-card">
      <div class="stat-top">
        <h3>Napi átlagod</h3>
        <span class="stat-symbol" aria-hidden="true">↗</span>
      </div>
      <div class="stat-number">
        <span>{fmt(yearly.latest?.average, 2)}</span><small>kWh/nap</small>
      </div>
      <p class="stat-description">
        {#if yearly.latest}
          {yearly.latest.start} → {yearly.latest.end} · {yearly.latest.days} nap ·
          {fmt(yearly.latest.volume)} kWh.
        {:else}
          <a href="#electricity-reading-peak">Rögzíts legalább két mérőállást</a
          > a kiválasztott évhez.
        {/if}
      </p>
      <p class="stat-change">
        {yearly.previous
          ? latestChange === null
            ? "Nullás előzményből pozitív fogyasztásnál nincs százalékos osztás."
            : `${signed(latestChange)} az előző szakasz napi átlagához képest.`
          : "A változás összevetéséhez legalább három mérés kell."}
      </p>
    </article>
    <article class="card stat-card forecast-card">
      <div class="stat-top">
        <h3>
          {yearly.fullPeriod
            ? "Várható éves fogyasztás"
            : "Fogyasztás a jogosultsági időszakban"}
        </h3>
        <span class="stat-symbol" aria-hidden="true">⌁</span>
      </div>
      <span class="badge neutral">{basis[yearly.kind]}</span>
      <div class="stat-number">
        <span>{fmt(yearly.volume)}</span><small>kWh</small>
      </div>
      <p class="stat-description">
        {yearly.kind === "measured"
          ? "A jogosultsági időszak pontos nyitó és záró állásából."
          : yearly.kind === "seasonal"
            ? yearly.last?.date === yearly.activeEnd
              ? "A mért fogyasztás és a havi súlyozással becsült évkezdő rész együtt."
              : "A mért szakasz fogyasztását a havi profil alapján vetítjük ki a jogosult időszakra."
            : yearly.kind === "manual"
              ? "Az éves fogyasztási beállításból, havi súlyozással a jogosult időszakra."
              : ""}
        {#if yearly.kind === "missing"}
          <a href="#electricity-annual-estimate">Éves fogyasztási becslés</a> vagy
          hosszabb mért időszak szükséges.
        {/if}
        {#if point.tariff === "H" && yearly.kind === "manual"}
          A fűtési idényre a beállított fogyasztási aránnyal számolunk.
        {/if}
      </p>
      {#if !yearly.fullPeriod && yearly.active > 0}
        <p class="stat-footnote">
          {yearly.activeStart} – {addDays(yearly.activeEnd, -1)} · {yearly.active}
          nap.
        </p>
      {/if}
      {#if yearly.kind === "manual" && yearly.manualAdjusted}
        <p class="stat-footnote">
          Az időszakra jutó beállított becslés kisebb az eddig követett
          fogyasztásnál. Ezért legalább az évkezdet óta számolt mennyiséget
          mutatjuk, a becsült kezdő résszel együtt, ha van ilyen.
        </p>
      {/if}
      {#if yearly.kind === "manual" && parseNumber(point.annualEstimate) === DEFAULT_ANNUAL_ESTIMATE}
        <p class="stat-footnote">
          Az alkalmazás kiinduló éves becslése {fmt(DEFAULT_ANNUAL_ESTIMATE, 0)} kWh,
          országos referencia alapján. Ellenőrizd, hogy ez megfelel-e a saját fogyasztásodnak.
        </p>
      {/if}
      <p class="stat-footnote">
        Becsült {yearly.fullPeriod ? "éves" : "időszaki"} költség: {money(
          yearly.annualCost?.total,
        )}, alapdíjjal, egyedi időszaki jóváírás nélkül.
      </p>
    </article>
    {#if point.tariff !== "B_GEO"}<article class="card stat-card">
        <div class="stat-top">
          <h3>Mennyi fér még bele?</h3>
          <span class="stat-symbol" aria-hidden="true">◷</span>
        </div>
        <div class="stat-number">
          <span>{fmt(headroom, 2)}</span><small>kWh/nap</small>
        </div>
        <p class="stat-description">
          {yearly.remaining === null
            ? "Mérőállás vagy becsülhető kezdőszakasz szükséges."
            : yearly.remainingDays === 0
              ? "A jogosultsági időszak véget ért."
              : `${fmt(yearly.remaining)} kWh ${yearly.remainingEstimated ? "becsült keret" : "keret"} és ${yearly.remainingDays} nap maradt az utolsó méréskor.`}
        </p>
        <p class="stat-footnote">
          {#if point.tariff === "H"}A fűtési idény fogyasztása nem csökkenti ezt
            a keretet.{/if}
          {#if yearly.opening}Az évkezdetkor hiányzó fogyasztást havi
            súlyozással becsültük.{:else if yearly.seasonSplitEstimated}Az
            idényhatárt átfogó fogyasztást naparányosan osztottuk meg.{/if}
          A legutóbbi mérés óta eltelt fogyasztást nem találjuk ki.
        </p>
      </article>{/if}
    <article class="card stat-card">
      <div class="stat-top">
        <h3>A tavalyi önmagadhoz képest</h3>
        <span class="stat-symbol" aria-hidden="true">↔</span>
      </div>
      <div class="stat-number"><span>{fmt(yoy)}</span><small>%</small></div>
      <p class="stat-description">
        {yearly.prior && yearly.tracked
          ? `Idei napi átlag: ${fmt(yearly.tracked.average, 2)}; tavaly: ${fmt(yearly.prior.average, 2)} kWh.`
          : yearly.tracked
            ? `Tavalyi mérés kell: ${yearly.priorStart} és ${yearly.priorEnd}.`
            : "Idei és tavalyi mérési szakasz is szükséges."}
      </p>
      <p class="stat-footnote">
        Azonos határnapok napi átlaga, időjárási korrekció nélkül. Február 29.
        párja február 28.; hiányzó mérésnél nincs interpoláció.
      </p>
    </article>
    <article class="card stat-card benchmark-card">
      <div class="stat-top">
        <h3>
          {yearly.fullPeriod
            ? "Magyar átlaghoz képest"
            : "Éves országos referencia"}
        </h3>
        <span class="badge neutral">KSH · 2025</span>
      </div>
      <p class="stat-description">
        {!yearly.fullPeriod
          ? "A jogosultsági időszak nem teljes kedvezményes év, ezért az időszaki fogyasztást nem hasonlítjuk az éves országos átlaghoz."
          : yearly.volume === null
            ? "Éves mérés vagy jelölt becslés kell a saját összevetéshez."
            : `Aktív mérő: ${fmt(yearly.volume)} kWh · ${basis[yearly.kind].toLocaleLowerCase("hu")}.`}
        Országos referencia: {fmt(NATIONAL_MONTHLY * 12)} kWh/év.
      </p>
      <div class="benchmark-filter">
        <Select
          id="electricity-benchmark-region"
          label="KSH területi összehasonlítás"
          value={region}
          options={regions}
          oncommit={setRegion}
        />
      </div>
      <Chart
        id="electricity-benchmark"
        kind="benchmark"
        unit="kWh/év"
        {bars}
        label="Éves áramfogyasztás összehasonlítása"
      />
      <p class="stat-change">
        {yearly.fullPeriod && yearly.volume !== null
          ? `${signed(percentChange(yearly.volume, NATIONAL_MONTHLY * 12))} az országos átlaghoz képest.`
          : ""}
      </p>
      {#if yearly.fullPeriod && yearly.volume !== null && regional !== null}<p
          class="stat-footnote"
        >
          {regionLabel(region)} átlagához képest: {signed(
            percentChange(yearly.volume, regional),
          )}.
        </p>{/if}
      <p class="stat-footnote">
        Egy háztartási fogyasztóra jutó havi éves átlag × 12. Külön B/H-mérő nem
        azonos egy teljes háztartással. Több pontnál az ismert összes éves
        mennyiséget is jelöljük; nem hatékonysági minősítés.
      </p>
      <a
        class="stat-source-link"
        href="https://www.ksh.gov.hu/stadat_files/kor/hu/kor0068.html"
        target="_blank"
        rel="noopener noreferrer">KSH · 2025, frissítve: 2026. 10. 30. ↗</a
      >
    </article>
    <article class="card stat-card savings-card">
      <div class="stat-top">
        <h3>Kevesebb fogyasztás, kisebb költség</h3>
        <span class="stat-symbol" aria-hidden="true">↘</span>
      </div>
      <div class="saving-heading">
        <label class="saving-label" for="electricity-saving"
          >Fogyasztáscsökkentés <output for="electricity-saving"
            >{saving}%</output
          ></label
        ><Help forId="electricity-saving" label="Fogyasztáscsökkentés" />
      </div>
      <input
        id="electricity-saving"
        aria-describedby="electricity-saving-help"
        type="range"
        min="0"
        max="100"
        step="1"
        bind:value={saving}
        onchange={() => update("saving", String(saving))}
        onblur={() => update("saving", String(saving))}
      />
      <div class="stat-number">
        <span>{fmt(savings, 0)}</span><small
          >{yearly.fullPeriod ? "Ft/év" : "Ft/időszak"}</small
        >
      </div>
      <p class="stat-description">
        {yearly.annualCost?.total !== null &&
        yearly.annualCost?.total !== undefined
          ? `${money(yearly.annualCost.total)} → ${money(reduced?.total)} becsült ${yearly.fullPeriod ? "éves" : "időszaki"} költség.`
          : "Fogyasztási adat és modellezhető tarifa szükséges."}
      </p>
      <p class="stat-footnote">
        Újraszámoljuk az ársávokat{point.tariff === "H"
          ? " a fűtési idényt figyelembe véve"
          : ""}. Az alapdíj változatlan. Az egyedi időszaki jóváírást nem
        vetítjük ki az egész évre.
      </p>
    </article>
    <article class="card stat-card">
      <div class="stat-top">
        <h3>Szokatlan változás?</h3>
        <span class="stat-symbol" aria-hidden="true">◎</span>
      </div>
      <span
        class="badge neutral"
        class:anomaly-warning={yearly.previous &&
          ((latestChange ?? 0) >= 50 ||
            (yearly.previous.average === 0 &&
              (yearly.latest?.average ?? 0) > 0))}
        >{!yearly.previous
          ? "KEVÉS ADAT"
          : latestChange === null
            ? "NULLÁRÓL INDULÓ FOGYASZTÁS"
            : Math.abs(latestChange) >= 50
              ? "LEGALÁBB 50%-OS VÁLTOZÁS"
              : "NINCS 50%-OS ELTÉRÉS"}</span
      >
      <p class="stat-description">
        {yearly.previous && yearly.latest
          ? `${fmt(yearly.previous.average, 2)} → ${fmt(yearly.latest.average, 2)} kWh/nap két egymást követő mérési szakaszon.`
          : "Legalább három mérés kell két szakasz összevetéséhez."}
      </p>
      <p class="stat-footnote">
        Egyszerű figyelemfelhívás. Az időjárás, a készülékek és a mérési hossz
        is okozhatja; nem hibadiagnózis.
      </p>
    </article>
    <article class="card stat-card">
      <div class="stat-top">
        <h3>Egy főre, egy négyzetméterre</h3>
        <span class="stat-symbol" aria-hidden="true">÷</span>
      </div>
      <div class="stat-number">
        <span
          >{yearly.volume !== null && settings.people
            ? fmt(yearly.volume / parseNumber(settings.people))
            : "—"}</span
        ><small>{yearly.fullPeriod ? "kWh/fő/év" : "kWh/fő/időszak"}</small>
      </div>
      <p class="stat-description">
        {#if yearly.volume !== null && settings.floorArea}
          {fmt(yearly.volume / parseNumber(settings.floorArea))}
          {yearly.fullPeriod ? "kWh/m²/év" : "kWh/m²/időszak"}.
        {/if}
        {#if !settings.floorArea || !settings.people}
          {#if !settings.floorArea && !settings.people}
            Add meg az <a href="#electricity-floor-area">alapterületet</a> és a
            <a href="#electricity-people">háztartás létszámát</a>.
          {:else if !settings.floorArea}
            Add meg az <a href="#electricity-floor-area">alapterületet</a>.
          {:else}
            Add meg a <a href="#electricity-people">háztartás létszámát</a>.
          {/if}
        {:else if yearly.volume === null}
          Éves mért vagy <a href="#electricity-annual-estimate"
            >becsült fogyasztási adat</a
          > is szükséges.
        {/if}
      </p>
      <p class="stat-footnote">
        Az aktív mérő {yearly.fullPeriod
          ? "éves"
          : "jogosultsági időszakra jutó"} mért vagy becsült energiájából számoljuk.
      </p>
    </article>
    {#if point.billing.schedule === "prepaid"}<article class="card stat-card">
        <div class="stat-top">
          <h3>Meddig elég az egyenleg?</h3>
          <span class="stat-symbol" aria-hidden="true">◷</span>
        </div>
        <div class="stat-number">
          <span>{fmt(balanceDays, 0)}</span><small>nap</small>
        </div>
        <p class="stat-description">
          {#if balanceDays === null}
            Add meg az <a href="#electricity-balance"
              >aktuális feltöltött egyenleget</a
            >, és
            <a href="#electricity-reading-peak">rögzíts legalább két állást</a>.
          {:else}
            {money(parseNumber(point.billing.balance))} egyenleg a legutóbbi mért
            napi költség mellett.
          {/if}
        </p>
        <p class="stat-footnote">
          Átlagalapú becslés, nem élő mérőegyenleg. Nem végzünk feltöltést, és a
          mérések rögzítése nem von le pénzt.
        </p>
      </article>{/if}
    <article class="card stat-card equivalence-card">
      <div class="stat-top">
        <h3>Ez annyi áram, mint…</h3>
        <span class="stat-symbol" aria-hidden="true">≈</span>
      </div>
      <p class="stat-caption">
        {yearly.latest
          ? `A legutóbbi mért ${fmt(eqVolume)} kWh energiája.`
          : "Mérés hiányában 1 kWh szemléltetése."}
      </p>
      <div class="equivalence-grid">
        <div>
          <strong>{fmt(eqVolume / (settings.deviceWatts / 1000))}</strong><span
            >óra egy {fmt(settings.deviceWatts, 0)} W-os készülékkel</span
          >
        </div>
        <div>
          <strong>{fmt(deviceMonthly)}</strong><span
            >kWh / 30 nap, napi {fmt(settings.dailyHours)} óra használattal</span
          >
        </div>
        <div>
          <strong>{money(deviceMonthly * deviceRate)}</strong><span
            >30 nap fogyasztási díja a kedvezményes egységárral, alapdíj nélkül</span
          >
        </div>
      </div>
      <p class="stat-footnote">
        Folyamatos névleges teljesítménnyel szemléltetünk. A termosztátos
        készülékek és a hűtő működése szakaszos lehet. A példa nem garantált
        megtakarítás.
      </p>
    </article>
    <ConsumptionExamples
      {point}
      value={settings.consumptionExample}
      onselect={(value) => onstats({ ...settings, consumptionExample: value })}
    />
  </div>
</section>
