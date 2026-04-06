<script lang="ts">
  import TerminalPanel from '../../lib/ui/TerminalPanel.svelte'
  import { enemyDefinitions } from '../../engine/pve/enemies'
  import type { GameState } from '../../lib/game'

  export let state: GameState

  function getEncounterCount(enemyId: string): number {
    return state.enemyEncounterCounts[enemyId] ?? 0
  }

  function getVictoryCount(enemyId: string): number {
    return state.enemyVictoryCounts[enemyId] ?? 0
  }

  function isKnown(enemyId: string): boolean {
    return state.knownEnemies.includes(enemyId)
  }
</script>

<TerminalPanel title="BESTIARY" tag="ARCHIVE" variant="low" bleedHeader={true}>
  <div class="bestiary-list">
    {#each enemyDefinitions as enemy}
      <article class:bestiary-entry={true} class:bestiary-entry--unknown={!isKnown(enemy.id)}>
        <div class="bestiary-entry__header">
          <div>
            <p>{isKnown(enemy.id) ? enemy.epithet.toUpperCase() : 'UNMAPPED ECOLOGY'}</p>
            <h3>{isKnown(enemy.id) ? enemy.name : 'UNKNOWN THREAT'}</h3>
          </div>
          <span>{getVictoryCount(enemy.id)}W / {getEncounterCount(enemy.id)}E</span>
        </div>
        <p>{isKnown(enemy.id) ? enemy.description : 'Encounter the organism to begin codex mapping.'}</p>
        {#if getVictoryCount(enemy.id) >= 2}
          <p class="bestiary-entry__detail">{enemy.counterplay}</p>
        {/if}
        {#if getVictoryCount(enemy.id) >= 4}
          <p class="bestiary-entry__detail">{enemy.ecology}</p>
        {/if}
      </article>
    {/each}
  </div>
</TerminalPanel>
