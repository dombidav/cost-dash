<script lang="ts">
  import Header from "./components/Header.svelte";
  import Faq from "./components/Faq.svelte";
  import { ui } from "./lib/ui.svelte";
  const electricity = location.pathname.endsWith("/aram.html");
  // Keep each lazy entry separate so its component CSS is preloaded with it.
  const pages = {
    electricity: () => import("./electricity/ElectricityPage.svelte"),
    gas: () => import("./gas/GasPage.svelte"),
  };
  const page = pages[electricity ? "electricity" : "gas"]();
</script>

<svelte:window
  onpagehide={() => {
    (document.activeElement as HTMLElement | null)?.blur();
  }}
/>

<a class="skip-link" href="#main">Ugrás a tartalomhoz</a>
<Header {electricity} />
<main id="main" class="shell">
  {#await page}
    <div class="empty-state" role="status">A kalkulátor betöltése…</div>
  {:then Page}
    <Page.default />
    <Faq {electricity} />
  {:catch}
    <p class="notice danger" role="alert">
      A kalkulátor nem tölthető be. Töltsd újra az oldalt.
    </p>
  {/await}
</main>
<footer class="shell">
  <a class="footer-brand" href={electricity ? "./aram.html" : "./index.html"}
    >RezsiPont</a
  ><span>Rezsiszámlák egyszerűen. Pont.</span><span
    >{electricity ? "Lakossági villamos energia" : "Lakossági földgáz"} · Tájékoztató
    becslés</span
  >
</footer>
{#if ui.message}<div class="toast" role="status">
    <span>{ui.message}</span>{#if ui.undo}<button
        type="button"
        onclick={() => {
          const action = ui.undo;
          ui.undo = null;
          action?.();
        }}>Visszavonás</button
      >{/if}
  </div>{/if}
