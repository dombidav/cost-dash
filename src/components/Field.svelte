<script lang="ts">
  import Help from "./Help.svelte";
  import type { FieldHelp } from "../lib/field-help";
  let {
    id,
    label,
    value,
    type = "text",
    min,
    max,
    unit = "",
    placeholder = "",
    decimal = false,
    hiddenLabel = false,
    help,
    oncommit,
  }: {
    id: string;
    label: string;
    value: string | number | null;
    type?: "text" | "date";
    min?: string;
    max?: string;
    unit?: string;
    placeholder?: string;
    decimal?: boolean;
    hiddenLabel?: boolean;
    help?: FieldHelp;
    oncommit: (value: string) => string | void;
  } = $props();
  let draft = $derived(value === null ? "" : String(value));
  let error = $state("");
  function commit() {
    error = oncommit(draft) || "";
  }
</script>

<div class="field">
  {#if hiddenLabel}<label for={id} class="sr-only">{label}</label>{:else}<div
      class="field-label"
    >
      <label for={id}>{label}</label><Help forId={id} {label} content={help} />
    </div>{/if}
  <div class="field-control">
    <div class="field-input" class:input-unit={!!unit}>
      <input
        {id}
        {type}
        {min}
        {max}
        inputmode={type === "text" ? (decimal ? "decimal" : "text") : undefined}
        bind:value={draft}
        {placeholder}
        autocomplete="off"
        onblur={type === "date" ? undefined : commit}
        onchange={type === "date" ? commit : undefined}
        aria-invalid={!!error}
        aria-describedby={`${unit ? `${id}-unit ` : ""}${id}-help${error ? ` ${id}-error` : ""}`}
      />{#if unit}<span id={`${id}-unit`}>{unit}</span>{/if}
    </div>
    {#if hiddenLabel}<Help forId={id} {label} content={help} />{/if}
  </div>
  <p id={`${id}-error`} class="field-error" role="alert">
    {error}
  </p>
</div>
