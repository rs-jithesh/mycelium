import { BALANCE } from '../balance.config'
import type { GameState } from '../../lib/game'
import { enemyDefinitions } from './enemies'
import type { ActiveEnemyEncounter, Enemy } from './enemy.types'

function getSpawnCooldownDebuffMultiplier(state: GameState): number {
  return state.activeEnemyDebuffs.reduce((multiplier, debuff) => {
    const effectMultiplier = debuff.effects.reduce((current, effect) => {
      if (effect.type !== 'spawnCooldownMultiplier') {
        return current
      }
      return current * effect.magnitude
    }, 1)
    return multiplier * effectMultiplier
  }, 1)
}

function getWeightedEnemy(enemies: Enemy[]): Enemy | null {
  if (enemies.length === 0) {
    return null
  }

  const totalWeight = enemies.reduce((sum, enemy) => sum + enemy.spawnWeight, 0)
  let roll = Math.random() * totalWeight

  for (const enemy of enemies) {
    roll -= enemy.spawnWeight
    if (roll <= 0) {
      return enemy
    }
  }

  return enemies[enemies.length - 1]
}

export function getEligibleEnemies(state: GameState): Enemy[] {
  return enemyDefinitions.filter((enemy) => {
    const withinMaxStage = enemy.hostStageMax === null || state.currentStage <= enemy.hostStageMax
    return state.currentStage >= enemy.hostStageMin && withinMaxStage
  })
}

export function getEnemySpawnCooldownMs(state: GameState): number {
  const baseCooldown = BALANCE.PVE_ENEMY_CHECK_BASE_MS
    - (state.currentStage - 1) * BALANCE.PVE_ENEMY_CHECK_STAGE_REDUCTION_MS
    - state.stats.resilience * BALANCE.PVE_ENEMY_CHECK_RESILIENCE_REDUCTION_MS

  return Math.max(
    BALANCE.PVE_ENEMY_CHECK_MIN_MS,
    Math.round(baseCooldown * getSpawnCooldownDebuffMultiplier(state))
  )
}

export function shouldAttemptEnemySpawn(state: GameState, now: number): boolean {
  if (state.hostCompleted || state.activeEnemyEncounter) {
    return false
  }
  if (state.clickCount === 0 && state.biomass.eq(0)) {
    return false
  }
  return now >= state.nextEnemyCheckAt
}

export function rollEnemySpawn(state: GameState, now: number): ActiveEnemyEncounter | null {
  const eligibleEnemies = getEligibleEnemies(state)
  if (eligibleEnemies.length === 0) {
    return null
  }

  const triggerChance = Math.min(
    BALANCE.PVE_ENEMY_TRIGGER_MAX,
    BALANCE.PVE_ENEMY_TRIGGER_BASE +
      (state.currentStage - 1) * BALANCE.PVE_ENEMY_TRIGGER_PER_STAGE +
      state.stats.complexity * BALANCE.PVE_ENEMY_TRIGGER_COMPLEXITY_BONUS
  )

  if (!state.forcedEnemyId && Math.random() > triggerChance) {
    return null
  }

  const forcedEnemy = state.forcedEnemyId
    ? eligibleEnemies.find((enemy) => enemy.id === state.forcedEnemyId) ?? null
    : null
  const enemy = forcedEnemy ?? getWeightedEnemy(eligibleEnemies)
  if (!enemy) {
    return null
  }

  const detectionPrefix = state.stats.complexity >= 3
    ? 'Pattern mapped.'
    : 'Movement detected.'

  return {
    enemyId: enemy.id,
    spawnedAt: now,
    detectedPower: typeof enemy.power === 'function' ? Number(enemy.power(state).toFixed(2)) : enemy.power,
    notification: `${detectionPrefix} ${enemy.name} approaching the active mesh.`,
  }
}
