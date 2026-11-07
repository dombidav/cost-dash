<script lang="ts">
  import Field from "../components/Field.svelte";
  import Select from "../components/Select.svelte";
  import { fmt } from "../lib/format";
  import { consumptionProfiles } from "./seasonal-profile";
  import {
    AREAS,
    TARIFFS,
    supported,
    officialRates,
    PRICE_SOURCE,
    DEFAULT_ANNUAL_ESTIMATE,
    NATIONAL_MONTHLY,
  } from "./reference";
  import type { Area, ElectricityPoint, Tariff } from "./types";

  let {
    point,
    canRemove,
    oncommit,
    ontariff,
    onremove,
  }: {
    point: ElectricityPoint;
    canRemove: boolean;
    oncommit: (key: string, value: string) => string | void;
    ontariff: (area: Area, tariff: Tariff) => void;
    onremove: () => void;
  } = $props();

  const descriptions: Record<Tariff, string> = {
    A1: "Egész nap használható áram, napszaktól független egységárral. A kedvezményes sáv felett magasabb díj érvényes.",
    A2: "Egész napos ellátás, külön csúcs- és völgyidős díjjal. A két regiszter együtt használ egy kedvezményes keretet.",
    B_BASIC:
      "Külön áramkörön, az elosztó által kapcsolt ellátás, például hőtárolós bojlerhez. Nem kizárólag éjszakai áram.",
    B_COMFORT:
      "Napi összesen 12 óra vezérelt ellátás megfelelő, külön bekötött berendezésekhez, ahol ez a tarifa elérhető.",
    H: "Külön mért, megfelelő hőszivattyúhoz. Október 15. és április 15. között korlátmentes H-díj, azon kívül eltérő elszámolás.",
    B_GEO:
      "Korábbi hőszivattyús tarifa, normál fogyasztási korlát nélkül. Kizárólag meglévő, megfelelő szerződéshez.",
    D: "Legkorábban 2027-től: a kedvezményes keretig fix, felette változó ár. A dinamikus költséghez negyedórás adatok kellenek.",
  };
  const solarOptions = [
    { value: "none", label: "Nincs napelem" },
    { value: "gross", label: "Bruttó · csak vételezési költség" },
    { value: "balance", label: "Szaldó · költség itt nem modellezhető" },
  ];
  let defaults = $derived(officialRates(point.area, point.tariff));
  let customRates = $derived(
    (Object.keys(defaults) as (keyof typeof defaults)[]).some(
      (key) => point.rates[key] !== defaults[key],
    ),
  );
  let customEligibility = $derived(
    point.eligibleFrom !== "2022-08-01" || point.eligibleTo !== "",
  );
  let supportsExtra = $derived(point.tariff === "A1" || point.tariff === "A2");
  let expanded = $state(false);
</script>

<section
  class="card point-settings"
  id="electricity-settings"
  aria-labelledby="point-settings-title"
>
  <h2 id="point-settings-title">
    <button
      class="settings-toggle"
      type="button"
      aria-expanded={expanded}
      aria-controls="electricity-settings-content"
      onclick={() => (expanded = !expanded)}
      ><span>Mérő beállításai</span><span class="toggle-meta"
        ><span class="badge neutral">{TARIFFS[point.tariff]}</span><span
          class="toggle-chevron"
          class:is-expanded={expanded}
          aria-hidden="true">＋</span
        ></span
      ></button
    >
  </h2>
  <div
    class="accordion-panel"
    class:is-expanded={expanded}
    id="electricity-settings-content"
    aria-hidden={!expanded}
    inert={!expanded}
  >
    <div class="accordion-clip">
      <div class="accordion-content">
        <p class="section-intro">
          Itt állítod be, milyen díjakkal és kedvezményekkel számoljunk ennél a
          mérőnél.
        </p>

        <div class="basic-grid">
          <Field
            id="electricity-name"
            label="Mérő neve"
            value={point.name}
            oncommit={(v) => oncommit("name", v)}
          />
          <Select
            id="electricity-area"
            label="Elosztó"
            value={point.area}
            options={Object.entries(AREAS).map(([value, area]) => ({
              value,
              label: area.label,
            }))}
            oncommit={(v) => ontariff(v as Area, point.tariff)}
          />
          <Select
            id="electricity-tariff"
            label="Tarifa"
            value={point.tariff}
            options={Object.entries(TARIFFS).map(([value, label]) => ({
              value,
              label,
              disabled: !supported(point.area, value as Tariff),
            }))}
            oncommit={(v) => ontariff(point.area, v as Tariff)}
          />
          <Field
            id="electricity-annual-estimate"
            label="Becsült éves fogyasztás"
            value={point.annualEstimate}
            unit="kWh"
            placeholder={`pl. ${DEFAULT_ANNUAL_ESTIMATE}`}
            decimal
            oncommit={(v) => oncommit("annualEstimate", v)}
          />
          {#if point.tariff !== "H"}
            <Select
              id="electricity-consumption-profile"
              label="Szezonális fogyasztási profil"
              value={point.consumptionProfile ??
                (point.tariff === "B_GEO" ? "winter" : "steady")}
              options={Object.entries(consumptionProfiles).map(
                ([value, profile]) => ({ value, label: profile.label }),
              )}
              oncommit={(v) => oncommit("consumptionProfile", v)}
            />
          {/if}
        </div>
        <p class="estimate-hint">
          Kiinduló becslés: {fmt(DEFAULT_ANNUAL_ESTIMATE, 0)} kWh/év, a
          <a
            href="https://www.ksh.gov.hu/stadat_files/kor/hu/kor0068.html"
            target="_blank"
            rel="noopener noreferrer">KSH 2025-ös háztartási átlaga</a
          >
          alapján kerekítve ({fmt(NATIONAL_MONTHLY * 12)} kWh/év).
          {#if point.tariff === "H" || point.tariff.startsWith("B_")}
            Ehhez a külön mérőhöz a saját várható éves fogyasztásodat add meg.
          {/if}
        </p>

        <div class="tariff-explanation">
          <p>{descriptions[point.tariff]}</p>
          <a href="#electricity-tariffs">Áramtarifák összehasonlítása ↗</a>
        </div>
        {#if point.tariff === "A2" || point.tariff === "H"}
          <div class="context-setting">
            {#if point.tariff === "A2"}<Field
                id="electricity-off-percent"
                label="Becsült fogyasztás völgyidőben · %"
                value={point.offPercent}
                decimal
                oncommit={(v) => oncommit("offPercent", v)}
              />
            {:else}<Field
                id="electricity-heating-percent"
                label="Éves H-fogyasztás fűtési idényben · %"
                value={point.heatingPercent}
                decimal
                oncommit={(v) => oncommit("heatingPercent", v)}
              />{/if}
            <p class="field-hint">
              {point.tariff === "H"
                ? "Ezzel az aránnyal osztjuk el a becsült fogyasztást a fűtési idény és az év többi része között."
                : "Ezt az arányt akkor használjuk a becsléshez, ha nincs mért megoszlás a két regiszter között."}
            </p>
          </div>
        {/if}

        <div class="rate-overview">
          <div class="rate-heading">
            <h3>Ezekkel a díjakkal számolunk</h3>
            <span class="badge neutral"
              >{customRates ? "EGYÉNI DÍJAK" : "HIVATALOS ALAPÉRTÉKEK"}</span
            >
          </div>
          <dl class="rate-values">
            <div>
              <dt>
                {point.tariff === "A2"
                  ? "Csúcs · kedvezményes"
                  : point.tariff === "H"
                    ? "Fűtési idényben"
                    : "Kedvezményes"}
              </dt>
              <dd>{fmt(point.rates.low, 3)} <small>Ft/kWh</small></dd>
            </div>
            {#if point.tariff === "A2" || point.tariff === "H"}<div>
                <dt>
                  {point.tariff === "A2"
                    ? "Völgy · kedvezményes"
                    : "Idényen kívül · kedvezményes"}
                </dt>
                <dd>{fmt(point.rates.second, 3)} <small>Ft/kWh</small></dd>
              </div>{/if}
            {#if point.tariff !== "B_GEO"}<div>
                <dt>Keret felett</dt>
                <dd>
                  {point.tariff === "D"
                    ? "Változó ár"
                    : fmt(point.rates.market, 3)}{#if point.tariff !== "D"}
                    <small>Ft/kWh</small>{/if}
                </dd>
              </div>{/if}
            <div>
              <dt>Alapdíj</dt>
              <dd>{fmt(point.rates.monthlyBase, 3)} <small>Ft/hó</small></dd>
            </div>
          </dl>
          <p class="field-hint">
            Bruttó díjak, áfával és kWh-alapú rendszerhasználattal. Érvényesség: {point
              .rates.effective}.
          </p>
          <details class="settings-disclosure rate-editor">
            <summary
              ><span>Díjak módosítása</span><span
                class="disclosure-mark"
                aria-hidden="true">＋</span
              ></summary
            >
            <p class="field-hint">
              A számlád szerinti bruttó díjakat add meg. Elosztó- vagy
              tarifaváltáskor újra a hivatalos alapárak töltődnek be.
            </p>
            <div class="advanced-grid">
              <Field
                id="electricity-low"
                label={point.tariff === "H"
                  ? "H-idény bruttó díja · Ft/kWh"
                  : point.tariff === "A2"
                    ? "Csúcs kedvezményes díj · Ft/kWh"
                    : "Kedvezményes bruttó díj · Ft/kWh"}
                value={point.rates.low}
                decimal
                oncommit={(v) => oncommit("low", v)}
              />
              {#if point.tariff === "A2" || point.tariff === "H"}<Field
                  id="electricity-second"
                  label={point.tariff === "H"
                    ? "Idényen kívüli kedvezményes díj · Ft/kWh"
                    : "Völgy kedvezményes díj · Ft/kWh"}
                  value={point.rates.second}
                  decimal
                  oncommit={(v) => oncommit("second", v)}
                />{/if}
              {#if point.tariff !== "D" && point.tariff !== "B_GEO"}<Field
                  id="electricity-market"
                  label="Keret feletti bruttó díj · Ft/kWh"
                  value={point.rates.market}
                  decimal
                  oncommit={(v) => oncommit("market", v)}
                />{/if}
              <Field
                id="electricity-fixed"
                label="Erre a pontra számolandó alapdíj · Ft/hó"
                value={point.rates.monthlyBase}
                decimal
                oncommit={(v) => oncommit("monthlyBase", v)}
              />
              <Field
                id="electricity-effective"
                label="Díjak érvényessége ettől"
                value={point.rates.effective}
                oncommit={(v) => oncommit("effective", v)}
              />
            </div>
            <p class="field-hint">
              Megosztott csatlakozásnál az alapdíj 0 is lehet, ha másik pontnál
              már beleszámoltad. A megadott árakat az egész vizsgált időszakra
              használjuk; történeti díjváltást nem rekonstruálunk.
            </p>
            <div class="rate-actions">
              <button
                class="text-button"
                type="button"
                onclick={() => ontariff(point.area, point.tariff)}
                >Hivatalos díjak visszatöltése ↗</button
              ><a href={PRICE_SOURCE} target="_blank" rel="noopener noreferrer"
                >MVM díjtábla · ellenőrizve: 2026. 11. 06. ↗</a
              >
            </div>
          </details>
        </div>

        <div class="special-settings">
          <h3>Valamelyik vonatkozik rád?</h3>
          <p class="field-hint">
            Csak akkor nyisd meg, ha szükséges. A már megadott beállítás a rész
            összecsukása után is érvényes marad.
          </p>
          <details
            class="settings-disclosure special-case"
            id="electricity-contract-settings"
          >
            <summary
              ><span class="case-copy"
                ><strong>Év közben indult vagy megszűnt a szerződésem</strong
                ><small
                  >{point.eligibleFrom}-től{point.eligibleTo
                    ? ` ${point.eligibleTo}-ig (kizáró)`
                    : ", záró dátum nélkül"}</small
                ></span
              ><span class="case-status"
                >{customEligibility ? "Egyedi időszak" : "Folyamatos"}<span
                  class="disclosure-mark"
                  aria-hidden="true">＋</span
                ></span
              ></summary
            >
            <p class="field-hint">
              Alapesetben folyamatos lakossági jogosultságot feltételezünk
              2022-08-01 óta. Új szerződésnél vagy átírásnál javítsd a saját
              kezdőnapodra; a keret időarányos lesz.
            </p>
            <div class="advanced-grid">
              <Field
                id="electricity-eligible-from"
                label="Lakossági jogosultság kezdete"
                value={point.eligibleFrom}
                oncommit={(v) => oncommit("eligibleFrom", v)}
              /><Field
                id="electricity-eligible-to"
                label="Jogosultság vége · kizáró, ha van"
                value={point.eligibleTo}
                placeholder="Nem kötelező"
                oncommit={(v) => oncommit("eligibleTo", v)}
              />
            </div>
          </details>
          <details
            class="settings-disclosure special-case"
            id="electricity-solar-settings"
          >
            <summary
              ><span class="case-copy"
                ><strong>Van napelemem</strong><small
                  >Hálózati vételezés és elszámolás</small
                ></span
              ><span class="case-status"
                >{point.solar === "gross"
                  ? "Bruttó"
                  : point.solar === "balance"
                    ? "Szaldó"
                    : "Nincs"}<span class="disclosure-mark" aria-hidden="true"
                  >＋</span
                ></span
              ></summary
            >
            <div class="advanced-grid">
              <Select
                id="electricity-solar"
                label="Napelem elszámolása"
                value={point.solar}
                options={solarOptions}
                oncommit={(v) => {
                  oncommit("solar", v);
                }}
              />
            </div>
            <p class="field-hint">
              Bruttó elszámolásnál a hálózatból vételezett energia költségét
              számoljuk, a visszatáplálást nem vonjuk le. Szaldós elszámoláshoz
              ez a költségmodell nem ad teljes összeget.
            </p>
          </details>
          {#if supportsExtra}<details
              class="settings-disclosure special-case"
              id="electricity-extra-settings"
            >
              <summary
                ><span class="case-copy"
                  ><strong>Igazolt többletkedvezményem van</strong><small
                    >Szolgáltató által jóváhagyott A1/A2-keret</small
                  ></span
                ><span class="case-status"
                  >{point.extraAnnual > 0
                    ? `+${fmt(point.extraAnnual)} kWh/év`
                    : "Nincs"}<span class="disclosure-mark" aria-hidden="true"
                    >＋</span
                  ></span
                ></summary
              >
              <p class="field-hint">
                Csak a szolgáltató által visszaigazolt éves mennyiséget add meg.
                Ha nincs ilyen jogosultságod, maradjon 0; személyes egészségügyi
                adat nem szükséges.
              </p>
              <div class="advanced-grid">
                <Field
                  id="electricity-extra"
                  label="Igazolt éves A-többletkeret · kWh"
                  value={point.extraAnnual}
                  decimal
                  oncommit={(v) => oncommit("extraAnnual", v)}
                /><Field
                  id="electricity-extra-from"
                  label="Többletkeret érvényes ettől"
                  value={point.extraFrom}
                  oncommit={(v) => oncommit("extraFrom", v)}
                /><Field
                  id="electricity-extra-to"
                  label="Többletkeret vége · kizáró, ha van"
                  value={point.extraTo}
                  placeholder="Nem kötelező"
                  oncommit={(v) => oncommit("extraTo", v)}
                />
              </div>
            </details>{/if}
        </div>

        <div class="point-management">
          <p>
            {canRemove
              ? "A mérő eltávolításával a hozzá tartozó méréseket is törlöd."
              : "Ez az egyetlen mérőd. Az eltávolításhoz előbb vegyél fel egy másikat."}
          </p>
          <button
            class="text-button danger-text"
            type="button"
            onclick={onremove}
            disabled={!canRemove}>Mérési pont eltávolítása</button
          >
        </div>
      </div>
    </div>
  </div>
</section>

<style>
  .point-settings {
    margin-bottom: 18px;
    padding-block: 0;
  }
  .settings-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    width: 100%;
    min-height: 72px;
    padding: 18px 0;
    border: 0;
    background: none;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .toggle-meta {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: none;
  }
  .toggle-chevron {
    display: inline-block;
    color: var(--accent);
    font-size: 20px;
    line-height: 1;
    transition: transform 0.28s ease;
  }
  .toggle-chevron.is-expanded {
    transform: rotate(45deg);
  }
  .accordion-panel {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.28s ease;
  }
  .accordion-panel.is-expanded {
    grid-template-rows: 1fr;
  }
  .accordion-clip {
    min-height: 0;
    overflow: hidden;
    visibility: hidden;
    transition: visibility 0s 0.28s;
  }
  .is-expanded > .accordion-clip {
    visibility: visible;
    transition-delay: 0s;
  }
  .accordion-content {
    padding-bottom: 24px;
  }
  .estimate-hint {
    font-size: 10px;
    color: var(--muted);
    line-height: 1.8;
    margin: 12px 0 0;
  }
  .estimate-hint a {
    color: var(--accent);
    text-underline-offset: 3px;
  }
  .basic-grid,
  .advanced-grid {
    display: grid;
    gap: 16px;
    min-width: 0;
  }
  .tariff-explanation {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 18px 0 24px;
    padding-left: 12px;
    border-left: 2px solid rgb(var(--accent-rgb) / 0.4);
  }
  .tariff-explanation p {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.8;
  }
  .tariff-explanation a,
  .rate-actions a {
    color: var(--accent);
    font-size: 11px;
    text-underline-offset: 3px;
  }
  .context-setting {
    max-width: 450px;
    margin-bottom: 24px;
  }
  .rate-overview {
    padding: 20px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: #11181455;
  }
  .rate-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  h3 {
    margin: 0;
    font-size: 13px;
    font-weight: 550;
  }
  .rate-values {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
    margin: 22px 0 14px;
  }
  .rate-values dt {
    font-size: 10px;
    color: var(--muted);
    margin-bottom: 6px;
  }
  .rate-values dd {
    font-size: 19px;
    line-height: 1.3;
    margin: 0;
    font-variant-numeric: tabular-nums;
    color: var(--text);
  }
  .rate-values small {
    font-size: 10px;
    color: var(--muted);
    white-space: nowrap;
    margin-left: 4px;
  }
  .settings-disclosure > summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    list-style: none;
    cursor: pointer;
    min-height: 48px;
    font-size: 12px;
  }
  .settings-disclosure > summary::-webkit-details-marker {
    display: none;
  }
  .disclosure-mark {
    display: inline-block;
    flex: none;
    font-size: 17px;
    color: var(--accent);
    line-height: 1;
  }
  .settings-disclosure[open] > summary .disclosure-mark {
    transform: rotate(45deg);
  }
  .settings-disclosure .advanced-grid {
    padding-bottom: 8px;
  }
  .rate-editor {
    border-top: 1px solid var(--border);
    margin-top: 18px;
  }
  .rate-editor > summary {
    color: var(--accent);
  }
  .rate-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .special-settings {
    margin-top: 26px;
  }
  .special-settings > .field-hint {
    margin: 7px 0 16px;
    line-height: 1.8;
  }
  .special-case {
    border-top: 1px solid var(--border);
  }
  .special-case > summary {
    min-height: 76px;
    padding-block: 14px;
  }
  .case-copy {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }
  .case-copy strong {
    font-size: 12px;
    font-weight: 500;
    color: var(--text);
    line-height: 1.6;
  }
  .case-copy small {
    font-size: 10px;
    color: var(--muted);
    line-height: 1.6;
  }
  .case-status {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 16px;
    font-size: 10px;
    color: var(--accent);
    text-align: right;
    flex: none;
  }
  .special-case > .advanced-grid {
    margin-top: 12px;
  }
  .point-management {
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: flex-start;
    border-top: 1px solid var(--border);
    padding-top: 18px;
    margin-top: 16px;
  }
  .point-management p {
    margin: 0;
    color: var(--muted);
    font-size: 10px;
    line-height: 1.8;
  }
  .point-management button {
    font-size: 10px;
    white-space: nowrap;
  }
  @media (min-width: 600px) {
    .basic-grid,
    .advanced-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .rate-values {
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    }
    .point-management {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      gap: 24px;
    }
    .tariff-explanation {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }
    .tariff-explanation a {
      flex: none;
    }
  }
  @media (min-width: 1100px) {
    .basic-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .advanced-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  @media (max-width: 599px) {
    .rate-overview {
      padding: 16px;
    }
    .rate-heading .badge {
      font-size: 7px;
    }
    .case-status {
      gap: 10px;
      flex-shrink: 1;
      min-width: 65px;
      font-size: 9px;
    }
    .case-copy {
      flex: 1;
    }
    .rate-values dd {
      font-size: 17px;
    }
  }
  @media (max-width: 599px) {
    .settings-toggle {
      font-size: 13px;
      gap: 8px;
    }
    .toggle-meta {
      gap: 10px;
    }
    .toggle-meta .badge {
      font-size: 7px;
      max-width: 105px;
      white-space: normal;
      line-height: 1.5;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .accordion-panel,
    .accordion-clip,
    .toggle-chevron {
      transition: none;
    }
  }
</style>
