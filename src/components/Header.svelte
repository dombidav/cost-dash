<script lang="ts">
  import { ui } from "../lib/ui.svelte";
  let { electricity }: { electricity: boolean } = $props();
</script>

<header class="site-header shell">
  <a class="brand" href={electricity ? "./aram.html" : "./index.html"}
    ><span class="brand-mark" aria-hidden="true"
      ><svg viewBox="0 0 24 24"
        >{#if electricity}<path d="m14 2-9 12h6l-1 8 9-12h-6Z" />{:else}<path
            d="M13 2c1 5-5 6-3 10 1-1 2-2 3-2 0 3 4 3 4 7a5 5 0 0 1-10 0C4 10 11 9 13 2Z"
          />{/if}</svg
      ></span
    ><span>Rezsi<span class="brand-accent">Pont</span></span><span
      class="brand-caption"
      >{electricity ? "ÁRAMKALKULÁTOR" : "GÁZKALKULÁTOR"}</span
    ></a
  >
  <nav class="energy-nav" aria-label="Kalkulátor választása">
    <a href="./index.html" aria-current={!electricity ? "page" : undefined}
      ><span aria-hidden="true">♨</span> Gáz</a
    ><a href="./aram.html" aria-current={electricity ? "page" : undefined}
      ><span aria-hidden="true">ϟ</span> Áram</a
    >
  </nav>
  <div class="storage-status" class:error={ui.storageError} role="status">
    <span class="status-dot"></span><span>{ui.status}</span>
  </div>
</header>
