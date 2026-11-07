<script lang="ts">
  import { onMount } from "svelte";
  import type { Reading } from "../types";
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

<div class="chart" class:benchmark-chart={kind === "benchmark"}>
  <canvas {id} bind:this={canvas} aria-label={label}>{label}</canvas>
</div>
{#if failed}<p class="field-hint">
    A grafikon nem tölthető be. A számokat a kártyákon és a naplóban találod.
  </p>{/if}
