import type { CountermeasureId, GameState } from '../../lib/game'

export type EnemyBehavior =
  | 'standard'
  | 'swarmer'
  | 'burrower'
  | 'armored'
  | 'stealer'
  | 'adapting'
  | 'sacrificial'

export type EnemyPowerValue = number | ((state: GameState) => number)
export type EnemyRewardValue = number | ((state: GameState) => number)

export interface DropEntry {
  id: string
  name: string
  description: string
  chance: number
  biomassReward?: EnemyRewardValue
  signalReward?: number | ((state: GameState) => number)
  perfectOnly?: boolean
}

export interface DropResult {
  id: string
  name: string
  description: string
  biomassReward: number
  signalReward: number
}

export interface PermanentBonus {
  id: string
  name: string
  description: string
}

export interface Enemy {
  id: string
  name: string
  epithet: string
  description: string
  ecology: string
  counterplay: string
  behavior: EnemyBehavior
  hostStageMin: number
  hostStageMax: number | null
  power: EnemyPowerValue
  biomassReward: EnemyRewardValue
  spawnWeight: number
  weaknesses: CountermeasureId[]
  resistances: CountermeasureId[]
  dropTable: DropEntry[]
}

export type CombatOutcome = 'perfect' | 'victory' | 'pyrrhic' | 'defeat'

export interface EnemyDebuffEffect {
  type: 'bpsMultiplier' | 'clickMultiplier' | 'spawnCooldownMultiplier'
  magnitude: number
}

export interface EnemyDebuff {
  id: string
  name: string
  description: string
  durationMs: number
  effects: EnemyDebuffEffect[]
}

export interface ActiveEnemyDebuff extends EnemyDebuff {
  enemyId: string
  sourceName: string
  remainingMs: number
}

export interface ActiveEnemyEncounter {
  enemyId: string
  spawnedAt: number
  detectedPower: number
  notification: string
}

export interface ActiveEnemyCombat {
  enemyId: string
  enemyName: string
  enemyBehavior: EnemyBehavior
  startedAt: number
  enemyHealth: number
  enemyMaxHealth: number
  playerIntegrity: number
  playerMaxIntegrity: number
  playerAttack: number
  enemyAttack: number
  enemyAttackIntervalMs: number
  enemyAttackCooldownMs: number
  attackWindupMs: number
  attackWindupRemainingMs: number
  attackCount: number
  enemyAttackCount: number
  eventLog: string[]
}

export interface CombatResult {
  enemyId: string
  enemyName: string
  enemyPower: number
  playerPower: number
  outcome: CombatOutcome
  matchup: 'advantage' | 'neutral' | 'resisted'
  biomassReward: number
  signalReward: number
  drops: DropResult[]
  debuff: ActiveEnemyDebuff | null
  permanentBonus: PermanentBonus | null
  flavorMessage: string
  logLines: string[]
}
