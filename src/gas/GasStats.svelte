<script lang="ts">
  import Help from "../components/Help.svelte";
  import {
    baseBetween,
    calculateStatistics,
    validateStatistics,
  } from "../statistics";
  import { R } from "../reference-data";
  import type { calculateBilling, calculateGasYear } from "../calculator";
  import { parseNumber } from "../calendar";
  import { fmt, money, signed } from "../lib/format";
  import { regionLabel, regionOptions } from "../lib/regions";
  import type { AppState, StatisticsSettings } from "../types";
  import Field from "../components/Field.svelte";
  import Select from "../components/Select.svelte";
  import Chart from "../components/Chart.svelte";
  import ElectricHeatingCard from "./ElectricHeatingCard.svelte";
  let {
    model,
    annual,
    bill,
    onstats,
  }: {
    model: AppState;
    annual: ReturnType<typeof calculateGasYear>;
    bill: ReturnType<typeof calculateBilling>;
    onstats: (value: StatisticsSettings) => void;
  } = $props();
  let saving = $derived(model.stats.savingPercent);
  let preview = $derived({
    ...model,
    stats: { ...model.stats, savingPercent: saving },
  });
  let result = $derived(calculateStatistics(preview, annual, bill));
  const regions = regionOptions(R.ksh.regions);
  const setRegion = (value: string) => update("region", value);
  const basis = {
    measured: "TELJES MÉRT ÉV",
    forecast: "PROFILALAPÚ BECSLÉS",
    manual: "KÉZI ÉVES BECSLÉS",
    missing: "KEVÉS ADAT",
  };
  let bars = $derived([
    ...(result.annualVolume !== null
      ? [{ label: "Saját éves adat", value: result.annualVolume, own: true }]
      : []),
    { label: "Országos átlag · 2025", value: result.national, own: false },
    ...(result.regional !== null
      ? [
          {
            label: `${regionLabel(model.stats.region)} · 2025`,
            value: result.regional,
            own: false,
          },
        ]
      : []),
  ]);
  function update(key: keyof StatisticsSettings, raw: string) {
    const value =
      key === "region" || key === "effective"
        ? raw
        : key === "area" && raw.trim() === ""
          ? null
          : parseNumber(raw);
    const candidate = { ...model.stats, [key]: value } as StatisticsSettings,
      message = validateStatistics(candidate);
    if (message) return message;
    onstats(candidate);
  }
  const settings: {
    key: keyof StatisticsSettings;
    label: string;
    decimal?: boolean;
  }[] = [
    { key: "low", label: "Kedvezményes bruttó díj · Ft/MJ", decimal: true },
    { key: "high", label: "Keret feletti bruttó díj · Ft/MJ", decimal: true },
    { key: "annualBase", label: "Éves alapdíj · Ft", decimal: true },
    { key: "effective", label: "Díjak érvényessége ettől · ÉÉÉÉ-HH-NN" },
    {
      key: "area",
      label: "Fűtött alapterület · m² (nem kötelező)",
      decimal: true,
    },
    { key: "heaterPower", label: "Szemléltető fűtőtest · kW", decimal: true },
    {
      key: "efficiency",
      label: "Feltételezett kazánhatásfok · %",
      decimal: true,
    },
  ];
</script>

<section class="statistics-section" id="gas-statistics">
  <div class="statistics-heading">
    <div>
      <div class="eyebrow"><span class="tiny-line"></span>A SZÁMOK MÖGÖTT</div>
      <h2>Több rálátás, jobb döntések.</h2>
      <p class="section-intro">
        Nézd meg, hogyan alakul a gázfogyasztásod és a költséged, és vesd össze
        a korábbi időszakokkal vagy a hazai átlaggal.
      </p>
    </div>
    <span class="badge neutral">{basis[result.annualKind]}</span>
  </div>
  <details class="card statistics-settings">
    <summary
      >Díjak és személyes összehasonlítás beállítása <span aria-hidden="true"
        >＋</span
      ></summary
    >
    <p class="section-intro">
      A megadott bruttó díjakkal becsüljük a költségeket, a háztartásod
      adataival pedig személyre szabjuk az összehasonlításokat.
    </p>
    <div class="stats-input-grid">
      {#each settings as field (field.key)}<Field
          id={`gas-stat-${field.key}`}
          label={field.label}
          value={model.stats[field.key]}
          decimal={field.decimal}
          oncommit={(value) => update(field.key, value)}
        />{/each}<Select
        id="gas-stat-region"
        label="Területi összehasonlítás"
        value={model.stats.region}
        options={regions}
        oncommit={setRegion}
      />
    </div>
    <p class="field-hint e-long-hint">
      MVM-alapérték: nettó 2,256 × 1,27 = bruttó 2,86512 Ft/MJ; keret felett
      22,002 Ft/MJ; éves alapdíj 11 674 Ft. Az alapdíjat naptári napokra
      arányosítjuk. Érvényesség: {model.stats.effective}. Ellenőrizve: {R.checked}.
      <a href={R.tariff.source} target="_blank" rel="noopener noreferrer"
        >Hivatalos díjtábla ↗</a
      >
    </p>
  </details>
  <div class="statistics-grid">
    <article class="card stat-card cost-card">
      <div class="stat-top">
        <h3>Forintban mennyibe kerül?</h3>
        <span class="stat-symbol" aria-hidden="true">Ft</span>
      </div>
      <p class="stat-caption">
        {model.billing.start} → {model.billing.end} · {result.bill.days} nap
      </p>
      <div class="stat-number">
        <span>{fmt(result.billingCost?.total, 0)}</span><small>Ft</small>
      </div>
      <p class="stat-description">
        {#if result.billingCost}
          {model.billing.mode === "reading"
            ? "Mért fogyasztás"
            : "Becsült részszámla"} költsége, sávkorrekció nélkül.
        {:else if model.billing.mode === "reading"}
          <a href="#gas-reading">Rögzítsd a határnapi mérőállásokat.</a>
        {:else}
          Add meg a <a href="#gas-annual-estimate">becsült éves fogyasztást</a>.
        {/if}
      </p>
      <dl class="cost-breakdown">
        <div>
          <dt>Kedvezményes energiadíj</dt>
          <dd>{money(result.billingCost?.low)}</dd>
        </div>
        <div>
          <dt>Keret feletti energiadíj</dt>
          <dd>{money(result.billingCost?.high)}</dd>
        </div>
        <div>
          <dt>Időarányos alapdíj</dt>
          <dd>
            {money(
              baseBetween(
                model.billing.start,
                model.billing.end,
                model.stats.annualBase,
              ),
            )}
          </dd>
        </div>
      </dl>
      <p class="stat-footnote">
        {result.latestCost && result.latest
          ? `Külön a legutóbbi mért időszak (${result.latest.start} → ${result.latest.end}): ${money(result.latestCost.total)} alapdíjjal. Ez eltérhet a részszámlától.`
          : "A mért fogyasztás költségbecsléséhez legalább két mérés kell."}
      </p>
    </article>
    <article class="card stat-card">
      <div class="stat-top">
        <h3>Még 1 m³ ára</h3>
        <span class="stat-symbol" aria-hidden="true">＋</span>
      </div>
      <p class="stat-caption">Fogyasztási díj, alapdíj nélkül</p>
      <div class="unit-price-pair">
        <div>
          <span>Kedvezményes sávban</span><strong
            >{fmt(
              model.settings.heat * model.settings.correction * model.stats.low,
              2,
            )} Ft/m³</strong
          >
        </div>
        <div>
          <span>Keret felett</span><strong
            >{fmt(
              model.settings.heat *
                model.settings.correction *
                model.stats.high,
              2,
            )} Ft/m³</strong
          >
        </div>
      </div>
      <p class="stat-footnote">
        1 m³ = {fmt(model.settings.heat * model.settings.correction, 3)} MJ. A tényleges
        ársáv az elszámolástól és sávkorrekciótól is függ.
      </p>
    </article>
    <article class="card stat-card">
      <div class="stat-top">
        <h3>Napi átlagod</h3>
        <span class="stat-symbol" aria-hidden="true">↗</span>
      </div>
      <div class="stat-number">
        <span>{fmt(result.latest?.average, 2)}</span><small>m³/nap</small>
      </div>
      <p class="stat-description">
        {#if result.latest}
          {result.latest.start} → {result.latest.end} · {result.latest.days} nap ·
          {fmt(result.latest.volume)} m³.
        {:else}
          <a href="#gas-reading">Rögzíts legalább két mérőállást</a> a kiválasztott
          évhez.
        {/if}
      </p>
      <p class="stat-change">
        {result.previous
          ? result.change === null
            ? "Nullás előzményből százalékos eltérés nem számolható."
            : `${signed(result.change)} az előző mérési időszak napi átlagához képest.`
          : "A változáshoz legalább három mérés kell."}
      </p>
    </article>
    <article class="card stat-card">
      <div class="stat-top">
        <h3>Mennyi fér még bele?</h3>
        <span class="stat-symbol" aria-hidden="true">◷</span>
      </div>
      <div class="stat-number">
        <span>{fmt(result.headroom, 2)}</span><small>m³/nap</small>
      </div>
      <p class="stat-description">
        {result.annual.remaining === null
          ? "Mérőállás vagy becsülhető kezdőszakasz szükséges."
          : result.remainingDays === 0
            ? "A kedvezményes év véget ért."
            : `Az utolsó méréskor ${fmt(result.annual.remaining)} m³ ${result.annual.opening ? "becsült keret" : "keret"} és ${result.remainingDays} nap volt hátra.`}
      </p>
      <p class="stat-footnote">
        Az éves maradék egyszerű napi átlaga, nem a havi szezonális kedvezmény.
        {#if result.annual.opening}Az évkezdetkor hiányzó fogyasztást havi
          súlyozással becsültük.{/if}
        Az utolsó mérés óta eltelt fogyasztást nem becsüljük hozzá.
      </p>
    </article>
    <article class="card stat-card forecast-card">
      <div class="stat-top">
        <h3>Várható éves fogyasztás</h3>
        <span class="stat-symbol" aria-hidden="true">⌁</span>
      </div>
      <span class="badge neutral">{basis[result.annualKind]}</span>
      <div class="stat-number">
        <span>{fmt(result.annualVolume)}</span><small>m³/év</small>
      </div>
      <p class="stat-description">
        {result.annualKind === "measured"
          ? "A kedvezményes év nyitó és záró méréséből számolt tényleges mennyiség."
          : result.annualKind === "forecast"
            ? result.annual.last?.date === result.annual.next
              ? "Az évben mért fogyasztás és a havi súlyozással becsült évkezdő rész együtt."
              : "A mért szakasz fogyasztását a havi profil alapján vetítjük ki az egész évre."
            : result.annualKind === "manual"
              ? result.manualAdjusted
                ? `A beállított éves becslés (${fmt(parseNumber(model.billing.annualEstimate))} m³) kisebb az évkezdet óta számolt fogyasztásnál. Ezért legalább az eddig követett mennyiséget mutatjuk, a becsült évkezdő résszel együtt, ha van ilyen.`
                : "Kevés a mérés, ezért a beállított éves becslést mutatjuk."
              : "Legalább 30 nap és az éves profilsúly 5%-ának megfigyelése kell."}
        {#if result.annualKind === "missing"}
          Addig megadhatsz <a href="#gas-annual-estimate">kézi éves becslést</a
          >.
        {/if}
      </p>
      <div class="forecast-track" aria-hidden="true">
        <span
          class:over-budget={(result.annualVolume ?? 0) > result.annual.annual}
          style:width={`${Math.min(100, ((result.annualVolume ?? 0) / result.annual.annual) * 100)}%`}
        ></span>
      </div>
      <p class="stat-footnote">
        {result.annualVolume === null
          ? `Éves keret: ${fmt(result.annual.annual)} m³.`
          : `${fmt((result.annualVolume / result.annual.annual) * 100)}% az éves keretből.`}
      </p>
      <p class="stat-footnote">
        {result.tracked
          ? `${result.annual.items.length} mérés, ${result.tracked.days} nap, ${fmt(result.share * 100)}% éves profilsúly. A becslés nem garantált év végi eredmény.`
          : "A mérést és a becslést külön jelöljük."}
      </p>
    </article>
    <article class="card stat-card">
      <div class="stat-top">
        <h3>A tavalyi önmagadhoz képest</h3>
        <span class="stat-symbol" aria-hidden="true">↔</span>
      </div>
      <div class="stat-number">
        <span>{fmt(result.yearChange)}</span><small>%</small>
      </div>
      <p class="stat-description">
        {result.prior && result.tracked
          ? `Idei napi átlag: ${fmt(result.tracked.average, 2)} m³; tavaly: ${fmt(result.prior.average, 2)} m³.`
          : result.tracked
            ? `Tavalyi mérés szükséges: ${result.priorStart} és ${result.priorEnd}.`
            : "Idei és tavalyi, azonos határnapokra rögzített mérőállások szükségesek."}
      </p>
      <p class="stat-footnote">
        Napi átlagok alapján, időjárási korrekció nélkül. Február 29. párja
        február 28. Nullás előzményből pozitív fogyasztásnál nincs százalékos
        osztás.
      </p>
    </article>
    <article class="card stat-card benchmark-card">
      <div class="stat-top">
        <h3>Magyar átlaghoz képest</h3>
        <span class="badge neutral">KSH · 2025</span>
      </div>
      <p class="stat-description">
        {result.annualVolume === null
          ? "A saját összevetéshez teljes éves mérés vagy jelölt éves becslés kell."
          : `Saját éves adat: ${fmt(result.annualVolume)} m³ · ${basis[result.annualKind].toLocaleLowerCase("hu")}.`}
      </p>
      <div class="benchmark-filter">
        <Select
          id="gas-benchmark-region"
          label="KSH területi összehasonlítás"
          value={model.stats.region}
          options={regions}
          oncommit={setRegion}
        />
      </div>
      <Chart
        id="gas-benchmark"
        kind="benchmark"
        unit="m³/év"
        {bars}
        label="Éves gázfogyasztás összehasonlítása"
      />
      <p class="stat-change">
        {result.nationalChange !== null
          ? `${signed(result.nationalChange)} az országos átlaghoz képest.`
          : "Országos referencia: 954 m³/év."}
      </p>
      {#if result.regionalChange !== null}<p class="stat-footnote">
          {regionLabel(model.stats.region)} átlagához képest: {signed(
            result.regionalChange,
          )}.
        </p>{/if}
      <p class="stat-footnote">
        Gázfogyasztó háztartások átlaga, eltérő lakásmérettel és
        gázhasználattal. Az éves havi átlag 12-szerese, nem hatékonysági
        minősítés.
      </p>
      <a
        class="stat-source-link"
        href={R.ksh.source}
        target="_blank"
        rel="noopener noreferrer">KSH · 2025, frissítve: 2026. 10. 30. ↗</a
      >
    </article>
    <article class="card stat-card">
      <div class="stat-top">
        <h3>Egy négyzetméterre vetítve</h3>
        <span class="stat-symbol" aria-hidden="true">m²</span>
      </div>
      <div class="stat-number">
        <span>{fmt(result.perArea?.kwh)}</span><small>kWh/m²/év</small>
      </div>
      <p class="stat-description">
        {#if model.stats.area === null}
          Add meg a <a href="#gas-stat-area">fűtött alapterületet</a>.
        {:else if result.perArea}
          {fmt(result.perArea.volume, 2)} m³/m²/év · {fmt(model.stats.area)} m².
        {:else}
          Éves mért vagy <a href="#gas-annual-estimate"
            >becsült fogyasztási adat</a
          > is szükséges.
        {/if}
      </p>
      <p class="stat-footnote">
        Az összes felhasznált gáz energiája, melegvízzel és főzéssel együtt. Nem
        energetikai tanúsítvány vagy kizárólagos fűtési hőigény.
      </p>
    </article>
    <article class="card stat-card savings-card">
      <div class="stat-top">
        <h3>Mi lenne, ha kevesebb fogyna?</h3>
        <span class="stat-symbol" aria-hidden="true">↘</span>
      </div>
      <div class="saving-heading">
        <label class="saving-label" for="gas-saving"
          >Fogyasztáscsökkentés <output for="gas-saving">{saving}%</output
          ></label
        ><Help forId="gas-saving" label="Fogyasztáscsökkentés" />
      </div>
      <input
        id="gas-saving"
        aria-describedby="gas-saving-help"
        type="range"
        min="0"
        max="100"
        step="1"
        bind:value={saving}
        onchange={() => update("savingPercent", String(saving))}
        onblur={() => update("savingPercent", String(saving))}
      />
      <div class="stat-number">
        <span>{fmt(result.savings, 0)}</span><small>Ft/év</small>
      </div>
      <p class="stat-description">
        {result.annualVolume === null
          ? "Teljes éves mérés vagy éves becslés kell."
          : `${fmt(result.annualVolume)} → ${fmt(result.reducedVolume)} m³/év.`}
      </p>
      <p class="stat-footnote">
        {result.annualCost
          ? `${money(result.annualCost.total)} → ${money(result.reducedCost!.total)}, alapdíjjal.`
          : "A beállított bruttó díjakkal számolunk."} Az ársávokat újraszámoljuk;
        az alapdíj változatlan.
      </p>
    </article>
    <article class="card stat-card">
      <div class="stat-top">
        <h3>Szokatlan változás?</h3>
        <span class="stat-symbol" aria-hidden="true">◎</span>
      </div>
      <span
        class="badge neutral"
        class:anomaly-warning={result.anomaly === "increase" ||
          result.anomaly === "new"}
        >{result.anomaly === "missing"
          ? "MÉG KEVÉS ADAT"
          : result.anomaly === "increase"
            ? "NAGYOBB NAPI ÁTLAG"
            : result.anomaly === "decrease"
              ? "KISEBB NAPI ÁTLAG"
              : result.anomaly === "new"
                ? "NULLÁRÓL INDULÓ FOGYASZTÁS"
                : "NINCS 50%-OS ELTÉRÉS"}</span
      >
      <p class="stat-description">
        {result.latest && result.previous
          ? `${fmt(result.previous.average, 2)} → ${fmt(result.latest.average, 2)} m³/nap, két egymást követő mérési szakaszon.`
          : "Legalább három mérés kell az összevetéshez."}
      </p>
      <p class="stat-footnote">
        Az 50%-os változást jelzésként kiemeljük. Időjárás, szokás vagy mérési
        hossz is okozhatja; ez nem műszaki hibadiagnózis.
      </p>
    </article>
    <article class="card stat-card equivalence-card">
      <div class="stat-top">
        <h3>Ez annyi energia, mint…</h3>
        <span class="stat-symbol" aria-hidden="true">≈</span>
      </div>
      <p class="stat-caption">
        {result.equivalence.kind === "measured"
          ? "Legutóbbi mért időszak"
          : result.equivalence.kind === "billing"
            ? "Vizsgált számlázási időszak"
            : "Egységnyi gáz, mérés hiányában példa"}: {fmt(
          result.equivalence.volume,
        )} m³.
      </p>
      <div class="equivalence-grid">
        <div>
          <strong>{fmt(result.equivalence.kwh)}</strong><span
            >kWh energiatartalom</span
          >
        </div>
        <div>
          <strong>{fmt(result.equivalence.hours)}</strong><span
            >óra egy {fmt(model.stats.heaterPower)} kW-os fűtőtesttel</span
          >
        </div>
        <div>
          <strong>{fmt(result.equivalence.usefulHeat)}</strong><span
            >kWh hasznos hő, {fmt(model.stats.efficiency, 0)}% feltételezett
            hatásfokkal</span
          >
        </div>
      </div>
      <p class="stat-footnote">
        1 kWh = 3,6 MJ. Folyamatos névleges teljesítményű üzem; az
        energia-egyenérték nem azonos villanyszámlával vagy azonos fűtési
        költséggel.
      </p>
    </article>
    <ElectricHeatingCard settings={model.settings} usage={result.equivalence} />
  </div>
</section>
