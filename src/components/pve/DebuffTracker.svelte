<script lang="ts">
  import TerminalPanel from '../../lib/ui/TerminalPanel.svelte'
  import type { ActiveEnemyDebuff } from '../../engine/pve/enemy.types'

  export let debuffs: ActiveEnemyDebuff[] = []

  function formatEffect(debuff: ActiveEnemyDebuff): string {
    return debuff.effects.map((effect) => {
      if (effect.type === 'bpsMultiplier') return `PASSIVE -${Math.round(effect.magnitude * 100)}%`
      if (effect.type === 'clickMultiplier') return `CLICK -${Math.round(effect.magnitude * 100)}%`
      return `THREAT CHECK +${Math.round((1 - effect.magnitude) * 100)}%`
    }).join(' / ')
  }

  function formatSeconds(ms: number): string {
    return `${Math.max(1, Math.ceil(ms / 1000))}s`
  }
</script>

{#if debuffs.length > 0}
  <TerminalPanel title="COLONY WOUNDS" tag="DEBUFF" variant="low" className="enemy-debuff-panel">
    <div class="enemy-debuff-list">
      {#each debuffs as debuff (debuff.id)}
        <div class="enemy-debuff-row">
          <div>
            <strong>{debuff.name.toUpperCase()}</strong>
            <p>{formatEffect(debuff)}</p>
          </div>
          <span>{formatSeconds(debuff.remainingMs)}</span>
        </div>
      {/each}
    </div>
  </TerminalPanel>
{/if}
