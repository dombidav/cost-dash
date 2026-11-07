<script lang="ts">
  import { fmt } from "../lib/format";
  import type { Area, Tariff } from "./types";
  import {
    AREAS,
    officialRates,
    PRICE_SOURCE,
    supported,
    TARIFFS,
  } from "./reference";
  let { active, area }: { active: Tariff; area: Area } = $props();
  const tariffs: {
    key: Tariff;
    use: string;
    restriction: string;
    pro: string;
    con: string;
  }[] = [
    {
      key: "A1",
      use: "Világításhoz, konnektorokhoz és háztartási készülékekhez.",
      restriction: "Nincs külön készülékkorlát.",
      pro: "Egész nap elérhető, napszaktól független árral.",
      con: "A kedvezményes keret felett magasabb az egységár.",
    },
    {
      key: "A2",
      use: "Háztartási fogyasztáshoz, ha a nagyobb terhelést át tudod tenni völgyidőre.",
      restriction:
        "Kétzónás mérés kell. A1 mellé kiépített külön A2-körön csak villanyautót szabad tölteni.",
      pro: "Egész napos ellátás, völgyidőben olcsóbb áram.",
      con: "Csúcsidőben drágább. A két zónának egy közös kerete van.",
    },
    {
      key: "B_BASIC",
      use: "Fixen bekötött, szakaszosan is biztonságos készülékhez, például tárolós bojlerhez.",
      restriction:
        "Konnektoros vagy folyamatos ellátást igénylő készülékhez tilos.",
      pro: "Kedvezőbb ár és a nappali mérőtől külön keret.",
      con: "Az elosztó kapcsolja, naponta összesen legalább 8 órára.",
    },
    {
      key: "B_COMFORT",
      use: "Hosszabb felfűtést igénylő, fixen bekötött készülékhez.",
      restriction:
        "Konnektoros vagy folyamatos ellátást igénylő készülékhez tilos.",
      pro: "Naponta összesen legalább 12 óra ellátás.",
      con: "Csak az MVM Démász területén érhető el, külön mérés és vezérlés kell.",
    },
    {
      key: "H",
      use: "Jóváhagyott hőszivattyúhoz vagy megújuló hőt hasznosító rendszerhez, külön mérőn.",
      restriction:
        "Sima villanyradiátorhoz, konnektorhoz és más háztartási fogyasztóhoz tilos.",
      pro: "Október 15. és április 15. között egész napos kedvezmény, fogyasztási korlát nélkül.",
      con: "Külön bekötés kell. Idényen kívül eltérő díj és időarányos keret érvényes.",
    },
    {
      key: "B_GEO",
      use: "A meglévő B GEO-szerződésben szereplő hőszivattyúhoz.",
      restriction: "Más készüléket tilos rákötni. Új szerződés nem köthető.",
      pro: "Lakossági használatnál a teljes fogyasztás kedvezményes.",
      con: "Vezérelt ellátás. Hőszivattyúcsere vagy bővítés esetén tarifát kell váltani.",
    },
    {
      key: "D",
      use: "Időzíthető fogyasztáshoz, távleolvasott, havi idősoros A1-es mérőn.",
      restriction:
        "Vezérelt mérőre, előre fizetős mérőhöz és szaldós napelem mellé nem választható.",
      pro: "A keretig fix kedvezményes ár. Felette olcsóbb időszakokra időzíthetsz.",
      con: "A keret feletti ár negyedóránként változhat és magas is lehet.",
    },
  ];
  let availableTariffs = $derived(
    tariffs.filter(({ key }) => supported(area, key)),
  );
</script>

<section
  class="comparison-section tariff-guide"
  id="electricity-tariffs"
  aria-labelledby="tariff-guide-title"
>
  <div class="eyebrow">
    <span class="tiny-line"></span>ISMERD MEG AZ ÁRSZABÁSOD
  </div>
  <h2 id="tariff-guide-title">Áramtarifák összehasonlítása</h2>
  <p class="comparison-intro">
    Hasonlítsd össze, melyik tarifához milyen készüléket köthetsz, mikor kapsz
    áramot, és milyen kedvezmény jár. A saját tarifádat a számla részletezőjén
    találod.
  </p>
  <div class="tariff-grid">
    {#each tariffs as tariff (tariff.key)}<article
        class="card tariff-card"
        class:is-selected={active === tariff.key}
      >
        <div class="card-heading">
          <h3>{TARIFFS[tariff.key]}</h3>
          {#if active === tariff.key}<span class="badge"
              >AKTÍV MÉRŐ TARIFÁJA</span
            >{/if}
        </div>
        <dl>
          <dt>Mire való?</dt>
          <dd>{tariff.use}</dd>
          <dt class="tariff-restriction">Mire tilos használni?</dt>
          <dd>{tariff.restriction}</dd>
          <dt>Előny</dt>
          <dd>{tariff.pro}</dd>
          <dt>Hátrány</dt>
          <dd>{tariff.con}</dd>
        </dl>
      </article>{/each}
  </div>
  <details class="card tariff-prices">
    <summary>Egységárak az aktív mérő elosztói területén</summary>
    <p>
      {AREAS[area].label} · A kalkulátor bruttó alapértékei Ft/kWh-ban. A saját mérőd
      díjait a beállításoknál találod.
    </p>
    <dl>
      {#each availableTariffs as { key } (key)}
        {@const rates = officialRates(area, key)}
        <div>
          <dt>{TARIFFS[key]}</dt>
          <dd>
            {#if key === "H"}
              Fűtési idényben {fmt(rates.low, 3)} · idényen kívül kedvezményesen {fmt(
                rates.second,
                3,
              )}
            {:else if key === "A2"}
              Kedvezményes csúcs {fmt(rates.low, 3)} · völgy {fmt(
                rates.second,
                3,
              )}
            {:else}
              Kedvezményes {fmt(rates.low, 3)}
            {/if}
            {#if key !== "B_GEO"}
              · keret felett {rates.market === null
                ? "változó ár"
                : fmt(rates.market, 3)}
            {/if}
          </dd>
        </div>
      {/each}
    </dl>
  </details>
  <div class="comparison-footnote">
    <span class="info-icon" aria-hidden="true">i</span>
    <p>
      A normál keret mérési pontonként 2523 kWh egy teljes kedvezményes évre
      (augusztus 1. – július 31.). A külön nappali és vezérelt mérő kerete nem
      vonható össze. Tarifaváltásról egyeztess a szolgáltatóddal.
    </p>
  </div>
  <p class="tariff-sources">
    Hivatalos források · <a
      href="https://www.mvmnext.hu/aram/servlet/download?id=16548&type=file"
      target="_blank"
      rel="noopener noreferrer">MVM tarifafeltételek ↗</a
    >
    ·
    <a
      href="https://www.mvmnext.hu/lakossagirezsi/gyakorikerdesek-aram"
      target="_blank"
      rel="noopener noreferrer">Keretek, H és B GEO ↗</a
    >
    ·
    <a
      href="https://www.mvmnext.hu/ee/egyetemes-szolgaltatas/szolgaltatasok/villamos-energia/villamos-energia-tarifak/b-alap"
      target="_blank"
      rel="noopener noreferrer">B alap feltételei ↗</a
    >
    ·
    <a
      href="https://www.mvmnext.hu/aram/pages/aloldal.jsp?id=16455107"
      target="_blank"
      rel="noopener noreferrer">D tarifa ↗</a
    >
    ·
    <a href={PRICE_SOURCE} target="_blank" rel="noopener noreferrer"
      >Bruttó díjtábla ↗</a
    >
  </p>
</section>

<style>
  .tariff-prices {
    margin-top: 12px;
    padding: 8px 16px;
    overflow-wrap: anywhere;
  }
  summary {
    cursor: pointer;
    min-height: 32px;
    padding-block: 6px;
    font-weight: 600;
  }
  .tariff-prices p,
  .tariff-prices dd {
    color: var(--muted);
  }
  .tariff-prices dl {
    margin: 0 0 8px;
  }
  .tariff-prices dl > div {
    border-top: 1px solid var(--border);
    padding: 8px 0;
  }
  .tariff-prices dt {
    font-weight: 600;
  }
  .tariff-prices dd {
    margin: 2px 0 0;
  }
</style>
