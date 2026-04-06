/**
 * analytical-model.ts
 * 
 * Analytical BPS growth model for the 8-tier generator economy with stage-gated unlocks.
 * 
 * MODE: --derive  Compute HOST_HEALTH from target clear times
 * MODE: (default) Measure pacing with current HOST_HEALTH
 * 
 * Run with: npx tsx src/engine/analytical-model.ts [--derive]
 */

import { BALANCE } from './balance.config'

declare const process: { argv: string[] }

const DERIVE_MODE = process.argv.includes('--derive')

// --- CONSTANTS ---
const BASE_COSTS = BALANCE.GENERATOR_BASE_COSTS
const BASE_PROD  = BALANCE.GENERATOR_BASE_PRODUCTION
const COST_EXP   = BALANCE.GENERATOR_COST_EXPONENT
const UNLOCK_THRESHOLDS = BALANCE.GENERATOR_UNLOCK_THRESHOLDS
const STAGE_GATES = BALANCE.GENERATOR_STAGE_GATES
const NUM_TIERS  = BASE_COSTS.length

// --- HELPERS ---

function generatorCost(tier: number, owned: number): number {
  return BASE_COSTS[tier] * Math.pow(COST_EXP, owned)
}

function computeBPS(owned: number[], upgrades: boolean[]): number {
  let total = 0
  for (let tier = 0; tier < NUM_TIERS; tier++) {
    let prod = BASE_PROD[tier] * owned[tier]
    if (tier === 0 && upgrades[0]) prod *= 1.25
    if (upgrades[1]) prod *= 1.05
    total += prod
  }
  return total
}

function isTierUnlocked(tier: number, owned: number[], clearedStage: number): boolean {
  if (tier === 0) return true
  if (owned[tier - 1] < UNLOCK_THRESHOLDS[tier]) return false
  if (STAGE_GATES[tier] > 0 && clearedStage < STAGE_GATES[tier]) return false
  return true
}

// --- SIMULATION ENGINE (shared) ---

interface SimState {
  owned: number[]
  biomass: number
  totalBiomass: number
  bps: number
  time: number
  upgrades: boolean[]
  clearedStage: number
}

const UPGRADE_COSTS = [75, 12000, 2_500_000]
const UPGRADE_REQUIRED_GEN = [0, 1, 2]
const UPGRADE_REQUIRED_OWNED = [5, 5, 5]

function canBuyUpgrade(idx: number, s: SimState): boolean {
  if (s.upgrades[idx]) return false
  if (s.owned[UPGRADE_REQUIRED_GEN[idx]] < UPGRADE_REQUIRED_OWNED[idx]) return false
  if (s.biomass < UPGRADE_COSTS[idx]) return false
  return true
}

function freshState(): SimState {
  return {
    owned: new Array(NUM_TIERS).fill(0),
    biomass: 5,
    totalBiomass: 5,
    bps: 0,
    time: 0,
    upgrades: [false, false, false],
    clearedStage: 0,
  }
}

// Advance simulation to a target time. Returns events processed.
function simUntil(state: SimState, targetTime: number, maxEvents = 2_000_000): number {
  let events = 0
  while (state.time < targetTime && events < maxEvents) {
    events++

    // Try upgrades
    let bought = false
    for (let u = 0; u < 3; u++) {
      if (canBuyUpgrade(u, state)) {
        state.biomass -= UPGRADE_COSTS[u]
        state.upgrades[u] = true
        state.bps = computeBPS(state.owned, state.upgrades)
        bought = true
        break
      }
    }
    if (bought) continue

    // Buy highest affordable tier
    let bestTier = -1
    for (let tier = NUM_TIERS - 1; tier >= 0; tier--) {
      if (!isTierUnlocked(tier, state.owned, state.clearedStage)) continue
      if (state.biomass >= generatorCost(tier, state.owned[tier])) {
        bestTier = tier
        break
      }
    }
    if (bestTier >= 0) {
      state.biomass -= generatorCost(bestTier, state.owned[bestTier])
      state.owned[bestTier]++
      state.bps = computeBPS(state.owned, state.upgrades)
      continue
    }

    // Wait for cheapest
    let cheapest = Infinity
    for (let tier = 0; tier < NUM_TIERS; tier++) {
      if (!isTierUnlocked(tier, state.owned, state.clearedStage)) continue
      const c = generatorCost(tier, state.owned[tier])
      if (c < cheapest) cheapest = c
    }
    for (let u = 0; u < 3; u++) {
      if (state.upgrades[u]) continue
      if (state.owned[UPGRADE_REQUIRED_GEN[u]] >= UPGRADE_REQUIRED_OWNED[u]) {
        if (UPGRADE_COSTS[u] < cheapest) cheapest = UPGRADE_COSTS[u]
      }
    }
    if (state.bps <= 0) break

    let dt = (cheapest - state.biomass) / state.bps
    if (state.time + dt > targetTime) dt = targetTime - state.time
    state.time += dt
    state.biomass += state.bps * dt
    state.totalBiomass += state.bps * dt
    if (state.time >= targetTime) break
  }
  return events
}

// --- DERIVE MODE ---

function runDeriveMode() {
  // Fixed values
  const STAGE_1_HEALTH = 600

  // Target clear times (cumulative from game start)
  const TARGET_TIMES = [
    45 * 60,
    4 * 3600,
    8 * 3600,
    24 * 3600,
    48 * 3600,
    72 * 3600,
    120 * 3600,
    144 * 3600,
    168 * 3600,
  ]

  const state = freshState()
  const derivedHealth: number[] = []
  let cumulativeHealth = 0

  console.log('\n=== DERIVING HOST_HEALTH (Stage 1 fixed at 600) ===\n')
  console.log('Stage gates: Tier 5->S2, Tier 6->S4, Tier 7->S6, Tier 8->S7\n')

  for (let stage = 0; stage < 8; stage++) {
    const targetTime = TARGET_TIMES[stage]

    // Simulate until target time
    simUntil(state, targetTime)

    // Calculate this stage's health
    let stageHealth: number
    if (stage === 0) {
      stageHealth = STAGE_1_HEALTH
    } else {
      stageHealth = Math.max(1000, state.totalBiomass - cumulativeHealth)
    }

    derivedHealth.push(stageHealth)
    cumulativeHealth += stageHealth

    // Mark stage as cleared
    state.clearedStage = stage + 1

    const tierUnlocks = []
    for (let t = 0; t < NUM_TIERS; t++) {
      if (STAGE_GATES[t] === stage + 1) tierUnlocks.push(t + 1)
    }

    console.log(
      `Stage ${stage + 1}`.padEnd(10) +
      `Clear: ${formatTime(targetTime)}`.padEnd(18) +
      `BPS: ${state.bps.toExponential(3)}`.padEnd(22) +
      `Health: ${stageHealth.toExponential(3)}`.padEnd(24) +
      `Gens: ${state.owned.join('/')}` +
      (tierUnlocks.length ? `  -> Tier ${tierUnlocks.join(',')} unlocked` : '')
    )
  }

  console.log('\n--- COPY-PASTE for balance.config.ts ---')
  console.log('HOST_HEALTH: [')
  for (let i = 0; i < derivedHealth.length; i++) {
    const rounded = parseFloat(derivedHealth[i].toPrecision(3))
    console.log(`  ${rounded},${' '.repeat(Math.max(1, 20 - String(rounded).length))}// Stage ${i+1}: ~${formatTime(TARGET_TIMES[i])}`)
  }
  console.log('],')

  // Verify
  console.log('\n--- VERIFICATION ---')
  verifyWithHealth(derivedHealth)
}

function verifyWithHealth(healthValues: number[]) {
  const state = freshState()

  let cumul = 0
  const thresholds: number[] = []
  for (const h of healthValues) { cumul += h; thresholds.push(cumul) }

  const MAX_TIME = 400 * 3600
  let events = 0
  const clears: { stage: number; time: number; bps: number }[] = []
  const unlocks: { tier: number; time: number; bps: number }[] = []
  const tierSeen = new Array(NUM_TIERS).fill(false)
  tierSeen[0] = true

  while (state.time < MAX_TIME && events < 5_000_000 && state.clearedStage < 8) {
    events++

    // Stage clears
    while (state.clearedStage < healthValues.length && state.totalBiomass >= thresholds[state.clearedStage]) {
      state.clearedStage++
      clears.push({ stage: state.clearedStage, time: state.time, bps: state.bps })
    }

    // Tier unlocks
    for (let t = 1; t < NUM_TIERS; t++) {
      if (!tierSeen[t] && isTierUnlocked(t, state.owned, state.clearedStage)) {
        tierSeen[t] = true
        unlocks.push({ tier: t + 1, time: state.time, bps: state.bps })
      }
    }

    // Upgrades
    let bought = false
    for (let u = 0; u < 3; u++) {
      if (canBuyUpgrade(u, state)) {
        state.biomass -= UPGRADE_COSTS[u]; state.upgrades[u] = true
        state.bps = computeBPS(state.owned, state.upgrades)
        bought = true; break
      }
    }
    if (bought) continue

    // Buy highest affordable
    let best = -1
    for (let t = NUM_TIERS - 1; t >= 0; t--) {
      if (!isTierUnlocked(t, state.owned, state.clearedStage)) continue
      if (state.biomass >= generatorCost(t, state.owned[t])) { best = t; break }
    }
    if (best >= 0) {
      state.biomass -= generatorCost(best, state.owned[best])
      state.owned[best]++
      state.bps = computeBPS(state.owned, state.upgrades)
      continue
    }

    // Wait
    let cheapest = Infinity
    for (let t = 0; t < NUM_TIERS; t++) {
      if (!isTierUnlocked(t, state.owned, state.clearedStage)) continue
      cheapest = Math.min(cheapest, generatorCost(t, state.owned[t]))
    }
    for (let u = 0; u < 3; u++) {
      if (state.upgrades[u]) continue
      if (state.owned[UPGRADE_REQUIRED_GEN[u]] >= UPGRADE_REQUIRED_OWNED[u])
        cheapest = Math.min(cheapest, UPGRADE_COSTS[u])
    }
    if (state.bps <= 0) break

    const nextThresh = state.clearedStage < thresholds.length ? thresholds[state.clearedStage] : Infinity
    const dtAfford = (cheapest - state.biomass) / state.bps
    const dtStage = Math.max(0, (nextThresh - state.totalBiomass) / state.bps)
    const dt = Math.min(dtAfford, dtStage)

    state.time += dt
    state.biomass += state.bps * dt
    state.totalBiomass += state.bps * dt
  }

  console.log('')
  for (const c of clears) {
    const tiers = unlocks.filter(u => Math.abs(u.time - c.time) < 1).map(u => `Tier ${u.tier}`)
    console.log(`  Stage ${c.stage} cleared at ${formatTime(c.time).padEnd(10)} BPS: ${c.bps.toExponential(3)}${tiers.length ? '  -> ' + tiers.join(', ') + ' unlocked' : ''}`)
  }
  console.log(`\n  Final: ${formatTime(state.time)} | Stage ${state.clearedStage} done | BPS: ${state.bps.toExponential(3)} | Gens: ${state.owned.join('/')}`)
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`
  return `${(seconds / 86400).toFixed(1)}d`
}

if (DERIVE_MODE) {
  runDeriveMode()
} else {
  // Run measure mode with current HOST_HEALTH
  console.log('Run with --derive to compute HOST_HEALTH values')
  console.log('Running verification with current HOST_HEALTH...')
  verifyWithHealth(BALANCE.HOST_HEALTH)
}
