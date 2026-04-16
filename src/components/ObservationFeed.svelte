<script lang="ts">
  import type { LogEntry, LogTag } from '../lib/game'

  export let entries: LogEntry[] = []
  export let maxVisible: number = 5
  export let fade: boolean = true

  const TAG_STYLES: Record<LogTag, { bg: string; color: string; border: string }> = {
    PASSIVE: { bg: '#0e1e0a', color: '#4a8030', border: '#1e3a10' },
    CLICK:   { bg: '#0a1020', color: '#3060a0', border: '#102040' },
    DEFENSE: { bg: '#1e0e08', color: '#b04020', border: '#3a1808' },
    SYSTEM:  { bg: '#18140a', color: '#806030', border: '#302808' },
    STAGE:   { bg: '#100e1e', color: '#6050b0', border: '#201838' },
    STRAIN:  { bg: '#0e1818', color: '#308070', border: '#103028' },
    SIGNAL:  { bg: '#181018', color: '#806890', border: '#301830' },
  }

  const OPACITIES = [1.0, 0.65, 0.38, 0.20, 0.10]

  $: visible = entries.slice(0, maxVisible)

  function formatTime(ts: number): string {
    return new Date(ts).toTimeString().slice(0, 8)
  }

  function getOpacity(index: number): number {
    if (!fade) return 1
    return OPACITIES[index] ?? 0.08
  }
</script>

<div class="feed">
  {#each visible as entry, i (entry.id)}
    <div
      class="entry"
      class:newest={fade && i === 0}
    >
      <span class="ts">{formatTime(entry.timestamp)}</span>
      <span
        class="tag"
        style="
          background: {TAG_STYLES[entry.tag].bg};
          color: {TAG_STYLES[entry.tag].color};
          border: 1px solid {TAG_STYLES[entry.tag].border};
        "
      >{entry.tag}</span>
      <span class="text">{entry.text}</span>
    </div>
  {/each}

  {#if visible.length === 0}
    <div class="empty">NETWORK INITIALIZING...</div>
  {/if}
</div>

<style>
  .feed {
    padding: 10px 0 14px 0;
    min-height: 110px;
  }

  .entry {
    display: flex;
    gap: 10px;
    align-items: baseline;
    padding: 5px 0;
    border-bottom: 1px solid #141a0e;
    transition: opacity 0.15s ease;
  }

  .entry:last-child {
    border-bottom: none;
  }

  .entry.newest {
    animation: fadeIn 0.2s ease forwards;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-2px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .ts {
    font-size: 9px;
    letter-spacing: 0.1em;
    color: #2e4820;
    white-space: nowrap;
    min-width: 52px;
    font-family: 'Courier New', monospace;
  }

  .tag {
    font-size: 9px;
    letter-spacing: 0.1em;
    padding: 1px 5px;
    border-radius: 2px;
    white-space: nowrap;
    min-width: 60px;
    text-align: center;
    font-family: 'Courier New', monospace;
  }

  .text {
    font-size: 14px;
    color: #608048;
    letter-spacing: 0.04em;
    line-height: 1.45;
    flex: 1;
    font-family: 'Courier New', monospace;
  }

  .entry.newest .text {
    color: #90c060;
  }

  .empty {
    font-size: 10px;
    letter-spacing: 0.15em;
    color: #2e4820;
    font-family: 'Courier New', monospace;
    padding: 12px 0;
  }
</style>
