/**
 * formulas.ts
 * Pure functions only. No side effects. No state mutation. No UI calls.
 * Every function takes values as arguments and returns a number or Decimal.
 */

import Decimal from 'break_eternity.js'
import { BALANCE } from './balance.config'
import type { DefenseEventId, GameState, GeneratorId, UpgradeId, SkillId, StrainId } from '../lib/game'
import {
  generatorDefinitions,
  upgradeDefinitions,
  strainDefinitions,
  skillDefinitions,
  hostDefinitions,
  countermeasureDefinitions,
} from '../lib/game'

// Local lookup helpers (pure, no side effects)
function getStrainDef(strain: StrainId | null) {
  if (!strain) return null
  return strainDefinitions.find((d) => d.id === strain) ?? null
}

function hasSkillInState(state: GameState, skillId: SkillId): boolean {
  return state.unlockedSkills.includes(skillId)
}

function getGenDef(id: GeneratorId) {
  const def = generatorDefinitions.find((d) => d.id === id)
  if (!def) throw new Error(`Unknown generator: ${id}`)
  return def
}

function getUpgDef(id: UpgradeId) {
  const def = upgradeDefinitions.find((d) => d.id === id)
  if (!def) throw new Error(`Unknown upgrade: ${id}`)
  return def
}

function getSkillDef(skillId: SkillId) {
  const def = skillDefinitions.find((d) => d.id === skillId)
  if (!def) throw new Error(`Unknown skill: ${skillId}`)
  return def
}

// --- COST FORMULAS ---

export function getGeneratorCostByOwned(generatorId: GeneratorId, owned: number): Decimal {
  const definition = getGenDef(generatorId)
  return definition.baseCost.mul(Decimal.pow(BALANCE.GENERATOR_COST_EXPONENT, owned))
}

export function getGeneratorEfficiencyByOwned(generatorId: GeneratorId, owned: number): Decimal {
  const definition = getGenDef(generatorId)
  const cost = getGeneratorCostByOwned(generatorId, owned)

  if (cost.eq(0)) {
    return new Decimal(0)
  }

  return definition.baseProduction.div(cost)
}

export function getGeneratorCost(state: GameState, generatorId: GeneratorId, amount = 1): Decimal {
  const startingOwned = state.generators[generatorId].owned
  let total = new Decimal(0)

  for (let index = 0; index < amount; index += 1) {
    total = total.add(getGeneratorCostByOwned(generatorId, startingOwned + index))
  }

  return total
}

// --- PROGRESSION FORMULAS ---

export function getCompletedHosts(state: GameState): number {
  return Math.max(0, state.currentStage - 1 + (state.hostCompleted ? 1 : 0))
}

export function getTotalMutationPointsEarned(state: GameState): number {
  const completedHosts = getCompletedHosts(state)

  if (completedHosts === 0) {
    return 0
  }

  // The first host clear unlocks the full evolution loop, then each later host adds one more point.
  return completedHosts + 1
}

export function getSpentMutationPoints(stats: Record<string, number>): number {
  return Object.values(stats).reduce((total, value) => total + value, 0)
}

// --- PRESTIGE FORMULAS ---

export function getProjectedGeneticMemoryGain(state: GameState): Decimal {
  if (state.lifetimeBiomass.lt(BALANCE.GENETIC_MEMORY_DIVISOR)) {
    return new Decimal(0)
  }
  return state.lifetimeBiomass.div(BALANCE.GENETIC_MEMORY_DIVISOR).pow(BALANCE.GENETIC_MEMORY_GAIN_EXPONENT).floor()
}

export function getGeneticMemoryBonusMultiplier(state: GameState): Decimal {
  // Diminishing curve: run 1 = +15%, run 2 = +26%, run 3 = +35%, cap at +70%
  const bonus = Math.min(0.70, 1 - 1 / (1 + state.prestigeCount * 0.17))
  return new Decimal(1 + bonus)
}

export function getGeneticMemoryBonusPercent(state: GameState): Decimal {
  return getGeneticMemoryBonusMultiplier(state).sub(1).mul(100)
}

export function getProjectedGeneticMemoryTotal(state: GameState): Decimal {
  return state.geneticMemory.add(getProjectedGeneticMemoryGain(state))
}

export function getProjectedGeneticMemoryBonusPercent(state: GameState): Decimal {
  // Project the bonus for the next run (prestigeCount + 1)
  const nextPrestigeCount = state.prestigeCount + 1
  const bonus = Math.min(0.70, 1 - 1 / (1 + nextPrestigeCount * 0.17))
  return new Decimal(bonus * 100)
}

// --- DEFENSE FORMULAS ---

export function getDefenseMitigation(state: GameState): number {
  let mitigation = Math.min(
    BALANCE.DEFENSE_MITIGATION_MAX_FROM_RESILIENCE,
    state.stats.resilience * BALANCE.DEFENSE_MITIGATION_PER_RESILIENCE
  )

  if (hasSkillInState(state, 'chitin-shell')) {
    mitigation += BALANCE.CHITIN_SHELL_MITIGATION_BONUS
  }

  if (hasSkillInState(state, 'spore-hardening')) {
    mitigation += BALANCE.SPORE_HARDENING_MITIGATION_BONUS
  }

  const echoBonuses = Object.values(state.hostEchoes)
  const resilientCount = echoBonuses.filter((e) => e === 'resilient').length
  if (resilientCount > 0) {
    mitigation += resilientCount * BALANCE.HOST_ECHO_BONUS_RESILIENT
  }

  return Math.min(BALANCE.DEFENSE_MITIGATION_CAP, mitigation)
}

export function getMitigatedPenaltyMultiplier(
  eventMultiplier: Decimal,
  state: GameState,
  eventId: DefenseEventId
): Decimal {
  if (eventMultiplier.gte(1)) return eventMultiplier  // no penalty to mitigate

  const equipped = state.equippedCountermeasure
  if (!equipped) return eventMultiplier  // no protocol equipped

  // Determine mitigation tier for this event + protocol combination
  const definition = countermeasureDefinitions.find((c) => c.id === equipped)
  if (!definition) return eventMultiplier

  let baseMitigation = 0
  if (definition.targetEventIds.includes(eventId)) {
    baseMitigation = BALANCE.COUNTERMEASURE_FULL_MITIGATION
  } else if (definition.partialEventIds.includes(eventId)) {
    baseMitigation = BALANCE.COUNTERMEASURE_PARTIAL_MITIGATION
  } else {
    return eventMultiplier  // no coverage — penalty applies in full
  }

  // Resilience stat bonus — stacks additively
  const resilienceBonus = state.stats.resilience * BALANCE.COUNTERMEASURE_RESILIENCE_BONUS_PER_POINT

  // Chitin Shell skill bonus
  const chitinBonus = state.unlockedSkills.includes('chitin-shell')
    ? BALANCE.CHITIN_SHELL_MITIGATION_BONUS
    : 0

  // Spore Hardening skill bonus
  const sporeHardeningBonus = state.unlockedSkills.includes('spore-hardening')
    ? BALANCE.SPORE_HARDENING_MITIGATION_BONUS
    : 0

  const totalMitigation = Math.min(
    BALANCE.COUNTERMEASURE_RESILIENCE_MITIGATION_CAP,
    baseMitigation + resilienceBonus + chitinBonus + sporeHardeningBonus
  )

  // Apply mitigation: move the multiplier toward 1.0 by the mitigation fraction
  // e.g. multiplier 0.55 (-45%), mitigation 0.70:
  // penalty depth = 0.45, mitigated depth = 0.45 * (1 - 0.70) = 0.135
  // mitigated multiplier = 1 - 0.135 = 0.865
  const penaltyDepth = new Decimal(1).sub(eventMultiplier)
  const mitigatedDepth = penaltyDepth.mul(1 - totalMitigation)
  return new Decimal(1).sub(mitigatedDepth)
}

export function getMitigatedClickMultiplier(
  clickMultiplier: Decimal,
  state: GameState,
  eventId: DefenseEventId
): Decimal {
  // Identical logic to getMitigatedPenaltyMultiplier.
  // Click multiplier mitigation uses the same coverage tier and stat bonuses.
  return getMitigatedPenaltyMultiplier(clickMultiplier, state, eventId)
}

export function getClickDefenseMultiplier(state: GameState): Decimal {
  return state.activeDefenseEvents.reduce((multiplier, event) => {
    if (!event.clickMultiplier) {
      return multiplier
    }
    return multiplier.mul(getMitigatedClickMultiplier(event.clickMultiplier, state, event.id))
  }, new Decimal(1))
}

// --- PRODUCTION FORMULAS ---

export function getUpgradeEffectivenessMultiplier(state: GameState): Decimal {
  let multiplier = new Decimal(1 + state.stats.complexity * BALANCE.COMPLEXITY_UPGRADE_EFFECTIVENESS_PER_POINT)

  if (hasSkillInState(state, 'signal-amplification')) {
    multiplier = multiplier.mul(BALANCE.SIGNAL_AMPLIFICATION_EFFECTIVENESS_MULTIPLIER)
  }

  return multiplier
}

export function getPassiveStatMultiplier(state: GameState): Decimal {
  let multiplier = new Decimal(1 + state.stats.complexity * BALANCE.COMPLEXITY_PASSIVE_BONUS_PER_POINT)

  if (state.stats.complexity >= 1) {
    multiplier = multiplier.mul(1.05)
  }

  if (hasSkillInState(state, 'enzymatic-breakdown')) {
    multiplier = multiplier.mul(BALANCE.ENZYMATIC_BREAKDOWN_PASSIVE_BONUS)
  }

  if (hasSkillInState(state, 'quorum-recursion')) {
    multiplier = multiplier.mul(BALANCE.QUORUM_RECURSION_PASSIVE_BONUS)
  }

  if (hasSkillInState(state, 'distributed-cognition')) {
    multiplier = multiplier.mul(BALANCE.DISTRIBUTED_COGNITION_PASSIVE_BONUS)
  }

  if (hasSkillInState(state, 'spore-hardening')) {
    multiplier = multiplier.mul(BALANCE.SPORE_HARDENING_PASSIVE_BONUS)
  }

  return multiplier
}

export function getProductionMultiplier(state: GameState, generatorId: GeneratorId): Decimal {
  let multiplier = new Decimal(1)
  const upgradeEffectiveness = getUpgradeEffectivenessMultiplier(state)
  const definition = getGenDef(generatorId)

  if (generatorId === 'hyphae-strand' && state.upgrades['chitinous-reinforcement']) {
    multiplier = multiplier.mul(
      new Decimal(1).add(new Decimal(BALANCE.CHITINOUS_REINFORCEMENT_BASE_BONUS).mul(upgradeEffectiveness))
    )
  }

  if (state.upgrades['exoenzyme-secretion'] && definition.tier <= BALANCE.EXOENZYME_SECRETION_MAX_TIER) {
    multiplier = multiplier.mul(
      new Decimal(1).add(new Decimal(BALANCE.EXOENZYME_SECRETION_BASE_BONUS).mul(upgradeEffectiveness))
    )
  }

  if (generatorId === 'rhizomorph-cord') {
    const lowerTierOwned = state.generators['hyphae-strand'].owned + state.generators['mycelial-mat'].owned
    const scalingBonus = Math.min(
      BALANCE.RHIZOMORPH_LOWER_TIER_SCALING_CAP,
      lowerTierOwned * BALANCE.RHIZOMORPH_LOWER_TIER_SCALING_PER_OWNED
    )
    multiplier = multiplier.mul(1 + scalingBonus)
  }

  // Signal economy temporarily disabled.
  // if (generatorId === 'sporocarp-cluster' && state.currentStage >= BALANCE.SIGNAL.UNLOCK_STAGE) {
  //   multiplier = multiplier.mul(1 + BALANCE.SPOROCARP_STAGE3_CARRY_BONUS)
  // }

  if (generatorId === 'sporocarp-cluster' && state.upgrades['lateral-transfer']) {
    let tier4Bonus = BALANCE.LATERAL_TRANSFER_TIER4_BASE_BONUS
    // Signal economy temporarily disabled.
    // if (state.currentStage >= BALANCE.SIGNAL.UNLOCK_STAGE) {
    //   tier4Bonus += BALANCE.LATERAL_TRANSFER_TIER4_STAGE3_BONUS
    // }
    multiplier = multiplier.mul(new Decimal(1).add(new Decimal(tier4Bonus).mul(upgradeEffectiveness)))
  }

  if (
    generatorId === 'fruiting-canopy' &&
    state.upgrades['canopy-ventilation'] &&
    state.hostHealth.gt(state.hostMaxHealth.mul(BALANCE.CANOPY_VENTILATION_HOST_HEALTH_THRESHOLD))
  ) {
    multiplier = multiplier.mul(
      new Decimal(1).add(new Decimal(BALANCE.CANOPY_VENTILATION_BASE_BONUS).mul(upgradeEffectiveness))
    )
  }

  if (generatorId === 'decomposer-bloom' && state.upgrades['decomposer-surge']) {
    multiplier = multiplier.mul(
      new Decimal(1).add(new Decimal(BALANCE.DECOMPOSER_SURGE_BASE_BONUS).mul(upgradeEffectiveness))
    )
  }

  if (
    generatorId === 'subterranean-nexus' &&
    state.upgrades['nexus-overweave'] &&
    state.activeDefenseEvents.length > 0
  ) {
    multiplier = multiplier.mul(
      new Decimal(1).add(new Decimal(BALANCE.NEXUS_OVERWEAVE_BASE_BONUS).mul(upgradeEffectiveness))
    )
  }

  if (
    generatorId === 'planetary-membrane' &&
    state.upgrades['membrane-tension'] &&
    state.currentStage === hostDefinitions.length
  ) {
    multiplier = multiplier.mul(
      new Decimal(1).add(new Decimal(BALANCE.MEMBRANE_TENSION_BASE_BONUS).mul(upgradeEffectiveness))
    )
  }

  const strainDef = getStrainDef(state.strain)
  if (strainDef) {
    multiplier = multiplier.mul(strainDef.passiveModifier)

    if (strainDef.id === 'symbiote') {
      const totalOwned = generatorDefinitions.reduce(
        (total, def) => total + state.generators[def.id].owned,
        0
      )
      const otherOwned = Math.max(0, totalOwned - state.generators[generatorId].owned)
      multiplier = multiplier.mul(1 + otherOwned * BALANCE.SYMBIOTE_SCALING_PER_OTHER)
    }
  }

  multiplier = multiplier.mul(getPassiveStatMultiplier(state))
  multiplier = multiplier.mul(getGeneticMemoryBonusMultiplier(state))

  for (const event of state.activeDefenseEvents) {
    multiplier = multiplier.mul(getMitigatedPenaltyMultiplier(event.multiplier, state, event.id))
  }

  for (const debuff of state.activeEnemyDebuffs) {
    for (const effect of debuff.effects) {
      if (effect.type === 'bpsMultiplier') {
        multiplier = multiplier.mul(1 - effect.magnitude)
      }
    }
  }

  // Signal production multiplier — active on run 2+ only.
  // Routing Signal into the network directly buffs all generator output.
  // This gives run 2+ a structurally different optimization layer without
  // affecting the first run at all.
  if (state.prestigeCount > 0 && isSignalUnlocked(state) && state.signal > 0) {
    const signalBonus = 1 + (state.signal / BALANCE.SIGNAL_PRODUCTION_DIVISOR)
    multiplier = multiplier.mul(signalBonus)
  }

  const echoBonuses = Object.values(state.hostEchoes)
  const efficientCount = echoBonuses.filter((e) => e === 'efficient').length
  if (efficientCount > 0) {
    multiplier = multiplier.mul(1 + efficientCount * BALANCE.HOST_ECHO_BONUS_EFFICIENT)
  }

  return multiplier
}

// --- SIGNAL FORMULAS ---

export function getSignalCap(state: GameState): number {
  const base = BALANCE.SIGNAL.BASE_CAP
  const complexityBonus = state.stats.complexity * BALANCE.SIGNAL.COMPLEXITY_CAP_BONUS_PER_POINT
  let cap = base + complexityBonus

  const echoBonuses = Object.values(state.hostEchoes)
  const patientCount = echoBonuses.filter((e) => e === 'patient').length
  if (patientCount > 0) {
    cap += patientCount * BALANCE.HOST_ECHO_BONUS_PATIENT
  }

  if (state.strain === 'parasite') {
    cap *= BALANCE.SIGNAL.STRAIN_PARASITE_CAP_PENALTY
  }

  return cap
}

export function isSignalUnlocked(state: GameState): boolean {
  return state.currentStage >= BALANCE.SIGNAL.UNLOCK_STAGE
}

export function isSignalOverspent(state: GameState): boolean {
  if (!isSignalUnlocked(state)) return false
  return state.signal < getSignalCap(state) * BALANCE.SIGNAL.PENALTY_THRESHOLD
}

export function getSignalPerSecond(state: GameState): number {
  if (!isSignalUnlocked(state)) return 0

  let rate = BALANCE.SIGNAL.BASE_PRODUCTION_PER_SECOND
  const stagesAbove = Math.max(0, state.currentStage - BALANCE.SIGNAL.UNLOCK_STAGE)
  rate += stagesAbove * BALANCE.SIGNAL.PRODUCTION_PER_STAGE_BONUS

  if (state.strain === 'symbiote') {
    rate *= BALANCE.SIGNAL.STRAIN_SYMBIOTE_PRODUCTION_MULT
  }

  if (isSignalOverspent(state)) {
    rate *= 1 + BALANCE.SIGNAL.PENALTY_RECOVERY_RATE
  }

  return rate
}

export function getSignalDecayRate(state: GameState): number {
  if (!isSignalUnlocked(state)) return 0

  const cap = getSignalCap(state)
  const threshold = cap * BALANCE.SIGNAL.DECAY_THRESHOLD

  if (state.signal <= threshold) return 0

  let rate = BALANCE.SIGNAL.DECAY_RATE_PER_SECOND
  rate -= state.stats.complexity * BALANCE.SIGNAL.COMPLEXITY_DECAY_REDUCTION_PER_POINT
  rate = Math.max(0.01, rate)

  if (state.strain === 'saprophyte') {
    rate *= BALANCE.SIGNAL.STRAIN_SAPROPHYTE_DECAY_MULT
  }

  const excess = (state.signal - threshold) / (cap - threshold)
  return rate * (1 + excess)
}

export function getSignalOverspendMultiplier(state: GameState): number {
  if (!isSignalUnlocked(state)) return 1

  const cap = getSignalCap(state)
  const penaltyFloor = cap * BALANCE.SIGNAL.PENALTY_THRESHOLD

  if (state.signal >= penaltyFloor) return 1

  const severity = 1 - state.signal / penaltyFloor
  const penaltyStrength = 1 - BALANCE.SIGNAL.PENALTY_BPS_MULTIPLIER
  return 1 - penaltyStrength * severity
}

export function getCoordinationMultiplierForTier(state: GameState, tier: number): number {
  const link = state.activeCoordinationLinks.find((entry) => entry.targetTier === tier)
  return link ? link.boostMultiplier : 1
}

export function getVulnerabilityWindowMultiplier(state: GameState): number {
  if (!state.activeVulnerabilityWindow) return 1
  return state.activeVulnerabilityWindow.damageMultiplier
}

export function isRivalSuppressed(state: GameState): boolean {
  return state.rivalSuppressed && state.rivalSuppressionRemainingMs > 0
}

export function formatSignal(value: number): string {
  return value.toFixed(1)
}

export function formatSignalRate(value: number): string {
  if (value === 0) return '0.0/s'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}/s`
}

export function getGeneratorProduction(state: GameState, generatorId: GeneratorId): Decimal {
  const isBlocked = state.activeDefenseEvents.some(
    (event) => event.disabledGeneratorId === generatorId
  )
  if (isBlocked) {
    return new Decimal(0)
  }

  const definition = getGenDef(generatorId)
  const owned = state.generators[generatorId].owned
  const tierIndex = definition.tier - 1

  if (owned === 0) {
    return new Decimal(0)
  }

  let production = definition.baseProduction.mul(owned)

  // Signal economy temporarily disabled.
  // const coordinationMultiplier = getCoordinationMultiplierForTier(state, tierIndex)
  // if (coordinationMultiplier !== 1) {
  //   production = production.mul(coordinationMultiplier)
  // }

  return production.mul(getProductionMultiplier(state, generatorId))
}

export function getGeneratorProductionPerBuy(_state: GameState, generatorId: GeneratorId): Decimal {
  const definition = getGenDef(generatorId)
  return definition.baseProduction
}

export function calculateBiomassPerSecond(state: GameState): Decimal {
  const total = generatorDefinitions.reduce(
    (total, definition) => total.add(getGeneratorProduction(state, definition.id)),
    new Decimal(0)
  )

  // Signal economy temporarily disabled.
  return total
}

// --- CLICK FORMULAS ---

// Returns the BPS value before active defense event penalties are applied.
// Used to prevent click value from weakening during events — clicking should
// remain strong (and become stronger) when the colony is under stress.
//
// Implementation: divides out each active event's passive multiplier.
// Beetle Disruption has multiplier 1.0 so dividing by it is a no-op — correct,
// since its penalty is a disabled generator rather than a global output reduction.
// All other event multipliers are between 0.55 and 0.85, so division is safe.
export function getUnpenalizedBps(state: GameState): Decimal {
  if (state.activeDefenseEvents.length === 0) {
    return state.biomassPerSecond
  }

  let unpenalized = state.biomassPerSecond
  for (const event of state.activeDefenseEvents) {
    if (event.multiplier.gt(0) && event.multiplier.lt(1)) {
      unpenalized = unpenalized.div(event.multiplier)
    }
  }
  return unpenalized
}

export function getBaseClickValue(state: GameState): Decimal {
  // Select BPS fraction based on strain.
  // Parasite is the active-play strain — higher fraction makes clicking dominant.
  // All others use the default fraction — clicking stays useful but not primary.
  const bpsFraction = state.strain === 'parasite'
    ? BALANCE.CLICK_BPS_FRACTION_PARASITE   // 0.06
    : BALANCE.CLICK_BPS_FRACTION_DEFAULT    // 0.04

  // Use unpenalized BPS as the click base.
  // During defense events, passive BPS is suppressed but click value should
  // not be — clicking is the correct response to a defense event, not a
  // passive wait. Recovering the pre-penalty BPS keeps the base stable.
  const referenceBps = getUnpenalizedBps(state)
  const bpsScaled = referenceBps.mul(bpsFraction)

  // Stage-relative click floor: a fraction of max host health.
  // This keeps click value stable over the course of a host instead of
  // weakening as the remaining host health approaches zero.
  const hostHealthFractions = state.strain === 'parasite'
    ? BALANCE.CLICK_HOST_HEALTH_FRACTION_PARASITE
    : BALANCE.CLICK_HOST_HEALTH_FRACTION_DEFAULT
  const stageIndex = Math.min(state.currentStage - 1, hostHealthFractions.length - 1)
  const hostHealthFloor = stageIndex === 0
    ? new Decimal(1)
    : state.hostMaxHealth.mul(hostHealthFractions[stageIndex])

  // Take the higher of BPS-scaled or host-health floor.
  let value = Decimal.max(new Decimal(1), Decimal.max(bpsScaled, hostHealthFloor))

  // If a defense event is active, apply an additional click boost.
  // This makes clicking actively stronger during events, creating a
  // natural active play loop: event fires → player clicks aggressively
  // → event expires → player returns to idle.
  if (state.activeDefenseEvents.length > 0) {
    value = value.mul(BALANCE.CLICK_DEFENSE_EVENT_BOOST)
  }

  // Apply Lateral Transfer upgrade multiplier
  if (state.upgrades['lateral-transfer']) {
    value = value.mul(BALANCE.LATERAL_TRANSFER_CLICK_MULTIPLIER)
  }

  // Neural Propagation upgrade — click ×1.5 (Stage 5+ unlock)
  if (state.upgrades['neural-propagation']) {
    value = value.mul(BALANCE.NEURAL_PROPAGATION_CLICK_MULTIPLIER)
  }

  // Terminus Strike upgrade — click ×2 (Stage 7+ unlock)
  if (state.upgrades['terminus-strike']) {
    value = value.mul(BALANCE.TERMINUS_STRIKE_CLICK_MULTIPLIER)
  }

  // Virulence stat bonuses (old flat strain click multipliers are retired)
  value = value.mul(1 + state.stats.virulence * BALANCE.VIRULENCE_CLICK_BONUS_PER_POINT)

  if (state.stats.virulence >= 3) {
    value = value.mul(BALANCE.VIRULENCE_THRESHOLD_BONUS)
  }

  if (state.strain === 'parasite' && state.activeParasiteDefenseBurstMs > 0) {
    value = value.mul(BALANCE.STRAIN_PARASITE_DEFENSE_BURST_CLICK_MULT)
  }

  if (hasSkillInState(state, 'acidic-secretion')) {
    value = value.mul(BALANCE.ACIDIC_SECRETION_CLICK_BONUS)
  }

  if (hasSkillInState(state, 'hemorrhagic-spread')) {
    value = value.mul(BALANCE.HEMORRHAGIC_SPREAD_CLICK_BONUS)
  }

  const echoBonuses = Object.values(state.hostEchoes)
  const aggressiveCount = echoBonuses.filter((e) => e === 'aggressive').length
  if (aggressiveCount > 0) {
    value = value.mul(1 + aggressiveCount * BALANCE.HOST_ECHO_BONUS_AGGRESSIVE)
  }

  value = value.mul(getClickDefenseMultiplier(state))

  for (const debuff of state.activeEnemyDebuffs) {
    for (const effect of debuff.effects) {
      if (effect.type === 'clickMultiplier') {
        value = value.mul(1 - effect.magnitude)
      }
    }
  }

  value = value.mul(getGeneticMemoryBonusMultiplier(state))

  return value
}

// --- OFFLINE GAINS ---

export function calculateOfflineGains(state: GameState, now = Date.now()): Decimal {
  const elapsed = Math.min(
    Math.max(0, now - state.lastSaveTime),
    BALANCE.OFFLINE_CAP_MS
  )
  const secondsOffline = elapsed / 1000

  let efficiency = BALANCE.BASE_OFFLINE_EFFICIENCY
  if (state.stats.resilience >= 3) {
    efficiency += BALANCE.RESILIENCE_OFFLINE_BONUS
  }
  if (hasSkillInState(state, 'dormancy-protocol')) {
    efficiency += BALANCE.DORMANCY_PROTOCOL_OFFLINE_BONUS
  }

  return state.biomassPerSecond.mul(secondsOffline).mul(efficiency)
}

// --- HOST FORMULAS ---

export function getHostProgress(state: GameState): number {
  const consumed = state.hostMaxHealth.sub(state.hostHealth)
  return Number(consumed.div(state.hostMaxHealth).mul(100).toFixed(2))
}

export function getHostBar(state: GameState): string {
  const width = 20
  const filled = Math.max(
    0,
    Math.min(width, Math.round((getHostProgress(state) / 100) * width))
  )
  return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}] ${getHostProgress(state).toFixed(1)}%`
}

// --- NOTATION ---

export function formatDecimal(value: Decimal): string {
  if (value.lt(BALANCE.NOTATION_LOCALE_MAX)) {
    return value.toNumber().toLocaleString(undefined, {
      maximumFractionDigits: 2,
      minimumFractionDigits: value.gte(100) ? 0 : 2,
    })
  }

  if (value.lt(BALANCE.NOTATION_LOCALE_MAX_FULL)) {
    return value.toNumber().toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })
  }

  if (value.lt(BALANCE.NOTATION_SHORTHAND_MAX)) {
    const units = [
      { value: 1e12, suffix: 'T' },
      { value: 1e9, suffix: 'B' },
      { value: 1e6, suffix: 'M' },
    ]

    const unit = units.find((entry) => value.gte(entry.value))
    if (unit) {
      return `${value.div(unit.value).toFixed(2)}${unit.suffix}`
    }
  }

  return value.toExponential(2)
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function debugEfficiencyCliff() {
  const results: Array<{
    transition: string
    efficiencyAtThreshold: string
    efficiencyAtUnlock: string
    cliffMultiplier: string
    target: string
    pass: boolean
  }> = []

  for (let tier = 0; tier < generatorDefinitions.length - 1; tier += 1) {
    const currentGenerator = generatorDefinitions[tier]
    const nextGenerator = generatorDefinitions[tier + 1]
    const unlockThreshold = BALANCE.GENERATOR_UNLOCK_THRESHOLDS[tier + 1]
    const efficiencyAtThreshold = getGeneratorEfficiencyByOwned(currentGenerator.id, unlockThreshold)
    const efficiencyAtUnlock = getGeneratorEfficiencyByOwned(nextGenerator.id, 0)
    const cliff = efficiencyAtUnlock.div(efficiencyAtThreshold).toNumber()

    results.push({
      transition: `Tier ${tier + 1} -> Tier ${tier + 2}`,
      efficiencyAtThreshold: efficiencyAtThreshold.toExponential(3),
      efficiencyAtUnlock: efficiencyAtUnlock.toExponential(3),
      cliffMultiplier: `${cliff.toFixed(0)}x`,
      target: '~600x',
      pass: cliff >= 500 && cliff <= 800,
    })
  }

  console.table(results)
  return results
}

// --- HELPER: can release spores ---

export function canReleaseSpores(state: GameState): boolean {
  return state.currentStage === hostDefinitions.length && state.hostCompleted
}

export function hasNextStage(state: GameState): boolean {
  return state.currentStage < hostDefinitions.length
}

export function getCurrentHostDefinition(state: GameState) {
  return hostDefinitions.find((h) => h.stage === state.currentStage) ?? hostDefinitions[0]
}

export function getThreatLevelLabel(level: string): string {
  return level.toUpperCase()
}
