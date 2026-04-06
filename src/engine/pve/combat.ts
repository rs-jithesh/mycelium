import { BALANCE } from '../balance.config'
import type { GameState } from '../../lib/game'
import type {
  ActiveEnemyCombat,
  ActiveEnemyDebuff,
  CombatOutcome,
  CombatResult,
  DropResult,
  Enemy,
  EnemyDebuffEffect,
} from './enemy.types'

function resolveNumber(value: number | ((state: GameState) => number), state: GameState): number {
  return typeof value === 'function' ? value(state) : value
}

function countHostEchoes(state: GameState): number {
  return Object.keys(state.hostEchoes).length
}

export function calculateEnemyPower(state: GameState, enemy: Enemy): number {
  let power = resolveNumber(enemy.power, state)

  switch (enemy.behavior) {
    case 'swarmer':
      power *= 1.08
      break
    case 'burrower':
      power *= 1.12
      break
    case 'armored':
      power *= 1.15
      break
    case 'stealer':
      power *= 1.06
      break
    case 'adapting':
      power *= 1.1 + Math.min(0.1, state.activeDefenseEvents.length * 0.02)
      break
    case 'sacrificial':
      power *= 0.98
      break
    default:
      break
  }

  return Number(power.toFixed(2))
}

export function getCountermeasureEncounterMatchup(
  state: GameState,
  enemy: Pick<Enemy, 'weaknesses' | 'resistances'>
): 'advantage' | 'neutral' | 'resisted' {
  if (!state.equippedCountermeasure) {
    return 'neutral'
  }
  if (enemy.weaknesses.includes(state.equippedCountermeasure)) {
    return 'advantage'
  }
  if (enemy.resistances.includes(state.equippedCountermeasure)) {
    return 'resisted'
  }
  return 'neutral'
}

export function calculatePlayerEncounterPower(state: GameState, enemy: Enemy): number {
  let power = BALANCE.PVE_PLAYER_POWER_STAGE_BASE + state.currentStage * 0.8
  power += state.stats.virulence * BALANCE.PVE_PLAYER_POWER_VIRULENCE
  power += state.stats.resilience * BALANCE.PVE_PLAYER_POWER_RESILIENCE
  power += state.stats.complexity * BALANCE.PVE_PLAYER_POWER_COMPLEXITY
  power += state.unlockedSkills.length * BALANCE.PVE_PLAYER_POWER_SKILL
  power += countHostEchoes(state) * BALANCE.PVE_PLAYER_POWER_HOST_ECHO

  if (state.strain === 'parasite') {
    power *= 1.12
  } else if (state.strain === 'symbiote') {
    power *= 1.05
  } else if (state.strain === 'saprophyte') {
    power *= 1.08
  }

  if (state.activeDefenseEvents.length > 0) {
    power *= 0.96
  }

  switch (getCountermeasureEncounterMatchup(state, enemy)) {
    case 'advantage':
      power *= 1 + BALANCE.PVE_COUNTERMATCH_ADVANTAGE_BONUS
      break
    case 'resisted':
      power *= 1 - BALANCE.PVE_COUNTERMATCH_RESIST_PENALTY
      break
    default:
      break
  }

  if (enemy.behavior === 'burrower') {
    power -= Math.max(0, 0.5 - state.stats.complexity * 0.08)
  }
  if (enemy.behavior === 'armored' && getCountermeasureEncounterMatchup(state, enemy) !== 'advantage') {
    power *= 0.92
  }
  if (enemy.behavior === 'adapting' && !state.equippedCountermeasure) {
    power *= 0.9
  }

  return Number(Math.max(0.5, power).toFixed(2))
}

export function createCombatSession(state: GameState, enemy: Enemy, now: number): ActiveEnemyCombat {
  const playerEncounterPower = calculatePlayerEncounterPower(state, enemy)
  const enemyPower = calculateEnemyPower(state, enemy)
  const playerMaxIntegrity = Math.round(
    BALANCE.PVE_COMBAT_PLAYER_INTEGRITY_BASE +
    state.currentStage * BALANCE.PVE_COMBAT_PLAYER_INTEGRITY_STAGE +
    state.stats.resilience * BALANCE.PVE_COMBAT_PLAYER_INTEGRITY_RESILIENCE
  )
  const enemyMaxHealth = Math.max(8, Math.round(enemyPower * BALANCE.PVE_COMBAT_ENEMY_HEALTH_MULT))
  const enemyAttackIntervalMs = Math.max(
    BALANCE.PVE_COMBAT_ENEMY_INTERVAL_MIN_MS,
    BALANCE.PVE_COMBAT_ENEMY_INTERVAL_MS - (state.currentStage - 1) * BALANCE.PVE_COMBAT_ENEMY_INTERVAL_STAGE_REDUCTION_MS
  )

  return {
    enemyId: enemy.id,
    enemyName: enemy.name,
    enemyBehavior: enemy.behavior,
    startedAt: now,
    enemyHealth: enemyMaxHealth,
    enemyMaxHealth,
    playerIntegrity: playerMaxIntegrity,
    playerMaxIntegrity,
    playerAttack: Number((
      BALANCE.PVE_COMBAT_PLAYER_ATTACK_BASE +
      state.stats.virulence * BALANCE.PVE_COMBAT_PLAYER_ATTACK_VIRULENCE +
      state.stats.complexity * BALANCE.PVE_COMBAT_PLAYER_ATTACK_COMPLEXITY
    ).toFixed(2)),
    enemyAttack: Number((enemyPower * BALANCE.PVE_COMBAT_ENEMY_ATTACK_MULT).toFixed(2)),
    enemyAttackIntervalMs,
    enemyAttackCooldownMs: enemyAttackIntervalMs,
    attackWindupMs: BALANCE.PVE_COMBAT_WINDUP_MS,
    attackWindupRemainingMs: BALANCE.PVE_COMBAT_WINDUP_MS,
    attackCount: 0,
    enemyAttackCount: 0,
    eventLog: [
      `${enemy.name} engaged. Pressure fronts interlock.`,
      `Countermeasure status: ${getCountermeasureEncounterMatchup(state, enemy).toUpperCase()}.`,
    ],
  }
}

function getLivePlayerDamageMultiplier(state: GameState, enemy: Enemy): number {
  let multiplier = 1
  const matchup = getCountermeasureEncounterMatchup(state, enemy)

  if (matchup === 'advantage') {
    multiplier *= 1 + BALANCE.PVE_COUNTERMATCH_ADVANTAGE_BONUS
  } else if (matchup === 'resisted') {
    multiplier *= 1 - BALANCE.PVE_COUNTERMATCH_RESIST_PENALTY
  }

  if (state.strain === 'parasite') multiplier *= 1.08
  if (enemy.behavior === 'armored' && matchup !== 'advantage') multiplier *= 0.9
  if (enemy.behavior === 'swarmer') multiplier *= 0.96

  return multiplier
}

function getLiveEnemyDamageMultiplier(state: GameState, enemy: Enemy): number {
  let multiplier = 1

  if (state.strain === 'symbiote') multiplier *= 0.95
  if (enemy.behavior === 'burrower') multiplier *= 1.08
  if (enemy.behavior === 'sacrificial') multiplier *= 1.12
  if (state.activeDefenseEvents.length > 0) multiplier *= 1.04

  return multiplier
}

export function performPlayerCombatAttack(state: GameState, combat: ActiveEnemyCombat, enemy: Enemy): ActiveEnemyCombat {
  const damage = Math.max(1, Math.round(combat.playerAttack * getLivePlayerDamageMultiplier(state, enemy)))
  const nextEnemyHealth = Math.max(0, combat.enemyHealth - damage)

  return {
    ...combat,
    enemyHealth: nextEnemyHealth,
    attackCount: combat.attackCount + 1,
    attackWindupRemainingMs: combat.attackWindupMs,
    eventLog: [...combat.eventLog.slice(-5), `You strike for ${damage}. ${enemy.name} integrity at ${nextEnemyHealth}/${combat.enemyMaxHealth}.`],
  }
}

export function tickEnemyCombat(state: GameState, combat: ActiveEnemyCombat, enemy: Enemy, deltaMs: number): ActiveEnemyCombat {
  const nextWindup = Math.max(0, combat.attackWindupRemainingMs - deltaMs)
  let nextCooldown = combat.enemyAttackCooldownMs - deltaMs
  let nextCombat: ActiveEnemyCombat = {
    ...combat,
    attackWindupRemainingMs: nextWindup,
    enemyAttackCooldownMs: nextCooldown,
  }

  while (nextCooldown <= 0 && nextCombat.playerIntegrity > 0 && nextCombat.enemyHealth > 0) {
    const damage = Math.max(1, Math.round(combat.enemyAttack * getLiveEnemyDamageMultiplier(state, enemy)))
    const nextPlayerIntegrity = Math.max(0, nextCombat.playerIntegrity - damage)
    nextCooldown += combat.enemyAttackIntervalMs
    nextCombat = {
      ...nextCombat,
      playerIntegrity: nextPlayerIntegrity,
      enemyAttackCooldownMs: nextCooldown,
      enemyAttackCount: nextCombat.enemyAttackCount + 1,
      eventLog: [...nextCombat.eventLog.slice(-5), `${enemy.name} lands ${damage}. Colony integrity at ${nextPlayerIntegrity}/${combat.playerMaxIntegrity}.`],
    }
  }

  return nextCombat
}

export function resolveCombatOutcomeFromSession(state: GameState, enemy: Enemy, combat: ActiveEnemyCombat): CombatResult {
  const baseResult = resolveCombat(state, enemy)
  const healthRatio = combat.enemyHealth / Math.max(1, combat.enemyMaxHealth)
  const integrityRatio = combat.playerIntegrity / Math.max(1, combat.playerMaxIntegrity)

  let outcome: CombatOutcome
  if (combat.enemyHealth <= 0 && integrityRatio >= 0.7) {
    outcome = 'perfect'
  } else if (combat.enemyHealth <= 0 && integrityRatio >= 0.3) {
    outcome = 'victory'
  } else if (combat.enemyHealth <= 0) {
    outcome = 'pyrrhic'
  } else if (healthRatio <= 0.2) {
    outcome = 'pyrrhic'
  } else {
    outcome = 'defeat'
  }

  const drops = rollDrops(state, enemy, outcome)
  const biomassReward = resolveNumber(enemy.biomassReward, state) * getOutcomeRewardMultiplier(outcome)
    + drops.reduce((total, drop) => total + drop.biomassReward, 0)
  const signalReward = drops.reduce((total, drop) => total + drop.signalReward, 0)
  const debuff = createDebuff(enemy, outcome)
  const flavorMessage = getCombatFlavorMessage(enemy, outcome)

  return {
    ...baseResult,
    outcome,
    biomassReward,
    signalReward,
    drops,
    debuff,
    flavorMessage,
    logLines: [
      `Encounter engaged: ${enemy.name} [${enemy.epithet}].`,
      `Combat exchange ${combat.attackCount}::${combat.enemyAttackCount} ended with ${outcome.toUpperCase()}.`,
      flavorMessage,
      ...combat.eventLog.slice(-3),
      ...(biomassReward > 0 ? [`Recovered ${biomassReward.toFixed(0)} biomass from the encounter.`] : []),
      ...(signalReward > 0 ? [`Recovered ${signalReward.toFixed(1)} Signal from residual echo tissue.`] : []),
      ...(debuff ? [`Residual damage: ${debuff.description}.`] : []),
    ],
  }
}

function getOutcome(playerPower: number, enemyPower: number): CombatOutcome {
  const ratio = playerPower / Math.max(0.01, enemyPower)
  if (ratio >= BALANCE.PVE_OUTCOME_PERFECT_RATIO) return 'perfect'
  if (ratio >= BALANCE.PVE_OUTCOME_VICTORY_RATIO) return 'victory'
  if (ratio >= BALANCE.PVE_OUTCOME_PYRRHIC_RATIO) return 'pyrrhic'
  return 'defeat'
}

function getOutcomeRewardMultiplier(outcome: CombatOutcome): number {
  switch (outcome) {
    case 'perfect':
      return BALANCE.PVE_REWARD_PERFECT_MULT
    case 'victory':
      return BALANCE.PVE_REWARD_VICTORY_MULT
    case 'pyrrhic':
      return BALANCE.PVE_REWARD_PYRRHIC_MULT
    case 'defeat':
      return BALANCE.PVE_REWARD_DEFEAT_MULT
  }
}

export function rollDrops(state: GameState, enemy: Enemy, outcome: CombatOutcome): DropResult[] {
  if (outcome === 'defeat') {
    return []
  }

  const luckBonus = state.stats.complexity * BALANCE.PVE_DROP_LUCK_COMPLEXITY_BONUS

  return enemy.dropTable.flatMap((drop) => {
    if (drop.perfectOnly && outcome !== 'perfect') {
      return []
    }

    if (Math.random() > Math.min(0.95, drop.chance + luckBonus)) {
      return []
    }

    const biomassReward = drop.biomassReward ? resolveNumber(drop.biomassReward, state) : 0
    const signalReward = typeof drop.signalReward === 'function' ? drop.signalReward(state) : (drop.signalReward ?? 0)

    return [{
      id: drop.id,
      name: drop.name,
      description: drop.description,
      biomassReward,
      signalReward,
    }]
  })
}

function createDebuffEffects(enemy: Enemy, outcome: CombatOutcome): EnemyDebuffEffect[] {
  if (outcome === 'perfect' || outcome === 'victory') {
    return []
  }

  const stronger = outcome === 'defeat'
  switch (enemy.behavior) {
    case 'stealer':
      return [{ type: 'bpsMultiplier', magnitude: stronger ? 0.22 : 0.12 }]
    case 'burrower':
      return [{ type: 'spawnCooldownMultiplier', magnitude: stronger ? 0.68 : 0.82 }]
    case 'armored':
      return [{ type: 'clickMultiplier', magnitude: stronger ? 0.25 : 0.14 }]
    case 'swarmer':
      return [
        { type: 'bpsMultiplier', magnitude: stronger ? 0.16 : 0.08 },
        { type: 'clickMultiplier', magnitude: stronger ? 0.14 : 0.08 },
      ]
    case 'adapting':
      return [{ type: 'spawnCooldownMultiplier', magnitude: stronger ? 0.6 : 0.78 }]
    case 'sacrificial':
      return [{ type: 'bpsMultiplier', magnitude: stronger ? 0.18 : 0.1 }]
    default:
      return [{ type: 'bpsMultiplier', magnitude: stronger ? 0.14 : 0.08 }]
  }
}

function describeDebuff(effects: EnemyDebuffEffect[]): string {
  return effects.map((effect) => {
    if (effect.type === 'bpsMultiplier') {
      return `${Math.round(effect.magnitude * 100)}% passive suppression`
    }
    if (effect.type === 'clickMultiplier') {
      return `${Math.round(effect.magnitude * 100)}% click suppression`
    }
    return `${Math.round((1 - effect.magnitude) * 100)}% faster threat checks`
  }).join(' / ')
}

export function createDebuff(enemy: Enemy, outcome: CombatOutcome): ActiveEnemyDebuff | null {
  const effects = createDebuffEffects(enemy, outcome)
  if (effects.length === 0) {
    return null
  }

  const durationMs = outcome === 'defeat'
    ? BALANCE.PVE_DEBUFF_DEFEAT_DURATION_MS
    : BALANCE.PVE_DEBUFF_PYRRHIC_DURATION_MS

  return {
    id: `${enemy.id}-${Date.now()}`,
    enemyId: enemy.id,
    sourceName: enemy.name,
    name: outcome === 'defeat' ? `${enemy.name} backlash` : `${enemy.name} wound`,
    description: describeDebuff(effects),
    durationMs,
    remainingMs: durationMs,
    effects,
  }
}

export function getCombatFlavorMessage(enemy: Enemy, outcome: CombatOutcome): string {
  switch (outcome) {
    case 'perfect':
      return `${enemy.name} folded into the colony before it could destabilize the substrate.`
    case 'victory':
      return `${enemy.name} was driven off and its remains fed the advancing lattice.`
    case 'pyrrhic':
      return `${enemy.name} was contained, but not before it tore scars through the active mesh.`
    case 'defeat':
      return `${enemy.name} broke the local front and left the colony reeling.`
  }
}

export function resolveCombat(state: GameState, enemy: Enemy): CombatResult {
  const enemyPower = calculateEnemyPower(state, enemy)
  const playerPower = calculatePlayerEncounterPower(state, enemy)
  const outcome = getOutcome(playerPower, enemyPower)
  const matchup = getCountermeasureEncounterMatchup(state, enemy)
  const baseReward = resolveNumber(enemy.biomassReward, state) * getOutcomeRewardMultiplier(outcome)
  const drops = rollDrops(state, enemy, outcome)
  const biomassReward = baseReward + drops.reduce((total, drop) => total + drop.biomassReward, 0)
  const signalReward = drops.reduce((total, drop) => total + drop.signalReward, 0)
  const debuff = createDebuff(enemy, outcome)
  const flavorMessage = getCombatFlavorMessage(enemy, outcome)

  const logLines = [
    `Encounter engaged: ${enemy.name} [${enemy.epithet}].`,
    `Pressure ratio ${playerPower.toFixed(1)} :: ${enemyPower.toFixed(1)} resolved as ${outcome.toUpperCase()}.`,
    flavorMessage,
  ]

  if (biomassReward > 0) {
    logLines.push(`Recovered ${biomassReward.toFixed(0)} biomass from the encounter.`)
  }
  if (signalReward > 0) {
    logLines.push(`Recovered ${signalReward.toFixed(1)} Signal from residual echo tissue.`)
  }
  if (debuff) {
    logLines.push(`Residual damage: ${debuff.description}.`)
  }

  return {
    enemyId: enemy.id,
    enemyName: enemy.name,
    enemyPower,
    playerPower,
    outcome,
    matchup,
    biomassReward,
    signalReward,
    drops,
    debuff,
    permanentBonus: null,
    flavorMessage,
    logLines,
  }
}
