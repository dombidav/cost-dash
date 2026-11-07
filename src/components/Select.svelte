<script lang="ts">
  import Help from "./Help.svelte";
  let {
    id,
    label,
    value,
    options,
    oncommit,
  }: {
    id: string;
    label: string;
    value: string | number;
    options: { value: string; label: string; disabled?: boolean }[];
    oncommit: (value: string) => void;
  } = $props();
</script>

<div class="field">
  <div class="field-label">
    <label for={id}>{label}</label><Help forId={id} {label} />
  </div>
  <select
    {id}
    value={String(value)}
    aria-describedby={`${id}-help`}
    onchange={(event) => oncommit(event.currentTarget.value)}
    >{#each options as option (option.value)}<option
        value={option.value}
        disabled={option.disabled}>{option.label}</option
      >{/each}</select
  >
</div>
