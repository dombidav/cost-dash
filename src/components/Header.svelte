<script lang="ts">
  import { ui } from "../lib/ui.svelte";
  import { pages, type PageId } from "../lib/pages";
  let { id }: { id: PageId } = $props();
</script>

<header class="site-header shell">
  <a class="brand" href={pages[id].href}
    ><span class="brand-mark" aria-hidden="true"
      ><svg viewBox="0 0 24 24"
        >{#if id === "electricity"}<path
            d="m14 2-9 12h6l-1 8 9-12h-6Z"
          />{:else if id === "gas"}<path
            d="M13 2c1 5-5 6-3 10 1-1 2-2 3-2 0 3 4 3 4 7a5 5 0 0 1-10 0C4 10 11 9 13 2Z"
          />{:else}<text x="12" y="18" text-anchor="middle" font-size="19"
            >{pages[id].icon}</text
          >{/if}</svg
      ></span
    ><span>Rezsi<span class="brand-accent">Pont</span></span><span
      class="brand-caption">{pages[id].title.toLocaleUpperCase("hu")}</span
    ></a
  >
  <nav class="energy-nav" aria-label="Oldalak">
    {#each Object.entries(pages) as [key, info] (key)}
      <a href={info.href} aria-current={id === key ? "page" : undefined}
        ><span aria-hidden="true">{info.icon}</span> {info.label}</a
      >
    {/each}
  </nav>
  <div class="storage-status" class:error={ui.storageError} role="status">
    <span class="status-dot"></span><span>{ui.status}</span>
  </div>
</header>
