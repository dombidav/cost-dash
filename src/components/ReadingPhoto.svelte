<script lang="ts">
  import { onMount, tick } from "svelte";
  import type Cropper from "cropperjs";
  import { photoSupport, checkPhotoSupport } from "../lib/photo-support.svelte";
  import {
    getPhoto,
    optimizePhoto,
    PHOTO_INPUT_MAX,
    PHOTO_PIXEL_MAX,
    PHOTO_TARGET,
    type Photo,
  } from "../lib/photos";
  let {
    photoId,
    value = $bindable<Photo | null>(null),
    oncommit,
    label = "Mérési kép",
  }: {
    photoId?: string;
    value?: Photo | null;
    oncommit?: (photo: Photo | null) => Promise<void>;
    label?: string;
  } = $props();
  const id = $props.id();
  let fileInput = $state<HTMLInputElement>();
  let editor: HTMLDialogElement;
  let viewer: HTMLDialogElement;
  let host: HTMLDivElement;
  let cropper: Cropper | undefined;
  let sourceUrl = "";
  let preview = $state("");
  let full = $state("");
  let error = $state("");
  let editorError = $state("");
  let busy = $state(false);
  let ready = $state(false);
  let active = true;
  onMount(() => {
    void checkPhotoSupport();
    return () => {
      active = false;
      releaseEditor();
      if (full) URL.revokeObjectURL(full);
    };
  });
  $effect(() => {
    const selected = value;
    const selectedId = photoId;
    let cancelled = false;
    let url = "";
    preview = "";
    error = "";
    if (selected || selectedId) {
      void (
        selected
          ? Promise.resolve(selected.thumbnail)
          : getPhoto(selectedId!, true)
      )
        .then((blob) => {
          if (cancelled) return;
          url = URL.createObjectURL(blob);
          preview = url;
        })
        .catch((reason) => {
          if (!cancelled)
            error =
              reason instanceof Error
                ? reason.message
                : "A kép nem tölthető be.";
        });
    }
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  });
  function releaseEditor() {
    cropper = undefined;
    // Cropper owns the children of this otherwise empty host.
    // eslint-disable-next-line svelte/no-dom-manipulating
    host?.replaceChildren();
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = "";
    ready = false;
  }
  function closeEditor() {
    if (busy) return;
    editor.close();
    releaseEditor();
  }
  async function choose(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file || busy) return;
    error = "";
    if (file.size > PHOTO_INPUT_MAX) {
      error = "Legfeljebb 15 MB-os képet választhatsz.";
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      error =
        "JPG-, PNG- vagy WebP-képet válassz. Más formátumot előbb alakíts át ezek egyikére.";
      return;
    }
    releaseEditor();
    busy = true;
    editorError = "";
    try {
      sourceUrl = URL.createObjectURL(file);
      const image = new Image();
      image.src = sourceUrl;
      image.alt = "A kivágandó eredeti kép";
      await image.decode();
      if (!active) return;
      if (image.naturalWidth * image.naturalHeight > PHOTO_PIXEL_MAX)
        throw new Error("Legfeljebb 50 megapixeles képet választhatsz.");
      const { default: Cropper } = await import("cropperjs");
      if (!active) return;
      editor.showModal();
      await tick();
      // eslint-disable-next-line svelte/no-dom-manipulating
      host.append(image);
      cropper = new Cropper(image, { container: host });
      const cropperImage = cropper.getCropperImage();
      if (!cropperImage) throw new Error("A képszerkesztő nem indítható el.");
      await cropperImage.$ready();
      cropperImage.rotatable = true;
      cropperImage.$center("contain");
      const selection = cropper.getCropperSelection();
      if (selection) {
        selection.aspectRatio = NaN;
        selectFullImage();
      }
      ready = true;
    } catch (reason) {
      error =
        reason instanceof Error
          ? reason.message
          : "A képet nem sikerült megnyitni.";
      editor.close();
      releaseEditor();
    } finally {
      busy = false;
    }
  }
  function selectFullImage() {
    const canvas = cropper?.getCropperCanvas()?.getBoundingClientRect();
    const image = cropper?.getCropperImage()?.getBoundingClientRect();
    if (canvas && image)
      cropper
        ?.getCropperSelection()
        ?.$change(
          image.left - canvas.left,
          image.top - canvas.top,
          image.width,
          image.height,
        );
  }
  async function save() {
    if (!ready || busy || !cropper) return;
    busy = true;
    editorError = "";
    try {
      const selection = cropper.getCropperSelection();
      const image = cropper.getCropperImage();
      if (!selection || !image || selection.width < 1 || selection.height < 1)
        throw new Error("Jelöld ki a megtartandó képrészt.");
      const [a, b] = image.$getTransform();
      const scale = Math.hypot(a, b);
      const long = Math.min(
        1600,
        Math.max(selection.width, selection.height) / scale,
      );
      const ratio = long / Math.max(selection.width, selection.height);
      const canvas = await selection.$toCanvas({
        width: Math.max(1, Math.round(selection.width * ratio)),
        height: Math.max(1, Math.round(selection.height * ratio)),
      });
      let photo: Photo;
      try {
        photo = await optimizePhoto(canvas);
      } finally {
        canvas.width = canvas.height = 0;
      }
      if (oncommit) await oncommit(photo);
      else value = photo;
      editor.close();
      releaseEditor();
    } catch (reason) {
      editorError =
        reason instanceof Error ? reason.message : "A kép mentése sikertelen.";
    } finally {
      busy = false;
    }
  }
  async function remove() {
    busy = true;
    error = "";
    try {
      if (oncommit) await oncommit(null);
      else value = null;
    } catch (reason) {
      error =
        reason instanceof Error ? reason.message : "A kép törlése sikertelen.";
    } finally {
      busy = false;
    }
  }
  async function view() {
    busy = true;
    error = "";
    try {
      const blob = value?.image ?? (await getPhoto(photoId!));
      if (full) URL.revokeObjectURL(full);
      full = URL.createObjectURL(blob);
      viewer.showModal();
    } catch (reason) {
      error =
        reason instanceof Error ? reason.message : "A kép nem tölthető be.";
    } finally {
      busy = false;
    }
  }
</script>

<div class="reading-photo" aria-busy={busy}>
  {#if preview}<button
      type="button"
      class="photo-thumb"
      aria-label={`${label} megnyitása`}
      onclick={view}
      disabled={busy}
      ><img
        src={preview}
        alt={label}
        width="80"
        height="64"
        loading="lazy"
      /></button
    >{/if}
  {#if photoSupport.supported}
    <input
      bind:this={fileInput}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      hidden
      onchange={choose}
    />
    <button
      type="button"
      class="text-button"
      onclick={() => fileInput?.click()}
      disabled={busy}
      >{photoId || value ? "Kép cseréje" : "Kép csatolása"}</button
    >
  {/if}
  {#if photoId || value}<button
      type="button"
      class="text-button"
      onclick={remove}
      disabled={busy}>Kép eltávolítása</button
    >{/if}
  {#if value}<small
      >{Math.ceil(value.image.size / 1000)} kB · {value.image.size >
      PHOTO_TARGET
        ? "Az olvashatóság megőrzéséhez nagyobb kép készült."
        : "Mentésre előkészítve"}</small
    >{/if}
  {#if error}<p class="field-error" role="alert">{error}</p>{/if}
</div>

<dialog
  bind:this={editor}
  class="photo-dialog photo-editor"
  aria-labelledby={`${id}-title`}
  oncancel={(event) => {
    event.preventDefault();
    closeEditor();
  }}
>
  <h2 id={`${id}-title`}>Kép vágása és forgatása</h2>
  <p>
    Jelöld ki a fontos részt. A mérőállás vagy a bizonylat adatai maradjanak
    olvashatók.
  </p>
  <div class="photo-crop-host" bind:this={host}></div>
  <div class="photo-actions">
    <button
      type="button"
      disabled={!ready || busy}
      onclick={() => cropper?.getCropperImage()?.$rotate("-90deg")}
      >↶ Balra 90°</button
    >
    <button
      type="button"
      disabled={!ready || busy}
      onclick={() => cropper?.getCropperImage()?.$rotate("90deg")}
      >↷ Jobbra 90°</button
    >
    <button
      type="button"
      disabled={!ready || busy}
      onclick={() => {
        cropper?.getCropperImage()?.$resetTransform().$center("contain");
        selectFullImage();
      }}>Visszaállítás</button
    >
  </div>
  <p class="field-hint">
    Az eredeti képből dolgozunk. Mentéskor optimalizált WebP és bélyegkép
    készül; az eredetit nem tároljuk.
  </p>
  {#if editorError}<p class="field-error" role="alert">{editorError}</p>{/if}
  <div class="photo-actions">
    <button type="button" onclick={closeEditor} disabled={busy}>Mégse</button
    ><button
      type="button"
      class="primary-button"
      onclick={save}
      disabled={!ready || busy}
      >{busy ? "Kép feldolgozása…" : "Kép használata"}</button
    >
  </div>
</dialog>
<dialog
  bind:this={viewer}
  class="photo-dialog photo-viewer"
  aria-label={label}
  onclose={() => {
    if (full) URL.revokeObjectURL(full);
    full = "";
  }}
>
  <div class="photo-actions">
    <button type="button" onclick={() => viewer.close()}>Bezárás</button>
  </div>
  {#if full}<img src={full} alt={label} />{/if}
</dialog>
