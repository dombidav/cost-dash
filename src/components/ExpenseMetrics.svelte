<script lang="ts">
  let { items }: { items: { label: string; value: string }[] } = $props();
</script>

<dl class="expense-metrics">
  {#each items as { label, value } (label)}
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  {/each}
</dl>
