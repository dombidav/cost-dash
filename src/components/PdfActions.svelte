<script lang="ts" generics="T">
  import { tick } from "svelte";
  import { today } from "../calendar";
  import { READING_LIMIT } from "../lib/reading-limit";
  import {
    backup,
    backupCategories,
    restore,
    type Category,
  } from "../pdf/backup";
  import type { Report } from "../pdf/report";
  import { pdfStatusMessages } from "../pdf/status";
  import { ui } from "../lib/ui.svelte";
  import {
    collectPhotoAttachments,
    validatePhotoAttachments,
    preparePhotoRestore,
    BACKUP_MAX,
    type PhotoAttachment,
  } from "../pdf/photos";
  import { photoIds, putPhotos, deletePhotos } from "../lib/photos";

  let {
    category,
    getData,
    report,
    parse,
    limit = () => 0,
    describe,
    onrestore,
    description,
    logLabel = "Adatok (PDF)",
    detailedLabel = "Adatok és összesítés (PDF)",
    restoreScope = "az ezen az oldalon tárolt adatokat és beállításokat",
  }: {
    category: Category;
    getData: () => T;
    report: (data: T, detailed: boolean) => Report;
    parse: (data: unknown) => T | null;
    limit?: (data: T) => number;
    describe: (data: T) => string;
    onrestore: (data: T) => boolean;
    description?: string;
    logLabel?: string;
    detailedLabel?: string;
    restoreScope?: string;
  } = $props();

  let input: HTMLInputElement;
  let restoreButton: HTMLButtonElement;
  let cancelButton = $state<HTMLButtonElement>();
  let operation = $state<"generate" | "read" | "restore" | null>(null);
  let busy = $derived(operation !== null);
  let statusIndex = $state(0);
  let meterCategory = $derived(
    category === "gas" || category === "electricity",
  );
  let message = $state("");
  let error = $state("");
  let pending = $state.raw<{
    data: T;
    description: string;
    removed: number;
    current: string;
    images: PhotoAttachment[];
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
    if (busy) return;
    operation = "generate";
    error = message = "";
    try {
      const data = getData();
      limit(data);
      const date = today();
      const images = await collectPhotoAttachments(data);
      const { writeReport } = await import("../pdf/write");
      const bytes = await writeReport(
        report(data, detailed),
        category,
        date,
        backup(category, data),
        images,
      );
      if (bytes.length > BACKUP_MAX)
        throw new Error("A PDF túl nagy. Exportáld az oldalakat külön-külön.");
      const url = URL.createObjectURL(
        new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      const { slug } = backupCategories[category];
      link.download = `rezsipont-${slug}-${detailed ? "osszesites" : "adatok"}-${date}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      message = "A PDF elkészült.";
    } catch (reason) {
      error =
        reason instanceof Error
          ? reason.message
          : "A PDF elkészítése nem sikerült. Próbáld meg újra.";
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
    if (file.size > BACKUP_MAX) {
      error = "Legfeljebb 200 MB-os PDF tölthető vissza.";
      return;
    }
    operation = "read";
    try {
      const { readBackupBundle } = await import("../pdf/read");
      const bundle = await readBackupBundle(file);
      if (!bundle) {
        error = "A PDF-ben nincs RezsiPont-adatcsatolmány.";
        return;
      }
      try {
        const data = restore(bundle.content, category, parse);
        validatePhotoAttachments(data, bundle.images);
        const removed = limit(data);
        pending = {
          data,
          description: `${describe(data)}${photoIds(data).length ? `, ${photoIds(data).length} csatolt kép` : ""}`,
          removed,
          current: JSON.stringify(getData()),
          images: bundle.images,
        };
      } catch (reason) {
        error = (reason as Error).message;
      }
    } catch (reason) {
      error =
        reason instanceof Error
          ? reason.message
          : "A fájl nem olvasható PDF-ként.";
    } finally {
      operation = null;
      await tick();
      if (
        pending &&
        (document.activeElement === restoreButton ||
          document.activeElement === document.body)
      ) {
        cancelButton?.focus();
      }
    }
  }

  async function closeRestore() {
    if (busy) return;
    pending = null;
    error = "";
    await tick();
    restoreButton.focus();
  }

  async function apply() {
    if (!pending || busy) return;
    const selected = pending;
    operation = "restore";
    let importedIds: string[] = [];
    try {
      if (JSON.stringify(getData()) !== selected.current) {
        error =
          "Az adatok a PDF beolvasása óta megváltoztak. Válaszd ki újra a PDF-et a visszaállításhoz.";
        return;
      }
      const prepared = await preparePhotoRestore(
        selected.data,
        selected.images,
      );
      await putPhotos(prepared.photos);
      importedIds = prepared.photos.map((photo) => photo.id);
      if (JSON.stringify(getData()) !== selected.current)
        throw new Error(
          "Az adatok a visszaállítás közben megváltoztak. Válaszd ki újra a PDF-et.",
        );
      if (!onrestore(prepared.data))
        throw new Error(
          "A visszaállított adatokat nem sikerült helyben menteni.",
        );
      importedIds = [];
    } catch (reason) {
      if (importedIds.length) {
        // A full metadata restore can report an incomplete rollback; preserve
        // any images already referenced by the surviving data in that case.
        try {
          const referenced = new Set(photoIds(getData()));
          await deletePhotos(importedIds.filter((id) => !referenced.has(id)));
        } catch {
          /* Keep images when the surviving state cannot be inspected. */
        }
      }
      error =
        reason instanceof Error
          ? reason.message
          : "A visszaállítás nem sikerült.";
      return;
    } finally {
      operation = null;
    }
    const { removed } = selected;
    ui.undo = null;
    void closeRestore();
    message = removed
      ? `Az adatok visszaállítása sikerült. A legrégebbi ${removed} mérés kimaradt.`
      : "Az adatok visszaállítása sikerült.";
  }
</script>

<section class="card pdf-actions" aria-label="PDF exportálás és visszaállítás">
  <h2>PDF exportálás és visszaállítás</h2>
  <p>
    {description ??
      (meterCategory
        ? `Mentsd el a méréseidet PDF-ben, hogy később is visszaállíthasd őket. Az oldal a legutóbbi ${READING_LIMIT} mérést őrzi meg.`
        : "Mentsd el az adatokat és beállításokat PDF-ben, hogy később visszaállíthasd őket.")}
  </p>
  {#if category !== "subscriptions"}
    <p class="photo-backup-note">
      A csatolt képeket a PDF külön fájlcsatolmányként őrzi meg; a kimutatás
      oldalain nem jelennek meg. Visszaállításkor ismét elérhetők a naplóban.
    </p>
  {/if}
  <div class="actions">
    <button type="button" aria-disabled={busy} onclick={() => download(false)}
      >{meterCategory ? "Fogyasztási napló (PDF)" : logLabel}</button
    >
    <button type="button" aria-disabled={busy} onclick={() => download(true)}
      >{meterCategory ? "Napló és statisztikák (PDF)" : detailedLabel}</button
    >
    <button
      type="button"
      bind:this={restoreButton}
      aria-disabled={busy}
      onclick={() => {
        if (!busy) input.click();
      }}>Visszaállítás PDF-ből</button
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
      <p id={`${category}-restore-summary`}>
        <strong>A mentés tartalma: {pending.description}.</strong>
        Visszaállításkor a mentés lecseréli {restoreScope}.
      </p>
      {#if pending.removed}
        <p class="feedback">
          A határ miatt a mentésből a legrégebbi {pending.removed} mérés kimarad.
        </p>
      {/if}
      <div class="actions">
        <button
          type="button"
          bind:this={cancelButton}
          disabled={busy}
          aria-describedby={`${category}-restore-summary`}
          onclick={closeRestore}>Mégse</button
        >
        <button
          type="button"
          aria-disabled={busy}
          aria-describedby={`${category}-restore-summary`}
          onclick={apply}>Adatok cseréje</button
        >
      </div>
    </div>
  {/if}
  <p class="feedback" role="alert">{error}</p>
  <p class="feedback" role="status">
    {operation === "restore"
      ? "Adatok és képek visszaállítása folyamatban."
      : operation === "generate"
        ? "PDF generálása folyamatban."
        : operation === "read"
          ? "PDF beolvasása folyamatban."
          : pending
            ? "A PDF adatai készen állnak a visszaállításra."
            : message}
  </p>
  {#if operation}
    <p aria-hidden="true">{pdfStatusMessages[statusIndex]}</p>
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
  .actions button:hover:not([aria-disabled="true"]) {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }
  .actions button[aria-disabled="true"] {
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
  .feedback:empty {
    margin: 0;
  }
</style>
