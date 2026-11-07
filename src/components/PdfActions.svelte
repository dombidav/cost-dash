<script lang="ts" generics="T">
  import { today } from "../calendar";
  import { READING_LIMIT } from "../lib/reading-limit";
  import { backup, restore, type Category } from "../pdf/backup";
  import type { Report } from "../pdf/report";
  import { pdfStatusMessages } from "../pdf/status";

  let {
    category,
    getData,
    report,
    parse,
    limit,
    describe,
    onrestore,
  }: {
    category: Category;
    getData: () => T;
    report: (data: T, detailed: boolean) => Report;
    parse: (data: unknown) => T | null;
    limit: (data: T) => number;
    describe: (data: T) => string;
    onrestore: (data: T) => boolean;
  } = $props();

  let input: HTMLInputElement;
  let operation = $state<"generate" | "read" | null>(null);
  let busy = $derived(operation !== null);
  let statusIndex = $state(0);
  let message = $state("");
  let error = $state("");
  let pending = $state.raw<{
    data: T;
    description: string;
    removed: number;
  } | null>(null);
  $effect(() => {
    if (!operation) return;
    statusIndex = 0;
    const timer = setInterval(() => {
      statusIndex = (statusIndex + 1) % pdfStatusMessages.length;
    }, 10_000);
    return () => clearInterval(timer);
  });

  async function download(detailed: boolean) {
    operation = "generate";
    error = message = "";
    try {
      const data = getData();
      limit(data);
      const date = today();
      const { writeReport } = await import("../pdf/write");
      const bytes = await writeReport(
        report(data, detailed),
        category,
        date,
        backup(category, data),
      );
      const url = URL.createObjectURL(
        new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      const slug = category === "gas" ? "gaz" : "aram";
      link.download = `rezsipont-${slug}-${detailed ? "statisztikak" : "fogyasztasi-naplo"}-${date}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      message = "A PDF elkészült.";
    } catch {
      error = "A PDF elkészítése nem sikerült. Próbáld meg újra.";
    } finally {
      operation = null;
    }
  }

  async function load(event: Event) {
    const field = event.currentTarget as HTMLInputElement;
    const file = field.files?.[0];
    field.value = "";
    if (!file || busy) return;
    pending = null;
    error = message = "";
    if (file.size > 50 * 1024 * 1024) {
      error = "Legfeljebb 50 MB-os PDF tölthető vissza.";
      return;
    }
    operation = "read";
    try {
      const { readBackup } = await import("../pdf/read");
      const content = await readBackup(file);
      if (!content) {
        error = "A PDF-ben nincs RezsiPont-adatcsatolmány.";
        return;
      }
      try {
        const data = restore(content, category, parse);
        const removed = limit(data);
        pending = { data, description: describe(data), removed };
      } catch (reason) {
        error = (reason as Error).message;
      }
    } catch {
      error = "A fájl nem olvasható PDF-ként.";
    } finally {
      operation = null;
    }
  }

  function apply() {
    if (!pending) return;
    if (!onrestore(pending.data)) {
      error = "A visszaállított adatokat nem sikerült helyben menteni.";
      return;
    }
    const { removed } = pending;
    pending = null;
    error = "";
    message = removed
      ? `Az adatok visszaállítása sikerült. A legrégebbi ${removed} mérés kimaradt.`
      : "Az adatok visszaállítása sikerült.";
  }
</script>

<section class="card pdf-actions" aria-label="PDF exportálás és visszaállítás">
  <h2>PDF exportálás és visszaállítás</h2>
  <p>
    Mentsd el a méréseidet PDF-ben, hogy később is visszaállíthasd őket. Az
    oldal a legutóbbi {READING_LIMIT} mérést őrzi meg.
  </p>
  <div class="actions">
    <button type="button" disabled={busy} onclick={() => download(false)}
      >Fogyasztási napló (PDF)</button
    >
    <button type="button" disabled={busy} onclick={() => download(true)}
      >Napló és statisztikák (PDF)</button
    >
    <button type="button" disabled={busy} onclick={() => input.click()}
      >Visszaállítás PDF-ből</button
    >
    <input
      hidden
      type="file"
      accept=".pdf,application/pdf"
      bind:this={input}
      onchange={load}
    />
  </div>
  {#if pending}
    <div class="restore">
      <p>
        <strong>A mentés tartalma: {pending.description}.</strong> Visszaállításkor
        a mentés lecseréli az ezen az oldalon tárolt méréseket és beállításokat.
      </p>
      {#if pending.removed}
        <p class="feedback">
          A határ miatt a mentésből a legrégebbi {pending.removed} mérés kimarad.
        </p>
      {/if}
      <div class="actions">
        <button type="button" disabled={busy} onclick={apply}
          >Adatok cseréje</button
        >
        <button
          type="button"
          onclick={() => {
            pending = null;
            error = "";
          }}>Mégse</button
        >
      </div>
    </div>
  {/if}
  {#if error}
    <p class="feedback" role="alert">{error}</p>
  {:else if operation}
    <p class="feedback">
      <strong role="status"
        >{operation === "generate"
          ? "PDF generálása folyamatban."
          : "PDF beolvasása folyamatban."}</strong
      >
      <span>{pdfStatusMessages[statusIndex]}</span>
    </p>
  {:else if message}
    <p class="feedback" role="status">{message}</p>
  {/if}
</section>

<style>
  .pdf-actions h2 {
    margin: 0 0 0.45rem;
    font-size: 1.05rem;
  }
  p {
    color: var(--muted);
    font-size: 0.875rem;
    line-height: 1.5;
    margin: 0;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
    margin-top: 0.85rem;
  }
  .actions button {
    min-height: 2.75rem;
    border: 1px solid currentColor;
    border-radius: 0.6rem;
    padding: 0.55rem 0.8rem;
    color: var(--accent);
    background: transparent;
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .actions button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }
  .actions button:disabled {
    opacity: 0.55;
    cursor: wait;
  }
  .restore {
    margin-top: 1rem;
    padding: 0.8rem;
    border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
    border-radius: 0.65rem;
  }
  .feedback {
    margin-top: 0.7rem;
  }
</style>
