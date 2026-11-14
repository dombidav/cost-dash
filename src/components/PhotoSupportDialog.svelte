<script lang="ts">
  import { onMount } from "svelte";
  import { checkPhotoSupport, photoSupport } from "../lib/photo-support.svelte";
  const preferenceKey = "rezsipont.photos.hide-unsupported.v1";
  let dialog: HTMLDialogElement;
  let hide = $state(true);
  let preferenceError = $state("");
  onMount(() => {
    let active = true;
    void checkPhotoSupport().then(() => {
      if (!active || photoSupport.supported) return;
      try {
        if (localStorage.getItem(preferenceKey) === "true") return;
      } catch {
        /* Still explain the unavailable feature. */
      }
      dialog.showModal();
    });
    return () => {
      active = false;
    };
  });
  function dismiss() {
    try {
      localStorage.setItem(preferenceKey, String(hide));
    } catch {
      if (!preferenceError) {
        preferenceError =
          "A beállítást nem sikerült elmenteni. A Rendben gombbal bezárhatod az ablakot, de később újra megjelenhet.";
        return;
      }
    }
    dialog.close();
  }
</script>

<dialog
  bind:this={dialog}
  class="photo-dialog support-dialog"
  aria-labelledby="photo-support-title"
  oncancel={(event) => {
    event.preventDefault();
    dismiss();
  }}
>
  <h2 id="photo-support-title">Mérési képek</h2>
  <p>
    A mérési képek feltöltése a te böngésődben egyelőre nem elérhető. A
    mérőállások rögzítését és a többi funkciót továbbra is használhatod.
  </p>
  <h3>Mit tudsz tenni?</h3>
  <ul>
    <li>Használhatod az oldal minden funkcióját a képfeltöltésen kívül</li>
    <li>
      Átválthatsz másik böngészőre, pl. Mozilla Firefox-ra
      <p class="photo-transfer">
        <span aria-hidden="true">↳</span><span
          >Ebben az esetben érdemes a <a href="./dashboard.html">Dashboard</a
          >-ról exportálnod az alkalmazásba mentett adataidat, és azt betölteni
          az új böngészőben. Így onnan folytathatod ahol abba hagytad</span
        >
      </p>
    </li>
  </ul>
  <label class="photo-checkbox"
    ><input type="checkbox" bind:checked={hide} /> Ne jelenjen meg többször</label
  >
  {#if preferenceError}<p class="field-error" role="alert">
      {preferenceError}
    </p>{/if}
  <div class="photo-actions">
    <button type="button" class="primary-button" onclick={dismiss}
      >Rendben</button
    >
  </div>
</dialog>
