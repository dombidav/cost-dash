<script lang="ts">
  import Help from "../components/Help.svelte";
  import type { ElectricityState, ElectricityPoint } from "./types";
  import { type annual, cost, measured, heating } from "./calculator";
  import { parseNumber } from "../calendar";
  import { percentChange } from "../lib/consumption";
  import { fmt, money, signed } from "../lib/format";
  import { NATIONAL_MONTHLY, ELECTRICITY_REGIONS } from "./reference";
  import Field from "../components/Field.svelte";
  import Select from "../components/Select.svelte";
  import Chart from "../components/Chart.svelte";
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
  let regional = $derived(
    settings.region !== "country"
      ? (ELECTRICITY_REGIONS[settings.region] ?? NATIONAL_MONTHLY) * 12
      : null,
  );
  let bars = $derived([
    ...(yearly.volume !== null
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
      ? [{ label: `${settings.region} · 2025`, value: regional, own: false }]
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
      yearly.complete &&
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
    linear: "LINEÁRIS ÉVES BECSLÉS",
    manual: "MEGADOTT ÉVES BECSLÉS",
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
        Az aktív mérési pont statisztikái. Az összes mérőt a közös összesítőben
        is látod.
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
        value={settings.region}
        options={[
          { value: "country", label: "Országos átlag" },
          ...Object.keys(ELECTRICITY_REGIONS)
            .sort((a, b) => a.localeCompare(b, "hu"))
            .map((r) => ({ value: r, label: r })),
        ]}
        oncommit={(value) => {
          update("region", value);
        }}
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
        {yearly.latest
          ? `${yearly.latest.start} → ${yearly.latest.end} · ${yearly.latest.days} nap · ${fmt(yearly.latest.volume)} kWh.`
          : "Legalább két érvényes mérés szükséges a kiválasztott évhez."}
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
        <h3>Várható éves fogyasztás</h3>
        <span class="stat-symbol" aria-hidden="true">⌁</span>
      </div>
      <span class="badge neutral">{basis[yearly.kind]}</span>
      <div class="stat-number">
        <span>{fmt(yearly.volume)}</span><small>kWh</small>
      </div>
      <p class="stat-description">
        {yearly.kind === "measured"
          ? "A jogosult éves időszak pontos nyitó és záró állásából."
          : yearly.kind === "linear"
            ? `Legalább 30 nap napi átlagát vetítjük a jogosult év ${yearly.active} napjára. A használat évszakosan változhat, ezért ez becslés.`
            : yearly.kind === "manual"
              ? "A beállított éves becslés, a részéves jogosultság napjaira arányosítva. H-nál a megadott fűtési aránnyal osztunk."
              : "Legalább 30 nap mérés vagy kézi éves becslés kell. H-tarifánál rövid téli/nyári szakaszt nem szorzunk fel az egész évre."}
      </p>
      <p class="stat-footnote">
        Becsült éves költség: {money(yearly.annualCost?.total)}, alapdíjjal,
        egyedi időszaki jóváírás nélkül.
      </p>
    </article>
    <article class="card stat-card">
      <div class="stat-top">
        <h3>Mennyi fér még bele?</h3>
        <span class="stat-symbol" aria-hidden="true">◷</span>
      </div>
      <div class="stat-number">
        <span>{fmt(headroom, 2)}</span><small>kWh/nap</small>
      </div>
      <p class="stat-description">
        {point.tariff === "B_GEO"
          ? "B GEO-nál nincs normál 2523-as sávhatár."
          : !yearly.complete
            ? `A napi mozgástérhez ${yearly.activeStart}-i kezdőállás kell.`
            : yearly.remainingDays === 0
              ? "Nincs hátralévő nap ebben a lemért jogosultsági időszakban."
              : `${fmt(yearly.remaining)} kWh normál keret és ${yearly.remainingDays} nap maradt az utolsó méréskor.`}
      </p>
      <p class="stat-footnote">
        A H-idény korlátmentes fogyasztása ezen felül értendő. A legutóbbi mérés
        óta eltelt fogyasztást nem találjuk ki.
      </p>
    </article>
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
        <h3>Magyar átlaghoz képest</h3>
        <span class="badge neutral">KSH · 2025</span>
      </div>
      <p class="stat-description">
        {yearly.volume === null
          ? "Éves mérés vagy jelölt becslés kell a saját összevetéshez."
          : `Aktív mérő: ${fmt(yearly.volume)} kWh · ${basis[yearly.kind].toLocaleLowerCase("hu")}.`}
        Országos referencia: {fmt(NATIONAL_MONTHLY * 12)} kWh/év.
      </p>
      <Chart
        id="electricity-benchmark"
        kind="benchmark"
        unit="kWh"
        {bars}
        label={bars.map((b) => `${b.label}: ${fmt(b.value)} kWh/év`).join(". ")}
      />
      <p class="stat-change">
        {yearly.volume !== null
          ? `${signed(percentChange(yearly.volume, NATIONAL_MONTHLY * 12))} az országos átlaghoz képest.`
          : ""}
      </p>
      {#if yearly.volume !== null && regional !== null}<p class="stat-footnote">
          {settings.region} átlagához képest: {signed(
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
        <span>{fmt(savings, 0)}</span><small>Ft/év</small>
      </div>
      <p class="stat-description">
        {yearly.annualCost?.total !== null &&
        yearly.annualCost?.total !== undefined
          ? `${money(yearly.annualCost.total)} → ${money(reduced?.total)} becsült éves költség.`
          : "Éves fogyasztási adat és modellezhető tarifa szükséges."}
      </p>
      <p class="stat-footnote">
        Az ársávokat és a H-idényt újraszámoljuk, az alapdíj változatlan. Az
        egyedi időszaki jóváírást nem vetítjük ki az egész évre.
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
        ><small>kWh/fő/év</small>
      </div>
      <p class="stat-description">
        {yearly.volume !== null && settings.floorArea
          ? `${fmt(yearly.volume / parseNumber(settings.floorArea))} kWh/m²/év.`
          : "Az alapterületet és a háztartás létszámát a statisztika beállításai között adhatod meg."}
      </p>
      <p class="stat-footnote">
        Az aktív mérő éves mért vagy becsült energiája. Külön H-mérőnél ez nem a
        lakás teljes fogyasztása.
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
          {balanceDays === null
            ? "Add meg az aktuális feltöltött egyenleget, és rögzíts legalább két állást."
            : `${money(parseNumber(point.billing.balance))} egyenleg a legutóbbi mért napi költség mellett.`}
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
  </div>
</section>
