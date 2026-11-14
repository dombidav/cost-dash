<script lang="ts">
  import ExpenseMetrics from "../components/ExpenseMetrics.svelte";
  import Help from "../components/Help.svelte";
  import PdfActions from "../components/PdfActions.svelte";
  import { readAppBackup, parseAppBackup, restoreAppBackup } from "./backup";
  import { dashboardReport } from "./report";
  import { ui } from "../lib/ui.svelte";
  import { today } from "../calendar";
  import { fmt, money } from "../lib/format";
  import { monthLabel } from "../lib/months";
  import { categories } from "../lib/pages";
  import DataCoverage from "./DataCoverage.svelte";
  import MonthComparison from "./MonthComparison.svelte";
  import MonthlyBudget from "./MonthlyBudget.svelte";
  import MonthlyPlan from "./MonthlyPlan.svelte";
  import UpcomingPayments from "./UpcomingPayments.svelte";
  import UtilityTrend from "./UtilityTrend.svelte";
  import {
    categoryColorProperty,
    categoryIds,
    readSources,
    reports,
    reportYears,
    summarize,
  } from "./data";

  const now = today();
  const currentMonth = now.slice(0, 7);
  const currentYear = Number(now.slice(0, 4));
  const currentIndex = String(Number(now.slice(5, 7)) - 1);
  let sources = $state.raw(readSources());
  let year = $state(currentYear);
  let monthIndex = $state(currentIndex);
  let years = $derived(reportYears(sources, now));
  let months = $derived(reports(sources, year, now));
  let budgetMonth = $derived(
    (year === currentYear ? months : reports(sources, currentYear, now)).at(
      -1,
    )!,
  );
  let showPrevious = $state(false);
  let previousMonths = $derived(
    reports(sources, year - 1, now).slice(0, months.length),
  );
  let previousAvailable = $derived(
    previousMonths.some((row) => row.total !== null),
  );
  let compareTrend = $derived(showPrevious && previousAvailable);
  let selected = $derived(
    monthIndex === "year"
      ? months
      : months.slice(Number(monthIndex), Number(monthIndex) + 1),
  );
  let summary = $derived(summarize(selected));
  let annual = $derived(summarize(months));
  let annualKnown = $derived(months.filter((row) => row.total !== null).length);
  let positiveTotal = $derived(
    summary.costs.reduce(
      (total, item) => total + Math.max(0, item.value ?? 0),
      0,
    ),
  );
  let largest = $derived(
    summary.costs.reduce<(typeof summary.costs)[number] | null>(
      (max, item) => ((item.value ?? 0) > (max?.value ?? 0) ? item : max),
      null,
    ),
  );
  let yearLabel = $derived(year === currentYear ? "Év eddig" : "Teljes év");
  let period = $derived(
    monthIndex === "year"
      ? `${year}. év${year === currentYear ? " eddig" : ""}`
      : monthLabel(selected[0]?.month ?? currentMonth),
  );
  let canvas = $state<HTMLCanvasElement>();
  let chartFailed = $state(false);
  let restoreVersion = $state(0);

  function reloadSources() {
    sources = readSources();
    if (!reportYears(sources, now).includes(year)) {
      year = currentYear;
      monthIndex = currentIndex;
    }
  }

  $effect(() => {
    if (!canvas) return;
    const target = canvas;
    const rows = months;
    const earlier = compareTrend ? previousMonths : [];
    let stopped = false;
    let dispose: (() => void) | undefined;
    void import("./chart")
      .then(({ drawMonthlyChart }) => {
        if (!stopped) {
          dispose = drawMonthlyChart(target, rows, earlier);
          chartFailed = false;
        }
      })
      .catch(() => {
        if (!stopped) chartFailed = true;
      });
    return () => {
      stopped = true;
      dispose?.();
    };
  });
</script>

<svelte:window onstorage={reloadSources} onpageshow={reloadSources} />
<div class="expense-page">
  <div class="expense-intro">
    <span class="eyebrow">DASHBOARD · KIADÁSOK EGY HELYEN</span>
    <h1>Kiadási áttekintő</h1>
    <p>
      Nézd meg, mire ment el a legtöbb, és hogyan változtak a kiadásaid hónapról
      hónapra.
    </p>
  </div>
  {#if sources.errors.length}
    <p class="notice danger" role="alert">
      Nem olvasható minden helyi adat: {sources.errors
        .map((id) => categories[id].label)
        .join(", ")}.
    </p>
  {/if}
  <section class="card" aria-labelledby="dashboard-summary">
    <h2 id="dashboard-summary">Havi és éves összesítés</h2>
    <p class="expense-subtitle">
      Válassz egy hónapot vagy az egész évet. A folyó év az aktuális hónapig
      látható.
    </p>
    <div class="expense-fields">
      <div class="field">
        <div class="field-label">
          <label for="dashboard-year">Év</label><Help
            forId="dashboard-year"
            label="Év"
            content={{
              what: "A kimutatás naptári éve.",
              where: "Az évek listája a helyben rögzített tételeidből készül.",
            }}
          />
        </div>
        <select
          id="dashboard-year"
          value={year}
          aria-describedby="dashboard-year-help"
          onchange={(event) => {
            year = Number(event.currentTarget.value);
            monthIndex = "year";
          }}
        >
          {#each years as option (option)}<option value={option}
              >{option}</option
            >{/each}
        </select>
      </div>
      <div class="field">
        <div class="field-label">
          <label for="dashboard-month">Időszak</label><Help
            forId="dashboard-month"
            label="Időszak"
            content={{
              what: "A kiemelt összeg és a kategóriák időszaka. A grafikon mindig a kiválasztott évet mutatja.",
              where: "Válassz egy hónapot vagy az egész évet.",
            }}
          />
        </div>
        <select
          id="dashboard-month"
          bind:value={monthIndex}
          aria-describedby="dashboard-month-help"
        >
          <option value="year">{yearLabel}</option>
          {#each months as row, index (row.month)}<option value={String(index)}
              >{monthLabel(row.month)}</option
            >{/each}
        </select>
      </div>
    </div>
    <ExpenseMetrics
      items={[
        {
          label: `Ismert összegek · ${period}`,
          value: summary.total === null ? "Nincs adat" : money(summary.total),
        },
        ...(monthIndex === "year"
          ? []
          : [
              {
                label: yearLabel,
                value:
                  annual.total === null ? "Nincs adat" : money(annual.total),
              },
            ]),
        {
          label: "Havi átlag az adatos hónapokban",
          value:
            annual.total === null
              ? "Nincs adat"
              : money(annual.total / annualKnown),
        },
      ]}
    />
    {#if largest?.value && positiveTotal}
      <p class="field-hint">
        A legnagyobb tétel: <strong>{categories[largest.id].label}</strong>, a
        pozitív összegek {fmt((largest.value / positiveTotal) * 100, 0)}%-a.
      </p>
    {/if}
    <DataCoverage rows={selected} />
  </section>

  <section class="card" aria-labelledby="dashboard-categories">
    <h2 id="dashboard-categories">Mire ment el? · {period}</h2>
    <p class="expense-subtitle">
      Nyisd meg a kategóriát a tételek és a beállítások megtekintéséhez.
    </p>
    <ul class="expense-list category-list">
      {#each summary.costs as item (item.id)}
        {@const info = categories[item.id]}
        {@const estimated = item.id !== "car" && item.id !== "subscriptions"}
        <li style:--category-color={`var(${categoryColorProperty(item.id)})`}>
          <div class="category-row">
            <a href={info.href}
              ><span aria-hidden="true">{info.icon}</span> {info.label}</a
            >
            <strong
              >{item.value === null ? "Nincs adat" : money(item.value)}</strong
            >
          </div>
          {#if item.value !== null}
            <p>
              {estimated
                ? "Becsült díj"
                : item.id === "car"
                  ? "Rögzített kifizetés"
                  : "Ütemezett havidíj"}{item.partial
                ? item.id === "water"
                  ? " · Részleges havi lefedettség"
                  : " · Hiányos mérőadat"
                : ""}{selected.length > 1
                ? ` · ${item.known}/${selected.length} hónap`
                : ""}
            </p>
            {#if item.value > 0 && positiveTotal > 0}
              <div class="category-track" aria-hidden="true">
                <span style:width={`${(item.value / positiveTotal) * 100}%`}
                ></span>
              </div>
            {/if}
          {/if}
        </li>
      {/each}
    </ul>
    <p class="field-hint">
      Az üres hónapokhoz nincs adat. A víz, a gáz és az áram összege a jelenlegi
      beállításokkal készült becslés. Az autó értékvesztése külön marad.
    </p>
    <details class="expense-detail">
      <summary>Hogyan számoljuk a közműdíjakat?</summary>
      <p>
        Teljes hónapot lefedő mérőállásoknál a két leolvasás közötti fogyasztást
        időarányosan osztjuk el. Számíthat a hónappal pontosan egyező megadott
        időszak, az aktuális hónapra pedig az éves fogyasztásból becsült
        részszámla is. Ha több villanyórából csak egy részükre van kiszámítható
        összeg, a kategória ezt külön jelzi.
      </p>
      <p>
        Víznél csak a leolvasásokkal lefedett napokra becsülünk díjat. Ha erre a
        hónapra korábban teljes havi fogyasztást mentettél, azt használjuk, amíg
        a leolvasások nem fedik le az egész hónapot. Ugyanazt a fogyasztást csak
        egyszer számoljuk.
      </p>
    </details>
  </section>

  {#if monthIndex !== "year" && selected[0]}
    <MonthComparison row={selected[0]} {sources} {now} />
  {/if}

  <UpcomingPayments {sources} {now} />
  <MonthlyPlan {sources} {now} />
  {#key restoreVersion}
    <MonthlyBudget row={budgetMonth} {sources} {now} />
  {/key}

  <section class="card" aria-labelledby="dashboard-trend">
    <h2 id="dashboard-trend">Havi alakulás · {year}</h2>
    <p class="expense-subtitle">
      A sávok a hónapok ismert költségeit mutatják. Az üres hónapokhoz még nincs
      használható adat.
    </p>
    {#if annualKnown}
      {#if previousAvailable}
        <div class="trend-switch">
          <label
            ><input
              type="checkbox"
              id="dashboard-previous-year"
              bind:checked={showPrevious}
              aria-describedby="dashboard-previous-year-help"
            />
            Előző év mutatása ({year - 1})</label
          >
          <Help
            forId="dashboard-previous-year"
            label="Előző év mutatása"
            content={{
              what: "Szaggatott vonal jelöli az előző év ismert havi összegeit.",
              where:
                "A havi összeg az adott hónapban elérhető kategóriákból áll össze.",
            }}
          />
        </div>
      {/if}
      {#if chartFailed}<p class="field-hint">
          A grafikon nem tölthető be. Az adatok alább táblázatban elérhetők.
        </p>{/if}
      <div
        class="trend-chart"
        role="img"
        aria-label={`${year}. évi kiadások hónaponként, kategóriák szerint${compareTrend ? `, az előző év ismert összegével (${year - 1})` : ""}`}
      >
        <canvas bind:this={canvas} aria-hidden="true"></canvas>
      </div>
      <ul class="trend-legend">
        {#each annual.costs as item (item.id)}
          {#if item.value !== null}<li>
              <span
                style:background={`var(${categoryColorProperty(item.id)})`}
                aria-hidden="true"
              ></span>{categories[item.id].label}
            </li>{/if}
        {/each}
        {#if compareTrend}
          <li>
            <span class="trend-reference" aria-hidden="true"></span>{year - 1} · ismert
            havi összeg
          </li>
        {/if}
      </ul>
      <details class="expense-detail">
        <summary>A grafikon adatai szövegesen</summary>
        <!-- svelte-ignore a11y_no_noninteractive_tabindex (A táblázat görgetőterülete billentyűzettel is elérhető.) -->
        <div
          class="trend-table"
          role="region"
          aria-label="Görgethető havi költségtáblázat"
          tabindex="0"
        >
          <table>
            <caption class="sr-only"
              >{year}. évi ismert költségek forintban</caption
            >
            <thead
              ><tr
                ><th scope="col">Hónap</th>{#each categoryIds as id (id)}<th
                    scope="col">{categories[id].label}</th
                  >{/each}<th scope="col">Összesen</th>{#if compareTrend}<th
                    scope="col">{year - 1} · összesen</th
                  >{/if}</tr
              ></thead
            >
            <tbody>
              {#each months as row, index (row.month)}
                <tr
                  ><th scope="row">{monthLabel(row.month)}</th>
                  {#each categoryIds as id (id)}
                    <td
                      >{row.costs[id].value === null
                        ? "Nincs adat"
                        : money(row.costs[id].value)}{row.costs[id].partial
                        ? " (részleges)"
                        : ""}</td
                    >
                  {/each}
                  <td>{row.total === null ? "Nincs adat" : money(row.total)}</td
                  >
                  {#if compareTrend}
                    {@const total = previousMonths[index]?.total}
                    <td>{total == null ? "Nincs adat" : money(total)}</td>
                  {/if}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </details>
    {:else}<p class="empty-state">
        A grafikon az első használható tétel után jelenik meg. A fenti
        kategórialinkekkel eljutsz a rögzítéshez.
      </p>{/if}
  </section>
  <UtilityTrend {sources} {months} {year} />
  <PdfActions
    category="dashboard"
    getData={readAppBackup}
    report={(data, detailed) =>
      dashboardReport(data, detailed, year, monthIndex)}
    parse={parseAppBackup}
    description="Teljes appmentés: minden gáz-, áram-, víz-, autó- és havidíjadat, beállítás, mentett piszkozat és a havi keret is bekerül a PDF-be. Mindkét export a teljes adatállományt menti, a kiválasztott kimutatási időszaktól függetlenül."
    logLabel="Teljes mentés (PDF)"
    detailedLabel="Teljes mentés és havi kimutatás (PDF)"
    restoreScope="a teljes app összes jelenlegi adatát és beállítását, a havi keretet is beleértve. A mentésben üres kategóriák jelenlegi adatai is törlődnek"
    describe={(saved) =>
      `${saved.gas?.readings.length ?? 0} gázmérés, ${saved.electricity?.points.length ?? 0} árammérő, ${saved.water?.readings.length ?? 0} vízóraállás, ${saved.water?.months.length ?? 0} korábbi vízhónap, ${saved.car?.cars.length ?? 0} autó, ${saved.subscriptions?.length ?? 0} havidíj és a havi keret`}
    onrestore={(saved) => {
      restoreAppBackup(saved);
      reloadSources();
      restoreVersion++;
      ui.status = "A teljes app adatai visszaállítva";
      ui.storageError = false;
      return true;
    }}
  />
</div>

<style>
  .category-list li {
    display: block;
  }
  .category-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 4px 16px;
  }
  .category-row a {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
    color: var(--category-color);
    font-weight: 650;
  }
  .category-track {
    background: var(--bg);
    height: 6px;
    margin-top: 8px;
    border-radius: 10px;
  }
  .category-track span {
    display: block;
    background: var(--category-color);
    height: 100%;
    border-radius: inherit;
  }
  .trend-chart {
    position: relative;
    height: clamp(200px, 30vw, 310px);
    width: 100%;
    overflow: hidden;
  }
  .trend-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    list-style: none;
    padding: 0;
    color: var(--muted);
  }
  .trend-legend li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .trend-legend span {
    width: 10px;
    height: 10px;
    border-radius: 3px;
  }
  .trend-legend .trend-reference {
    width: 20px;
    height: 0;
    border-top: 2px dashed var(--text);
    border-radius: 0;
  }
  .trend-switch {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }
  .trend-switch label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
  }
  .trend-switch input {
    width: 18px;
    min-height: 18px;
    accent-color: var(--accent);
  }
  .trend-table {
    overflow: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    color: var(--text);
  }
  th,
  td {
    border-bottom: 1px solid var(--border);
    padding: 8px;
    text-align: start;
    white-space: nowrap;
  }
</style>
