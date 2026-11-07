<script lang="ts">
  let { percent }: { percent: number | null } = $props();
</script>

<div class="gauge-wrap">
  <svg viewBox="0 0 160 160" class="gauge" aria-hidden="true"
    ><circle class="gauge-track" cx="80" cy="80" r="67" /><circle
      class="gauge-fill"
      cx="80"
      cy="80"
      r="67"
      style:stroke-dashoffset={421 *
        (1 - Math.max(0, Math.min(100, percent ?? 0)) / 100)}
    /></svg
  >
  <div class="gauge-label">
    <strong>{percent === null ? "—" : `${Math.round(percent)}%`}</strong><span
      >még elérhető</span
    >
  </div>
</div>
