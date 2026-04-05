/**
 * simulation.ts
 * Headless balance verification runner.
 *
 * Uses the real game engine for the early game (tick-by-tick),
 * then switches to analytical fast-forward for later stages where
 * the engine is too slow to simulate days of game time.
 *
 * Defense events are disabled for clean pacing measurements.
 *
 * Run:  npx tsx src/engine/simulation.ts [duration_hours]
 * E.g.: npx tsx src/engine/simulation.ts 240   (10 days)
 */

import {
  createFreshState,
  tick,
  advanceStageAction,
  absorb as engineAbsorb,
  checkVisibilityUnlocks,
  // Signal economy temporarily disabled.
  // tickSignalSystem,
  // spendSignalCoordinationCommand,
  // spendSignalVulnerabilityWindow,
  // spendSignalRivalSuppression,
} from './happenings'
import * as formulas from './formulas'
import { BALANCE } from './balance.config'
import type { GameState } from '../lib/game'
import { generatorDefinitions, upgradeDefinitions } from '../lib/game'
import Decimal from 'break_eternity.js'

declare const process: { argv: string[] }

const args = process.argv.slice(2)
const verbose = args.includes('--verbose')
const positionalArgs = args.filter((a) => !a.startsWith('--'))
const DURATION_HOURS = parseFloat(positionalArgs[0] ?? '240')
const MAX_GAME_SECONDS = DURATION_HOURS * 3600
const TICK_MS = BALANCE.TICK_MS

// ── Milestones ──────────────────────────────────────────────────────────

const milestones = [
  { label: 'First generator', check: (s: GameState) => s.generators['hyphae-strand'].owned >= 1 },
  { label: 'First host cleared (Strain)', check: (s: GameState) => formulas.getCompletedHosts(s) >= 1 },
  { label: 'Stage 3 reached (Skills)', check: (s: GameState) => s.currentStage >= 3 },
  { label: 'Stage 1 cleared', check: (s: GameState) => s.currentStage >= 2 },
  { label: 'Stage 2 cleared', check: (s: GameState) => s.currentStage >= 3 },
  // Signal economy temporarily disabled.
  // { label: 'Signal unlocked (Stage 3)', check: (s: GameState) => s.currentStage >= 3 },
  { label: 'Stage 3 cleared', check: (s: GameState) => s.currentStage >= 4 },
  { label: 'Stage 4 cleared', check: (s: GameState) => s.currentStage >= 5 },
  { label: 'Stage 5 cleared', check: (s: GameState) => s.currentStage >= 6 },
  { label: 'Stage 6 cleared', check: (s: GameState) => s.currentStage >= 7 },
  { label: 'Stage 7 cleared', check: (s: GameState) => s.currentStage >= 8 },
  { label: 'Stage 8 cleared', check: (s: GameState) => s.currentStage >= 8 && s.hostCompleted },
  // { label: 'First coord command issued', check: (s: GameState) => s.activeCoordinationLinks.length > 0 },
  // { label: 'Signal cap maxed (>= cap)', check: (s: GameState) => s.signal >= formulas.getSignalCap(s) * 0.95 },
]
for (let t = 1; t < generatorDefinitions.length; t++) {
  const gen = generatorDefinitions[t]
  milestones.push({
    label: `Tier ${t + 1} unlocked (${gen.name})`,
    check: (s: GameState) => s.visibility.generatorTiers[t],
  })
}
const reached = new Map<string, number>()

// ── Helpers ─────────────────────────────────────────────────────────────

function fmt(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function genSummary(s: GameState): string {
  return generatorDefinitions.map((g) => `${g.name.charAt(0)}:${s.generators[g.id].owned}`).join(' ')
}

function suppressDefense(state: GameState, fakeTime: number): GameState {
  if (state.activeDefenseEvents.length === 0 && state.nextDefenseCheckAt > fakeTime) return state
  return { ...state, nextDefenseCheckAt: fakeTime + 1e12, activeDefenseEvents: [] }
}

// Signal economy temporarily disabled.
// function getOwnedSignalTiers(state: GameState): number[] {
//   return generatorDefinitions
//     .map((generator, index) => ({ generator, index }))
//     .filter(({ generator, index }) => state.visibility.generatorTiers[index] && state.generators[generator.id].owned > 0)
//     .map(({ index }) => index)
// }

// function autoSpendSignal(state: GameState): GameState {
//   if (!formulas.isSignalUnlocked(state)) return state
//   if (state.signal < formulas.getSignalCap(state) * 0.7) return state
//   return state
// }

function advanceAnalyticalChunk(state: GameState, seconds: number): GameState {
  const bps = formulas.calculateBiomassPerSecond(state)
  const production = bps.mul(seconds)
  // Signal economy temporarily disabled.
  const hostDamage = production

  let next: GameState = {
    ...state,
    biomass: state.biomass.add(production),
    lifetimeBiomass: state.lifetimeBiomass.add(production),
    hostHealth: Decimal.max(0, state.hostHealth.sub(hostDamage)),
    hostCompleted: state.hostHealth.sub(hostDamage).lte(0),
    biomassPerSecond: bps,
  }

  return next
}

function checkMs(state: GameState, gs: number): void {
  for (const m of milestones) {
    if (!reached.has(m.label) && m.check(state)) {
      reached.set(m.label, gs)
      console.log(`${fmt(gs).padStart(15)} | \u2713 ${m.label}`)
    }
  }
}

/**
 * Lightweight bulk-buy: purchases all affordable generators and upgrades
 * without the per-purchase overhead of checkVisibilityUnlocks + recalculateDerivedState.
 * Calls checkVisibilityUnlocks once at the end (cheap), but skips recalculateDerivedState
 * (expensive due to getLevelFromEp) — the caller is responsible for BPS tracking.
 *
 * Returns the updated state plus a flag indicating if any purchases were made.
 */
function bulkBuy(state: GameState, fakeTime: number): { state: GameState; purchased: boolean } {
  let s = state
  let purchased = false

  // Buy upgrades (cheap check, only 3 currently)
  for (const upg of upgradeDefinitions) {
    if (s.upgrades[upg.id]) continue
    if (s.generators[upg.requiredGenerator].owned < upg.requiredOwned) continue
    if (s.biomass.gte(upg.cost)) {
      s = {
        ...s,
        upgrades: { ...s.upgrades, [upg.id]: true },
        biomass: Decimal.max(0, s.biomass.sub(upg.cost)),
      }
      purchased = true
    }
  }

  // Buy generators — highest visible tier first, buy as many as affordable
  let anyBought = true
  let safetyPasses = 0
  while (anyBought && safetyPasses < 20) {
    anyBought = false
    safetyPasses++
    for (let t = generatorDefinitions.length - 1; t >= 0; t--) {
      if (!s.visibility.generatorTiers[t]) continue
      const gen = generatorDefinitions[t]
      let owned = s.generators[gen.id].owned
      let biomass = s.biomass

      // Calculate how many we can buy (geometric cost: baseCost * 1.18^owned)
      let count = 0
      while (true) {
        const cost = formulas.getGeneratorCostByOwned(gen.id, owned + count)
        if (biomass.lt(cost)) break
        biomass = biomass.sub(cost)
        count++
        // Safety: don't buy more than 500 in one burst per tier
        if (count >= 500) break
      }

      if (count > 0) {
        s = {
          ...s,
          biomass,
          generators: {
            ...s.generators,
            [gen.id]: { owned: owned + count },
          },
        }
        anyBought = true
        purchased = true
      }
    }
  }

  // Visibility check is cheap (0ms), recalculate BPS for visibility decisions
  s = {
    ...s,
    biomassPerSecond: formulas.calculateBiomassPerSecond(s),
  }
  s = checkVisibilityUnlocks(s, fakeTime)

  return { state: s, purchased }
}

// ── Phase 1: Tick-by-tick engine run (up to the switchover point) ───────

/** Run the real engine tick-by-tick for precise early-game timing. */
function runTickPhase(state: GameState, fakeTime: number, gameSeconds: number, maxSeconds: number): { state: GameState; fakeTime: number; gameSeconds: number } {
  const maxTicks = Math.floor((maxSeconds - gameSeconds) * 1000 / TICK_MS)
  let lastMinute = -1

  for (let i = 0; i < maxTicks; i++) {
    fakeTime += TICK_MS
    gameSeconds += TICK_MS / 1000

    state = tick(state, fakeTime)
    state = suppressDefense(state, fakeTime)

    // Debug: periodic status (only if verbose)
    if (verbose) {
      const cm = Math.floor(gameSeconds / 60)
      if (cm !== lastMinute) {
        lastMinute = cm
        console.log(`${fmt(gameSeconds).padStart(15)} |   S${state.currentStage} BPS=${state.biomassPerSecond.toExponential(2)} HP=${state.hostHealth.toExponential(2)} | ${genSummary(state)}`)
      }
    }

    // AI: buy all affordable upgrades + generators in one batch
    ;({ state } = bulkBuy(state, fakeTime))
    checkMs(state, gameSeconds)

    // Auto-advance
    if (state.hostCompleted && formulas.hasNextStage(state)) {
      state = advanceStageAction(state)
    }

    checkMs(state, gameSeconds)

    if (reached.size === milestones.length) break

    // Switch to analytical phase once Stage 1 is cleared (engine too slow for later stages)
    if (state.currentStage >= 2) break
  }

  return { state, fakeTime, gameSeconds }
}

// ── Phase 2: Analytical fast-forward ────────────────────────────────────

/**
 * After the early game, production is dominated by the highest unlocked tier.
 * We analytically compute time to deplete host health, buy generators, and
 * unlock new tiers without running the expensive per-tick engine.
 */
function runAnalyticalPhase(state: GameState, fakeTime: number, gameSeconds: number): { state: GameState; fakeTime: number; gameSeconds: number } {

  const MAX_ITER = 200_000
  let lastLoggedMinute = -1

  for (let iter = 0; iter < MAX_ITER && gameSeconds < MAX_GAME_SECONDS; iter++) {
    // Buy everything affordable first
    ;({ state } = bulkBuy(state, fakeTime))

    // Auto-advance stage
    if (state.hostCompleted && formulas.hasNextStage(state)) {
      state = advanceStageAction(state)
      // After advancing, bulkBuy again (new tiers may unlock)
      ;({ state } = bulkBuy(state, fakeTime))
    }

    checkMs(state, gameSeconds)
    if (reached.size === milestones.length) break

    // Compute BPS for time jumps
    const bps = formulas.calculateBiomassPerSecond(state)
    if (bps.lte(0)) break

    // ── Determine time to next meaningful event ──

    let jumpSeconds = MAX_GAME_SECONDS - gameSeconds  // default: jump to end

    // 1) Time until host depletes — this is always the hard upper bound
    if (!state.hostCompleted && state.hostHealth.gt(0)) {
      const s = state.hostHealth.div(bps).toNumber()
      if (s > 0 && s < jumpSeconds) jumpSeconds = s
    }

    // 2) Time to buy the next highest-tier generator.
    //    If it's very short (< 60s), jump 60s instead to batch many purchases.
    let highestVisibleTier = -1
    for (let t = generatorDefinitions.length - 1; t >= 0; t--) {
      if (state.visibility.generatorTiers[t]) { highestVisibleTier = t; break }
    }
    if (highestVisibleTier >= 0) {
      const gen = generatorDefinitions[highestVisibleTier]
      const cost = formulas.getGeneratorCostByOwned(gen.id, state.generators[gen.id].owned)
      const deficit = cost.sub(state.biomass)
      if (deficit.gt(0)) {
        const s = deficit.div(bps).toNumber()
        if (s > 0) {
          // If next purchase is < 300s away, batch: jump at least 300s so bulkBuy
          // handles many purchases at once instead of one per iteration.
          const batchedJump = Math.max(s, 300)
          if (batchedJump < jumpSeconds) jumpSeconds = batchedJump
        }
      }
    }

    // Clamp the jump to at most 1/4 of remaining host time for responsiveness.
    if (!state.hostCompleted && state.hostHealth.gt(0)) {
      const hostTimeRemaining = state.hostHealth.div(bps).toNumber()
      const quarterTime = hostTimeRemaining / 4
      if (quarterTime > 1 && quarterTime < jumpSeconds) {
        jumpSeconds = quarterTime
      }
    }

    // 3) Time until cheapest available upgrade
    for (const upg of upgradeDefinitions) {
      if (state.upgrades[upg.id]) continue
      if (state.generators[upg.requiredGenerator].owned < upg.requiredOwned) continue
      const deficit = upg.cost.sub(state.biomass)
      if (deficit.gt(0)) {
        const s = deficit.div(bps).toNumber()
        if (s > 0 && s < jumpSeconds) jumpSeconds = s
      }
    }

    // Minimum jump: 1 second (avoid spinning)
    jumpSeconds = Math.max(1, jumpSeconds + 0.01)
    const jump = Math.min(jumpSeconds, MAX_GAME_SECONDS - gameSeconds)
    if (jump <= 0) break

    let remainingJump = jump
    while (remainingJump > 0) {
      checkMs(state, gameSeconds)
      const chunk = Math.min(30, remainingJump)
      state = advanceAnalyticalChunk(state, chunk)
      fakeTime += chunk * 1000
      gameSeconds += chunk
      remainingJump -= chunk
      checkMs(state, gameSeconds)

      if (state.hostCompleted) {
        break
      }
    }

    state = suppressDefense(state, fakeTime)

    // Verbose logging
    if (verbose) {
      const cm = Math.floor(gameSeconds / 60)
      if (cm !== lastLoggedMinute) {
        lastLoggedMinute = cm
        console.log(`${fmt(gameSeconds).padStart(15)} |   S${state.currentStage} BPS=${state.biomassPerSecond.toExponential(2)} HP=${state.hostHealth.toExponential(2)} | ${genSummary(state)}`)
      }
    }
  }

  return { state, fakeTime, gameSeconds }
}

// ── Main ────────────────────────────────────────────────────────────────

console.log(`\nSimulating ${DURATION_HOURS}h (${(DURATION_HOURS / 24).toFixed(1)} days)...`)
console.log(`Defense events: DISABLED (clean pacing)\n`)
console.log('GAME TIME       | EVENT')
console.log('\u2500'.repeat(70))

let state = createFreshState()
let fakeTime = Date.now()
let gameSeconds = 0

state = suppressDefense(state, fakeTime)
for (let i = 0; i < 20; i++) state = engineAbsorb(state)

const startWall = Date.now()

// Phase 1: Tick-by-tick until Stage 1 clears (precise early-game timing)
console.log(`${fmt(0).padStart(15)} | [Phase 1: tick-by-tick through Stage 1]`)
;({ state, fakeTime, gameSeconds } = runTickPhase(state, fakeTime, gameSeconds, MAX_GAME_SECONDS))

// Phase 2: Analytical fast-forward for the remaining duration
if (gameSeconds < MAX_GAME_SECONDS && reached.size < milestones.length) {
  console.log(`${fmt(gameSeconds).padStart(15)} | [Phase 2: analytical fast-forward to ${fmt(MAX_GAME_SECONDS)}]`)
  ;({ state, fakeTime, gameSeconds } = runAnalyticalPhase(state, fakeTime, gameSeconds))
}

const elapsedWall = ((Date.now() - startWall) / 1000).toFixed(1)

// ── Summary ─────────────────────────────────────────────────────────────

console.log('\n' + '\u2500'.repeat(70))
console.log(`Simulation complete in ${elapsedWall}s wall time.\n`)

console.log('Final state:')
console.log(`  Stage: ${state.currentStage}${state.hostCompleted ? ' (completed)' : ''}`)
console.log(`  Hosts:  ${formulas.getCompletedHosts(state)}`)
console.log(`  BPS:   ${state.biomassPerSecond.toExponential(3)}`)
// Signal economy temporarily disabled.
// console.log(`  Signal: ${state.signal.toFixed(1)} / ${formulas.getSignalCap(state).toFixed(0)} | SPS: ${formulas.getSignalPerSecond(state).toFixed(2)}`)
console.log(`  Generators: ${genSummary(state)}`)
console.log(`  Milestones: ${reached.size}/${milestones.length}`)

// Pacing summary
const stageClears = [...reached.entries()].filter(([l]) => l.startsWith('Stage')).sort(([, a], [, b]) => a - b)
if (stageClears.length > 0) {
  console.log('\nPacing summary:')
  console.log('  STAGE CLEAR       | GAME TIME   | ELAPSED     | TARGET')
  console.log('  ' + '\u2500'.repeat(60))
  const targets = ['~12m', '~90m', '~4h', '~10h', '~24h', '~48h', '~4d', '~7d']
  let prev = 0
  for (let i = 0; i < stageClears.length; i++) {
    const [label, sec] = stageClears[i]
    const elapsed = sec - prev
    const target = targets[i] ?? '?'
    console.log(`  ${label.padEnd(19)} | ${fmt(sec).padEnd(11)} | ${fmt(elapsed).padEnd(11)} | ${target}`)
    prev = sec
  }
}

// Tier unlock timeline
const tierUnlocks = [...reached.entries()].filter(([l]) => l.startsWith('Tier')).sort(([, a], [, b]) => a - b)
if (tierUnlocks.length > 0) {
  console.log('\nTier unlock timeline:')
  for (const [label, sec] of tierUnlocks) {
    console.log(`  ${fmt(sec).padStart(11)} | ${label}`)
  }
}
