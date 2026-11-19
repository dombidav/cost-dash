<script lang="ts">
  import icon from "../../dashboard.svg";
  import { installApp, updateApp, pwa } from "../lib/pwa.svelte";
</script>

{#if pwa.supported && !pwa.installed}
  <section class="install-app" aria-labelledby="install-title">
    <img src={icon} width="64" height="64" alt="" />
    <div class="install-copy">
      <h2 id="install-title">
        Telepítsd az alkalmazást és használd teljesen offline
      </h2>
      <p>
        Kalkulátorok, grafikonok, fotók és PDF-mentések internet nélkül is. A
        meglévő adataid és beállításaid a telepítés után is megmaradnak.
      </p>
      <p class="install-status" role="status">
        {#if pwa.error}
          {pwa.error}
        {:else if !pwa.offlineReady}
          Az offline csomag letöltése folyamatban…
        {:else if !pwa.canInstall && !pwa.installing}
          Az offline csomag kész. A telepítést a böngésző menüjéből vagy a
          címsor telepítés ikonjával is elindíthatod, ha a böngésző felajánlja.
        {:else}
          Az offline csomag kész. Telepítés után azonnal használhatod.
        {/if}
      </p>
    </div>
    {#if pwa.canInstall || !pwa.offlineReady || pwa.installing}
      <button
        type="button"
        onclick={installApp}
        disabled={!pwa.offlineReady || !pwa.canInstall || pwa.installing}
      >
        {pwa.installing
          ? "Telepítés…"
          : pwa.offlineReady
            ? "Alkalmazás telepítése"
            : "Letöltés…"}
      </button>
    {/if}
  </section>
{/if}
{#if pwa.supported && pwa.updateAvailable}
  <div class="update-notice">
    <p role="status">
      {#if pwa.updating}Az új verzió megnyitása…
      {:else if pwa.updateBlocked}Az új verzió letöltve. Zárd be a többi
        RezsiPont-lapot vagy -ablakot a frissítéshez.
      {:else}Az új verzió letöltve. Ha még nem szerkesztettél, automatikusan
        frissül. Egyébként mentsd el a módosításaidat, majd frissíts.{/if}
      A mentett adataid megmaradnak.
    </p>
    <button type="button" onclick={updateApp} disabled={pwa.updating}
      >Frissítés most</button
    >
  </div>
{/if}

<style>
  .install-app {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 24px;
    margin: 0 0 32px;
    padding: clamp(24px, 4vw, 36px);
    border: 1px solid rgb(211 189 255 / 35%);
    border-radius: var(--radius);
    background: linear-gradient(120deg, rgb(211 189 255 / 12%), var(--card));
  }
  img {
    flex: none;
  }
  .install-copy {
    flex: 1 1 320px;
    min-width: 0;
  }
  h2 {
    margin: 0 0 12px;
    color: #d3bdff;
    font-size: clamp(21px, 3vw, 28px);
    line-height: 1.25;
    text-wrap: balance;
  }
  p {
    margin: 0;
    max-width: 66ch;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.7;
  }
  .install-status {
    margin-top: 12px;
    font-size: 12px;
  }
  button {
    min-height: 48px;
    padding: 12px 20px;
    border: 1px solid #d3bdff;
    border-radius: 12px;
    background: #d3bdff;
    color: #182018;
    font: inherit;
    font-size: 14px;
    font-weight: 650;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.6;
    cursor: wait;
  }
  .update-notice {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 24px;
    margin-bottom: 32px;
  }
  @media (max-width: 599px) {
    .install-app {
      gap: 18px;
    }
    .install-copy {
      flex-basis: 100%;
    }
    button {
      width: 100%;
    }
  }
</style>
