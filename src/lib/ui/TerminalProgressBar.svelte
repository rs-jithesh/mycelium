<script lang="ts">
  export let value = 0
  export let max = 100
  export let width = 24
  export let prefix = ''

  const safeMax = max <= 0 ? 1 : max
  $: ratio = Math.max(0, Math.min(1, value / safeMax))
  $: filled = Math.round(ratio * width)
  $: empty = width - filled
  $: percent = ratio * 100
  $: barText = `[${'█'.repeat(filled)}${' '.repeat(empty)}] ${percent.toFixed(1)}%`
</script>

<div class="terminal-progress">
  {#if prefix}
    <p class="terminal-progress__label">{prefix}</p>
  {/if}
  <pre class="terminal-progress__bar" aria-label={`${percent.toFixed(1)} percent complete`}>{barText}</pre>
</div>
