<script lang="ts">
  import { days, monthPeriod } from "../calendar";
  import { categories } from "../lib/pages";
  import { categoryIds, type Category, type MonthReport } from "./data";

  let { rows }: { rows: MonthReport[] } = $props();
  let count = $derived(
    categoryIds.filter((id) => rows.some((row) => row.costs[id].value !== null))
      .length,
  );

  function status(id: Category) {
    if (rows.length === 1) {
      const row = rows[0];
      const cost = row.costs[id];
      if (cost.value === null) {
        if (id === "gas")
          return "Nincs becsülhető díj. Ellenőrizd a nyitó és záró állást vagy az éves becslést.";
        if (id === "electricity")
          return "Nincs becsülhető díj. Ellenőrizd a mérőadatokat és a számlázási módot.";
        if (id === "water") return "Nincs fogyasztási adat ehhez a hónaphoz.";
        return id === "car"
          ? "Nincs rögzített kifizetés."
          : "Nincs ütemezett havidíj.";
      }
      if (cost.coveredDays !== undefined) {
        const { start, end } = monthPeriod(row.month);
        return `Becsült díj · ${cost.coveredDays}/${days(start, end)} nap adata`;
      }
      const source = cost.fromAnnualEstimate
        ? "Éves fogyasztásból becsült díj"
        : "Becsült díj";
      if (cost.meters)
        return `${source} · ${cost.meters.included}/${cost.meters.expected} mérő`;
      if (id === "gas") return source;
      return id === "car" ? "Rögzített kifizetések" : "Ütemezett havidíjak";
    }
    const known = rows.filter((row) => row.costs[id].value !== null);
    const partial = known.filter((row) => row.costs[id].partial).length;
    const annual = known.filter(
      (row) => row.costs[id].fromAnnualEstimate,
    ).length;
    return [
      `${known.length}/${rows.length} hónaphoz van összeg`,
      partial ? `${partial} hónap részleges` : "",
      annual ? `${annual} hónap éves fogyasztásból is becsült` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }
</script>

<details class="expense-detail">
  <summary
    >Adatlefedettség · {count}/{categoryIds.length} kategóriához van összeg</summary
  >
  <p class="field-hint">
    Az összesítés a rendelkezésre álló adatokból készül. A részleges hónapok
    összege csak a lefedett napokat vagy mérőket tartalmazza.
  </p>
  <ul class="expense-list coverage">
    {#each categoryIds as id (id)}
      <li>
        <a href={categories[id].href}>{categories[id].label}</a>
        <span>{status(id)}</span>
      </li>
    {/each}
  </ul>
</details>

<style>
  .coverage li {
    display: grid;
    grid-template-columns: minmax(4.75rem, 1fr) minmax(0, 4fr);
    align-items: baseline;
  }
</style>
