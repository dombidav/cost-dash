<script lang="ts">
  import { tick, untrack } from "svelte";
  import Header from "./components/Header.svelte";
  import Faq from "./components/Faq.svelte";
  import InstallApp from "./components/InstallApp.svelte";
  import PhotoSupportDialog from "./components/PhotoSupportDialog.svelte";
  import { ui } from "./lib/ui.svelte";
  import { currentPage, pages as navigation } from "./lib/pages";
  const id = currentPage(location.pathname);
  const pageInfo = navigation[id];
  // Keep each lazy entry separate so its component CSS is preloaded with it.
  const pages = {
    electricity: () => import("./electricity/ElectricityPage.svelte"),
    gas: () => import("./gas/GasPage.svelte"),
    water: () => import("./water/WaterPage.svelte"),
    car: () => import("./car/CarPage.svelte"),
    subscriptions: () => import("./subscriptions/SubscriptionsPage.svelte"),
    dashboard: () => import("./dashboard/DashboardPage.svelte"),
  };
  const page = pages[id]();
  void page.then(
    () => revealFragment(),
    () => {},
  );
  let notification = $state<HTMLDivElement>();
  let notificationHeight = $state(0);
  let undoButton = $state<HTMLButtonElement>();

  async function revealFragment() {
    const hash = location.hash;
    if (!hash || hash === "#main") return;
    await tick();
    if (hash !== location.hash) return;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;

    const panel = target.closest<HTMLElement>(
      "[data-section-disclosure][inert]",
    );
    if (panel) {
      document
        .querySelector<HTMLButtonElement>(
          `button[aria-controls="${CSS.escape(panel.id)}"]`,
        )
        ?.click();
      await tick();
    }
    if (!target.isConnected || hash !== location.hash) return;
    for (
      let parent = target.parentElement;
      parent;
      parent = parent.parentElement
    ) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
    }
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start" });
  }

  function revisitFragment(event: MouseEvent) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLAnchorElement>('a[href^="#"]');
    if (link?.hash === location.hash) void revealFragment();
  }

  $effect(() => {
    if (ui.undo && undoButton) undoButton.focus();
  });

  function keepFocusVisible() {
    const focused = document.activeElement;
    if (
      !(focused instanceof HTMLElement) ||
      !notification ||
      notification.contains(focused)
    )
      return;
    const target = focused.getBoundingClientRect();
    const banner = notification.getBoundingClientRect();
    if (
      target.bottom > banner.top &&
      target.top < banner.bottom &&
      target.right > banner.left &&
      target.left < banner.right
    )
      focused.scrollIntoView({ block: "center", behavior: "instant" });
  }

  $effect(() => {
    if (ui.message || ui.undo) untrack(keepFocusVisible);
  });

  async function finishUndo(restore: boolean) {
    const undo = ui.undo;
    if (!undo) return;
    ui.undo = null;
    ui.message = "";
    if (restore) undo.action();
    await tick();
    document.getElementById(undo.focusId)?.focus();
  }
</script>

<svelte:window
  onhashchange={revealFragment}
  onclick={revisitFragment}
  onfocusin={keepFocusVisible}
  onpagehide={() => {
    (document.activeElement as HTMLElement | null)?.blur();
  }}
/>

<a class="skip-link" href="#main">Ugrás a tartalomhoz</a>
<Header {id} />
{#if ["gas", "electricity", "water", "car"].includes(id)}
  <PhotoSupportDialog />
{/if}
<main id="main" class="shell" tabindex="-1">
  {#await page}
    <div class="empty-state" role="status">A kalkulátor betöltése…</div>
  {:then Page}
    <Page.default />
    <Faq {id} />
    <InstallApp />
  {:catch}
    <p class="notice danger" role="alert">
      A kalkulátor nem tölthető be. Töltsd újra az oldalt.
    </p>
  {/await}
</main>
<footer class="shell">
  <a class="footer-brand" href={pageInfo.href}>RezsiPont</a><span
    >Rezsiszámlák egyszerűen. Pont.</span
  ><span>{pageInfo.title} · Tájékoztató becslés</span>
</footer>
<div role="status" class="sr-only">{ui.message}</div>
{#if ui.message || ui.undo}
  <div
    class="toast"
    bind:this={notification}
    bind:offsetHeight={notificationHeight}
  >
    {#if ui.message && ui.message !== ui.undo?.message}<span>{ui.message}</span
      >{/if}
    {#if ui.undo}
      <div class="undo-actions">
        <span id="undo-message">{ui.undo.message}</span>
        <button
          type="button"
          bind:this={undoButton}
          aria-describedby="undo-message"
          onclick={() => finishUndo(true)}>Visszavonás</button
        >
        <button
          type="button"
          aria-label="Törlési értesítés bezárása"
          onclick={() => finishUndo(false)}>Bezárás</button
        >
      </div>
    {/if}
  </div>
  <div aria-hidden="true" style:height={`${notificationHeight + 22}px`}></div>
{/if}

<style>
  .undo-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
  }
</style>
