<script lang="ts">
  import { onMount } from "svelte";
  import type { Reading } from "../types";
  import { fmt } from "../lib/format";
  let {
    id,
    kind = "consumption",
    unit = "m³",
    readings = [],
    bars = [],
    label,
  }: {
    id: string;
    kind?: "consumption" | "benchmark";
    unit?: string;
    readings?: Reading[];
    bars?: { label: string; value: number; own: boolean; short?: string }[];
    label: string;
  } = $props();
  let canvas: HTMLCanvasElement,
    visible = $state(false),
    failed = $state(false);
  let showData = $state(false);
  onMount(() => {
    if (!("IntersectionObserver" in window)) {
      visible = true;
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) visible = true;
      },
      { rootMargin: "150px" },
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  });
  $effect(() => {
    if (!visible || !canvas) return;
    const currentReadings = readings,
      currentBars = bars,
      target = canvas,
      currentKind = kind,
      currentUnit = unit;
    let stopped = false,
      destroy: (() => void) | undefined;
    void import("../charts")
      .then((charts) => {
        if (stopped) return;
        if (currentKind === "consumption")
          charts.drawConsumption(target, currentReadings, currentUnit);
        else charts.drawBenchmark(target, currentBars, currentUnit);
        destroy = () => charts.clear(id);
      })
      .catch(() => {
        if (!stopped) failed = true;
      });
    return () => {
      stopped = true;
      destroy?.();
    };
  });
</script>

<div
  class="chart"
  class:benchmark-chart={kind === "benchmark"}
  role="img"
  aria-label={label}
>
  <canvas {id} bind:this={canvas} aria-hidden="true"></canvas>
</div>
{#if failed}<p class="field-hint">A grafikon nem tölthető be.</p>{/if}
{#if readings.length || bars.length}
  <details
    class="chart-data"
    ontoggle={(event) => (showData = event.currentTarget.open)}
  >
    <summary>A grafikon adatai szövegesen</summary>
    {#if showData}
      <ul>
        {#if kind === "benchmark"}
          {#each bars as bar, index (index)}
            <li>{bar.label} · {fmt(bar.value)} {unit}</li>
          {/each}
        {:else}
          {#each readings as reading (reading.id)}
            <li>
              {reading.date} · {fmt(reading.value - readings[0].value)}
              {unit}
            </li>
          {/each}
        {/if}
      </ul>
    {/if}
  </details>
{/if}

<style>
  .chart-data {
    margin-block: 8px;
    color: var(--muted);
    font-size: 0.875rem;
    overflow-wrap: anywhere;
  }
  summary {
    cursor: pointer;
    min-height: 32px;
    padding-block: 5px;
  }
  ul {
    padding-inline-start: 1.5em;
  }
</style>
