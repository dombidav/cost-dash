<script lang="ts">
  import Help from "./Help.svelte";
  import type { FieldHelp } from "../lib/field-help";

  let {
    id,
    label,
    help,
    type = "text",
    value = $bindable(""),
    inputmode,
    min,
    max,
    placeholder,
    required = false,
    format,
  }: {
    id: string;
    label: string;
    help: FieldHelp;
    type?: "text" | "date" | "month";
    value?: string;
    inputmode?: "decimal" | "numeric";
    min?: string;
    max?: string;
    placeholder?: string;
    required?: boolean;
    format?: (value: string) => string;
  } = $props();
  let typing = $state(false);
</script>

<div class="field">
  <div class="field-label">
    <label for={id}>{label}</label>
    <Help forId={id} {label} content={help} />
  </div>
  <input
    {id}
    {type}
    bind:value={
      () => (format && !typing ? format(value) : value),
      (input) => {
        if (format) typing = true;
        value = input;
      }
    }
    onblur={() => (typing = false)}
    {inputmode}
    {min}
    {max}
    {placeholder}
    {required}
    maxlength={type === "text" ? (inputmode ? 18 : 80) : undefined}
    autocomplete="off"
    aria-describedby={`${id}-help`}
  />
</div>
