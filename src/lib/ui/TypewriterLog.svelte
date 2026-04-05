<script lang="ts">
  export let entries: string[] = []

  // Newest first
  $: reversed = [...entries].reverse()

  function getOpacity(index: number): number {
    // index 0 = newest = fully opaque, fades as it gets older
    return Math.max(0.25, 1 - index * 0.08)
  }
</script>

<div class="typewriter-log" aria-live="polite" role="log">
  <p class="typewriter-log__line typewriter-log__line--thinking">
    <span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
  </p>
  {#each reversed as entry, index (index)}
    <p class="typewriter-log__line" style={`--line-opacity: ${getOpacity(index)}`}>
      {entry}
    </p>
  {/each}
</div>
