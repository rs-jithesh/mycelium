/**
 * simulation-debug.ts
 * Short diagnostic run to trace the cascade bug.
 * Run with: npx tsx src/engine/simulation-debug.ts
 */

import { createFreshState, tick, buyGeneratorAction, buyUpgradeAction, advanceStageAction, absorb as engineAbsorb, checkVisibilityUnlocks } from './happenings'
import * as formulas from './formulas'
import { BALANCE } from './balance.config'
import type { GameState } from '../lib/game'
import { generatorDefinitions, upgradeDefinitions } from '../lib/game'
import Decimal from 'break_eternity.js'

declare const process: { argv: string[] }

const TICK_MS = BALANCE.TICK_MS
// Simulate 3 hours of game time
const TOTAL_GAME_SECONDS = 3 * 3600
const TOTAL_TICKS = Math.floor((TOTAL_GAME_SECONDS * 1000) / TICK_MS)

let state = createFreshState()

// Use a fake time to simulate properly
let fakeTime = Date.now()

// Initial clicks
for (let i = 0; i < 20; i++) {
  state = engineAbsorb(state)
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}m${s.toString().padStart(2, '0')}s`
}

function genSummary(s: GameState): string {
  return generatorDefinitions.map(g => `${g.name.charAt(0)}:${s.generators[g.id].owned}`).join(' ')
}

function tierVisibility(s: GameState): string {
  return s.visibility.generatorTiers.map((v, i) => v ? i : '').filter(x => x !== '').join(',')
}

let prevStage = state.currentStage
let prevHostCompleted = state.hostCompleted
let lastPrintMinute = -1

// Track which tiers were visible
let prevTierVis = [...state.visibility.generatorTiers]

console.log(`Simulating ${TOTAL_GAME_SECONDS / 3600}h (${TOTAL_TICKS} ticks)...\n`)
console.log('TIME      | STAGE | HOST_HP          | BPS              | BIOMASS          | TIERS_VIS | GENS')
console.log('-'.repeat(120))

for (let i = 0; i < TOTAL_TICKS; i++) {
  fakeTime += TICK_MS
  const gameSeconds = (i + 1) * TICK_MS / 1000
  const gameMinutes = gameSeconds / 60

  state = tick(state, fakeTime)

  // Auto-buy upgrades
  for (const upgrade of upgradeDefinitions) {
    if (!state.upgrades[upgrade.id] &&
        state.generators[upgrade.requiredGenerator].owned >= upgrade.requiredOwned &&
        state.biomass.gte(upgrade.cost)) {
      state = buyUpgradeAction(state, upgrade.id)
      console.log(`${formatTime(gameSeconds).padStart(9)} | UPGRADE: ${upgrade.name} purchased`)
    }
  }

  // Auto-buy highest affordable generator (buy all affordable, top-down)
  let bought = true
  while (bought) {
    bought = false
    for (let tier = generatorDefinitions.length - 1; tier >= 0; tier--) {
      const gen = generatorDefinitions[tier]
      if (!state.visibility.generatorTiers[tier]) continue
      const cost = formulas.getGeneratorCostByOwned(gen.id, state.generators[gen.id].owned)
      if (state.biomass.gte(cost)) {
        state = buyGeneratorAction(state, gen.id)
        bought = true
        break
      }
    }
  }

  // Check for new tier unlocks
  for (let t = 0; t < state.visibility.generatorTiers.length; t++) {
    if (state.visibility.generatorTiers[t] && !prevTierVis[t]) {
      console.log(`${formatTime(gameSeconds).padStart(9)} | TIER ${t + 1} UNLOCKED (stage=${state.currentStage}, hostCompleted=${state.hostCompleted})`)
    }
  }
  prevTierVis = [...state.visibility.generatorTiers]

  // Auto-advance
  if (state.hostCompleted && formulas.hasNextStage(state)) {
    console.log(`${formatTime(gameSeconds).padStart(9)} | HOST COMPLETED (stage=${state.currentStage}) - hostHealth=${state.hostHealth.toExponential(2)}, advancing...`)
    state = advanceStageAction(state)
    console.log(`${formatTime(gameSeconds).padStart(9)} |   -> Now stage ${state.currentStage}, hostHealth=${state.hostHealth.toExponential(2)}, BPS=${state.biomassPerSecond.toExponential(2)}`)
  }

  // Periodic logging every minute
  const currentMinute = Math.floor(gameMinutes)
  if (currentMinute !== lastPrintMinute && currentMinute % 1 === 0) {
    lastPrintMinute = currentMinute
    console.log(
      `${formatTime(gameSeconds).padStart(9)} | S${state.currentStage}    | ${state.hostHealth.toExponential(2).padStart(16)} | ${state.biomassPerSecond.toExponential(2).padStart(16)} | ${state.biomass.toExponential(2).padStart(16)} | ${tierVisibility(state).padStart(9)} | ${genSummary(state)}`
    )
  }

  // Stop early if stage 4+ reached
  if (state.currentStage >= 4) {
    console.log(`\nEarly stop: reached stage ${state.currentStage} at ${formatTime(gameSeconds)}`)
    break
  }

  // Only print every 5 minutes after minute 30 to reduce output
  if (gameMinutes > 30 && currentMinute % 5 !== 0) {
    lastPrintMinute = currentMinute
  }
}

console.log('\nFinal state:')
console.log(`  Stage: ${state.currentStage}`)
console.log(`  BPS: ${state.biomassPerSecond.toExponential(3)}`)
console.log(`  Biomass: ${state.biomass.toExponential(3)}`)
console.log(`  Host Health: ${state.hostHealth.toExponential(3)}`)
console.log(`  Generators: ${genSummary(state)}`)
console.log(`  Visible tiers: ${tierVisibility(state)}`)
