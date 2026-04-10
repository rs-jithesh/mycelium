/**
 * formulas.ts
 * Pure functions only. No side effects. No state mutation. No UI calls.
 * Every function takes values as arguments and returns a number or Decimal.
 */

import Decimal from 'break_eternity.js'
import { BALANCE } from './balance.config'
import type { DefenseEventId, GameState, GeneratorId, UpgradeId, SkillId, StrainId, StatId, IntegrationZoneState } from '../lib/game'
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

// --- STRAIN-STAT SYNERGY SYSTEM ---

// Synergy map: which stats align with which strains
// Parasite → Virulence (synergy), Complexity (opposition), Resilience (neutral)
// Symbiote → Complexity (synergy), Virulence (opposition), Resilience (neutral)
// Saprophyte → Resilience (synergy), no opposition (hybrid)
const STRAIN_SYNERGY_MAP: Record<StrainId, { synergy: StatId; opposition: StatId | null }> = {
  parasite: { synergy: 'virulence', opposition: 'complexity' },
  symbiote: { synergy: 'complexity', opposition: 'virulence' },
  saprophyte: { synergy: 'resilience', opposition: null },
}

/**
 * Get the synergy modifier for a strain-stat combination.
 * Returns STRAIN_SYNERGY_MULTIPLIER if stat aligns with strain archetype,
 * STRAIN_OPPOSITION_MULTIPLIER if stat opposes strain archetype,
 * or 1.0 if neutral.
 */
export function getStrainSynergyModifier(strain: StrainId | null, stat: StatId): number {
  if (!strain) return 1.0

  const mapping = STRAIN_SYNERGY_MAP[strain]
  if (!mapping) return 1.0

  if (stat === mapping.synergy) {
    return BALANCE.STRAIN_SYNERGY_MULTIPLIER
  }
  if (stat === mapping.opposition) {
    return BALANCE.STRAIN_OPPOSITION_MULTIPLIER
  }
  return 1.0
}

/**
 * Get the synergy label for UI display.
 * Returns 'synergy' | 'opposition' | 'neutral' | null (if no strain selected)
 */
export function getStrainSynergyLabel(strain: StrainId | null, stat: StatId): 'synergy' | 'opposition' | 'neutral' | null {
  if (!strain) return null

  const mapping = STRAIN_SYNERGY_MAP[strain]
  if (!mapping) return null

  if (stat === mapping.synergy) return 'synergy'
  if (stat === mapping.opposition) return 'opposition'
  return 'neutral'
}

/**
 * Calculate the effective bonus for a stat considering soft cap and synergy.
 *
 * Formula:
 * - Points 1 to STAT_SOFT_CAP_THRESHOLD: full baseBonus each
 * - Points beyond threshold: baseBonus × SOFT_CAP_FALLOFF^i for each overage point i
 * - Result is then multiplied by strain synergy modifier
 *
 * Example with 5 points, base 0.15, cap at 3, falloff 0.65, synergy 1.35:
 * - Full points: 3 × 0.15 = 0.45
 * - Overage: 0.15 × 0.65 + 0.15 × 0.65² = 0.0975 + 0.063375 = 0.160875
 * - Pre-synergy: 0.610875
 * - Post-synergy: 0.610875 × 1.35 = 0.82468125
 */
export function getEffectiveStatBonus(
  points: number,
  baseBonus: number,
  strain: StrainId | null,
  stat: StatId,
  geneticMemoryStats?: { accumulatedBonus: number }
): number {
  if (points <= 0) return 0

  const threshold = BALANCE.STAT_SOFT_CAP_THRESHOLD
  const falloff = BALANCE.SOFT_CAP_FALLOFF

  let preCapBonus: number

  if (points <= threshold) {
    // Full effectiveness for all points
    preCapBonus = points * baseBonus
  } else {
    // Full effectiveness up to threshold, then diminishing returns
    const fullPoints = threshold * baseBonus
    let overageBonus = 0
    const overagePoints = points - threshold

    for (let i = 1; i <= overagePoints; i++) {
      overageBonus += baseBonus * Math.pow(falloff, i)
    }

    preCapBonus = fullPoints + overageBonus
  }

  // Apply strain synergy
  const synergyModifier = getStrainSynergyModifier(strain, stat)
  let result = preCapBonus * synergyModifier

  // Apply genetic memory bonus if provided
  if (geneticMemoryStats && geneticMemoryStats.accumulatedBonus > 0) {
    result *= getGeneticMemoryStatMultiplier(geneticMemoryStats)
  }

  return result
}

/**
 * Check if Saprophyte hybrid bonus threshold is met.
 * Requires SAPROPHYTE_HYBRID_BONUS_THRESHOLD total points across at least 2 different stats.
 */
export function isSaprophyteHybridBonusActive(stats: Record<StatId, number>): boolean {
  const totalPoints = stats.virulence + stats.resilience + stats.complexity
  if (totalPoints < BALANCE.SAPROPHYTE_HYBRID_BONUS_THRESHOLD) return false

  // Count how many stats have points
  const statsWithPoints = [stats.virulence, stats.resilience, stats.complexity].filter((p) => p > 0).length
  return statsWithPoints >= 2
}

/**
 * Get Saprophyte hybrid bonus multiplier if active, otherwise 1.0
 */
export function getSaprophyteHybridMultiplier(stats: Record<StatId, number>): number {
  return isSaprophyteHybridBonusActive(stats) ? BALANCE.SAPROPHYTE_HYBRID_BONUS_MULTIPLIER : 1.0
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

/**
 * Calculate genetic memory points to retain from a prestige.
 * Returns floor(totalSpentPoints × GENETIC_MEMORY_POINTS_RETAINED_PERCENT)
 */
export function calculateGeneticMemoryPointsToRetain(totalSpentPoints: number): number {
  return Math.floor(totalSpentPoints * BALANCE.GENETIC_MEMORY_POINTS_RETAINED_PERCENT)
}

/**
 * Calculate the new genetic memory stats after a prestige.
 * Caps prestige contributions at GENETIC_MEMORY_MAX_STACKS.
 */
export function calculateNewGeneticMemoryStats(
  currentMemory: { prestigeContributions: number; accumulatedBonus: number },
  spentPointsThisRun: number
): { prestigeContributions: number; accumulatedBonus: number } {
  const pointsToAdd = calculateGeneticMemoryPointsToRetain(spentPointsThisRun)

  if (pointsToAdd <= 0) {
    return { ...currentMemory }
  }

  const newContributions = Math.min(
    BALANCE.GENETIC_MEMORY_MAX_STACKS,
    currentMemory.prestigeContributions + 1
  )

  const newAccumulatedBonus = currentMemory.accumulatedBonus + pointsToAdd * BALANCE.GENETIC_MEMORY_BONUS_PER_STACK

  return {
    prestigeContributions: newContributions,
    accumulatedBonus: newAccumulatedBonus,
  }
}

/**
 * Get the genetic memory multiplier for stat effectiveness.
 * Returns 1 + accumulatedBonus (so 0.10 bonus becomes 1.10 multiplier)
 */
export function getGeneticMemoryStatMultiplier(geneticMemoryStats: { accumulatedBonus: number }): number {
  return 1 + geneticMemoryStats.accumulatedBonus
}

// --- SIGNATURE ABILITY FORMULAS ---

/**
 * Calculate Hemorrhagic Burst click interval.
 * Base interval reduced by Virulence points.
 * Each Virulence point reduces interval by HEMORRHAGIC_VIRULENCE_INTERVAL_REDUCTION.
 */
export function getHemorrhagicBurstInterval(virulencePoints: number): number {
  const reduction = virulencePoints * BALANCE.HEMORRHAGIC_VIRULENCE_INTERVAL_REDUCTION
  return Math.max(1, BALANCE.HEMORRHAGIC_BURST_BASE_INTERVAL - reduction)
}

/**
 * Calculate Hemorrhagic Burst multiplier.
 * Base multiplier increased by Virulence points.
 * Each Virulence point adds HEMORRHAGIC_VIRULENCE_MULTIPLIER_BONUS.
 */
export function getHemorrhagicBurstMultiplier(virulencePoints: number): number {
  const bonus = virulencePoints * BALANCE.HEMORRHAGIC_VIRULENCE_MULTIPLIER_BONUS
  return BALANCE.HEMORRHAGIC_BURST_BASE_MULTIPLIER * (1 + bonus)
}

/**
 * Get the number of clicks until next Hemorrhagic Burst.
 */
export function getClicksUntilBurst(currentClickCount: number, virulencePoints: number): number {
  const interval = getHemorrhagicBurstInterval(virulencePoints)
  const clicksSinceLastBurst = currentClickCount % interval
  return interval - clicksSinceLastBurst
}

/**
 * Calculate Mycorrhizal Network pulse interval in seconds.
 * Base interval reduced by Complexity points.
 * Each Complexity point reduces interval by MYCORRHIZAL_COMPLEXITY_INTERVAL_REDUCTION.
 */
export function getMycorrhizalPulseInterval(complexityPoints: number): number {
  const reduction = complexityPoints * BALANCE.MYCORRHIZAL_COMPLEXITY_INTERVAL_REDUCTION
  return Math.max(5, BALANCE.MYCORRHIZAL_BASE_INTERVAL_SECONDS - reduction)
}

/**
 * Calculate Mycorrhizal Network pulse multiplier.
 * Base multiplier increased by Complexity points.
 * Each Complexity point adds MYCORRHIZAL_COMPLEXITY_PULSE_BONUS.
 */
export function getMycorrhizalPulseMultiplier(complexityPoints: number): number {
  const bonus = complexityPoints * BALANCE.MYCORRHIZAL_COMPLEXITY_PULSE_BONUS
  return BALANCE.MYCORRHIZAL_BASE_PULSE_MULTIPLIER * (1 + bonus)
}

/**
 * Calculate Decomposition Loop conversion rate.
 * Base rate increased by Resilience points.
 * Each Resilience point adds DECOMPOSITION_RESILIENCE_BONUS_PER_POINT.
 */
export function getDecompositionConversionRate(resiliencePoints: number): number {
  const bonus = resiliencePoints * BALANCE.DECOMPOSITION_RESILIENCE_BONUS_PER_POINT
  return Math.min(1.0, BALANCE.DECOMPOSITION_BASE_CONVERSION_RATE + bonus)
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
  // Use new synergy-aware calculation for Resilience
  const resilienceBonus = getEffectiveStatBonus(
    state.stats.resilience,
    BALANCE.RESILIENCE_DEFENSE_PER_POINT,
    state.strain,
    'resilience',
    state.geneticMemoryStats
  )

  // Apply Saprophyte hybrid bonus if active
  const hybridMultiplier = state.strain === 'saprophyte' ? getSaprophyteHybridMultiplier(state.stats) : 1.0

  let mitigation = Math.min(
    BALANCE.DEFENSE_MITIGATION_MAX_FROM_RESILIENCE,
    resilienceBonus * hybridMultiplier
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

function getCountermeasureMitigationBonus(state: GameState, eventId?: DefenseEventId): number {
  if (!eventId || !state.equippedCountermeasure) return 0

  const definition = countermeasureDefinitions.find((c) => c.id === state.equippedCountermeasure)
  if (!definition) return 0

  let baseMitigation = 0
  if (definition.targetEventIds.includes(eventId)) {
    baseMitigation = BALANCE.COUNTERMEASURE_FULL_MITIGATION
  } else if (definition.partialEventIds.includes(eventId)) {
    baseMitigation = BALANCE.COUNTERMEASURE_PARTIAL_MITIGATION
  } else {
    return 0
  }

  const resilienceBonus = state.stats.resilience * BALANCE.COUNTERMEASURE_RESILIENCE_BONUS_PER_POINT

  const totalMitigation = Math.min(
    BALANCE.COUNTERMEASURE_TIER_MITIGATION_CAP,
    baseMitigation + resilienceBonus
  )

  return totalMitigation
}

export function getMitigatedPenaltyMultiplier(baseMultiplier: Decimal, state: GameState, eventId?: DefenseEventId): Decimal {
  if (baseMultiplier.gte(1)) {
    return baseMultiplier
  }

  let mitigation = getDefenseMitigation(state) + getCountermeasureMitigationBonus(state, eventId)
  if (state.strain === 'symbiote' && state.activeDefenseEvents.length > 0) {
    mitigation += BALANCE.STRAIN_SYMBIOTE_ACTIVE_DEFENSE_MITIGATION_BONUS
  }

  mitigation = Math.min(BALANCE.DEFENSE_MITIGATION_CAP, mitigation)
  const reducedPenalty = 1 - (1 - baseMultiplier.toNumber()) * (1 - mitigation)
  return new Decimal(reducedPenalty)
}

export function getClickDefenseMultiplier(state: GameState): Decimal {
  return state.activeDefenseEvents.reduce((multiplier, event) => {
    if (!event.clickMultiplier) {
      return multiplier
    }
    return multiplier.mul(getMitigatedPenaltyMultiplier(event.clickMultiplier, state, event.id))
  }, new Decimal(1))
}

// --- PRODUCTION FORMULAS ---

export function getUpgradeEffectivenessMultiplier(state: GameState): Decimal {
  // Use new synergy-aware calculation for Complexity
  const complexityBonus = getEffectiveStatBonus(
    state.stats.complexity,
    BALANCE.COMPLEXITY_UPGRADE_EFFECTIVENESS_PER_POINT,
    state.strain,
    'complexity',
    state.geneticMemoryStats
  )

  // Apply Saprophyte hybrid bonus if active
  const hybridMultiplier = state.strain === 'saprophyte' ? getSaprophyteHybridMultiplier(state.stats) : 1.0

  let multiplier = new Decimal(1 + complexityBonus * hybridMultiplier)

  if (hasSkillInState(state, 'signal-amplification')) {
    multiplier = multiplier.mul(BALANCE.SIGNAL_AMPLIFICATION_EFFECTIVENESS_MULTIPLIER)
  }

  return multiplier
}

export function getPassiveStatMultiplier(state: GameState): Decimal {
  // Use new synergy-aware calculation for Complexity
  const complexityBonus = getEffectiveStatBonus(
    state.stats.complexity,
    BALANCE.COMPLEXITY_PASSIVE_BONUS_PER_POINT,
    state.strain,
    'complexity',
    state.geneticMemoryStats
  )

  // Apply Saprophyte hybrid bonus if active
  const hybridMultiplier = state.strain === 'saprophyte' ? getSaprophyteHybridMultiplier(state.stats) : 1.0

  let multiplier = new Decimal(1 + complexityBonus * hybridMultiplier)

  // Saprophyte unique: Resilience also adds passive BPS
  if (state.strain === 'saprophyte') {
    const resiliencePassiveBonus = getEffectiveStatBonus(
      state.stats.resilience,
      BALANCE.SAPROPHYTE_RESILIENCE_CONVERTS_TO_PASSIVE,
      state.strain,
      'resilience',
      state.geneticMemoryStats
    )
    multiplier = multiplier.mul(1 + resiliencePassiveBonus * hybridMultiplier)
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

  if (state.activeAttack?.isActive) {
    multiplier = multiplier.mul(state.activeAttack.bpsBonusMultiplier)
  }

  if (state.currentStage === 7 && state.seasonalState) {
    const seasonBpsModifier = getSeasonalBPSModifier(state.seasonalState.currentSeason)
    multiplier = multiplier.mul(seasonBpsModifier)
  }

  if (state.currentStage === 8 && state.activeAttack?.zoneId) {
    const targetedZone = state.zones.find(z => z.id === state.activeAttack!.zoneId)
    if (targetedZone) {
      multiplier = multiplier.mul(getRivalControlZoneMultiplier(targetedZone))
    }
  }

  if (state.currentStage === 10 && state.supplyChainBonusActive) {
    const supplyChainBonus = getSupplyChainBPSBonus(10, state.supplyChainBonusActive)
    multiplier = multiplier.mul(1 + supplyChainBonus)
  }

  if (state.currentStage === 11 && state.integrationPulse?.isActive) {
    multiplier = multiplier.mul(getIntegrationPulseBPSMultiplier())
  }

  return multiplier
}

// --- SIGNAL FORMULAS ---

export function getSignalCap(state: GameState): number {
  const base = BALANCE.SIGNAL.BASE_CAP

  // Use new synergy-aware calculation for Complexity
  const complexityBonus = getEffectiveStatBonus(
    state.stats.complexity,
    BALANCE.SIGNAL.COMPLEXITY_CAP_BONUS_PER_POINT,
    state.strain,
    'complexity',
    state.geneticMemoryStats
  )

  // Apply Saprophyte hybrid bonus if active
  const hybridMultiplier = state.strain === 'saprophyte' ? getSaprophyteHybridMultiplier(state.stats) : 1.0

  let cap = base + complexityBonus * hybridMultiplier

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

  // Use new synergy-aware calculation for Complexity decay reduction
  const decayReduction = getEffectiveStatBonus(
    state.stats.complexity,
    BALANCE.SIGNAL.COMPLEXITY_DECAY_REDUCTION_PER_POINT,
    state.strain,
    'complexity',
    state.geneticMemoryStats
  )

  // Apply Saprophyte hybrid bonus if active
  const hybridMultiplier = state.strain === 'saprophyte' ? getSaprophyteHybridMultiplier(state.stats) : 1.0

  let rate = BALANCE.SIGNAL.DECAY_RATE_PER_SECOND
  rate -= decayReduction * hybridMultiplier
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

  // Virulence stat bonuses with synergy and soft cap
  const virulenceBonus = getEffectiveStatBonus(
    state.stats.virulence,
    BALANCE.VIRULENCE_CLICK_BONUS_PER_POINT,
    state.strain,
    'virulence',
    state.geneticMemoryStats
  )

  // Apply Saprophyte hybrid bonus if active
  const hybridMultiplier = state.strain === 'saprophyte' ? getSaprophyteHybridMultiplier(state.stats) : 1.0

  value = value.mul(1 + virulenceBonus * hybridMultiplier)

  // Threshold bonus at VIRULENCE_THRESHOLD points (applies after synergy)
  if (state.stats.virulence >= BALANCE.VIRULENCE_THRESHOLD) {
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

  // Resilience threshold bonus for offline efficiency (using new threshold constant)
  if (state.stats.resilience >= BALANCE.VIRULENCE_THRESHOLD) {
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
  const results = []

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
  if (state.currentStage !== hostDefinitions.length) return false
  if (state.currentStage === 11) {
    return state.integrationMeter >= getIntegrationMeterMax()
  }
  return state.hostCompleted
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

// ═══════════════════════════════════════════════════════════════════════════
// ZONE SYSTEM FORMULAS
// ═══════════════════════════════════════════════════════════════════════════

export function getZoneCompromisePercent(zone: { health: Decimal; maxHealth: Decimal }): number {
  if (zone.maxHealth.lte(0)) return 100
  const consumed = zone.maxHealth.sub(zone.health)
  return Math.min(100, Math.max(0, consumed.div(zone.maxHealth).mul(100).toNumber()))
}

export function isZoneUnlocked(zone: { isUnlocked: boolean; compromisePercent?: number }, threshold?: number): boolean {
  if (zone.isUnlocked) return true
  if (threshold === undefined) return false
  return (zone.compromisePercent ?? 0) >= threshold * 100
}

export function getHostCompromisePercent(state: GameState): number {
  if (state.zones.length === 0) {
    return getHostProgress(state)
  }
  const totalCompromise = state.zones.reduce((sum, zone) => sum + getZoneCompromisePercent(zone), 0)
  return totalCompromise / state.zones.length
}

export function getZoneDamageContribution(zone: { compromisePercent: number }, totalCompromise: number): Decimal {
  return new Decimal(zone.compromisePercent / 100)
}

// ═══════════════════════════════════════════════════════════════════════════
// ENZYME RESERVE FORMULAS
// ═══════════════════════════════════════════════════════════════════════════

export function getEnzymeReserveCap(state: GameState): number {
  return BALANCE.ENZYME_RESERVES.cap
}

export function getEnzymePassiveGainRate(): number {
  return BALANCE.ENZYME_RESERVES.passiveGainRate
}

export function getEnzymeGrindReward(): number {
  return BALANCE.ENZYME_RESERVES.grindReward
}

export function canAffordActiveAttack(state: GameState, zoneId?: string): boolean {
  const cost = getActiveAttackCost(state, zoneId)
  return state.enzymeReserves >= cost
}

export function getActiveAttackCost(state: GameState, zoneId?: string): number {
  const hostId = String(state.currentStage).padStart(2, '0') as keyof typeof BALANCE.HOSTS
  const hostConfig = BALANCE.HOSTS[hostId]
  if (!hostConfig || !hostConfig.activeAttackAvailable) return Infinity

  let baseCost: number
  if (state.currentStage >= 4 && state.currentStage <= 6) {
    baseCost = BALANCE.ACTIVE_ATTACKS.costByHostRange['04-06'].baseCost
  } else if (state.currentStage >= 7 && state.currentStage <= 8) {
    baseCost = BALANCE.ACTIVE_ATTACKS.costByHostRange['07-08'].baseCost
  } else if (state.currentStage >= 9 && state.currentStage <= 10) {
    baseCost = BALANCE.ACTIVE_ATTACKS.costByHostRange['09-10'].baseCost
  } else {
    baseCost = BALANCE.ACTIVE_ATTACKS.costByHostRange['11'].baseCost
  }

  if (zoneId && zoneId in BALANCE.ACTIVE_ATTACKS.zoneCostMultipliers) {
    baseCost *= BALANCE.ACTIVE_ATTACKS.zoneCostMultipliers[zoneId as keyof typeof BALANCE.ACTIVE_ATTACKS.zoneCostMultipliers]
  }

  return Math.floor(baseCost)
}

export function getActiveAttackBPSBonus(): number {
  return BALANCE.ACTIVE_ATTACKS.bpsBonusPercent / 100
}

export function getActiveAttackCooldown(): number {
  return BALANCE.ACTIVE_ATTACKS.cooldownMs
}

export function getActiveAttackStressIncrement(state: GameState): number {
  if (state.currentStage >= 4 && state.currentStage <= 6) {
    return BALANCE.ACTIVE_ATTACKS.costByHostRange['04-06'].stressIncrement
  } else if (state.currentStage >= 7 && state.currentStage <= 8) {
    return BALANCE.ACTIVE_ATTACKS.costByHostRange['07-08'].stressIncrement
  } else if (state.currentStage >= 9 && state.currentStage <= 10) {
    return BALANCE.ACTIVE_ATTACKS.costByHostRange['09-10'].stressIncrement
  }
  return 0
}

// ═══════════════════════════════════════════════════════════════════════════
// HOST STRESS FORMULAS
// ═══════════════════════════════════════════════════════════════════════════

export function getHostStressDecayRate(): number {
  return BALANCE.HOST_STRESS.decayRatePerSecond
}

export function getHostStressThreshold1(): number {
  return BALANCE.HOST_STRESS.thresholds.threshold1
}

export function getHostStressThreshold2(): number {
  return BALANCE.HOST_STRESS.thresholds.threshold2
}

export function getHostStressFrequencyMultiplier(stress: number): number {
  if (stress >= getHostStressThreshold2()) {
    return BALANCE.HOST_STRESS.effects.threshold2SeverityMultiplier
  }
  if (stress >= getHostStressThreshold1()) {
    return BALANCE.HOST_STRESS.effects.threshold1FrequencyMultiplier
  }
  return 1.0
}

export function getHostStressSeverityMultiplier(stress: number): number {
  if (stress >= getHostStressThreshold2()) {
    return BALANCE.HOST_STRESS.effects.threshold2SeverityMultiplier
  }
  return 1.0
}

export function isHostUnderStress(state: GameState): boolean {
  return state.hostStress.currentStress >= getHostStressThreshold1()
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFENSE EVENT FAILURE STATE FORMULAS
// ═══════════════════════════════════════════════════════════════════════════

export function getCountermeasureFailRate(stage: number): number {
  const hostId = String(stage).padStart(2, '0') as keyof typeof BALANCE.DEFENSE_EVENTS.countermeasureFailRateByHost
  const rate = BALANCE.DEFENSE_EVENTS.countermeasureFailRateByHost[hostId]
  return rate ?? BALANCE.DEFENSE_EVENTS.countermeasureFailRateBase
}

export function getDefenseEventFrequencyMultiplier(stage: number): number {
  const hostId = String(stage).padStart(2, '0') as keyof typeof BALANCE.HOSTS
  const hostConfig = BALANCE.HOSTS[hostId]
  if (!hostConfig) return 1.0
  const profile = BALANCE.DEFENSE_EVENTS.profiles[hostConfig.defenseEventProfile as keyof typeof BALANCE.DEFENSE_EVENTS.profiles]
  return profile?.frequencyMultiplier ?? 1.0
}

export function getDefenseEventSeverityMultiplier(stage: number): number {
  const hostId = String(stage).padStart(2, '0') as keyof typeof BALANCE.HOSTS
  const hostConfig = BALANCE.HOSTS[hostId]
  if (!hostConfig) return 1.0
  const profile = BALANCE.DEFENSE_EVENTS.profiles[hostConfig.defenseEventProfile as keyof typeof BALANCE.DEFENSE_EVENTS.profiles]
  return profile?.severityMultiplier ?? 1.0
}

export function getDefenseEventProfile(stage: number): string {
  const hostId = String(stage).padStart(2, '0') as keyof typeof BALANCE.HOSTS
  const hostConfig = BALANCE.HOSTS[hostId]
  return hostConfig?.defenseEventProfile ?? 'basic'
}

export function isDefenseEventProfileActive(stage: number): boolean {
  const profile = getDefenseEventProfile(stage)
  return profile !== 'none'
}

// ═══════════════════════════════════════════════════════════════════════════
// VECTOR PROGRESS FORMULAS (HOST 06, 09)
// ═══════════════════════════════════════════════════════════════════════════

export function getVectorProgressThreshold(stage: number): number {
  if (stage === 6) {
    return BALANCE.HOSTS['06'].vector.progressThreshold
  }
  if (stage === 9) {
    return BALANCE.HOSTS['09'].supplyChain.bonusPercent
  }
  return Infinity
}

export function getVectorBPSBonus(stage: number): number {
  if (stage === 6) {
    return BALANCE.HOSTS['06'].vector.bpsBonusPercent / 100
  }
  if (stage === 9) {
    return BALANCE.HOSTS['09'].supplyChain.bonusPercent / 100
  }
  return 0
}

// ═══════════════════════════════════════════════════════════════════════════
// SEASONAL CYCLE FORMULAS (HOST 07)
// ═══════════════════════════════════════════════════════════════════════════

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export function getSeasonDurationSeconds(): number {
  return BALANCE.HOSTS['07'].seasonal.durationSeconds
}

export function getSeasonFromIndex(index: number): Season {
  const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter']
  return seasons[index % 4]
}

export function getSeasonalBPSModifier(season: Season): number {
  switch (season) {
    case 'spring':
      return 1.0
    case 'summer':
      return 1 + (BALANCE.HOSTS['07'].seasonal.summerBpsBonusPercent / 100)
    case 'autumn':
      return 1.0
    case 'winter':
      return 1 - (BALANCE.HOSTS['07'].seasonal.winterBpsPenaltyPercent / 100)
  }
}

export function getSeasonalEventFrequencyMultiplier(season: Season): number {
  switch (season) {
    case 'spring':
      return BALANCE.HOSTS['07'].seasonal.springEventFrequencyMultiplier
    case 'summer':
      return 0.7
    case 'autumn':
      return 1.0
    case 'winter':
      return 1.2
  }
}

export function getMainChannelAttackAreaPercent(): number {
  return BALANCE.HOSTS['07'].seasonal.mainChannelAttackAreaPercent / 100
}

// ═══════════════════════════════════════════════════════════════════════════
// RIVAL NETWORK FORMULAS (HOST 08)
// ═══════════════════════════════════════════════════════════════════════════

export function getRivalZoneDecayRate(): number {
  return BALANCE.HOSTS['08'].rivalNetwork.zoneDecayRate
}

export function getRivalCountermeasureFrequency(): number {
  return BALANCE.HOSTS['08'].rivalNetwork.countermeasureFrequency
}

export function getRivalCountermeasureBpsHaltSeconds(): number {
  return BALANCE.HOSTS['08'].rivalNetwork.countermeasureBpsHaltSeconds
}

export function getHeartrootUnlockThreshold(): number {
  return BALANCE.HOSTS['08'].zones[3].unlockThreshold ?? 0.5
}

export function isRivalNetworkSuppressed(state: GameState): boolean {
  return state.currentStage === 8 && state.rivalNetworkState?.isSuppressing === true
}

export function getRivalControlZoneMultiplier(zone: { isRivalControlled?: boolean }): number {
  if (!zone.isRivalControlled) return 1.0
  return 0.5
}

export function isZoneRivalControlled(state: GameState, zoneId: string): boolean {
  if (state.currentStage !== 8) return false
  const zone = state.zones.find(z => z.id === zoneId)
  return zone?.isRivalControlled ?? false
}

export function getRivalDisruptionBPSBonus(): number {
  return 0.25
}

// ═══════════════════════════════════════════════════════════════════════════
// RESEARCH INSTITUTIONS FORMULAS (HOST 10)
// ═══════════════════════════════════════════════════════════════════════════

export function getResearchZoneDefenseReduction(): number {
  return BALANCE.HOSTS['10'].researchZone.defenseReductionPercent
}

export function getMultiFrontStressThreshold(): number {
  return BALANCE.HOSTS['10'].multiFront.stressThreshold
}

// ═══════════════════════════════════════════════════════════════════════════
// QUEEN NODE FORMULAS (HOST 03)
// ═══════════════════════════════════════════════════════════════════════════

export function getQueenNodeHealthPercent(): number {
  return BALANCE.HOSTS['03'].queenNode.healthPercent
}

export function getQueenNodeCollapseDrainMultiplier(): number {
  return BALANCE.HOSTS['03'].queenNode.collapseDrainMultiplier
}

// ═══════════════════════════════════════════════════════════════════════════
// NEURAL ZONE FORMULAS (HOST 05)
// ═══════════════════════════════════════════════════════════════════════════

export function getNeuralStressReductionPercent(): number {
  return BALANCE.HOSTS['05'].stress.neuralStressReductionPct
}

// ═══════════════════════════════════════════════════════════════════════════
// PROACTIVE COUNTERMEASURE FORMULAS (HOST 10+)
// ═══════════════════════════════════════════════════════════════════════════

export function getProactiveCountermeasureCost(): number {
  return BALANCE.PROACTIVE_COUNTERMEASURES.signalCost
}

export function getProactiveCountermeasureDurationMs(): number {
  return BALANCE.PROACTIVE_COUNTERMEASURES.durationMs
}

export function getProactiveCountermeasureSuccessBonus(): number {
  return BALANCE.PROACTIVE_COUNTERMEASURES.preemptiveSuccessRateBonus
}

export function getProactiveCountermeasureMatchingEvents(countermeasureId: import('../lib/game').ProactiveCountermeasureId): string[] {
  return BALANCE.PROACTIVE_COUNTERMEASURES.matchingEvents[countermeasureId] ?? []
}

export function isProactiveCountermeasureActive(state: GameState, now: number): boolean {
  return state.proactiveCountermeasure !== null && now < state.proactiveCountermeasureEndAt && state.proactiveCountermeasureEndAt > 0
}

export function doesProactiveCountermeasureMatchEvent(countermeasureId: import('../lib/game').ProactiveCountermeasureId, eventId: DefenseEventId): boolean {
  const matchingEvents = getProactiveCountermeasureMatchingEvents(countermeasureId)
  return matchingEvents.includes(eventId)
}

// ═══════════════════════════════════════════════════════════════════════════
// TIER 2 SCANNING FORMULAS (HOST 10)
// ═══════════════════════════════════════════════════════════════════════════

export function isTier2ScanningAvailable(stage: number): boolean {
  return stage >= BALANCE.EVENT_TIERS.tier2ScanUnlockHost
}

export function getTier2ScanCost(): number {
  return BALANCE.PROACTIVE_COUNTERMEASURES.signalCost
}

export function getTier2PreemptiveBonus(): number {
  return BALANCE.EVENT_TIERS.tier2PreemptiveSuccessRateBonus
}

export function isTier2BonusApplied(state: GameState): boolean {
  return state.tier2ScanActive &&
         state.tier2PreemptiveSet &&
         state.nextDefenseEventId !== null &&
         state.nextDefenseEventId === state.tier2ScannedEventId
}

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-FRONT EVENT FORMULAS (HOST 10)
// ═══════════════════════════════════════════════════════════════════════════

export function getMultiFrontExtraEventCount(): number {
  return BALANCE.MULTI_FRONT.extraEventCount
}

export function getMultiFrontStressThresholdRatio(): number {
  return BALANCE.MULTI_FRONT.stressThresholdRatio
}

export function isMultiFrontTriggered(state: GameState): boolean {
  if (state.currentStage !== 10) return false
  const threshold = getMultiFrontStressThreshold()
  const ratio = state.hostStress.currentStress / threshold
  return ratio >= BALANCE.MULTI_FRONT.stressThresholdRatio
}

// ═══════════════════════════════════════════════════════════════════════════
// SUPPLY CHAIN SPREAD FORMULAS (HOST 09 → 10)
// ═══════════════════════════════════════════════════════════════════════════

export function getSupplyChainSpreadBonusCarryover(): number {
  return BALANCE.SUPPLY_CHAIN_SPREAD.bonusCarryoverPercent / 100
}

export function getSupplyChainZoneStartBonus(): number {
  return BALANCE.SUPPLY_CHAIN_SPREAD.zoneStartHealthBonus
}

export function getSupplyChainBPSBonus(stage: number, supplyChainBonusActive: boolean): number {
  if (stage !== 10) return 0
  if (!supplyChainBonusActive) return 0
  return BALANCE.HOSTS['09'].supplyChain.bonusPercent / 100
}

// ═══════════════════════════════════════════════════════════════════════════
// IMMEDIATE HIT EVENT FORMULAS
// ═══════════════════════════════════════════════════════════════════════════

export function isImmediateHitEvent(eventId: DefenseEventId): boolean {
  return BALANCE.IMMEDIATE_HIT_EVENTS.includes(eventId)
}

export function getImmediateHitDamageMultiplier(eventId: DefenseEventId): number {
  const immediateHitMultipliers: Record<DefenseEventId, number> = {
    'fungicide-spray': 0.65,
    'soil-fumigation': 0.5,
    'biocontrol-application': 0.6,
    'resistance-breaker': 0.55,
    'quarantine-protocol': 0.4,
    'research-crackdown': 0.45,
    'public-awareness-campaign': 1,
    'regulatory-crackdown': 0.35,
    'drought': 1,
    'beetle-disruption': 1,
    'cold-snap': 1,
    'spore-competition': 1,
    'immune-response': 1,
    'desiccation-pulse': 1,
    'antifungal-exudates': 1,
    'microbial-rivalry': 1,
    'uv-surge': 1,
    'lignin-fortification': 1,
    'root-allelopathy': 1,
    'insect-vector-swarm': 1,
    'viral-hijack': 1,
    'nutrient-sequestration': 1,
    'spore-predation': 1,
    'thermal-stratification': 1,
    'ecosystem-feedback': 1,
    'mycorrhizal-interference': 1,
    'allelopathic-warfare': 1,
    'zone-reclamation': 1,
    'spore-trap': 1,
    'atmospheric-collapse': 1,
    'hydrological-breakdown': 1,
    'geochemical-disruption': 1,
    'mass-extinction-pulse': 1,
    'tectonic-response': 1,
    'solar-isolation': 1,
  }
  return immediateHitMultipliers[eventId] ?? 1
}

// ═══════════════════════════════════════════════════════════════════════════
// GRIND EVENT FORMULAS (UPDATED)
// ═══════════════════════════════════════════════════════════════════════════

export type GrindEventOutcome = 'success' | 'partialFail' | 'fullFail'

export function getGrindEventTimerSeconds(): number {
  return BALANCE.GRIND_EVENTS.timerSeconds
}

export function getGrindEventBaseFailRate(): number {
  return BALANCE.GRIND_EVENTS.baseFailRate
}

export function getGrindEventEnzymeRewardBase(): number {
  return BALANCE.GRIND_EVENTS.enzymeRewardBase
}

export function getGrindEventEnzymeRewardOnSuccess(): number {
  return BALANCE.GRIND_EVENTS.enzymeRewardOnSuccess
}

export function getGrindEventEnzymeRewardOnPartialFail(): number {
  return BALANCE.GRIND_EVENTS.enzymeRewardOnPartialFail
}

export function getGrindEventEnzymeRewardOnFullFail(): number {
  return BALANCE.GRIND_EVENTS.enzymeRewardOnFullFail
}

export function getGrindEventSessionWindowSeconds(): number {
  return BALANCE.GRIND_EVENTS.timerSeconds
}

export function getGrindEventFailRateIncreasePerEvent(): number {
  return BALANCE.GRIND_EVENTS.failRateEscalation.increasePerEvent
}

export function getGrindEventMaxFailRate(): number {
  return BALANCE.GRIND_EVENTS.failRateEscalation.maxFailRate
}

export function getGrindEventCurrentFailRate(runEventCount: number): number {
  const baseFailRate = getGrindEventBaseFailRate()
  const increasePerEvent = getGrindEventFailRateIncreasePerEvent()
  const maxFailRate = getGrindEventMaxFailRate()
  return Math.min(maxFailRate, baseFailRate + (runEventCount * increasePerEvent))
}

export function getGrindEventDiminishingReturnsMultiplier(runEventCount: number): number {
  if (!BALANCE.GRIND_EVENTS.diminishingReturns.enabled) return 1.0

  const reductionPerEvent = BALANCE.GRIND_EVENTS.diminishingReturns.reductionPerEvent
  const minMultiplier = BALANCE.GRIND_EVENTS.diminishingReturns.minRewardMultiplier

  const multiplier = 1 - (runEventCount * reductionPerEvent)
  return Math.max(minMultiplier, multiplier)
}

export function getGrindEventEnzymeReward(runEventCount: number): number {
  const baseReward = getGrindEventEnzymeRewardBase()
  const diminishingMultiplier = getGrindEventDiminishingReturnsMultiplier(runEventCount)
  return Math.floor(baseReward * diminishingMultiplier)
}

export function resolveGrindEvent(runEventCount: number): { outcome: GrindEventOutcome; enzymeReward: number } {
  const currentFailRate = getGrindEventCurrentFailRate(runEventCount)
  const roll = Math.random()

  if (roll < currentFailRate * BALANCE.GRIND_EVENTS.failRateEscalation.maxFailRate) {
    return { outcome: 'fullFail', enzymeReward: getGrindEventEnzymeRewardOnFullFail() }
  } else if (roll < currentFailRate) {
    return { outcome: 'partialFail', enzymeReward: getGrindEventEnzymeRewardOnPartialFail() }
  } else {
    return { outcome: 'success', enzymeReward: getGrindEventEnzymeReward(runEventCount) }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COUNTERMEASURE RESOLUTION FORMULA (UPDATED)
// ═══════════════════════════════════════════════════════════════════════════

export type CountermeasureOutcome = 'success' | 'partialFail' | 'fullFail'

export function getPartialFailMitigationPercent(): number {
  return BALANCE.DEFENSE_EVENTS.partialFailMitigationPercent
}

export function getFullFailTimerExtensionSeconds(): number {
  return BALANCE.DEFENSE_EVENTS.fullFailTimerExtensionSeconds
}

export function getFullFailShareOfFailRate(): number {
  return BALANCE.DEFENSE_EVENTS.fullFailShareOfFailRate
}

export function resolveCountermeasure(baseFailRate: number, stressMultiplier: number): CountermeasureOutcome {
  const effectiveFailRate = baseFailRate * stressMultiplier
  const roll = Math.random()
  const fullFailThreshold = effectiveFailRate * getFullFailShareOfFailRate()

  if (roll < fullFailThreshold) {
    return 'fullFail'
  } else if (roll < effectiveFailRate) {
    return 'partialFail'
  } else {
    return 'success'
  }
}

export function getCountermeasureMitigatedMultiplier(
  outcome: CountermeasureOutcome,
  baseMultiplier: number
): number {
  if (outcome === 'success') {
    return 1.0
  }

  if (outcome === 'partialFail') {
    const mitigation = getPartialFailMitigationPercent()
    const deductionAmount = 1 - baseMultiplier
    const reducedDeduction = deductionAmount * (1 - mitigation)
    return 1 - reducedDeduction
  }

  return baseMultiplier
}

// ═══════════════════════════════════════════════════════════════════════════
// ESCALATING DEDUCTION CURVES
// ═══════════════════════════════════════════════════════════════════════════

export type CurveType = 'linear' | 'exponential' | 'logarithmic'

export function getStartDeductionPercent(): number {
  return BALANCE.DEFENSE_EVENTS.startDeductionPercent
}

export function getDefenseRampCurve(): CurveType {
  return BALANCE.DEFENSE_EVENTS.rampCurve as CurveType
}

export function getCurrentDeductionPercent(
  elapsedMs: number,
  durationMs: number,
  startPercent: number,
  endPercent: number,
  curve: CurveType
): number {
  if (durationMs <= 0) return endPercent

  const progress = Math.min(1, elapsedMs / durationMs)

  if (curve === 'linear') {
    return startPercent + (endPercent - startPercent) * progress
  }

  if (curve === 'exponential') {
    return startPercent + (endPercent - startPercent) * Math.pow(progress, 2)
  }

  if (curve === 'logarithmic') {
    return startPercent + (endPercent - startPercent) * (Math.log(1 + progress * 9) / Math.log(10))
  }

  return endPercent
}

export function getDefenseEventDeductionMultiplier(
  elapsedMs: number,
  durationMs: number,
  baseMultiplier: number
): number {
  const curve = getDefenseRampCurve()
  const startPercent = getStartDeductionPercent()

  const startMultiplier = 1 - startPercent
  const endMultiplier = baseMultiplier

  const currentPercent = getCurrentDeductionPercent(elapsedMs, durationMs, startPercent, 1.0, curve)
  const currentMultiplier = startMultiplier + (endMultiplier - startMultiplier) * (currentPercent - startPercent) / (1 - startPercent)

  return Math.max(endMultiplier, Math.min(startMultiplier, currentMultiplier))
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTIVE ATTACK ENZYME REWARD
// ═══════════════════════════════════════════════════════════════════════════

export function getEnzymeGainFromSuccessfulCountermeasure(): number {
  return BALANCE.ACTIVE_ATTACKS.enzymeGainFromSuccessfulCountermeasure
}

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION METER ZONE CONFIG (HOST 11)
// ═══════════════════════════════════════════════════════════════════════════

export function getIntegrationMeterMax(): number {
  return BALANCE.HOSTS['11'].integrationMeter.maxValue
}

export function getIntegrationZoneConfig(zoneId: string): {
  saturationThreshold: number
  contributionPerSecond: number
} | null {
  const zone = BALANCE.HOSTS['11'].integrationMeter.zones.find(z => z.id === zoneId)
  if (!zone) return null
  return {
    saturationThreshold: zone.saturationThreshold,
    contributionPerSecond: zone.contributionPerSecond,
  }
}

export function getExtinctionEventFrequencySeconds(): number {
  return BALANCE.HOSTS['11'].integrationMeter.extinctionEvents.frequencySeconds
}

export function getExtinctionEventMeterRegressionPercent(): number {
  return BALANCE.HOSTS['11'].integrationMeter.extinctionEvents.meterRegressionPercent
}

export function getExtinctionEventResponseWindowSeconds(): number {
  return BALANCE.HOSTS['11'].integrationMeter.extinctionEvents.responseWindowSeconds
}

export function getIntegrationPulseConfig(): {
  cost: number
  durationSeconds: number
  fillRateMultiplier: number
  cooldownSeconds: number
} {
  return {
    cost: BALANCE.HOSTS['11'].integrationMeter.integrationPulse.cost,
    durationSeconds: BALANCE.HOSTS['11'].integrationMeter.integrationPulse.durationSeconds,
    fillRateMultiplier: BALANCE.HOSTS['11'].integrationMeter.integrationPulse.fillRateMultiplier,
    cooldownSeconds: BALANCE.HOSTS['11'].integrationMeter.integrationPulse.cooldownSeconds,
  }
}

export function getIntegrationPulseCost(): number {
  return BALANCE.HOSTS['11'].integrationMeter.integrationPulse.cost
}

export function getIntegrationPulseDurationSeconds(): number {
  return BALANCE.HOSTS['11'].integrationMeter.integrationPulse.durationSeconds
}

export function getIntegrationPulseBPSMultiplier(): number {
  return BALANCE.HOSTS['11'].integrationMeter.integrationPulse.fillRateMultiplier
}

export function getExtinctionEventFrequency(): number {
  return BALANCE.HOSTS['11'].integrationMeter.extinctionEvents.frequencySeconds
}

export function getExtinctionEventMeterRegression(): number {
  return BALANCE.HOSTS['11'].integrationMeter.extinctionEvents.meterRegressionPercent
}

export function getIntegrationMeterSaturationThreshold(): number {
  const zones = BALANCE.HOSTS['11'].integrationMeter.zones
  return zones.length > 0 ? zones[0].saturationThreshold : 200
}

export function getZoneSaturationRate(zoneCompromisePercent: number): number {
  if (zoneCompromisePercent < 50) return 0
  const effectivePercent = (zoneCompromisePercent - 50) / 50
  return effectivePercent * 0.1
}

export function getIntegrationMeterFillRate(state: GameState): number {
  if (state.currentStage !== 11) return 0
  let fillRate = 0
  for (const zone of state.integrationZones) {
    if (zone.isLocked) continue
    const zoneConfig = getIntegrationZoneConfig(zone.zoneId)
    if (!zoneConfig) continue
    if (zone.saturationPercent >= zoneConfig.saturationThreshold) {
      fillRate += zoneConfig.contributionPerSecond
    } else {
      const zoneState = state.zones.find(z => z.id === zone.zoneId)
      if (zoneState) {
        fillRate += getZoneSaturationRate(zoneState.compromisePercent)
      }
    }
  }
  return fillRate
}

export function isIntegrationComplete(state: GameState): boolean {
  return state.currentStage === 11 && state.integrationMeter >= getIntegrationMeterMax()
}

export function canUseIntegrationPulse(state: GameState): boolean {
  if (state.currentStage !== 11) return false
  if (state.signal < getIntegrationPulseCost()) return false
  if (state.integrationPulse?.isActive) return false
  return true
}

export function getIntegrationMeterRegressionMultiplier(state: GameState): number {
  return 1 - (getExtinctionEventMeterRegression() / 100)
}
