<script lang="ts">
  let {
    eyebrow,
    title,
    description,
  }: { eyebrow: string; title: string; description: string } = $props();
</script>

<header class="page-heading">
  <div>
    <div class="eyebrow">
      <span class="tiny-line" aria-hidden="true"></span>{eyebrow}
    </div>
    <h1>{title}<span>.</span></h1>
    <p>{description}</p>
  </div>
</header>
