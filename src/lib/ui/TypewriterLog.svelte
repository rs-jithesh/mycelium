<script lang="ts">
  export let entries: string[] = []

  $: reversed = [...entries].reverse()

  function getOpacity(index: number): number {
    return Math.max(0.25, 1 - index * 0.08)
  }

  function isFlavorEntry(entry: string): boolean {
    return !/\d/.test(entry)
  }
</script>

<div class="typewriter-log" aria-live="polite" role="log">
  <p class="typewriter-log__line typewriter-log__line--thinking">
    <span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
  </p>
  {#each reversed as entry, index (index)}
    <p
      class="typewriter-log__line"
      class:typewriter-log__line--flavor={isFlavorEntry(entry)}
      style={`--line-opacity: ${getOpacity(index)}`}
    >
      {entry}
    </p>
  {/each}
</div>
