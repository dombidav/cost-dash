<script lang="ts">
  import { onDestroy } from "svelte";
  import { fieldHelp, type FieldHelp } from "../lib/field-help";

  let {
    forId,
    label,
    content,
  }: { forId: string; label: string; content?: FieldHelp } = $props();
  let text = $derived(content ?? fieldHelp(forId));
  let button: HTMLButtonElement, panel: HTMLSpanElement;
  let open = $state(false),
    pinned = false,
    hovered = false,
    closeTimer: ReturnType<typeof setTimeout>;
  let left = $state(0),
    top = $state(0);
  onDestroy(() => clearTimeout(closeTimer));

  function position() {
    if (!open) return;
    const anchor = button.getBoundingClientRect(),
      box = panel.getBoundingClientRect();
    const width = document.documentElement.clientWidth,
      height = window.innerHeight;
    left = Math.max(12, Math.min(anchor.left - 8, width - box.width - 12));
    top =
      anchor.bottom + 8 + box.height <= height - 12
        ? anchor.bottom + 8
        : Math.max(12, anchor.top - box.height - 8);
  }
  function show() {
    clearTimeout(closeTimer);
    if (!open) {
      panel.showPopover();
      open = true;
    }
    position();
  }
  function close() {
    clearTimeout(closeTimer);
    pinned = false;
    open = false;
    panel?.hidePopover();
  }
  function leave() {
    hovered = false;
    closeTimer = setTimeout(() => {
      if (!pinned && !hovered && document.activeElement !== button) close();
    }, 120);
  }
  function outside(event: PointerEvent) {
    const target = event.target as Node;
    if (open && !button.contains(target) && !panel.contains(target)) close();
  }
</script>

<svelte:window
  onpointerdown={outside}
  onkeydown={(event) => {
    if (event.key === "Escape" && open) close();
  }}
  onresize={position}
  onscroll={() => {
    if (open) close();
  }}
/>
<button
  bind:this={button}
  type="button"
  class="help-button"
  data-help-for={forId}
  aria-label={`${label} – súgó`}
  aria-expanded={open}
  aria-controls={`${forId}-help`}
  onpointerenter={(event) => {
    if (event.pointerType !== "touch") {
      hovered = true;
      show();
    }
  }}
  onpointerleave={leave}
  onfocus={show}
  onblur={() => {
    pinned = false;
    if (!hovered) close();
  }}
  onclick={() => {
    if (pinned) close();
    else {
      pinned = true;
      show();
    }
  }}><span aria-hidden="true">?</span></button
>
<span
  bind:this={panel}
  id={`${forId}-help`}
  class="help-tooltip"
  role="tooltip"
  popover="manual"
  style:left={`${left}px`}
  style:top={`${top}px`}
  onpointerenter={() => {
    hovered = true;
    clearTimeout(closeTimer);
  }}
  onpointerleave={leave}
>
  <strong class="help-title">{label}</strong>
  <span class="help-section"><strong>Mit jelent?</strong>{text.what}</span>
  <span class="help-section"
    ><strong>Hol találod / mit adj meg?</strong>{text.where}</span
  >
</span>
