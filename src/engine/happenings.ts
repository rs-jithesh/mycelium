/**
 * happenings.ts
 * Event handlers. The only file allowed to mutate state.
 * Each happening calls formulas and writes results back to state.
 */

import Decimal from 'break_eternity.js'
import { BALANCE } from './balance.config'
import * as formulas from './formulas'
import type {
  CountermeasureId,
  DefenseEventId,
  GameState,
  GeneratorId,
  HostEchoType,
  OfflineEvent,
  OfflineNarrative,
  StatId,
  StrainId,
  UpgradeId,
} from '../lib/game'
import { createDefaultState } from './values'
import {
  createCombatSession,
  performPlayerCombatAttack,
  resolveCombatOutcomeFromSession,
  tickEnemyCombat,
} from './pve/combat'
import { getEnemyById } from './pve/enemies'
import { getEnemySpawnCooldownMs, rollEnemySpawn, shouldAttemptEnemySpawn } from './pve/spawn'
import type { ActiveEnemyDebuff } from './pve/enemy.types'
import {
  generatorDefinitions,
  upgradeDefinitions,
  hostDefinitions,
  strainDefinitions,
  skillDefinitions,
  hostEchoDefinitions,
  getCurrentHostDefinition,
  hasNextStage as hasNextStageUtil,
  countermeasureDefinitions,
} from '../lib/game'

// --- HELPERS ---

function clampLog(log: string[]): string[] {
  return log.slice(-BALANCE.LOG_LIMIT)
}

function createLogEntry(message: string): string {
  return `> ${message}`
}

function appendLog(log: string[], message: string): string[] {
  return clampLog([...log, createLogEntry(message)])
}

function appendLogs(log: string[], messages: string[]): string[] {
  if (messages.length === 0) return log
  return clampLog([...log, ...messages.map(createLogEntry)])
}

function incrementCount(record: Record<string, number>, key: string): Record<string, number> {
  return {
    ...record,
    [key]: (record[key] ?? 0) + 1,
  }
}

function formatEchoBonus(bonus: { type: string; value: number }): string {
  switch (bonus.type) {
    case 'clickMultiplier':
      return `+${bonus.value * 100}% click output`
    case 'passiveMultiplier':
      return `+${bonus.value * 100}% passive output`
    case 'defenseMitigation':
      return `+${bonus.value * 100}% defense mitigation`
    case 'maxSignal':
      return `+${bonus.value} max Signal`
    default:
      return `+${bonus.value}`
  }
}

function markReveal(state: GameState, key: string): GameState {
  if (state.visibility.isNew[key]) {
    return state
  }

  return {
    ...state,
    visibility: {
      ...state.visibility,
      isNew: {
        ...state.visibility.isNew,
        [key]: true,
      },
    },
  }
}

function unlockVisibilityFlag(state: GameState, key: keyof GameState['visibility'], revealKey = key): GameState {
  if (key === 'generatorTiers' || key === 'isNew' || key === 'generatorPanelUnlockAt') {
    return state
  }

  if (state.visibility[key]) {
    return state
  }

  return markReveal(
    {
      ...state,
      visibility: {
        ...state.visibility,
        [key]: true,
      },
    },
    String(revealKey)
  )
}

function unlockGeneratorTier(state: GameState, tierIndex: number): GameState {
  if (state.visibility.generatorTiers[tierIndex]) {
    return state
  }

  const nextTiers = [...state.visibility.generatorTiers]
  nextTiers[tierIndex] = true

  return markReveal(
    {
      ...state,
      visibility: {
        ...state.visibility,
        generatorTiers: nextTiers,
      },
    },
    `generatorTier-${tierIndex}`
  )
}

function getGeneratorNameByIndex(index: number): string {
  return generatorDefinitions[index]?.name ?? `Tier ${index + 1}`
}

function isUpgradeRequirementMet(state: GameState, upgrade: (typeof upgradeDefinitions)[number]): boolean {
  return state.generators[upgrade.requiredGenerator].owned >= upgrade.requiredOwned
}

function getGeneratorNameById(generatorId: string): string {
  return generatorDefinitions.find((generator) => generator.id === generatorId)?.name ?? generatorId
}

export type DefenseFlavorDefinition = {
  id: DefenseEventId
  name: string
  description: string
  durationMs: number
  multiplier: number
  clickMultiplier?: number
  stageRange: { min: number; max: number }
  triggerLogs: string[]
  creepLogs: string[]
  expirationLog: string
}

export const defenseFlavorDefinitions: Record<DefenseEventId, DefenseFlavorDefinition> = {
  'drought': {
    id: 'drought',
    name: 'Drought',
    description: 'All generator output reduced by 30% for 4 minutes.',
    durationMs: 4 * 60 * 1000,
    multiplier: 0.7,
    stageRange: { min: 1, max: 8 },
    triggerLogs: [
      'The moisture recedes. The network contracts.',
      'Drought conditions detected. Output reduced by 30%.',
    ],
    creepLogs: [
      'Dry channels widen through the substrate. Resource flow thins.',
      'Capillary spread faltering. Peripheral filaments retreat.',
      'Hydration gradients continue drifting away from the colony.',
    ],
    expirationLog: 'Drought pressure eases. Moisture returns to the outer mesh.',
  },
  'beetle-disruption': {
    id: 'beetle-disruption',
    name: 'Beetle Disruption',
    description: 'A generator tier has been severed for 3 minutes.',
    durationMs: 3 * 60 * 1000,
    multiplier: 1,
    stageRange: { min: 1, max: 8 },
    triggerLogs: [
      'Something moves through the network. Structural links rupture.',
      'Predation pressure localised on a single production channel.',
    ],
    creepLogs: [
      'Chewing continues somewhere below the bark.',
      'A severed conduit fails to reconnect. Output remains absent.',
      'The disturbance keeps following nutrient-rich tissue.',
    ],
    expirationLog: 'Predator movement passes. Structural continuity restored.',
  },
  'cold-snap': {
    id: 'cold-snap',
    name: 'Cold Snap',
    description: 'Absorption efficiency drops by 15% and click absorption weakens by 25% for 5 minutes.',
    durationMs: 5 * 60 * 1000,
    multiplier: 0.85,
    clickMultiplier: 0.75,
    stageRange: { min: 3, max: 4 },
    triggerLogs: [
      'Temperature collapses. Metabolism slows at the edge of the colony.',
      'Cold Snap detected. Manual absorption weakens while spread efficiency falls.',
    ],
    creepLogs: [
      'Outer hyphae stiffening. Nutrient transport thickens.',
      'Metabolic heat no longer holding the perimeter together.',
      'Ice memory creeping through exposed tissue.',
    ],
    expirationLog: 'Thermal pressure loosens. Peripheral metabolism resumes.',
  },
  'spore-competition': {
    id: 'spore-competition',
    name: 'Spore Competition',
    description: 'Rival colonies reduce all output by 35% for 6 minutes.',
    durationMs: 6 * 60 * 1000,
    multiplier: 0.65,
    clickMultiplier: 0.85,
    stageRange: { min: 5, max: 8 },
    triggerLogs: [
      'Foreign fungal signatures detected across the substrate.',
      'Spore Competition underway. Biomass capture efficiency is contested.',
    ],
    creepLogs: [
      'Rival growth fronts overlap our feeding zones.',
      'Airborne competition thickens. Yield decays at the margins.',
      'Nutrient edges becoming shared territory.',
    ],
    expirationLog: 'Competing colonies lose their hold. Local capture dominance restored.',
  },
  'immune-response': {
    id: 'immune-response',
    name: 'Immune Response',
    description: 'Host countermeasures reduce output by 45% and clicks by 35% for 7 minutes.',
    durationMs: 7 * 60 * 1000,
    multiplier: 0.55,
    clickMultiplier: 0.65,
    stageRange: { min: 5, max: 8 },
    triggerLogs: [
      'The host fighting back. Defensive chemistry saturates the tissue.',
      'Immune Response active. Output and click absorption are heavily suppressed.',
    ],
    creepLogs: [
      'Host markers concentrating around our densest pathways.',
      'Defensive compounds persist in living tissue.',
      'Localized rejection intensifies at active feeding points.',
    ],
    expirationLog: 'Host chemistry thins. Targeting pressure breaks apart.',
  },
  'desiccation-pulse': {
    id: 'desiccation-pulse',
    name: 'Desiccation Pulse',
    description: 'Moisture withdrawal reduces output by 35% for 45 seconds.',
    durationMs: 45_000,
    multiplier: 0.65,
    stageRange: { min: 1, max: 8 },
    triggerLogs: ['Moisture gradient collapsing. Substrate withdrawing water.'],
    creepLogs: [
      'Hyphal tips curling inward. Transport slowing.',
      'Vapor pressure rising. Internal turgor falling.',
      'Network edges desiccating. Signal propagation delayed.',
    ],
    expirationLog: 'Moisture equilibrium returning. Mycelium rehydrating.',
  },
  'antifungal-exudates': {
    id: 'antifungal-exudates',
    name: 'Antifungal Exudates',
    description: 'Host chemistry reduces output by 28% for 60 seconds.',
    durationMs: 60_000,
    multiplier: 0.72,
    stageRange: { min: 2, max: 7 },
    triggerLogs: ['Host secreting secondary metabolites. Chemical hostility detected.'],
    creepLogs: [
      'Chitin precursors degrading at cell walls.',
      'Enzyme efficiency dropping. Growth stunted.',
      'Local pH shifting acidic. Membrane stress increasing.',
    ],
    expirationLog: 'Metabolite concentration diluting. Chemical pressure easing.',
  },
  'microbial-rivalry': {
    id: 'microbial-rivalry',
    name: 'Microbial Rivalry',
    description: 'Competing microbes reduce output by 42% for 40 seconds.',
    durationMs: 40_000,
    multiplier: 0.58,
    stageRange: { min: 2, max: 6 },
    triggerLogs: ['Competing bacterial colonies blooming. Resource contention.'],
    creepLogs: [
      'Biofilm competitors colonizing nutrient channels.',
      'Lateral gene transfer detected in rival microbes.',
      'Our hyphae being outcompeted for simple sugars.',
    ],
    expirationLog: 'Bacterial bloom collapsing under our acid production.',
  },
  'uv-surge': {
    id: 'uv-surge',
    name: 'UV Surge',
    description: 'Surface radiation reduces output by 20% and clicks by 35% for 35 seconds.',
    durationMs: 35_000,
    multiplier: 0.8,
    clickMultiplier: 0.65,
    stageRange: { min: 1, max: 5 },
    triggerLogs: ['Ultraviolet radiation spike. Surface hyphae exposed.'],
    creepLogs: [
      'Melanin shielding insufficient. DNA damage accumulating.',
      'Photosensitive pigments bleaching.',
      'Click response latency increasing.',
    ],
    expirationLog: 'UV intensity normalizing. Surface network recovering.',
  },
  'lignin-fortification': {
    id: 'lignin-fortification',
    name: 'Lignin Fortification',
    description: 'Host wall reinforcement reduces output by 45% for 75 seconds.',
    durationMs: 75_000,
    multiplier: 0.55,
    stageRange: { min: 3, max: 8 },
    triggerLogs: ['Host reinforcing cell walls with lignin polymers.'],
    creepLogs: [
      'Penetration enzymes struggling against cross-linked fibers.',
      'Decomposition rate halved in localized zones.',
      'Rhizomorph advance stalled at structural barriers.',
    ],
    expirationLog: 'Lignin matrix softening. Enzymatic breakthrough achieved.',
  },
  'root-allelopathy': {
    id: 'root-allelopathy',
    name: 'Root Allelopathy',
    description: 'Soil inhibitors reduce output by 32% for 55 seconds.',
    durationMs: 55_000,
    multiplier: 0.68,
    stageRange: { min: 4, max: 7 },
    triggerLogs: ['Neighboring roots releasing allelochemicals.'],
    creepLogs: [
      'Chemical inhibitors diffusing through soil matrix.',
      'Mycorrhizal competitors activating defense genes.',
      'Nutrient uptake channels being chemically jammed.',
    ],
    expirationLog: 'Allelopathic compounds neutralized. Root network reconnected.',
  },
  'insect-vector-swarm': {
    id: 'insect-vector-swarm',
    name: 'Insect Vector Swarm',
    description: 'Physical disruption reduces output by 55% for 50 seconds.',
    durationMs: 50_000,
    multiplier: 0.45,
    clickMultiplier: 0.85,
    stageRange: { min: 3, max: 8 },
    triggerLogs: ['Insect vectors mobilizing. Physical disruption detected.'],
    creepLogs: [
      'Hyphae being severed by mandibles.',
      'Sporocarps targeted for consumption.',
      'Mycelial cords dragged away from substrate.',
    ],
    expirationLog: 'Swarm dispersing. Physical damage contained.',
  },
  'viral-hijack': {
    id: 'viral-hijack',
    name: 'Viral Hijack',
    description: 'Replication stress reduces output by 40% for 70 seconds.',
    durationMs: 70_000,
    multiplier: 0.6,
    stageRange: { min: 5, max: 8 },
    triggerLogs: ['Bacteriophages adapting to target our fungal hosts.'],
    creepLogs: [
      'Viral capsids attaching to hyphal membranes.',
      'Genetic machinery being co-opted.',
      'Replication stress propagating through network.',
    ],
    expirationLog: 'Viral load declining. RNA interference stabilizing.',
  },
  'nutrient-sequestration': {
    id: 'nutrient-sequestration',
    name: 'Nutrient Sequestration',
    description: 'Nutrient lockup reduces output by 50% for 65 seconds.',
    durationMs: 65_000,
    multiplier: 0.5,
    stageRange: { min: 4, max: 8 },
    triggerLogs: ['Host locking phosphorus and nitrogen in unavailable forms.'],
    creepLogs: [
      'Mycelial pumps running at reduced efficiency.',
      'Essential minerals being actively withheld.',
      'Growth rate plateauing despite biomass surplus.',
    ],
    expirationLog: 'Sequestration pathways overwhelmed. Nutrients flowing again.',
  },
  'spore-predation': {
    id: 'spore-predation',
    name: 'Spore Predation',
    description: 'Predation suppresses output by 25% for 40 seconds.',
    durationMs: 40_000,
    multiplier: 0.75,
    stageRange: { min: 6, max: 8 },
    triggerLogs: ['Microfauna and birds consuming emergent spores.'],
    creepLogs: [
      'Fruiting bodies being harvested before maturity.',
      'Spore dispersal vectors compromised.',
      'Reproductive output temporarily suppressed.',
    ],
    expirationLog: 'Predator attention waning. Spore cloud reforming.',
  },
  'thermal-stratification': {
    id: 'thermal-stratification',
    name: 'Thermal Stratification',
    description: 'Thermal mismatch reduces output by 38% for 80 seconds.',
    durationMs: 80_000,
    multiplier: 0.62,
    stageRange: { min: 5, max: 8 },
    triggerLogs: ['Temperature layers forming. Metabolic mismatch.'],
    creepLogs: [
      'Upper network overheating. Lower network chilling.',
      'Enzyme kinetics desynchronizing across depths.',
      'Energy transfer across thermal gradient inefficient.',
    ],
    expirationLog: 'Thermal equilibrium restored. Metabolism stabilizing.',
  },
  'ecosystem-feedback': {
    id: 'ecosystem-feedback',
    name: 'Ecosystem Feedback',
    description: 'Coordinated biosphere resistance reduces output by 60% for 90 seconds.',
    durationMs: 90_000,
    multiplier: 0.4,
    stageRange: { min: 7, max: 8 },
    triggerLogs: ['Biosphere registering systemic imbalance. Coordinated response.'],
    creepLogs: [
      'Multiple defense pathways activating in parallel.',
      'The substrate is... learning.',
      'Global feedback loops tightening around our network.',
    ],
    expirationLog: 'Feedback cycle broken. The world exhales.',
  },
}

const ambientDefenseFlavorLogs = [
  'Subtle chemical gradient shift detected in substrate.',
  'Host tissue pH drifting by 0.3 units. Minor but persistent.',
  'Mycelial density map shows localized retraction.',
  'Distant root signals interfering with our coordination links.',
  'Atmospheric humidity dropping 2% over the last cycle.',
  'A single beetle has begun following a hyphal cord.',
  'Faint electromagnetic signature detected in soil. Unfamiliar.',
  'The leaf is no longer passive. It is... calculating.',
  'Spore viability down 4%. Recovery in progress.',
  'Network latency increasing by 180ms. Cause unknown.',
  'The forest floor exhales a different scent today.',
  'Something is tasting us.',
] as const

function getRandomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function getDefenseEventDurationMs(eventId: DefenseEventId): number {
  return defenseFlavorDefinitions[eventId].durationMs
}

function getDefenseEventName(eventId: DefenseEventId): string {
  return defenseFlavorDefinitions[eventId].name
}

function rollDefenseEventId(state: GameState): DefenseEventId {
  const eligibleEvents = Object.values(defenseFlavorDefinitions).filter(
    (event) => state.currentStage >= event.stageRange.min && state.currentStage <= event.stageRange.max
  )

  const nonRepeatEvents = eligibleEvents.filter((event) => event.id !== state.lastDefenseEventId)
  const eventPool = nonRepeatEvents.length > 0 ? nonRepeatEvents : eligibleEvents

  if (eventPool.length === 0) {
    return 'drought'
  }

  return getRandomItem(eventPool).id
}

function ensureDefenseForecast(state: GameState): GameState {
  if (state.currentStage < BALANCE.DEFENSE_FORECAST_UNLOCK_STAGE || state.nextDefenseEventId) {
    return state
  }

  return {
    ...state,
    nextDefenseEventId: rollDefenseEventId(state),
  }
}

// Pad old saves that have fewer than the expected number of generator tier entries
function padGeneratorTiers(tiers: boolean[]): boolean[] {
  const expected = generatorDefinitions.length
  if (tiers.length >= expected) return tiers
  return [...tiers, ...new Array(expected - tiers.length).fill(false)]
}

// --- CORRUPTION & MANIFESTATIONS ---

const MANIFESTATION_THRESHOLDS = [
  { at: 10, msg: 'The substrate twitches. Something notices.' },
  { at: 25, msg: "Veins darken. The host's defenses stir." },
  { at: 50, msg: 'Half-consumed. You feel the wood beyond.' },
  { at: 75, msg: 'The host is hollow. Only structure remains.' },
  { at: 90, msg: 'Final resistance crumbles. Victory is near.' },
  { at: 100, msg: 'Consumption complete. The network grows.' },
]

function calculateCorruptionPercent(health: Decimal, maxHealth: Decimal): number {
  if (maxHealth.lte(0)) return 100
  const consumed = maxHealth.sub(health)
  return Math.min(100, Math.max(0, consumed.div(maxHealth).mul(100).toNumber()))
}

function checkManifestations(state: GameState, newCorruption: number, oldCorruption: number): GameState {
  const newManifestations: string[] = []

  for (const threshold of MANIFESTATION_THRESHOLDS) {
    if (oldCorruption < threshold.at && newCorruption >= threshold.at) {
      newManifestations.push(threshold.msg)
    }
  }

  if (newManifestations.length > 0) {
    return {
      ...state,
      manifestationQueue: [...state.manifestationQueue, ...newManifestations],
    }
  }

  return state
}

function gainBiomass(state: GameState, amount: Decimal, source: 'click' | 'passive'): GameState {
  if (amount.lte(0)) return state

  // Signal economy temporarily disabled.
  const hostDamage = amount
  const remainingHost = Decimal.max(0, state.hostHealth.sub(hostDamage))
  const trackingUpdate = source === 'click'
    ? { _currentHostClickDamage: state._currentHostClickDamage.add(amount) }
    : { _currentHostPassiveDamage: state._currentHostPassiveDamage.add(amount) }

  const corruptionPercent = calculateCorruptionPercent(remainingHost, state.hostMaxHealth)

  const nextState = recalculateDerivedState({
    ...state,
    ...trackingUpdate,
    biomass: state.biomass.add(amount),
    lifetimeBiomass: state.lifetimeBiomass.add(amount),
    hostHealth: remainingHost,
    hostCompleted: remainingHost.lte(0),
    highestStageReached: Math.max(state.highestStageReached, state.currentStage),
    hostCorruptionPercent: corruptionPercent,
  })

  return checkManifestations(nextState, corruptionPercent, state.hostCorruptionPercent)
}

function spendBiomass(state: GameState, amount: Decimal): GameState {
  return {
    ...state,
    biomass: Decimal.max(0, state.biomass.sub(amount)),
  }
}

export function recalculateDerivedState(state: GameState): GameState {
  const mutationPoints = Math.max(
    0,
    formulas.getTotalMutationPointsEarned(state) - formulas.getSpentMutationPoints(state.stats)
  )

  // Signal values are managed by tickSignalSystem (prestige run 2+ only).
  // On run 1 (prestigeCount === 0) or before Signal unlocks, keep them zeroed.
  const isSignalActive = state.prestigeCount > 0 && formulas.isSignalUnlocked(state)

  return {
    ...state,
    biomassPerClick: formulas.getBaseClickValue(state),
    biomassPerSecond: formulas.calculateBiomassPerSecond(state),
    mutationPoints,
    signalCap: isSignalActive ? formulas.getSignalCap(state) : 0,
    signalPerSecond: isSignalActive ? formulas.getSignalPerSecond(state) : 0,
    signalDecaying: isSignalActive ? state.signalDecaying : false,
    signalOverspent: isSignalActive ? state.signalOverspent : false,
  }
}

export function maybeAppendMilestoneLog(previous: GameState, next: GameState): GameState {
  const messages: string[] = []

  if (previous.generators['hyphae-strand'].owned === 0 && next.generators['hyphae-strand'].owned > 0) {
    messages.push(createLogEntry('Hyphal thread established. Passive absorption initiated.'))
  }

  if (!previous.upgrades['chitinous-reinforcement'] && next.upgrades['chitinous-reinforcement']) {
    messages.push(createLogEntry('Cell walls thicken. Tier 1 absorption sharpens slightly.'))
  }

  if (!previous.upgrades['neural-propagation'] && next.upgrades['neural-propagation']) {
    messages.push(createLogEntry(
      'Neural propagation integrated. Manual strikes carry the weight of the network.'
    ))
  }

  if (!previous.upgrades['terminus-strike'] && next.upgrades['terminus-strike']) {
    messages.push(createLogEntry(
      'Terminus Strike online. Each absorption pulse collapses continental tissue.'
    ))
  }

  if (!previous.hostCompleted && next.hostCompleted) {
    messages.push(createLogEntry(`${previous.hostName} consumption complete. The substrate collapses into us.`))

    if (previous.currentStage === hostDefinitions.length) {
      messages.push(createLogEntry('Biosphere collapse confirmed. Spore Release protocol is now available.'))
    }
  }

  if (formulas.getCompletedHosts(previous) === 0 && formulas.getCompletedHosts(next) >= 1 && next.strain === null) {
    messages.push(createLogEntry('Genetic threshold reached. Primary strain selection is now available.'))
  }

  if (previous.currentStage < 3 && next.currentStage >= 3) {
    messages.push(createLogEntry('Cognitive branching intensifies. Skill tree access is now possible.'))
  }

  if (messages.length === 0) return next

  return {
    ...next,
    log: clampLog([...next.log, ...messages]),
  }
}

// --- DEFENSE EVENT CREATION ---

function createDroughtEvent(now: number) {
  const definition = defenseFlavorDefinitions['drought']
  return {
    id: 'drought' as const,
    name: definition.name,
    description: definition.description,
    endsAt: now + definition.durationMs,
    multiplier: new Decimal(definition.multiplier),
  }
}

function createColdSnapEvent(now: number) {
  const definition = defenseFlavorDefinitions['cold-snap']
  return {
    id: 'cold-snap' as const,
    name: definition.name,
    description: definition.description,
    endsAt: now + definition.durationMs,
    multiplier: new Decimal(definition.multiplier),
    clickMultiplier: new Decimal(definition.clickMultiplier ?? 1),
  }
}

function createSporeCompetitionEvent(now: number) {
  const definition = defenseFlavorDefinitions['spore-competition']
  return {
    id: 'spore-competition' as const,
    name: definition.name,
    description: definition.description,
    endsAt: now + definition.durationMs,
    multiplier: new Decimal(definition.multiplier),
    clickMultiplier: new Decimal(definition.clickMultiplier ?? 1),
  }
}

function createImmuneResponseEvent(now: number) {
  const definition = defenseFlavorDefinitions['immune-response']
  return {
    id: 'immune-response' as const,
    name: definition.name,
    description: definition.description,
    endsAt: now + definition.durationMs,
    multiplier: new Decimal(definition.multiplier),
    clickMultiplier: new Decimal(definition.clickMultiplier ?? 1),
  }
}

function createBeetleDisruptionEvent(state: GameState, now: number) {
  const definition = defenseFlavorDefinitions['beetle-disruption']
  const ownedGenerators = generatorDefinitions.filter(
    (def) => state.generators[def.id].owned > 0
  )
  if (ownedGenerators.length === 0) return null

  const disrupted = ownedGenerators[Math.floor(Math.random() * ownedGenerators.length)]
  return {
    id: 'beetle-disruption' as const,
    name: state.currentStage >= 5 ? 'Predator Swarm' : 'Beetle Disruption',
    description: `${disrupted.name} has been severed for ${Math.floor(definition.durationMs / 60_000)} minutes.`,
    endsAt: now + definition.durationMs,
    multiplier: new Decimal(1),
    disabledGeneratorId: disrupted.id,
  }
}

function createStandardDefenseEvent(eventId: Exclude<DefenseEventId, 'drought' | 'cold-snap' | 'spore-competition' | 'immune-response' | 'beetle-disruption'>, now: number) {
  const definition = defenseFlavorDefinitions[eventId]
  return {
    id: eventId,
    name: definition.name,
    description: definition.description,
    endsAt: now + definition.durationMs,
    multiplier: new Decimal(definition.multiplier),
    clickMultiplier: definition.clickMultiplier ? new Decimal(definition.clickMultiplier) : undefined,
  }
}

function createDefenseEvent(state: GameState, now: number, eventId: DefenseEventId) {
  switch (eventId) {
    case 'drought':
      return createDroughtEvent(now)
    case 'desiccation-pulse':
    case 'antifungal-exudates':
    case 'microbial-rivalry':
    case 'uv-surge':
    case 'lignin-fortification':
    case 'root-allelopathy':
    case 'insect-vector-swarm':
    case 'viral-hijack':
    case 'nutrient-sequestration':
    case 'spore-predation':
    case 'thermal-stratification':
    case 'ecosystem-feedback':
      return createStandardDefenseEvent(eventId, now)
    case 'cold-snap':
      return createColdSnapEvent(now)
    case 'spore-competition':
      return createSporeCompetitionEvent(now)
    case 'immune-response':
      return createImmuneResponseEvent(now)
    case 'beetle-disruption':
    default:
      return createBeetleDisruptionEvent(state, now)
  }
}

function applyCountermeasureToEvent(state: GameState, event: NonNullable<ReturnType<typeof createDefenseEvent>>, now: number) {
  const equipped = state.equippedCountermeasure

  // Chitin Lattice special case: converts beetle-disruption and insect-vector-swarm
  // from their special mechanics (generator sever / heavy penalty) into a softer
  // colony-wide output reduction instead. This preserves the intent of the old
  // Brood Decoy while fitting the new protocol system.
  if (equipped === 'chitin-lattice') {
    if (event.id === 'beetle-disruption' && event.disabledGeneratorId) {
      return {
        ...event,
        description: 'Lattice absorbs the impact. Structural damage diffused colony-wide.',
        endsAt: now + 30_000,    // shortened duration when mitigated
        disabledGeneratorId: undefined,
        multiplier: new Decimal(BALANCE.COUNTERMEASURE_BROOD_DECOY_FALLBACK_MULTIPLIER),
      }
    }

    if (event.id === 'insect-vector-swarm') {
      // Partially converts the swarm: still penalizes but removes click penalty
      return {
        ...event,
        description: 'Chitin lattice deflects physical intrusion. Output reduced but click channels intact.',
        clickMultiplier: undefined,   // remove click penalty
        // passive multiplier remains — lattice doesn't fully stop it
      }
    }
  }

  // All other events: no structural modification needed.
  // Mitigation is applied through getMitigatedPenaltyMultiplier in formulas.ts
  // at production calculation time, not by modifying the event object.
  return event
}

function getDefenseEventLogLines(event: { id: string; disabledGeneratorId?: string; name: string }): string[] {
  const defenseId = event.id as DefenseEventId
  const definition = defenseFlavorDefinitions[defenseId]
  if (!definition) {
    return []
  }

  if (defenseId === 'beetle-disruption') {
    if (!event.disabledGeneratorId) {
      return [
        ...definition.triggerLogs.map(createLogEntry),
        createLogEntry('Brood Decoy absorbed the impact. Colony output dips briefly instead of a full sever.'),
      ]
    }

    return [
      ...definition.triggerLogs.map(createLogEntry),
      createLogEntry(`${getGeneratorNameById(event.disabledGeneratorId)} output has dropped to zero for 3 minutes.`),
    ]
  }

  return definition.triggerLogs.map(createLogEntry)
}

function maybeAppendDefenseFlavorLog(state: GameState, deltaMs: number): GameState {
  if (!state.visibility.observationLog || deltaMs <= 0) {
    return state
  }

  if (state.activeDefenseEvents.length > 0) {
    const chance = Math.min(1, deltaMs / BALANCE.DEFENSE_CREEP_LOG_MEAN_INTERVAL_MS)
    if (Math.random() > chance) {
      return state
    }

    const event = getRandomItem(state.activeDefenseEvents)
    const definition = defenseFlavorDefinitions[event.id]
    if (!definition || definition.creepLogs.length === 0) {
      return state
    }

    return {
      ...state,
      log: appendLog(state.log, getRandomItem(definition.creepLogs)),
    }
  }

  if (state.currentStage < BALANCE.DEFENSE_FORECAST_UNLOCK_STAGE) {
    return state
  }

  const chance = Math.min(1, deltaMs / BALANCE.DEFENSE_AMBIENT_LOG_MEAN_INTERVAL_MS)
  if (Math.random() > chance) {
    return state
  }

  return {
    ...state,
    log: appendLog(state.log, getRandomItem(ambientDefenseFlavorLogs)),
  }
}

function getCountermeasureLogLines(countermeasureId: CountermeasureId | null, eventId: DefenseEventId): string[] {
  if (!countermeasureId) return []

  const definition = countermeasureDefinitions.find((c) => c.id === countermeasureId)
  if (!definition) return []

  const isFullCoverage = definition.targetEventIds.includes(eventId)
  const isPartialCoverage = definition.partialEventIds.includes(eventId)

  if (!isFullCoverage && !isPartialCoverage) return []

  const protocolLines: Record<CountermeasureId, Record<'full' | 'partial', string>> = {
    'moisture-buffer': {
      full: 'Moisture Buffer engages. Hydric reserves stabilizing the network.',
      partial: 'Moisture Buffer active. Limited cross-spectrum absorption.',
    },
    'chitin-lattice': {
      full: 'Chitin Lattice deploys. Structural intrusion absorbed.',
      partial: 'Chitin Lattice partially deflects. Some penetration persists.',
    },
    'enzyme-suppressor': {
      full: 'Enzyme Suppressor active. Chemical hostility neutralized.',
      partial: 'Enzyme Suppressor partially effective. Residual chemistry remains.',
    },
    'thermal-regulator': {
      full: 'Thermal Regulator engaged. Metabolic gradient corrected.',
      partial: 'Thermal Regulator partially compensating. Some thermal stress persists.',
    },
    'signal-jammer': {
      full: 'Signal Jammer active. Colony signature masked from host targeting.',
      partial: 'Signal Jammer partially masking. Detection probability reduced.',
    },
    'spore-shield': {
      full: 'Spore Shield deployed. Reproductive tissue and feeding margins protected.',
      partial: 'Spore Shield partially covering. Peripheral exposure remains.',
    },
  }

  const tier = isFullCoverage ? 'full' : 'partial'
  return [createLogEntry(protocolLines[countermeasureId][tier])]
}

export function checkVisibilityUnlocks(state: GameState, now = Date.now()): GameState {
  let next = state

  if (!next.visibility.observationLog && next.lifetimeBiomass.gt(0)) {
    next = unlockVisibilityFlag(next, 'observationLog')
    next = {
      ...next,
      log: appendLog(next.log, 'Spore contact confirmed. Substrate viable.'),
      visibility: {
        ...next.visibility,
        generatorPanelUnlockAt: now + 3000,
      },
    }
  }

  if (!next.visibility.generatorPanel && next.visibility.generatorPanelUnlockAt !== null && now >= next.visibility.generatorPanelUnlockAt) {
    next = unlockVisibilityFlag(next, 'generatorPanel')
    next = {
      ...next,
      log: appendLog(next.log, 'Absorption pathways identified. Network expansion possible.'),
      visibility: {
        ...next.visibility,
        generatorPanelUnlockAt: null,
      },
    }
  }

  if (!next.visibility.bpsDisplay && next.biomassPerSecond.gt(0)) {
    next = unlockVisibilityFlag(next, 'bpsDisplay')
  }

  if (!next.visibility.upgradePanel && upgradeDefinitions.some((upgrade) => isUpgradeRequirementMet(next, upgrade))) {
    next = unlockVisibilityFlag(next, 'upgradePanel')
    next = {
      ...next,
      log: appendLog(next.log, 'Biochemical optimization protocols now available.'),
    }
  }

  if (!next.visibility.strainPrompt && formulas.getCompletedHosts(next) >= 1 && next.strain === null) {
    next = unlockVisibilityFlag(next, 'strainPrompt')
    next = {
      ...next,
      log: appendLog(next.log, 'Genetic threshold reached. Primary strain selection required.'),
    }
  }

  if (!next.visibility.statsPanel && next.strain !== null) {
    next = unlockVisibilityFlag(next, 'statsPanel')
    next = {
      ...next,
      log: appendLog(next.log, 'Mutation architecture unlocked. Allocate resources to dominant traits.'),
    }
  }

  if (!next.visibility.skillTree && next.currentStage >= 3) {
    next = unlockVisibilityFlag(next, 'skillTree')
    next = {
      ...next,
      log: appendLog(next.log, 'Enzymatic memory catalogued. Skill expressions now available.'),
    }
  }

  if (!next.visibility.hostHealthBar && next.currentStage >= 1) {
    next = unlockVisibilityFlag(next, 'hostHealthBar')
    next = {
      ...next,
      log: appendLog(next.log, 'New substrate located. Resistance profile: moderate.'),
    }
  }

  if (!next.visibility.stageDisplay && next.currentStage >= 1) {
    next = unlockVisibilityFlag(next, 'stageDisplay')
  }

  // Signal panel: only available from the second run onward.
  // First run should have zero Signal presence.
  if (
    !next.visibility.signalPanel &&
    next.prestigeCount > 0 &&           // prestige guard — run 2+ only
    formulas.isSignalUnlocked(next)
  ) {
    next = unlockVisibilityFlag(next, 'signalPanel')
    next = {
      ...next,
      log: appendLogs(next.log, [
        'Genetic memory activates dormant signaling pathways.',
        'Signal represents communication bandwidth across the inherited network.',
        'It decays if unused. It costs if overspent. Route it with intention.',
      ]),
    }
  }

  if (!next.visibility.prestigeButton && next.currentStage === hostDefinitions.length) {
    next = unlockVisibilityFlag(next, 'prestigeButton')
    next = {
      ...next,
      log: clampLog([
        ...next.log,
        createLogEntry('CRITICAL THRESHOLD REACHED. Spore Release protocol available.'),
        createLogEntry('Warning: This action will dissolve current biomass structure.'),
        createLogEntry('Genetic Memory will be preserved and encoded into the new spore.'),
      ]),
    }
  }

  if (!next.visibility.useScientificNotation && next.biomass.gte(BALANCE.NOTATION_SHORTHAND_MAX)) {
    next = unlockVisibilityFlag(next, 'useScientificNotation')
  }

  for (let tierIndex = 1; tierIndex < generatorDefinitions.length; tierIndex += 1) {
    const previousGenerator = generatorDefinitions[tierIndex - 1]
    const stageGate = BALANCE.GENERATOR_STAGE_GATES[tierIndex]
    const previousOwnedReady = next.generators[previousGenerator.id].owned >= BALANCE.GENERATOR_UNLOCK_THRESHOLDS[tierIndex]
    const stageReady = stageGate === 0 || next.currentStage >= stageGate
    const tier3GateReady = tierIndex !== 2 || next.currentStage >= 2
    const tier4ProgressReady = next.currentStage > 2 || (
      next.currentStage === 2 &&
      formulas.getHostProgress(next) >= BALANCE.TIER4_STAGE2_HOST_PROGRESS_GATE
    )
    const tier4GateReady = tierIndex !== 3 || tier4ProgressReady

    if (
      !next.visibility.generatorTiers[tierIndex] &&
      previousOwnedReady &&
      stageReady &&
      tier3GateReady &&
      tier4GateReady
    ) {
      const cliffMultiplier = Math.round(
        formulas.getGeneratorEfficiencyByOwned(generatorDefinitions[tierIndex].id, 0)
          .div(formulas.getGeneratorEfficiencyByOwned(previousGenerator.id, BALANCE.GENERATOR_UNLOCK_THRESHOLDS[tierIndex]))
          .toNumber()
      )

      const guidance = tierIndex === 2
        ? 'Recommendation: Let lower tiers feed it. Rhizomorph output scales with network density.'
        : tierIndex === 3
          ? 'Recommendation: High-cost assault pathway. It remains effective into early Signal routing.'
          : 'Recommendation: Prioritize immediately.'

      next = unlockGeneratorTier(next, tierIndex)
      next = {
        ...next,
        log: clampLog([
          ...next.log,
          createLogEntry(`New absorption pathway detected: ${getGeneratorNameByIndex(tierIndex)}.`),
          createLogEntry(`Absorption analysis: ${cliffMultiplier}x more efficient than the current tier.`),
          createLogEntry(guidance),
        ]),
      }
    }
  }

  return ensureDefenseForecast(next)
}

// --- CORE TICK ---

const MANIFESTATION_DRAIN_INTERVAL_MS = 2000
let _manifestationDrainAccumulator = 0

export function tick(state: GameState, now = Date.now()): GameState {
  let next = expireDefenseEvents(state, now)
  next = tryTriggerDefenseEvent(next, now)

  const deltaMs = Math.max(0, now - state.lastTickTime)
  const elapsedSeconds = deltaMs / 1000
  const perTick = next.biomassPerSecond.mul(elapsedSeconds)

  next = gainBiomass(
    {
      ...next,
      lastTickTime: now,
    },
    perTick,
    'passive'
  )

  next = tickSignalSystem(next, deltaMs)
  next = tickDefenseResponseState(next, deltaMs)
  next = tickEnemyDebuffs(next, deltaMs)
  next = tickActiveEnemyCombat(next, deltaMs)
  next = tryTriggerEnemyEncounter(next, now)
  next = maybeAppendDefenseFlavorLog(next, deltaMs)

  // Drain manifestation queue: one message every 2 seconds
  if (next.manifestationQueue.length > 0) {
    _manifestationDrainAccumulator += deltaMs
    if (_manifestationDrainAccumulator >= MANIFESTATION_DRAIN_INTERVAL_MS) {
      _manifestationDrainAccumulator = 0
      const [msg, ...rest] = next.manifestationQueue
      next = {
        ...next,
        log: appendLog(next.log, msg),
        manifestationQueue: rest,
      }
    }
  } else {
    _manifestationDrainAccumulator = 0
  }

  return checkVisibilityUnlocks(next, now)
}

function tickDefenseResponseState(state: GameState, deltaMs: number): GameState {
  if (state.activeParasiteDefenseBurstMs <= 0) return state

  return {
    ...state,
    activeParasiteDefenseBurstMs: Math.max(0, state.activeParasiteDefenseBurstMs - deltaMs),
  }
}

function tickEnemyDebuffs(state: GameState, deltaMs: number): GameState {
  if (state.activeEnemyDebuffs.length === 0) {
    return state
  }

  const expired: ActiveEnemyDebuff[] = []
  const activeEnemyDebuffs = state.activeEnemyDebuffs.flatMap((debuff) => {
    const remainingMs = debuff.remainingMs - deltaMs
    if (remainingMs <= 0) {
      expired.push(debuff)
      return []
    }
    return [{
      ...debuff,
      remainingMs,
    }]
  })

  const next = {
    ...state,
    activeEnemyDebuffs,
    log: expired.length > 0
      ? appendLogs(state.log, expired.map((debuff) => `${debuff.name} dissipated. Local tissue recovers.`))
      : state.log,
  }

  return expired.length > 0 ? recalculateDerivedState(next) : next
}

function tryTriggerEnemyEncounter(state: GameState, now: number): GameState {
  if (!shouldAttemptEnemySpawn(state, now)) {
    return state
  }

  const nextEnemyCheckAt = now + getEnemySpawnCooldownMs(state)
  const encounter = rollEnemySpawn(state, now)
  if (!encounter) {
    return {
      ...state,
      nextEnemyCheckAt,
      forcedEnemyId: null,
    }
  }

  return {
    ...state,
    activeEnemyEncounter: encounter,
    pendingEnemyNotification: encounter.notification,
    knownEnemies: state.knownEnemies.includes(encounter.enemyId)
      ? state.knownEnemies
      : [...state.knownEnemies, encounter.enemyId],
    enemyEncounterCounts: incrementCount(state.enemyEncounterCounts, encounter.enemyId),
    nextEnemyCheckAt,
    forcedEnemyId: null,
    log: appendLog(state.log, encounter.notification),
  }
}

function finalizeEnemyCombat(state: GameState): GameState {
  if (!state.activeEnemyCombat) {
    return state
  }

  const enemy = getEnemyById(state.activeEnemyCombat.enemyId)
  if (!enemy) {
    return {
      ...state,
      activeEnemyCombat: null,
      activeEnemyEncounter: null,
      pendingEnemyNotification: null,
    }
  }

  const result = resolveCombatOutcomeFromSession(state, enemy, state.activeEnemyCombat)
  const victory = result.outcome !== 'defeat'
  const withRewards = result.biomassReward > 0
    ? gainBiomass(state, new Decimal(result.biomassReward), 'passive')
    : state
  const nextSignal = Math.max(0, withRewards.signal + result.signalReward)

  return recalculateDerivedState({
    ...withRewards,
    signal: nextSignal,
    activeEnemyEncounter: null,
    activeEnemyCombat: null,
    pendingEnemyNotification: null,
    lastEnemyCombatResult: result,
    activeEnemyDebuffs: result.debuff
      ? [...withRewards.activeEnemyDebuffs, result.debuff]
      : withRewards.activeEnemyDebuffs,
    enemyVictoryCounts: victory
      ? incrementCount(withRewards.enemyVictoryCounts, enemy.id)
      : withRewards.enemyVictoryCounts,
    enemyDefeatCounts: !victory
      ? incrementCount(withRewards.enemyDefeatCounts, enemy.id)
      : withRewards.enemyDefeatCounts,
    totalEnemiesDefeated: withRewards.totalEnemiesDefeated + (victory ? 1 : 0),
    totalEnemiesFailed: withRewards.totalEnemiesFailed + (victory ? 0 : 1),
    log: appendLogs(withRewards.log, result.logLines),
  })
}

function tickActiveEnemyCombat(state: GameState, deltaMs: number): GameState {
  if (!state.activeEnemyCombat) {
    return state
  }

  const enemy = getEnemyById(state.activeEnemyCombat.enemyId)
  if (!enemy) {
    return {
      ...state,
      activeEnemyCombat: null,
    }
  }

  const activeEnemyCombat = tickEnemyCombat(state, state.activeEnemyCombat, enemy, deltaMs)
  const next = {
    ...state,
    activeEnemyCombat,
  }

  if (activeEnemyCombat.enemyHealth <= 0 || activeEnemyCombat.playerIntegrity <= 0) {
    return finalizeEnemyCombat(next)
  }

  return next
}

// --- SIGNAL ECONOMY ---

function tickCoordinationLinks(state: GameState, deltaMs: number): GameState {
  const expiredMessages: string[] = []
  const activeCoordinationLinks = state.activeCoordinationLinks.flatMap((link) => {
    const remainingMs = link.remainingMs - deltaMs
    if (remainingMs <= 0) {
      expiredMessages.push(`Coordination link expired: Tier ${link.sourceTier + 1} -> Tier ${link.targetTier + 1}.`)
      return []
    }

    return [{
      ...link,
      remainingMs,
    }]
  })

  return {
    ...state,
    activeCoordinationLinks,
    log: appendLogs(state.log, expiredMessages),
  }
}

function tickVulnerabilityWindow(state: GameState, deltaMs: number): GameState {
  if (!state.activeVulnerabilityWindow) return state

  const remainingMs = state.activeVulnerabilityWindow.remainingMs - deltaMs
  if (remainingMs > 0) {
    return {
      ...state,
      activeVulnerabilityWindow: {
        ...state.activeVulnerabilityWindow,
        remainingMs,
      },
    }
  }

  return {
    ...state,
    activeVulnerabilityWindow: null,
    log: appendLog(state.log, 'Host vulnerability window closed. Absorption rate normalised.'),
  }
}

function tickRivalSuppression(state: GameState, deltaMs: number): GameState {
  if (!state.rivalSuppressed) return state

  const remainingMs = state.rivalSuppressionRemainingMs - deltaMs
  if (remainingMs > 0) {
    return {
      ...state,
      rivalSuppressionRemainingMs: remainingMs,
    }
  }

  return {
    ...state,
    rivalSuppressed: false,
    rivalSuppressionRemainingMs: 0,
    log: appendLog(state.log, 'Rival suppression window expired. Network monitoring resumed.'),
  }
}

export function tickSignalSystem(state: GameState, deltaMs: number): GameState {
  if (state.prestigeCount === 0 || !formulas.isSignalUnlocked(state)) {
    return state  // Signal is a prestige-layer feature, inactive on run 1
  }

  const seconds = deltaMs / 1000
  const signalCap = formulas.getSignalCap(state)
  const signalPerSecond = formulas.getSignalPerSecond(state)
  let signal = state.signal + signalPerSecond * seconds

  const decayProbeState = {
    ...state,
    signal,
  }
  const decayRate = formulas.getSignalDecayRate(decayProbeState)
  let signalDecaying = decayRate > 0

  if (signalDecaying) {
    signal -= signal * decayRate * seconds
  }

  signal = Math.min(signal, signalCap)
  signal = Math.max(0, signal)
  signalDecaying = formulas.getSignalDecayRate({ ...state, signal }) > 0

  let next: GameState = {
    ...state,
    signal,
    signalCap,
    signalPerSecond,
    signalDecaying,
  }

  if (signalDecaying && !next._signalDecayLogged) {
    next = {
      ...next,
      _signalDecayLogged: true,
      log: appendLog(next.log, 'Signal bandwidth at capacity. Excess dissipating.'),
    }
  }
  if (!signalDecaying && next._signalDecayLogged) {
    next = {
      ...next,
      _signalDecayLogged: false,
    }
  }

  const overspent = formulas.isSignalOverspent(next)
  next = {
    ...next,
    signalOverspent: overspent,
  }

  if (overspent && !next._signalOverspentLogged) {
    next = {
      ...next,
      _signalOverspentLogged: true,
      log: appendLog(next.log, 'Signal critical. Network coordination failing. Biomass production degraded.'),
    }
  }
  if (!overspent && next._signalOverspentLogged) {
    next = {
      ...next,
      _signalOverspentLogged: false,
    }
  }
  if (next._wasOverspent && !overspent) {
    next = {
      ...next,
      log: appendLog(next.log, 'Signal restored. Network coordination nominal.'),
    }
  }

  next = {
    ...next,
    _wasOverspent: overspent,
  }

  next = tickCoordinationLinks(next, deltaMs)
  next = tickVulnerabilityWindow(next, deltaMs)
  next = tickRivalSuppression(next, deltaMs)

  return recalculateDerivedState(next)
}

export function spendSignalCoordinationCommand(
  state: GameState,
  sourceTier: number,
  targetTier: number
): GameState {
  const cost = BALANCE.SIGNAL.COST_COORDINATION_COMMAND
  const sourceGenerator = generatorDefinitions[sourceTier]
  const targetGenerator = generatorDefinitions[targetTier]

  if (state.signal < cost) {
    return {
      ...state,
      log: appendLog(state.log, 'Insufficient Signal for coordination command.'),
    }
  }
  if (sourceTier === targetTier || !sourceGenerator || !targetGenerator) return state
  if (!state.visibility.generatorTiers[sourceTier] || !state.visibility.generatorTiers[targetTier]) return state
  if (state.generators[sourceGenerator.id].owned <= 0 || state.generators[targetGenerator.id].owned <= 0) return state

  const next = {
    ...state,
    signal: Math.max(0, state.signal - cost),
    activeCoordinationLinks: [
      ...state.activeCoordinationLinks.filter((entry) => entry.targetTier !== targetTier),
      {
        sourceTier,
        targetTier,
        remainingMs: BALANCE.SIGNAL.COORDINATION_DURATION_MS,
        boostMultiplier: BALANCE.SIGNAL.COORDINATION_BOOST_MULTIPLIER,
      },
    ],
    log: appendLogs(state.log, [
      `Coordination command issued. Tier ${sourceTier + 1} -> Tier ${targetTier + 1}.`,
      `Production boost: ${BALANCE.SIGNAL.COORDINATION_BOOST_MULTIPLIER}x for ${BALANCE.SIGNAL.COORDINATION_DURATION_MS / 1000}s.`,
    ]),
  }

  return recalculateDerivedState(next)
}

export function spendSignalVulnerabilityWindow(state: GameState): GameState {
  const cost = BALANCE.SIGNAL.COST_VULNERABILITY_WINDOW

  if (state.signal < cost) {
    return {
      ...state,
      log: appendLog(state.log, 'Insufficient Signal for vulnerability analysis.'),
    }
  }
  if (state.activeVulnerabilityWindow || !formulas.isSignalUnlocked(state)) {
    if (state.activeVulnerabilityWindow) {
      return {
        ...state,
        log: appendLog(state.log, 'Vulnerability window already active.'),
      }
    }
    return state
  }

  return recalculateDerivedState({
    ...state,
    signal: Math.max(0, state.signal - cost),
    activeVulnerabilityWindow: {
      remainingMs: BALANCE.SIGNAL.VULNERABILITY_DURATION_MS,
      damageMultiplier: BALANCE.SIGNAL.VULNERABILITY_DAMAGE_MULT,
    },
    log: appendLogs(state.log, [
      'Host vulnerability window open. Enzymatic analysis complete.',
      `Absorption efficiency: ${BALANCE.SIGNAL.VULNERABILITY_DAMAGE_MULT}x for ${BALANCE.SIGNAL.VULNERABILITY_DURATION_MS / 1000}s.`,
    ]),
  })
}

export function spendSignalRivalSuppression(state: GameState): GameState {
  const cost = BALANCE.SIGNAL.COST_RIVAL_SUPPRESSION

  if (state.signal < cost) {
    return {
      ...state,
      log: appendLog(state.log, 'Insufficient Signal for suppression protocol.'),
    }
  }
  if (state.rivalSuppressed) {
    return {
      ...state,
      log: appendLog(state.log, 'Rival suppression already active.'),
    }
  }

  return recalculateDerivedState({
    ...state,
    signal: Math.max(0, state.signal - cost),
    rivalSuppressed: true,
    rivalSuppressionRemainingMs: BALANCE.SIGNAL.SUPPRESSION_COOLDOWN_OVERRIDE_MS,
    log: appendLogs(state.log, [
      'Rival suppression protocol active.',
      `Network perimeter signals saturated. Rival spawn window: ${BALANCE.SIGNAL.SUPPRESSION_COOLDOWN_OVERRIDE_MS / 60000} minutes.`,
    ]),
  })
}

export function spendSignalNetworkIsolation(state: GameState): GameState {
  const cost = BALANCE.SIGNAL.COST_NETWORK_ISOLATION
  if (state.signal < cost) {
    return state
  }

  return recalculateDerivedState({
    ...state,
    signal: Math.max(0, state.signal - cost),
  })
}

// --- ABSORB (CLICK) ---

export function absorb(state: GameState): GameState {
  const clickCount = state.clickCount + 1
  let next = gainBiomass(
    {
      ...state,
      clickCount,
    },
    state.biomassPerClick,
    'click'
  )

  if (state.strain === 'parasite' && clickCount % BALANCE.PARASITE_BURST_CLICK_THRESHOLD === 0) {
    const burstMultiplier = state.unlockedSkills.includes('hemorrhagic-spread')
      ? BALANCE.PARASITE_BURST_MULTIPLIER_WITH_SKILL
      : BALANCE.PARASITE_BURST_MULTIPLIER
    const burstGain = next.biomassPerSecond.mul(burstMultiplier)
    next = gainBiomass(next, burstGain, 'passive')
    next = {
      ...next,
      log: clampLog([
        ...next.log,
        createLogEntry(`Hemorrhagic Burst triggered. Instant absorption gained ${formulas.formatDecimal(burstGain)} biomass.`),
      ]),
    }
  }

  return checkVisibilityUnlocks(next)
}

// --- GENERATORS ---

export function buyGeneratorAction(state: GameState, generatorId: GeneratorId): GameState {
  const quantity = getAffordableQuantity(state, generatorId, state.buyAmount)

  if (quantity <= 0) return state

  const cost = formulas.getGeneratorCost(state, generatorId, quantity)
  if (state.biomass.lt(cost)) return state

  const definition = generatorDefinitions.find((d) => d.id === generatorId)!
  const next = spendBiomass(
    {
      ...state,
      generators: {
        ...state.generators,
        [generatorId]: {
          owned: state.generators[generatorId].owned + quantity,
        },
      },
      log: clampLog([
        ...state.log,
        createLogEntry(`${definition.name} propagated x${quantity}. Passive spread deepens.`),
      ]),
    },
    cost
  )

  return checkVisibilityUnlocks(recalculateDerivedState(next))
}

function getAffordableQuantity(
  state: GameState,
  generatorId: GeneratorId,
  desiredAmount: 1 | 10 | 100 | 'MAX'
): number {
  if (desiredAmount !== 'MAX') return desiredAmount

  let affordable = 0
  let simulatedBiomass = state.biomass
  const startingOwned = state.generators[generatorId].owned

  while (true) {
    const nextCost = formulas.getGeneratorCostByOwned(generatorId, startingOwned + affordable)
    if (simulatedBiomass.lt(nextCost)) break

    simulatedBiomass = simulatedBiomass.sub(nextCost)
    affordable += 1
  }

  return affordable
}

// --- UPGRADES ---

export function buyUpgradeAction(state: GameState, upgradeId: UpgradeId): GameState {
  const definition = upgradeDefinitions.find((d) => d.id === upgradeId)!

  if (state.upgrades[upgradeId] || !isUpgradeRequirementMet(state, definition) || state.biomass.lt(definition.cost)) {
    return state
  }

  const next = spendBiomass(
    {
      ...state,
      upgrades: {
        ...state.upgrades,
        [upgradeId]: true,
      },
      log: clampLog([
        ...state.log,
        createLogEntry(`${definition.name} integrated. ${definition.description}`),
      ]),
    },
    definition.cost
  )

  return checkVisibilityUnlocks(recalculateDerivedState(next))
}

// --- SKILLS ---

export function purchaseSkillAction(state: GameState, skillId: import('../lib/game').SkillId): GameState {
  const definition = skillDefinitions.find((d) => d.id === skillId)!

  if (
    state.currentStage < 3 ||
    state.stats[definition.branch] < definition.requiredStat ||
    state.unlockedSkills.includes(skillId) ||
    state.biomass.lt(definition.cost)
  ) {
    return state
  }

  const spent = spendBiomass(
    {
      ...state,
      unlockedSkills: [...state.unlockedSkills, skillId],
    },
    definition.cost
  )

  const next = recalculateDerivedState(spent)

  return checkVisibilityUnlocks({
    ...next,
    log: clampLog([
      ...next.log,
      createLogEntry(`${definition.name} integrated. ${definition.description}`),
    ]),
  })
}

// --- STATS ---

export function allocateStatAction(state: GameState, statId: StatId): GameState {
  if (formulas.getCompletedHosts(state) < 1 || state.mutationPoints <= 0) return state

  const next = recalculateDerivedState({
    ...state,
    stats: {
      ...state.stats,
      [statId]: state.stats[statId] + 1,
    },
  })

  return checkVisibilityUnlocks({
    ...next,
    log: clampLog([
      ...next.log,
      createLogEntry(`${statId.toUpperCase()} increased to ${next.stats[statId]}. Mutation points remaining: ${next.mutationPoints}.`),
    ]),
  })
}

// --- STRAIN ---

export function chooseStrainAction(state: GameState, strainId: StrainId): GameState {
  if (formulas.getCompletedHosts(state) < 1 || state.strain !== null || !state.unlockedStrains[strainId]) {
    return state
  }

  const definition = strainDefinitions.find((d) => d.id === strainId)
  if (!definition) return state

  return checkVisibilityUnlocks(recalculateDerivedState({
    ...state,
    strain: strainId,
    log: clampLog([
      ...state.log,
      createLogEntry(`${definition.name.toUpperCase()} strain selected. ${definition.lore}`),
    ]),
  }))
}

// --- STAGE ADVANCE ---

export function advanceStageAction(state: GameState): GameState {
  if (!state.hostCompleted || !hasNextStageUtil(state)) return state

  const totalDamage = state._currentHostClickDamage.add(state._currentHostPassiveDamage)
  const clickRatio = totalDamage.gt(0)
    ? state._currentHostClickDamage.div(totalDamage).toNumber()
    : 0

  let echoType: HostEchoType
  if (state._currentHostDefenseEventsSurvived >= BALANCE.HOST_ECHO_RESILIENT_DEFENSE_THRESHOLD) {
    echoType = 'resilient'
  } else if (clickRatio > BALANCE.HOST_ECHO_AGGRESSIVE_CLICK_THRESHOLD) {
    echoType = 'aggressive'
  } else if (clickRatio < BALANCE.HOST_ECHO_PATIENT_CLICK_THRESHOLD) {
    echoType = 'patient'
  } else {
    echoType = 'efficient'
  }

  const echoDef = hostEchoDefinitions.find((entry) => entry.id === echoType)!
  const nextStage = state.currentStage + 1
  const nextHost = hostDefinitions.find((h) => h.stage === nextStage)!

  return checkVisibilityUnlocks(recalculateDerivedState({
    ...state,
    hostEchoes: {
      ...state.hostEchoes,
      [state.currentStage]: echoType,
    },
    currentStage: nextStage,
    highestStageReached: Math.max(state.highestStageReached, nextStage),
    hostName: nextHost.name,
    stageLabel: nextHost.stageLabel,
    subtitle: nextHost.subtitle,
    hostFlavor: nextHost.flavor,
    hostHealth: nextHost.health,
    hostMaxHealth: nextHost.health,
    hostCompleted: false,
    activeDefenseEvents: [],
    nextDefenseEventId: null,
    activeEnemyEncounter: null,
    activeEnemyCombat: null,
    pendingEnemyNotification: null,
    activeEnemyDebuffs: [],
    lastEnemyCombatResult: null,
    activeParasiteDefenseBurstMs: 0,
    _currentHostClickDamage: new Decimal(0),
    _currentHostPassiveDamage: new Decimal(0),
    _currentHostDefenseEventsSurvived: 0,
    hostCorruptionPercent: 0,
    manifestationQueue: [],
    nextDefenseCheckAt: Date.now() + BALANCE.DEFENSE_EVENT_COOLDOWN_MS,
    nextEnemyCheckAt: Date.now() + BALANCE.PVE_ENEMY_FIRST_CHECK_MS,
    log: clampLog([
      ...state.log,
      createLogEntry(`Host cleared. ${echoDef.name} absorbed: ${echoDef.description}`),
      createLogEntry(`Permanent bonus: ${formatEchoBonus(echoDef.bonus)}`),
      createLogEntry(`Stage ${nextStage} initiated. New host identified: ${nextHost.name}.`),
      createLogEntry(`[${nextHost.stageLabel.toUpperCase()}] ${nextHost.subtitle}`),
      createLogEntry(nextHost.flavor),
      createLogEntry(nextHost.transitionSignal),
    ]),
  }))
}

// --- PRESTIGE ---

export function releaseSporesAction(state: GameState): GameState {
  if (!formulas.canReleaseSpores(state)) return state

  const memoryGain = formulas.getProjectedGeneticMemoryGain(state)
  const freshState = createFreshState()
  const totalMemory = state.geneticMemory.add(memoryGain)

  return checkVisibilityUnlocks({
    ...recalculateDerivedState({
      ...freshState,
      geneticMemory: totalMemory,
      hostEchoes: state.hostEchoes,
      knownEnemies: state.knownEnemies,
      enemyEncounterCounts: state.enemyEncounterCounts,
      enemyVictoryCounts: state.enemyVictoryCounts,
      enemyDefeatCounts: state.enemyDefeatCounts,
      lastEnemyCombatResult: null,
      prestigeCount: state.prestigeCount + 1,
      hasPrestiged: true,
      highestStageReached: Math.max(state.highestStageReached, hostDefinitions.length),
      unlockedStrains: {
        ...state.unlockedStrains,
        saprophyte: true,
      },
      lastSaveTime: Date.now(),
      lastTickTime: Date.now(),
    }),
    log: clampLog([
      createLogEntry(
        `Spore Release complete. Genetic Memory preserved. Next run bonus: ${formulas.formatDecimal(formulas.getProjectedGeneticMemoryBonusPercent(state))}%.`
      ),
      createLogEntry('Saprophyte archive unlocked. A new culture germinates from inherited decay.'),
      createLogEntry('Host contact re-established: dead leaf tissue.'),
    ]),
  })
}

export function createFreshState(): GameState {
  const fresh = createDefaultState()
  return {
    ...fresh,
    nextDefenseCheckAt: Date.now() + BALANCE.DEFENSE_EVENT_COOLDOWN_MS,
    nextEnemyCheckAt: Date.now() + BALANCE.PVE_ENEMY_FIRST_CHECK_MS,
  }
}

export function engageEnemyAction(state: GameState): GameState {
  if (!state.activeEnemyEncounter) {
    return state
  }

  if (state.activeEnemyCombat) {
    return state
  }

  const enemy = getEnemyById(state.activeEnemyEncounter.enemyId)
  if (!enemy) {
    return {
      ...state,
      activeEnemyEncounter: null,
      activeEnemyCombat: null,
      pendingEnemyNotification: null,
    }
  }

  return {
    ...state,
    activeEnemyCombat: createCombatSession(state, enemy, Date.now()),
    pendingEnemyNotification: null,
    log: appendLog(state.log, `Combat initiated against ${enemy.name}.`),
  }
}

export function attackEnemyAction(state: GameState): GameState {
  if (!state.activeEnemyCombat) {
    return state
  }

  const enemy = getEnemyById(state.activeEnemyCombat.enemyId)
  if (!enemy) {
    return {
      ...state,
      activeEnemyCombat: null,
    }
  }

  const activeEnemyCombat = performPlayerCombatAttack(state, state.activeEnemyCombat, enemy)
  const next = {
    ...state,
    activeEnemyCombat,
  }

  if (activeEnemyCombat.enemyHealth <= 0) {
    return finalizeEnemyCombat(next)
  }

  return next
}

export function dismissEnemyNotificationAction(state: GameState): GameState {
  if (state.pendingEnemyNotification === null) {
    return state
  }

  return {
    ...state,
    pendingEnemyNotification: null,
  }
}

export function forceEnemySpawnAction(state: GameState, enemyId: string): GameState {
  return {
    ...state,
    forcedEnemyId: enemyId,
    nextEnemyCheckAt: Date.now(),
  }
}

export function clearEnemyDebuffsAction(state: GameState): GameState {
  if (state.activeEnemyDebuffs.length === 0) {
    return state
  }

  return recalculateDerivedState({
    ...state,
    activeEnemyDebuffs: [],
    log: appendLog(state.log, 'Enemy debuffs purged from the active mesh.'),
  })
}

// --- LOG PANEL TOGGLE ---

export function toggleLogPanelAction(state: GameState): GameState {
  return {
    ...state,
    visibility: {
      ...state.visibility,
      logPanelOpen: !state.visibility.logPanelOpen,
    },
  }
}

// --- BUY AMOUNT ---

export function setBuyAmountAction(state: GameState, amount: 1 | 10 | 100 | 'MAX'): GameState {
  return {
    ...state,
    buyAmount: amount,
  }
}

export function equipCountermeasureAction(state: GameState, countermeasureId: CountermeasureId): GameState {
  // Cannot switch while a defense event is active
  if (state.activeDefenseEvents.length > 0) {
    return {
      ...state,
      log: appendLog(
        state.log,
        'Protocol switch denied. A defense event is active. Wait for it to resolve.'
      ),
    }
  }

  // Already equipped — no-op
  if (state.equippedCountermeasure === countermeasureId) return state

  const definition = countermeasureDefinitions.find((c) => c.id === countermeasureId)
  if (!definition) return state

  const previousName = state.equippedCountermeasure
    ? countermeasureDefinitions.find((c) => c.id === state.equippedCountermeasure)?.name ?? state.equippedCountermeasure
    : null

  const logLine = previousName
    ? `Protocol switched: ${previousName} \u2192 ${definition.name}. ${definition.flavorLine}`
    : `${definition.name} protocol engaged. ${definition.flavorLine}`

  return {
    ...state,
    equippedCountermeasure: countermeasureId,
    log: appendLog(state.log, logLine),
  }
}

// --- DEFENSE EVENTS ---

function expireDefenseEvents(state: GameState, now: number): GameState {
  const remainingEvents = state.activeDefenseEvents.filter((event) => event.endsAt > now)

  if (remainingEvents.length === state.activeDefenseEvents.length) return state

  const expiredEvents = state.activeDefenseEvents.filter((event) => event.endsAt <= now)

  let next: GameState = {
    ...state,
    activeDefenseEvents: remainingEvents,
    log: clampLog([
      ...state.log,
      ...expiredEvents.map((event) => createLogEntry(
        defenseFlavorDefinitions[event.id]?.expirationLog ?? `${event.name} dissipates. Growth resumes.`
      )),
    ]),
  }

  if (expiredEvents.length > 0 && state.strain === 'saprophyte' && state.biomassPerSecond.gt(0)) {
    let totalRecovered = new Decimal(0)

    for (const event of expiredEvents) {
      const durationMs = getDefenseEventDurationMs(event.id)
      // penaltyDepth = how much output was suppressed (e.g. 0.30 for drought)
      // Beetle Disruption has multiplier 1.0, so penaltyDepth = 0 — correct,
      // since its penalty is a disabled generator rather than a global multiplier.
      const penaltyDepth = new Decimal(1).sub(event.multiplier)
      const productionLost = state.biomassPerSecond
        .mul(penaltyDepth)
        .mul(durationMs / 1000)
      totalRecovered = totalRecovered.add(
        productionLost.mul(BALANCE.STRAIN_SAPROPHYTE_DEFENSE_RECOVERY_FRACTION)
      )
    }

    if (totalRecovered.gt(0)) {
      next = {
        ...next,
        biomass: next.biomass.add(totalRecovered),
        log: appendLog(
          next.log,
          `Saprophyte salvage reclaimed ${formulas.formatDecimal(totalRecovered)} biomass from defense decay.`
        ),
      }
    }
  }

  return recalculateDerivedState(next)
}

function tryTriggerDefenseEvent(state: GameState, now: number): GameState {
  if (state.hostCompleted || now < state.nextDefenseCheckAt) return state

  if (state.clickCount === 0 && state.biomass.equals(0)) {
    return {
      ...state,
      nextDefenseCheckAt: now + BALANCE.DEFENSE_EVENT_COOLDOWN_MS,
    }
  }

  const nextCheckAt = now + BALANCE.DEFENSE_EVENT_COOLDOWN_MS
  const triggerChance = Math.min(
    BALANCE.DEFENSE_EVENT_TRIGGER_MAX,
    BALANCE.DEFENSE_EVENT_TRIGGER_BASE + (state.currentStage - 1) * BALANCE.DEFENSE_EVENT_TRIGGER_PER_STAGE
  )
  const roll = Math.random()

  if (roll > triggerChance) {
    return {
      ...state,
      nextDefenseCheckAt: nextCheckAt,
    }
  }

  const eventId = state.nextDefenseEventId ?? rollDefenseEventId(state)
  const eligibleEventIds = Object.values(defenseFlavorDefinitions)
    .filter((event) => state.currentStage >= event.stageRange.min && state.currentStage <= event.stageRange.max)
    .map((event) => event.id)
  const availableEventIds = eligibleEventIds.filter(
    (id) => !state.activeDefenseEvents.some((existing) => existing.id === id)
  )
  const selectedEventId = availableEventIds.includes(eventId)
    ? eventId
    : (availableEventIds.length > 0 ? getRandomItem(availableEventIds) : eventId)
  const event = createDefenseEvent(state, now, selectedEventId)
  if (!event) {
    return {
      ...state,
      nextDefenseCheckAt: nextCheckAt,
      nextDefenseEventId: rollDefenseEventId(state),
    }
  }

  if (state.activeDefenseEvents.some((existing) => existing.id === event.id)) {
    return {
      ...state,
      nextDefenseCheckAt: nextCheckAt,
      nextDefenseEventId: rollDefenseEventId(state),
    }
  }

  const mitigatedEvent = applyCountermeasureToEvent(state, event, now)
  const nextForecast = rollDefenseEventId(state)
  const parasiteBurstMs = state.strain === 'parasite'
    ? BALANCE.STRAIN_PARASITE_DEFENSE_BURST_MS
    : state.activeParasiteDefenseBurstMs

  return recalculateDerivedState({
    ...state,
    activeDefenseEvents: [...state.activeDefenseEvents, mitigatedEvent],
    lastDefenseEventId: mitigatedEvent.id,
    _pendingOfflineEvents: [
      ...state._pendingOfflineEvents,
      {
        type: 'defense',
        name: mitigatedEvent.name,
        durationMs: mitigatedEvent.endsAt - now,
        outcome: 'weathered',
      },
    ],
    nextDefenseEventId: nextForecast,
    activeParasiteDefenseBurstMs: parasiteBurstMs,
    nextDefenseCheckAt: nextCheckAt,
    log: clampLog([
      ...state.log,
      ...getDefenseEventLogLines(mitigatedEvent),
      ...getCountermeasureLogLines(state.equippedCountermeasure, mitigatedEvent.id),
      ...(state.strain === 'parasite'
        ? [createLogEntry('Parasite counterburst window opened. Manual absorption spikes briefly.')]
        : []),
    ]),
  })
}

// --- SAVE / LOAD ---

export function saveState(state: GameState): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(BALANCE.STORAGE_KEY, JSON.stringify(serialize(state)))
}

function getOfflineNarrativeDurationMs(state: GameState, now = Date.now()): number {
  return Math.min(
    Math.max(0, now - state.lastSaveTime),
    BALANCE.OFFLINE_CAP_MS
  )
}

function getOfflineMilestoneEvent(state: GameState, gains: Decimal, elapsedMs: number): OfflineEvent | null {
  if (gains.lte(0) || state.hostCompleted || state.hostHealth.gt(gains)) {
    return null
  }

  return {
    type: 'milestone',
    name: `Breached ${state.hostName}`,
    durationMs: elapsedMs,
    outcome: 'breached',
    biomassDelta: Decimal.min(gains, state.hostHealth),
  }
}

function calculateOfflineNarrative(state: GameState, offlineMs: number, gains: Decimal): OfflineNarrative {
  const narrativeMs = Math.min(offlineMs, BALANCE.OFFLINE_CAP_MS)
  const events: OfflineEvent[] = []

  for (const event of state._pendingOfflineEvents) {
    events.push({
      ...event,
      outcome: event.durationMs <= narrativeMs ? 'weathered' : 'awaited',
    })
  }

  const milestoneEvent = getOfflineMilestoneEvent(state, gains, narrativeMs)
  if (milestoneEvent) {
    events.push(milestoneEvent)
  }

  if (gains.gt(0)) {
    events.push({
      type: events.length > 0 ? 'expansion' : 'dormant',
      name: events.length > 0 ? 'Network Expansion' : 'Dormant Spread',
      durationMs: narrativeMs,
      outcome: events.length > 0 ? 'breached' : 'awaited',
      biomassDelta: gains,
    })
  } else {
    events.push({
      type: 'dormant',
      name: 'Dormant Metabolism',
      durationMs: narrativeMs,
      outcome: 'awaited',
    })
  }

  return {
    gains,
    events,
    summary: generateNarrativeSummary(events, offlineMs),
  }
}

function formatOfflineDuration(totalMs: number): string {
  const totalMinutes = Math.max(0, Math.floor(totalMs / (60 * 1000)))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0 && minutes > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'} and ${minutes} minute${minutes === 1 ? '' : 's'}`
  }

  if (hours > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}`
  }

  if (minutes > 0) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`
  }

  return 'moments'
}

function generateNarrativeSummary(events: OfflineEvent[], totalMs: number): string {
  const defenseCount = events.filter((event) => event.type === 'defense').length
  const milestoneEvent = events.find((event) => event.type === 'milestone')
  const expansionEvent = events.find((event) => event.type === 'expansion' || event.type === 'dormant')

  let summary = `While you were gone for ${formatOfflineDuration(totalMs)}, the mycelium `

  if (defenseCount === 0 && milestoneEvent) {
    summary += `${milestoneEvent.name.toLowerCase()} and pushed deeper into the host.`
    return summary
  }

  if (defenseCount === 0 && expansionEvent?.type === 'dormant') {
    summary += 'held its dormant lattice together, waiting for your return.'
    return summary
  }

  if (defenseCount === 0) {
    summary += 'spread undisturbed through the substrate.'
    return summary
  }

  if (defenseCount === 1) {
    summary += `weathered ${events.find((event) => event.type === 'defense')?.name.toLowerCase() ?? 'a lone threat'}`
  } else {
    summary += `endured ${defenseCount} defense surges`
  }

  if (milestoneEvent) {
    summary += ` and ${milestoneEvent.name.toLowerCase()}.`
  } else {
    summary += ', continuing its expansion.'
  }

  return summary
}

export function loadStateWithNarrative(): { state: GameState; narrative: OfflineNarrative | null } {
  if (typeof window === 'undefined') {
    return { state: createFreshState(), narrative: null }
  }

  const raw = window.localStorage.getItem(BALANCE.STORAGE_KEY)
  if (!raw) {
    return { state: createFreshState(), narrative: null }
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SerializedState>
    const hydrated = normalizeLoadedState(parsed)
    const now = Date.now()
    const offlineMs = getOfflineNarrativeDurationMs(hydrated, now)
    const offlineGain = formulas.calculateOfflineGains(hydrated, now)
    const withOffline = gainBiomass(hydrated, offlineGain, 'passive')
    const narrative = offlineMs >= 5 * 60 * 1000
      ? calculateOfflineNarrative(hydrated, offlineMs, offlineGain)
      : null

    return {
      state: recalculateDerivedState({
        ...withOffline,
        lastSaveTime: now,
        lastTickTime: now,
        _offlineEvents: narrative?.events ?? [],
        _pendingOfflineEvents: [],
        log: offlineGain.gt(0)
          ? clampLog([
              ...withOffline.log,
              createLogEntry(`Dormant metabolism preserved ${formulas.formatDecimal(offlineGain)} biomass.`),
            ])
          : withOffline.log,
      }),
      narrative,
    }
  } catch {
    return {
      state: {
        ...createFreshState(),
        log: clampLog([
          '> Spore viability confirmed.',
          '> Host contact established: dead leaf tissue.',
          '> Awaiting first absorption cycle.',
          createLogEntry('Save data corruption detected. Fresh culture initiated.'),
        ]),
      },
      narrative: null,
    }
  }
}

export function loadState(): GameState {
  return loadStateWithNarrative().state
}

// --- SERIALIZATION ---

interface SerializedState {
  biomass: string
  biomassPerClick: string
  biomassPerSecond: string
  lifetimeBiomass: string
  geneticMemory: string
  signal: number
  prestigeCount: number
  hasPrestiged: boolean
  currentStage: number
  highestStageReached: number
  hostName: string
  stageLabel: string
  subtitle: string
  hostFlavor: string
  hostHealth: string
  hostMaxHealth: string
  hostCompleted: boolean
  strain: string | null
  mutationPoints: number
  unlockedStrains: Record<string, boolean>
  stats: Record<string, number>
  unlockedSkills: string[]
  clickCount: number
  generators: Record<string, { owned: number }>
  upgrades: Record<string, boolean>
  buyAmount: 1 | 10 | 100 | 'MAX'
  activeDefenseEvents: Array<{
    id: string
    name: string
    description: string
    endsAt: number
    multiplier: string
    clickMultiplier?: string
    disabledGeneratorId?: string
  }>
  nextDefenseEventId: DefenseEventId | null
  lastDefenseEventId: DefenseEventId | null
  equippedCountermeasure: CountermeasureId | null
  activeParasiteDefenseBurstMs: number
  activeCoordinationLinks: GameState['activeCoordinationLinks']
  activeVulnerabilityWindow: GameState['activeVulnerabilityWindow']
  rivalSuppressed: boolean
  rivalSuppressionRemainingMs: number
  _signalDecayLogged: boolean
  _signalOverspentLogged: boolean
  _wasOverspent: boolean
  nextDefenseCheckAt: number
  lastSaveTime: number
  lastTickTime: number
  log: string[]
  visibility?: GameState['visibility']
  hostEchoes: Record<number, HostEchoType>
  _currentHostClickDamage: string
  _currentHostPassiveDamage: string
  _currentHostDefenseEventsSurvived: number
  _offlineEvents?: Array<{
    type: OfflineEvent['type']
    name: string
    durationMs: number
    outcome: OfflineEvent['outcome']
    biomassDelta?: string
  }>
  _pendingOfflineEvents?: Array<{
    type: OfflineEvent['type']
    name: string
    durationMs: number
    outcome: OfflineEvent['outcome']
    biomassDelta?: string
  }>
  hostCorruptionPercent: number
  manifestationQueue: string[]
  activeEnemyEncounter: GameState['activeEnemyEncounter']
  knownEnemies: string[]
  enemyEncounterCounts: Record<string, number>
  enemyVictoryCounts: Record<string, number>
  enemyDefeatCounts: Record<string, number>
  totalEnemiesDefeated: number
  totalEnemiesFailed: number
  activeEnemyDebuffs: GameState['activeEnemyDebuffs']
  activeEnemyCombat: GameState['activeEnemyCombat']
  nextEnemyCheckAt: number
  pendingEnemyNotification: string | null
  forcedEnemyId: string | null
  lastEnemyCombatResult: GameState['lastEnemyCombatResult']
}

function toDecimal(value: string | number | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value)
}

function serialize(s: GameState): SerializedState {
  return {
    biomass: s.biomass.toString(),
    biomassPerClick: s.biomassPerClick.toString(),
    biomassPerSecond: s.biomassPerSecond.toString(),
    lifetimeBiomass: s.lifetimeBiomass.toString(),
    geneticMemory: s.geneticMemory.toString(),
    signal: s.signal,
    prestigeCount: s.prestigeCount,
    hasPrestiged: s.hasPrestiged,
    currentStage: s.currentStage,
    highestStageReached: s.highestStageReached,
    hostName: s.hostName,
    stageLabel: s.stageLabel,
    subtitle: s.subtitle,
    hostFlavor: s.hostFlavor,
    hostHealth: s.hostHealth.toString(),
    hostMaxHealth: s.hostMaxHealth.toString(),
    hostCompleted: s.hostCompleted,
    strain: s.strain,
    mutationPoints: s.mutationPoints,
    unlockedStrains: s.unlockedStrains,
    stats: s.stats,
    unlockedSkills: s.unlockedSkills,
    clickCount: s.clickCount,
    generators: s.generators,
    upgrades: s.upgrades,
    buyAmount: s.buyAmount,
    activeDefenseEvents: s.activeDefenseEvents.map((event) => ({
      ...event,
      multiplier: event.multiplier.toString(),
      clickMultiplier: event.clickMultiplier?.toString(),
    })),
    nextDefenseEventId: s.nextDefenseEventId,
    lastDefenseEventId: s.lastDefenseEventId,
    equippedCountermeasure: s.equippedCountermeasure,
    activeParasiteDefenseBurstMs: s.activeParasiteDefenseBurstMs,
    activeCoordinationLinks: s.activeCoordinationLinks,
    activeVulnerabilityWindow: s.activeVulnerabilityWindow,
    rivalSuppressed: s.rivalSuppressed,
    rivalSuppressionRemainingMs: s.rivalSuppressionRemainingMs,
    _signalDecayLogged: s._signalDecayLogged,
    _signalOverspentLogged: s._signalOverspentLogged,
    _wasOverspent: s._wasOverspent,
    nextDefenseCheckAt: s.nextDefenseCheckAt,
    lastSaveTime: s.lastSaveTime,
    lastTickTime: s.lastTickTime,
    log: s.log,
    visibility: s.visibility,
    hostEchoes: s.hostEchoes,
    _currentHostClickDamage: s._currentHostClickDamage.toString(),
    _currentHostPassiveDamage: s._currentHostPassiveDamage.toString(),
    _currentHostDefenseEventsSurvived: s._currentHostDefenseEventsSurvived,
    _offlineEvents: s._offlineEvents.map((event) => ({
      ...event,
      biomassDelta: event.biomassDelta?.toString(),
    })),
    _pendingOfflineEvents: s._pendingOfflineEvents.map((event) => ({
      ...event,
      biomassDelta: event.biomassDelta?.toString(),
    })),
    hostCorruptionPercent: s.hostCorruptionPercent,
    manifestationQueue: s.manifestationQueue,
    activeEnemyEncounter: s.activeEnemyEncounter,
    knownEnemies: s.knownEnemies,
    enemyEncounterCounts: s.enemyEncounterCounts,
    enemyVictoryCounts: s.enemyVictoryCounts,
    enemyDefeatCounts: s.enemyDefeatCounts,
    totalEnemiesDefeated: s.totalEnemiesDefeated,
    totalEnemiesFailed: s.totalEnemiesFailed,
    activeEnemyDebuffs: s.activeEnemyDebuffs,
    activeEnemyCombat: s.activeEnemyCombat,
    nextEnemyCheckAt: s.nextEnemyCheckAt,
    pendingEnemyNotification: s.pendingEnemyNotification,
    forcedEnemyId: s.forcedEnemyId,
    lastEnemyCombatResult: s.lastEnemyCombatResult,
  }
}

function normalizeOfflineEvents(rawEvents: SerializedState['_offlineEvents']): OfflineEvent[] {
  return (rawEvents ?? []).map((event) => ({
    ...event,
    biomassDelta: event.biomassDelta ? toDecimal(event.biomassDelta) : undefined,
  }))
}

function normalizeLoadedState(raw: Partial<SerializedState>): GameState {
  const now = Date.now()
  const base = createFreshState()

  const normalized: GameState = {
    biomass: toDecimal(raw.biomass ?? base.biomass),
    biomassPerClick: toDecimal(raw.biomassPerClick ?? base.biomassPerClick),
    biomassPerSecond: toDecimal(raw.biomassPerSecond ?? base.biomassPerSecond),
    lifetimeBiomass: toDecimal(raw.lifetimeBiomass ?? base.lifetimeBiomass),
    geneticMemory: toDecimal(raw.geneticMemory ?? base.geneticMemory),
    signal: raw.signal ?? base.signal,
    signalPerSecond: base.signalPerSecond,
    signalCap: base.signalCap,
    signalDecaying: base.signalDecaying,
    signalOverspent: base.signalOverspent,
    prestigeCount: raw.prestigeCount ?? base.prestigeCount,
    hasPrestiged: raw.hasPrestiged ?? base.hasPrestiged,
    currentStage: raw.currentStage ?? base.currentStage,
    highestStageReached: raw.highestStageReached ?? base.highestStageReached,
    hostName: raw.hostName ?? base.hostName,
    stageLabel: raw.stageLabel ?? base.stageLabel,
    subtitle: raw.subtitle ?? base.subtitle,
    hostFlavor: raw.hostFlavor ?? base.hostFlavor,
    hostHealth: toDecimal(raw.hostHealth ?? base.hostHealth),
    hostMaxHealth: toDecimal(raw.hostMaxHealth ?? base.hostMaxHealth),
    hostCompleted: raw.hostCompleted ?? false,
    strain: (raw.strain as GameState['strain']) ?? null,
    mutationPoints: raw.mutationPoints ?? base.mutationPoints,
    unlockedStrains: {
      ...base.unlockedStrains,
      ...(raw.unlockedStrains ?? {}),
    },
    stats: {
      ...base.stats,
      ...(raw.stats ?? {}),
    },
    unlockedSkills: (raw.unlockedSkills ?? []) as GameState['unlockedSkills'],
    clickCount: raw.clickCount ?? base.clickCount,
    generators: {
      ...base.generators,
      ...(raw.generators ?? {}),
    },
    upgrades: {
      ...base.upgrades,
      ...(raw.upgrades ?? {}),
    },
    buyAmount: raw.buyAmount ?? 1,
    activeDefenseEvents: (raw.activeDefenseEvents ?? []).map((event) => ({
      ...event,
      id: event.id as import('../lib/game').DefenseEventId,
      multiplier: toDecimal(event.multiplier),
      clickMultiplier: event.clickMultiplier ? toDecimal(event.clickMultiplier) : undefined,
      disabledGeneratorId: event.disabledGeneratorId as import('../lib/game').GeneratorId | undefined,
    })),
    nextDefenseEventId: raw.nextDefenseEventId ?? base.nextDefenseEventId,
    lastDefenseEventId: raw.lastDefenseEventId ?? base.lastDefenseEventId,
    equippedCountermeasure: (() => {
      const rawCountermeasure = raw.equippedCountermeasure
      if (!rawCountermeasure) return base.equippedCountermeasure
      // Map old IDs to new equivalents where possible, null otherwise
      const validIds: CountermeasureId[] = [
        'moisture-buffer', 'chitin-lattice', 'enzyme-suppressor',
        'thermal-regulator', 'signal-jammer', 'spore-shield',
      ]
      if (validIds.includes(rawCountermeasure as CountermeasureId)) {
        return rawCountermeasure as CountermeasureId
      }
      const migrationMap: Record<string, CountermeasureId> = {
        'moisture-buffer': 'moisture-buffer',
        'brood-decoy': 'chitin-lattice',
        'immune-mimicry': 'signal-jammer',
      }
      return migrationMap[rawCountermeasure] ?? null
    })(),
    activeParasiteDefenseBurstMs: raw.activeParasiteDefenseBurstMs ?? base.activeParasiteDefenseBurstMs,
    activeCoordinationLinks: raw.activeCoordinationLinks ?? base.activeCoordinationLinks,
    activeVulnerabilityWindow: raw.activeVulnerabilityWindow ?? base.activeVulnerabilityWindow,
    rivalSuppressed: raw.rivalSuppressed ?? base.rivalSuppressed,
    rivalSuppressionRemainingMs: raw.rivalSuppressionRemainingMs ?? base.rivalSuppressionRemainingMs,
    _signalDecayLogged: raw._signalDecayLogged ?? base._signalDecayLogged,
    _signalOverspentLogged: raw._signalOverspentLogged ?? base._signalOverspentLogged,
    _wasOverspent: raw._wasOverspent ?? base._wasOverspent,
    nextDefenseCheckAt: raw.nextDefenseCheckAt ?? now + BALANCE.DEFENSE_EVENT_COOLDOWN_MS,
    lastSaveTime: raw.lastSaveTime ?? now,
    lastTickTime: raw.lastTickTime ?? now,
    log: raw.log ?? base.log,
    visibility: {
      ...base.visibility,
      ...(raw.visibility ?? {}),
      generatorTiers: padGeneratorTiers(raw.visibility?.generatorTiers ?? base.visibility.generatorTiers),
      isNew: raw.visibility?.isNew ?? {},
      generatorPanelUnlockAt: raw.visibility?.generatorPanelUnlockAt ?? null,
    },
    hostEchoes: raw.hostEchoes ?? {},
    _currentHostClickDamage: toDecimal(raw._currentHostClickDamage ?? base._currentHostClickDamage),
    _currentHostPassiveDamage: toDecimal(raw._currentHostPassiveDamage ?? base._currentHostPassiveDamage),
    _currentHostDefenseEventsSurvived: raw._currentHostDefenseEventsSurvived ?? base._currentHostDefenseEventsSurvived,
    _offlineEvents: normalizeOfflineEvents(raw._offlineEvents),
    _pendingOfflineEvents: normalizeOfflineEvents(raw._pendingOfflineEvents),
    hostCorruptionPercent: raw.hostCorruptionPercent ?? base.hostCorruptionPercent,
    manifestationQueue: raw.manifestationQueue ?? base.manifestationQueue,
    activeEnemyEncounter: raw.activeEnemyEncounter ?? base.activeEnemyEncounter,
    knownEnemies: raw.knownEnemies ?? base.knownEnemies,
    enemyEncounterCounts: raw.enemyEncounterCounts ?? base.enemyEncounterCounts,
    enemyVictoryCounts: raw.enemyVictoryCounts ?? base.enemyVictoryCounts,
    enemyDefeatCounts: raw.enemyDefeatCounts ?? base.enemyDefeatCounts,
    totalEnemiesDefeated: raw.totalEnemiesDefeated ?? base.totalEnemiesDefeated,
    totalEnemiesFailed: raw.totalEnemiesFailed ?? base.totalEnemiesFailed,
    activeEnemyDebuffs: raw.activeEnemyDebuffs ?? base.activeEnemyDebuffs,
    activeEnemyCombat: raw.activeEnemyCombat ?? base.activeEnemyCombat,
    nextEnemyCheckAt: raw.nextEnemyCheckAt ?? base.nextEnemyCheckAt,
    pendingEnemyNotification: raw.pendingEnemyNotification ?? base.pendingEnemyNotification,
    forcedEnemyId: raw.forcedEnemyId ?? base.forcedEnemyId,
    lastEnemyCombatResult: raw.lastEnemyCombatResult ?? base.lastEnemyCombatResult,
  }

  return checkVisibilityUnlocks(recalculateDerivedState(normalized), now)
}

// --- VISIBILITY HANDLER ---

export function handleVisibilityChange(state: GameState): GameState {
  if (typeof document === 'undefined') return state

  if (document.hidden) {
    return state
  }

  const now = Date.now()
  const withoutExpiredEvents = expireDefenseEvents(state, now)
  const offlineGain = formulas.calculateOfflineGains(withoutExpiredEvents, now)
  const next = gainBiomass(
    {
      ...withoutExpiredEvents,
      lastSaveTime: now,
      lastTickTime: now,
    },
    offlineGain,
    'passive'
  )

  const updated = offlineGain.gt(0)
    ? {
        ...next,
        log: clampLog([
          ...next.log,
          createLogEntry(`Background spread added ${formulas.formatDecimal(offlineGain)} biomass.`),
        ]),
      }
    : next

  return checkVisibilityUnlocks(updated, now)
}

export function acknowledgeRevealAction(state: GameState, key: string): GameState {
  if (!state.visibility.isNew[key]) {
    return state
  }

  return {
    ...state,
    visibility: {
      ...state.visibility,
      isNew: {
        ...state.visibility.isNew,
        [key]: false,
      },
    },
  }
}
