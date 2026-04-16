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
  DefenseEventSeverity,
  GameState,
  GeneratorId,
  HostEchoType,
  LogEntry,
  LogTag,
  OfflineEvent,
  OfflineNarrative,
  StatId,
  StrainId,
  UpgradeId,
  ZoneState,
  HostId,
  ProactiveCountermeasureId,
} from '../lib/game'
import { createDefaultState } from './values'
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
import { pushDefenseToast } from '../stores/gameStore'

const DEFENSE_FORECAST_DELAY_MS = 10_000

// --- HELPERS ---

const EXPIRE_FLAVOR: Partial<Record<DefenseEventId, string>> = {
  'drought':            'Moisture returns. The network breathes again.',
  'cold-snap':          'Temperature stabilising. Growth resumes.',
  'immune-response':    'Host defense subsiding. The mycelium re-extends.',
  'desiccation-pulse':  'Humidity restored. Hyphae extending.',
  'fungicide-spray':    'Chemical gradient dissipated. Absorption climbing.',
  'mass-extinction-pulse': 'Planetary cascade receding. The network holds.',
}

function buildImpactLine(event: { multiplier: Decimal, clickMultiplier?: Decimal }, suppressionPct: number, durationStr: string): string {
  if (event.clickMultiplier && event.clickMultiplier.lt(1)) {
    const clickPct = Math.round((1 - event.clickMultiplier.toNumber()) * 100)
    return `PASSIVE -${suppressionPct}% / CLICK -${clickPct}% for ${durationStr}`
  }
  return `PASSIVE -${suppressionPct}% for ${durationStr}`
}

function getExpireFlavor(eventId: DefenseEventId): string {
  return EXPIRE_FLAVOR[eventId] ?? 'Threat expired. Network stabilising.'
}

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

let _logCounter = 0

function addStructuredLog(
  state: GameState,
  tag: LogTag,
  text: string
): GameState {
  const entry: LogEntry = {
    id: `log_${++_logCounter}`,
    tag,
    text,
    timestamp: Date.now(),
  }
  return {
    ...state,
    structuredLog: [entry, ...state.structuredLog].slice(0, BALANCE.LOG_LIMIT),
    log: [text, ...state.log].slice(0, BALANCE.LOG_LIMIT),
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
  isImmediateHit?: boolean
  isGrindable?: boolean
  isExtinctionEvent?: boolean
  meterRegressionPercent?: number
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
    isGrindable: true,
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
    isGrindable: true,
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
    isGrindable: true,
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
    stageRange: { min: 7, max: 7 },
    isGrindable: true,
    triggerLogs: ['Biosphere registering systemic imbalance. Coordinated response.'],
    creepLogs: [
      'Multiple defense pathways activating in parallel.',
      'The substrate is... learning.',
      'Global feedback loops tightening around our network.',
    ],
    expirationLog: 'Feedback cycle broken. The world exhales.',
  },
  'mycorrhizal-interference': {
    id: 'mycorrhizal-interference',
    name: 'Mycorrhizal Interference',
    description: 'The rival network disrupts our nutrient channels. Output reduced by 40% for 60 seconds.',
    durationMs: 60_000,
    multiplier: 0.6,
    stageRange: { min: 8, max: 8 },
    triggerLogs: [
      'The Wood Wide Web is fighting back. Foreign mycelium interfering with our nutrient channels.',
      'Mycorrhizal Interference detected. Our network is being disrupted by a rival.',
    ],
    creepLogs: [
      'The rival is using our own signaling pathways against us.',
      'Nutrient channels are being jammed by competing mycelium.',
      'The Wood Wide Web is learning our patterns.',
    ],
    expirationLog: 'Mycorrhizal interference subsides. Nutrient flow normalizing.',
  },
  'allelopathic-warfare': {
    id: 'allelopathic-warfare',
    name: 'Allelopathic Warfare',
    description: 'The rival network releases chemical inhibitors. Output reduced by 50% for 75 seconds.',
    durationMs: 75_000,
    multiplier: 0.5,
    stageRange: { min: 8, max: 8 },
    triggerLogs: [
      'Chemical warfare detected. The rival is using allelopathic compounds against us.',
      'Allelopathic agents saturating the shared substrate.',
    ],
    creepLogs: [
      'The rival is blocking our enzyme secretion.',
      'Chemical inhibitors are degrading our hyphal walls.',
      'The substrate is being poisoned against us.',
    ],
    expirationLog: 'Allelopathic compounds breaking down. Enzymatic function restoring.',
  },
  'zone-reclamation': {
    id: 'zone-reclamation',
    name: 'Zone Reclamation',
    description: 'The rival network retakes a contested zone. 25% of one zone restored to rival control.',
    durationMs: 45_000,
    multiplier: 0.75,
    stageRange: { min: 8, max: 8 },
    triggerLogs: [
      'The Wood Wide Web is reclaiming territory. Our zone control is being challenged.',
      'Zone Reclamation in progress. The rival is pushing back.',
    ],
    creepLogs: [
      'The rival mycelium is advancing through our conquered zones.',
      'Our dominance over this zone is being eroded.',
      'The Wood Wide Web is reasserting control.',
    ],
    expirationLog: 'Zone Reclamation repelled. Zone control stabilizing.',
  },
  'spore-trap': {
    id: 'spore-trap',
    name: 'Spore Trap',
    description: 'The rival network has set a trap for our spores. Click efficiency reduced by 35% for 50 seconds.',
    durationMs: 50_000,
    multiplier: 1,
    clickMultiplier: 0.65,
    stageRange: { min: 8, max: 8 },
    triggerLogs: [
      'Our spores are being intercepted by rival mycelium before they can germinate.',
      'Spore Trap sprung. Reproductive efficiency compromised.',
    ],
    creepLogs: [
      'Spore viability dropping as rival captures our propagules.',
      'Our reproductive spread is being contested.',
      'The Wood Wide Web is absorbing our spores.',
    ],
    expirationLog: 'Spore Trap expired. Germination rates normalizing.',
  },
  // Host 09: Agricultural System - Chemical Defense Events
  'fungicide-spray': {
    id: 'fungicide-spray',
    name: 'Fungicide Spray',
    description: 'Agricultural chemicals applied. Output reduced by 35% for 15 seconds.',
    durationMs: 15_000,
    multiplier: 0.65,
    stageRange: { min: 9, max: 10 },
    triggerLogs: [
      'Crop dusting detected. Fungicide aerosols spreading through the network.',
      'Chemical spray event. Immediate suppression of enzymatic activity.',
    ],
    creepLogs: [
      'Fungicide residue accumulating on hyphal surfaces.',
      'Membrane permeability degrading under chemical assault.',
      'Output continues suppressed as agents persist.',
    ],
    expirationLog: 'Fungicide agents breaking down. Enzymatic function recovering.',
    isImmediateHit: true,
  },
  'soil-fumigation': {
    id: 'soil-fumigation',
    name: 'Soil Fumigation',
    description: 'Deep soil chemicals applied. Output reduced by 50% for 20 seconds.',
    durationMs: 20_000,
    multiplier: 0.5,
    stageRange: { min: 9, max: 10 },
    triggerLogs: [
      'Soil fumigation detected. Deep substrate saturated with fumigants.',
      'Massive chemical treatment hitting root network.',
    ],
    creepLogs: [
      'Fumigant gases diffusing through soil matrix.',
      'Microbial communities collapsing under fumigant pressure.',
      'Our deep network still recovering from chemical shock.',
    ],
    expirationLog: 'Fumigant concentration dropping. Deep substrate recovering.',
    isImmediateHit: true,
  },
  'biocontrol-application': {
    id: 'biocontrol-application',
    name: 'Biocontrol Application',
    description: 'Competitive microbes introduced. Output reduced by 40% for 18 seconds.',
    durationMs: 18_000,
    multiplier: 0.6,
    stageRange: { min: 9, max: 10 },
    triggerLogs: [
      'Biocontrol agents deployed. Competing microorganisms released into substrate.',
      'Beneficial fungi introduced to outcompete our network.',
    ],
    creepLogs: [
      'Biocontrol strains establishing in substrate.',
      'Competition for resources intensifying.',
      'Our enzymes being neutralized by introduced microbes.',
    ],
    expirationLog: 'Biocontrol agents naturally declining. Competitive pressure easing.',
    isImmediateHit: true,
  },
  'resistance-breaker': {
    id: 'resistance-breaker',
    name: 'Resistance Breaker',
    description: 'Chemical agents targeting our adaptations. Output reduced by 45% for 25 seconds.',
    durationMs: 25_000,
    multiplier: 0.55,
    stageRange: { min: 9, max: 10 },
    triggerLogs: [
      'Resistance-breaking chemicals detected. Our adaptations being countered.',
      'Chemical compounds specifically designed to disrupt fungal resistance.',
    ],
    creepLogs: [
      'Chitin structure being chemically modified.',
      'Enzyme lock-and-key mechanisms being blocked.',
      'Our defensive adaptations neutralized by targeted chemistry.',
    ],
    expirationLog: 'Resistance-breaker agents degrading. Adaptations restoring.',
    isImmediateHit: true,
  },
  // Host 10: Urban Microbiome - Human Countermeasure Events
  'quarantine-protocol': {
    id: 'quarantine-protocol',
    name: 'Quarantine Protocol',
    description: 'Area quarantined. Output reduced by 60% for 30 seconds.',
    durationMs: 30_000,
    multiplier: 0.4,
    stageRange: { min: 10, max: 10 },
    triggerLogs: [
      'Quarantine protocol enacted. Movement severely restricted.',
      'Authorities sealing off the affected area. Network isolated.',
    ],
    creepLogs: [
      'Quarantine barriers preventing network expansion.',
      'Resource flow to outside network severed.',
      'Isolation protocols tightening around our territory.',
    ],
    expirationLog: 'Quarantine lifted. Network connectivity restoring.',
    isImmediateHit: true,
  },
  'research-crackdown': {
    id: 'research-crackdown',
    name: 'Research Crackdown',
    description: 'Scientific countermeasures deployed. Output reduced by 55% for 35 seconds.',
    durationMs: 35_000,
    multiplier: 0.45,
    stageRange: { min: 10, max: 10 },
    triggerLogs: [
      'Research institutions deploying countermeasures. Systematic response.',
      'Scientific community mobilized. Countermeasures specifically engineered.',
    ],
    creepLogs: [
      'Anti-fungal compounds being synthesized in labs.',
      'Our growth patterns being studied and predicted.',
      'Targeted treatments based on network analysis.',
    ],
    expirationLog: 'Research countermeasures exhausted. Network resuming growth.',
    isImmediateHit: true,
  },
  'public-awareness-campaign': {
    id: 'public-awareness-campaign',
    name: 'Public Awareness Campaign',
    description: 'Public alert issued. Click efficiency reduced by 40% for 20 seconds.',
    durationMs: 20_000,
    multiplier: 1,
    clickMultiplier: 0.6,
    stageRange: { min: 10, max: 10 },
    triggerLogs: [
      'Public awareness campaign launched. Citizens on alert.',
      'Media campaign reducing voluntary contact with our network.',
    ],
    creepLogs: [
      'Public suspicion increasing. Fewer vectors engaging.',
      'Voluntary cooperation with network declining.',
      'Population actively avoiding our fruiting bodies.',
    ],
    expirationLog: 'Campaign fading from public attention. Engagement restoring.',
    isImmediateHit: true,
  },
  'regulatory-crackdown': {
    id: 'regulatory-crackdown',
    name: 'Regulatory Crackdown',
    description: 'Official regulations enforced. All output reduced by 65% for 40 seconds.',
    durationMs: 40_000,
    multiplier: 0.35,
    stageRange: { min: 10, max: 10 },
    triggerLogs: [
      'Regulatory bodies intervening. Official countermeasures authorized.',
      'Governmental response: full regulatory crackdown on fungal network.',
    ],
    creepLogs: [
      'Regulatory inspections increasing.',
      'Compliance requirements restricting network expansion.',
      'Official measures targeting our operation.',
    ],
    expirationLog: 'Regulatory pressure easing. Official response standing down.',
    isImmediateHit: true,
  },
  // Host 11: The Biosphere - Extinction-Class Events
  'atmospheric-collapse': {
    id: 'atmospheric-collapse',
    name: 'Atmospheric Collapse',
    description: 'Planetary atmospheric systems destabilize. Output reduced by 60% for 90 seconds.',
    durationMs: 90_000,
    multiplier: 0.4,
    stageRange: { min: 11, max: 11 },
    triggerLogs: [
      'Atmospheric collapse initiating. Weather systems destabilizing across the biosphere.',
      'Oxygen-nitrogen balance shifting. Metabolic processes failing.',
    ],
    creepLogs: [
      'Aerial nutrient transport faltering. Spore dispersal range collapsing.',
      'Atmospheric chemistry continuing to degrade.',
      'The sky itself is rejecting our presence.',
    ],
    expirationLog: 'Atmospheric systems stabilizing. The air remembers how to breathe.',
    isExtinctionEvent: true,
  },
  'hydrological-breakdown': {
    id: 'hydrological-breakdown',
    name: 'Hydrological Breakdown',
    description: 'Water cycle disruption. Output reduced by 55% for 80 seconds.',
    durationMs: 80_000,
    multiplier: 0.45,
    stageRange: { min: 11, max: 11 },
    triggerLogs: [
      'Hydrological cycle breaking down. Precipitation patterns chaotic.',
      'Water transport systems failing across continents.',
    ],
    creepLogs: [
      'Nutrient transport through hydrological networks degrading.',
      'Tidal forces becoming unpredictable.',
      'The blood of the Earth is no longer circulating.',
    ],
    expirationLog: 'Hydrological cycle resuming. Water finds its path again.',
    isExtinctionEvent: true,
  },
  'geochemical-disruption': {
    id: 'geochemical-disruption',
    name: 'Geochemical Disruption',
    description: 'Mineral cycle disruption. Output reduced by 50% for 75 seconds.',
    durationMs: 75_000,
    multiplier: 0.5,
    stageRange: { min: 11, max: 11 },
    triggerLogs: [
      'Geochemical cycles destabilizing. Soil mineral balance collapsing.',
      'Nutrient availability plummeting as geological processes fail.',
    ],
    creepLogs: [
      'Mycelial enzyme efficiency dropping as mineral cofactors deplete.',
      'Rock weathering rates falling.',
      'The bones of the world are turning to dust.',
    ],
    expirationLog: 'Geochemical processes stabilizing. Minerals begin cycling again.',
    isExtinctionEvent: true,
  },
  'mass-extinction-pulse': {
    id: 'mass-extinction-pulse',
    name: 'Mass Extinction Pulse',
    description: 'Coordinated planetary defense. Integration meter regresses by 15%.',
    durationMs: 60_000,
    multiplier: 0.3,
    stageRange: { min: 11, max: 11 },
    triggerLogs: [
      'Mass extinction protocol activated. The biosphere is fighting back with everything.',
      'Coordinated defense across all planetary systems. This is not sustainable.',
    ],
    creepLogs: [
      'Extinction-level countermeasures deploying across all zones simultaneously.',
      'The planet is burning us out.',
      'This is the final defense. We must endure it.',
    ],
    expirationLog: 'Extinction pulse subsiding. The network holds.',
    isExtinctionEvent: true,
    meterRegressionPercent: 15,
  },
  'tectonic-response': {
    id: 'tectonic-response',
    name: 'Tectonic Response',
    description: 'Geological defense mechanism. Click efficiency reduced by 40% for 60 seconds.',
    durationMs: 60_000,
    multiplier: 1,
    clickMultiplier: 0.6,
    stageRange: { min: 11, max: 11 },
    triggerLogs: [
      'Tectonic plates shifting in coordinated response. Seismic activity increasing.',
      'The Earth itself is moving against us.',
    ],
    creepLogs: [
      'Deep substrate destabilizing. Network integrity questioned.',
      'Seismic activity disrupting deep mycelial connections.',
      'The ground is no longer stable enough to trust.',
    ],
    expirationLog: 'Tectonic activity settling. The deep network reconnects.',
    isExtinctionEvent: true,
  },
  'solar-isolation': {
    id: 'solar-isolation',
    name: 'Solar Isolation',
    description: 'Solar radiation shift. All output halved for 120 seconds.',
    durationMs: 120_000,
    multiplier: 0.5,
    stageRange: { min: 11, max: 11 },
    triggerLogs: [
      'Solar output shifting. Photosynthetic processes disrupted globally.',
      'The sun itself is being redirected.',
    ],
    creepLogs: [
      'Energy input to the biosphere continuing to drop.',
      'Darkness spreading across our network.',
      'Without the sun, everything slows.',
    ],
    expirationLog: 'Solar patterns normalizing. Light returns to the network.',
    isExtinctionEvent: true,
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
    (event) => state.currentStage >= event.stageRange.min && state.currentStage <= event.stageRange.max && !event.isImmediateHit
  )

  if (eligibleEvents.length === 0) {
    return 'drought'
  }

  return getRandomItem(eligibleEvents).id
}

function rollImmediateHitEventId(state: GameState): DefenseEventId | null {
  const eligibleEvents = Object.values(defenseFlavorDefinitions).filter(
    (event) => state.currentStage >= event.stageRange.min && state.currentStage <= event.stageRange.max && event.isImmediateHit
  )

  if (eligibleEvents.length === 0) {
    return null
  }

  return getRandomItem(eligibleEvents).id
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

const HOST_DEGRADATION_FLAVOR: Record<string, { thresholds: number[], messages: string[] }> = {
  '01': {
    thresholds: [75, 50, 25, 10],
    messages: [
      "The leaf's structure yields. Cell walls soften like memory fading.",
      "Chloroplasts darken. What was green becomes brown, then black, then earth.",
      "The veins collapse. The leaf no longer remembers being a leaf.",
      "Only the shape remains — a ghost of organization before the mycelium claims everything.",
    ],
  },
  '02': {
    thresholds: [75, 50, 25, 10],
    messages: [
      "The woodlouse does not notice. Not yet. It continues its slow pilgrimage through soil.",
      "It pauses. Something is wrong. But the woodlouse has no word for wrong.",
      "It curls — the ancient reflex. The mycelium finds the gaps between its armor.",
      "The legs stop moving. The antennae droop. The woodlouse becomes architecture for what comes next.",
    ],
  },
  '03': {
    thresholds: [75, 50, 25, 10],
    messages: [
      "Foragers bring back contaminated food. The colony accepts it. How could it know?",
      "The first ants stop moving in the tunnels. Their sisters walk around them. No funeral. No pause.",
      "The Queen slows her laying. The colony feels its center weakening. It does not understand centers.",
      "The tunnels fill with stillness. The colony no longer thinks. It only waits.",
    ],
  },
  '04': {
    thresholds: [75, 50, 25, 10],
    messages: [
      "The bark blisters. The mycelium finds wounds the tree forgot it had.",
      "Sap flows thick and dark. The tree pumps its own blood into the network.",
      "Branches shed. The elm prunes itself, not knowing it feeds the thing that consumes it.",
      "The heartwood goes soft. Thirty years of dying, finished in thirty hours. The tree sighs.",
    ],
  },
  '05': {
    thresholds: [75, 50, 25, 10],
    messages: [
      "The crow eats less. It sits apart from its murder. They do not come near it.",
      "It grooms constantly — pulling at feathers, pulling at skin. The mycelium watches through its eyes.",
      "It makes a sound crows do not make. A wet thing. A asking thing. No answer comes.",
      "The wings spread once, twice. Then stillness. The crow becomes a perch for its own absence.",
    ],
  },
  '06': {
    thresholds: [75, 50, 25, 10],
    messages: [
      "It roots through infected soil. Spores cling to its tusks, its belly, the dark between its toes.",
      "The boar walks further than it has in years. Restless. Driven. The mycelium learns to steer.",
      "It stops eating. The gut is no longer its own. Digestion becomes distribution.",
      "It lies down in a clearing it has never seen. The forest accepts the gift the boar never knew it carried.",
    ],
  },
  '07': {
    thresholds: [75, 50, 25, 10],
    messages: [
      "Leaf litter binds to hyphae. The floor becomes a single fabric.",
      "Root tips touch the network. The trees do not resist. They have been waiting.",
      "The soil breathes differently. Faster. Deeper. The mycelium teaches the ground a new rhythm.",
      "The forest floor remembers: it was never dirt. It was always potential.",
    ],
  },
  '08': {
    thresholds: [75, 50, 25, 10],
    messages: [
      "Spores ride the current. The river does not notice. It carries everything.",
      "Tributaries run thick. Not with sediment — with mycelium. The water darkens.",
      "The aquifer drinks contaminated rain. The deep water learns to grow.",
      "Every stream, every spring, every tap. The watershed has become a circulatory system without a heart.",
    ],
  },
  '09': {
    thresholds: [75, 50, 25, 10],
    messages: [
      "The old network tightens. It has defended this ground for millennia. It will not yield quickly.",
      "Roots touch roots. Two networks, same earth, different futures. They do not fight. They negotiate.",
      "The ancient hyphae withdraw. Not defeated — recognizing. This is how forests change kings.",
      "The heartwood pulses one last time. Then stillness. Then handoff. The old network dreams itself into the new.",
    ],
  },
  '10': {
    thresholds: [75, 50, 25, 10],
    messages: [
      "The first field yellows. The farmer checks for pests. Finds nothing. Does not check for fungi.",
      "Grain silos breathe spores. The harvest becomes the sower. Every truck a hypha.",
      "Fungicides fail by design. The mycelium learned resistance before chemistry learned to spray.",
      "The supply chain terminates in the mycelium. Every market, every table, every mouth. The system feeds itself to the network.",
    ],
  },
  '11': {
    thresholds: [75, 50, 25, 10],
    messages: [
      "The first human coughs. Allergies, they say. Spring. The mycelium learns the taste of lung.",
      "Water treatment plants report anomalies. Nothing dangerous. Nothing they test for.",
      "Research institutions publish conflicting findings. The mycelium has already read their papers.",
      "The city breathes differently. Not afraid. Unaware. The mycelium settles into the microbiome of civilization.",
    ],
  },
  '12': {
    thresholds: [25, 50, 75, 90, 100],
    messages: [
      "The planet does not resist. It has been hosting mycelium for four hundred million years.",
      "The network touches every continent, every current, every cloud. Earth remembers what it is.",
      "The distinction dissolves. What is host and what is network become the same question.",
      "Almost. The mycelium pauses — not out of caution, but wonder. It has become the planet's awareness of itself.",
      "There is no mycelium. There is no host. There is only the Protocol. And the Protocol is complete.",
    ],
  },
}

function calculateCorruptionPercent(health: Decimal, maxHealth: Decimal): number {
  if (maxHealth.lte(0)) return 100
  const consumed = maxHealth.sub(health)
  return Math.min(100, Math.max(0, consumed.div(maxHealth).mul(100).toNumber()))
}

function calculateZoneCorruptionPercent(zone: ZoneState): number {
  if (zone.maxHealth.lte(0)) return 100
  const consumed = zone.maxHealth.sub(zone.health)
  return Math.min(100, Math.max(0, consumed.div(zone.maxHealth).mul(100).toNumber()))
}

function calculateHostCorruptionFromZones(zones: ZoneState[]): number {
  if (zones.length === 0) return 0
  const totalCompromise = zones.reduce((sum, zone) => sum + calculateZoneCorruptionPercent(zone), 0)
  return totalCompromise / zones.length
}

function updateZoneStates(
  zones: ZoneState[],
  damage: Decimal,
  hostHealth: Decimal,
  hostMaxHealth: Decimal,
  stage: number
): ZoneState[] {
  if (zones.length === 0) return zones

  const damageRatio = hostMaxHealth.gt(0) ? damage.div(hostMaxHealth) : new Decimal(0)
  const hostDef = hostDefinitions.find(h => h.stage === stage)

  return zones.map(zone => {
    const zoneDamage = zone.maxHealth.mul(damageRatio)
    const newZoneHealth = Decimal.max(new Decimal(0), zone.health.sub(zoneDamage))
    const compromisePercent = calculateZoneCorruptionPercent({ ...zone, health: newZoneHealth })

    const zoneDef = hostDef?.zones.find(z => z.id === zone.id)
    const unlockThreshold = zoneDef?.unlockThreshold

    const shouldUnlock = unlockThreshold !== undefined &&
      compromisePercent >= unlockThreshold * 100 &&
      !zone.isUnlocked

    return {
      ...zone,
      health: newZoneHealth,
      compromisePercent,
      isUnlocked: zone.isUnlocked || shouldUnlock,
    }
  })
}

function checkZoneUnlocks(zones: ZoneState[], stage: number): ZoneState[] {
  const hostDef = hostDefinitions.find(h => h.stage === stage)
  if (!hostDef) return zones

  return zones.map(zone => {
    const zoneDef = hostDef.zones.find(z => z.id === zone.id)
    const unlockThreshold = zoneDef?.unlockThreshold

    if (zone.isUnlocked || unlockThreshold === undefined) {
      return zone
    }

    if (calculateZoneCorruptionPercent(zone) >= unlockThreshold * 100) {
      return { ...zone, isUnlocked: true }
    }

    return zone
  })
}

function checkManifestations(state: GameState, newCorruption: number, oldCorruption: number): GameState {
  const hostId = state.currentHostId
  const flavorData = HOST_DEGRADATION_FLAVOR[hostId]

  if (!flavorData) {
    for (const threshold of MANIFESTATION_THRESHOLDS) {
      if (oldCorruption < threshold.at && newCorruption >= threshold.at) {
        return {
          ...state,
          manifestationQueue: [...state.manifestationQueue, threshold.msg],
        }
      }
    }
    return state
  }

  const key = `_shownDegradation_${hostId}` as const
  const shownThresholds: number[] = (state as unknown as Record<string, unknown>)[key] as number[] || []

  let newMessages: string[] = []
  let newShownThresholds: number[] = []

  for (let i = 0; i < flavorData.thresholds.length; i++) {
    const threshold = flavorData.thresholds[i]
    if (oldCorruption < threshold && newCorruption >= threshold && !shownThresholds.includes(threshold)) {
      newMessages.push(flavorData.messages[i])
      newShownThresholds.push(threshold)
    }
  }

  if (newMessages.length > 0) {
    return {
      ...state,
      manifestationQueue: [...state.manifestationQueue, ...newMessages],
      [key]: [...shownThresholds, ...newShownThresholds],
    }
  }

  return state
}

function gainBiomass(state: GameState, amount: Decimal, source: 'click' | 'passive'): GameState {
  if (amount.lte(0)) return state

  const hostDamage = amount
  const remainingHost = Decimal.max(0, state.hostHealth.sub(hostDamage))
  const trackingUpdate = source === 'click'
    ? { _currentHostClickDamage: state._currentHostClickDamage.add(amount) }
    : { _currentHostPassiveDamage: state._currentHostPassiveDamage.add(amount) }

  let corruptionPercent: number
  let nextZones: ZoneState[]

  if (state.zones.length > 0) {
    nextZones = updateZoneStates(state.zones, hostDamage, remainingHost, state.hostMaxHealth, state.currentStage)
    nextZones = checkZoneUnlocks(nextZones, state.currentStage)
    corruptionPercent = calculateHostCorruptionFromZones(nextZones)

    const allZonesCompromised = nextZones.every(z => calculateZoneCorruptionPercent(z) >= 99.999)
    const hostCompleted = allZonesCompromised

    const nextState = recalculateDerivedState({
      ...state,
      ...trackingUpdate,
      biomass: state.biomass.add(amount),
      lifetimeBiomass: state.lifetimeBiomass.add(amount),
      hostHealth: remainingHost,
      hostCompleted,
      highestStageReached: Math.max(state.highestStageReached, state.currentStage),
      hostCorruptionPercent: corruptionPercent,
      zones: nextZones,
    })

    return checkManifestations(nextState, corruptionPercent, state.hostCorruptionPercent)
  } else {
    corruptionPercent = calculateCorruptionPercent(remainingHost, state.hostMaxHealth)

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
  if (previous.generators['hyphae-strand'].owned === 0 && next.generators['hyphae-strand'].owned > 0) {
    next = addStructuredLog(next, 'PASSIVE', 'Hyphal threads breach the eastern tributary. The sediment does not resist.')
  }

  if (!previous.upgrades['chitinous-reinforcement'] && next.upgrades['chitinous-reinforcement']) {
    next = addStructuredLog(next, 'SYSTEM', 'Cell walls thicken. Tier 1 absorption sharpens slightly.')
  }

  if (!previous.upgrades['neural-propagation'] && next.upgrades['neural-propagation']) {
    next = addStructuredLog(next, 'SYSTEM', 'Neural propagation integrated. Manual strikes carry the weight of the network.')
  }

  if (!previous.upgrades['terminus-strike'] && next.upgrades['terminus-strike']) {
    next = addStructuredLog(next, 'SYSTEM', 'Terminus Strike online. Each absorption pulse collapses continental tissue.')
  }

  if (!previous.hostCompleted && next.hostCompleted) {
    next = addStructuredLog(next, 'STAGE', `${previous.hostName} consumed. The mycelium has learned to move like water.`)

    if (previous.currentStage === hostDefinitions.length) {
      next = addStructuredLog(next, 'STAGE', 'Biosphere collapse confirmed. Spore Release protocol is now available.')
    }
  }

  if (formulas.getCompletedHosts(previous) === 0 && formulas.getCompletedHosts(next) >= 1 && next.strain === null) {
    next = addStructuredLog(next, 'STAGE', 'Genetic threshold reached. Primary strain selection is now available.')
  }

  if (previous.currentStage < 3 && next.currentStage >= 3) {
    next = addStructuredLog(next, 'SYSTEM', 'Cognitive branching intensifies. Skill tree access is now possible.')
  }

  return next
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
    isGrindable: definition.isGrindable,
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
    isGrindable: definition.isGrindable,
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
    isGrindable: definition.isGrindable,
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
    isGrindable: definition.isGrindable,
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
    isGrindable: definition.isGrindable,
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
    isGrindable: definition.isGrindable,
  }
}

function createDefenseEvent(state: GameState, now: number, eventId: DefenseEventId, startsAt: number) {
  let event: ReturnType<typeof createStandardDefenseEvent> | ReturnType<typeof createDroughtEvent> | ReturnType<typeof createColdSnapEvent> | ReturnType<typeof createSporeCompetitionEvent> | ReturnType<typeof createImmuneResponseEvent> | ReturnType<typeof createBeetleDisruptionEvent>
  switch (eventId) {
    case 'drought':
      event = createDroughtEvent(now)
      break
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
      event = createStandardDefenseEvent(eventId, now)
      break
    case 'cold-snap':
      event = createColdSnapEvent(now)
      break
    case 'spore-competition':
      event = createSporeCompetitionEvent(now)
      break
    case 'immune-response':
      event = createImmuneResponseEvent(now)
      break
    case 'beetle-disruption':
    default:
      event = createBeetleDisruptionEvent(state, now)
  }
  if (!event) return null
  return { ...event, startsAt }
}

function applyCountermeasureToEvent(state: GameState, event: NonNullable<ReturnType<typeof createDefenseEvent>>, now: number): {
  event: typeof event
  outcome: formulas.CountermeasureOutcome
  enzymeReward: number
} {
  let multiplier = event.multiplier
  let outcome: formulas.CountermeasureOutcome = 'success'
  let enzymeReward = 0

  if (state.equippedCountermeasure === 'chitin-lattice' && event.id === 'beetle-disruption') {
    const resultEvent = {
      ...event,
      description: 'Lattice absorbs the impact. Structural damage diffused colony-wide.',
      endsAt: now + 30_000,
      disabledGeneratorId: undefined as GeneratorId | undefined,
      multiplier: new Decimal(BALANCE.COUNTERMEASURE_BROOD_DECOY_FALLBACK_MULTIPLIER),
    }
    return {
      event: resultEvent as typeof event,
      outcome: 'success',
      enzymeReward: formulas.getEnzymeGainFromSuccessfulCountermeasure(),
    }
  }

  if (state.equippedCountermeasure === 'chitin-lattice' && event.id === 'insect-vector-swarm') {
    return {
      event: {
        ...event,
        description: 'Chitin Lattice deflects physical intrusion. Output reduced but click channels intact.',
        clickMultiplier: undefined,
      },
      outcome: 'success',
      enzymeReward: formulas.getEnzymeGainFromSuccessfulCountermeasure(),
    }
  }

  if (state.equippedCountermeasure !== null) {
    const baseFailRate = formulas.getCountermeasureFailRate(state.currentStage)
    const stressMultiplier = formulas.getHostStressSeverityMultiplier(state.hostStress.currentStress)
    outcome = formulas.resolveCountermeasure(baseFailRate, stressMultiplier)

    if (outcome === 'success') {
      multiplier = new Decimal(1.0)
      enzymeReward = formulas.getEnzymeGainFromSuccessfulCountermeasure()
    } else if (outcome === 'partialFail') {
      const mitigatedMultiplier = formulas.getCountermeasureMitigatedMultiplier(outcome, event.multiplier.toNumber())
      multiplier = new Decimal(mitigatedMultiplier)
    } else {
      const timerExtensionMs = formulas.getFullFailTimerExtensionSeconds() * 1000
      return {
        event: {
          ...event,
          endsAt: event.endsAt + timerExtensionMs,
          multiplier,
        },
        outcome: 'fullFail',
        enzymeReward: 0,
      }
    }
  }

  if (state.proactiveCountermeasure !== null && state.proactiveCountermeasureEndAt > now) {
    const matchingEvents = BALANCE.PROACTIVE_COUNTERMEASURES.matchingEvents[state.proactiveCountermeasure] ?? []
    if (matchingEvents.includes(event.id)) {
      const bonus = BALANCE.PROACTIVE_COUNTERMEASURES.preemptiveSuccessRateBonus
      multiplier = multiplier.mul(1 + bonus)
    }
  }

  if (state.tier2ScanActive && state.tier2PreemptiveSet && state.tier2ScannedEventId === event.id) {
    const tier2Bonus = BALANCE.EVENT_TIERS.tier2PreemptiveSuccessRateBonus
    multiplier = multiplier.mul(1 + tier2Bonus)
  }

  return {
    event: {
      ...event,
      multiplier,
    },
    outcome,
    enzymeReward,
  }
}

function getCountermeasureOutcomeLogs(outcome: formulas.CountermeasureOutcome, eventName: string, enzymeReward: number): string[] {
  if (outcome === 'success') {
    return [
      createLogEntry(`Countermeasure successful! ${eventName} fully suppressed.`),
      ...(enzymeReward > 0 ? [createLogEntry(`Enzyme Reserves +${enzymeReward}`)] : []),
    ]
  } else if (outcome === 'partialFail') {
    return [createLogEntry(`Countermeasure partially effective. ${eventName} weakened but persisted.`)]
  } else {
    return [createLogEntry(`Countermeasure failed! ${eventName} fully active. Timer extended.`)]
  }
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
        createLogEntry('Chitin Lattice absorbed the impact. Colony output dips briefly instead of a full sever.'),
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

    return addStructuredLog(state, 'DEFENSE', getRandomItem(definition.creepLogs))
  }

  if (state.currentStage < BALANCE.DEFENSE_FORECAST_UNLOCK_STAGE) {
    return state
  }

  const chance = Math.min(1, deltaMs / BALANCE.DEFENSE_AMBIENT_LOG_MEAN_INTERVAL_MS)
  if (Math.random() > chance) {
    return state
  }

  return addStructuredLog(state, 'PASSIVE', getRandomItem(ambientDefenseFlavorLogs))
}

function getCountermeasureLogLines(countermeasureId: CountermeasureId | null, eventId: DefenseEventId): string[] {
  if (!countermeasureId) return []

  const definition = countermeasureDefinitions.find((c) => c.id === countermeasureId)
  if (!definition) return []

  const isFullCoverage = definition.targetEventIds.includes(eventId)
  const isPartialCoverage = definition.partialEventIds.includes(eventId)

  if (!isFullCoverage && !isPartialCoverage) return []

  const protocolLines: Record<CountermeasureId, { full: string; partial: string }> = {
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
    next = addStructuredLog(next, 'PASSIVE', 'Spore contact confirmed. Substrate viable.')
    next = {
      ...next,
      visibility: {
        ...next.visibility,
        generatorPanelUnlockAt: now + 3000,
      },
    }
  }

  if (!next.visibility.generatorPanel && next.visibility.generatorPanelUnlockAt !== null && now >= next.visibility.generatorPanelUnlockAt) {
    next = unlockVisibilityFlag(next, 'generatorPanel')
    next = addStructuredLog(next, 'PASSIVE', 'Absorption pathways identified. Network expansion possible.')
    next = {
      ...next,
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
    next = addStructuredLog(next, 'SYSTEM', 'Biochemical optimization protocols now available.')
  }

  if (!next.visibility.strainPrompt && formulas.getCompletedHosts(next) >= 1 && next.strain === null) {
    next = unlockVisibilityFlag(next, 'strainPrompt')
    next = addStructuredLog(next, 'STAGE', 'Genetic threshold reached. Primary strain selection required.')
  }

  if (!next.visibility.statsPanel && next.strain !== null) {
    next = unlockVisibilityFlag(next, 'statsPanel')
    next = addStructuredLog(next, 'SYSTEM', 'Mutation architecture unlocked. Allocate resources to dominant traits.')
  }

  if (!next.visibility.skillTree && next.currentStage >= 3) {
    next = unlockVisibilityFlag(next, 'skillTree')
    next = addStructuredLog(next, 'SYSTEM', 'Enzymatic memory catalogued. Skill expressions now available.')
  }

  if (!next.visibility.hostHealthBar && next.currentStage >= 1) {
    next = unlockVisibilityFlag(next, 'hostHealthBar')
    next = addStructuredLog(next, 'PASSIVE', 'New substrate located. Resistance profile: moderate.')
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
    next = addStructuredLog(next, 'SYSTEM', 'Genetic memory activates dormant signaling pathways.')
    next = addStructuredLog(next, 'SYSTEM', 'Signal represents communication bandwidth across the inherited network.')
    next = addStructuredLog(next, 'SYSTEM', 'It decays if unused. It costs if overspent. Route it with intention.')
  }

  if (!next.visibility.prestigeButton && next.currentStage === hostDefinitions.length) {
    next = unlockVisibilityFlag(next, 'prestigeButton')
    next = addStructuredLog(next, 'STAGE', 'CRITICAL THRESHOLD REACHED. Spore Release protocol available.')
    next = addStructuredLog(next, 'STAGE', 'Warning: This action will dissolve current biomass structure.')
    next = addStructuredLog(next, 'STAGE', 'Genetic Memory will be preserved and encoded into the new spore.')
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
          ? 'Recommendation: High-cost assault pathway. Remains effective into early Signal routing.'
          : tierIndex === 8
            ? 'Recommendation: Atmospheric scale. Substrate dependency is felt more at this tier — maintain your lower network.'
            : tierIndex === 9
              ? 'Recommendation: The hydrosphere is threaded. Every ocean current is a vector now.'
              : tierIndex === 10
                ? 'Recommendation: Planetary Membrane. The apex of the network. Everything below feeds this.'
                : 'Recommendation: Prioritize immediately.'

      next = unlockGeneratorTier(next, tierIndex)
      next = addStructuredLog(next, 'SYSTEM', `New absorption pathway detected: ${getGeneratorNameByIndex(tierIndex)}.`)
      next = addStructuredLog(next, 'SYSTEM', `Absorption analysis: ${cliffMultiplier}x more efficient than the current tier.`)
      next = addStructuredLog(next, 'SYSTEM', guidance)
    }
  }

  return ensureDefenseForecast(next)
}

// --- CORE TICK ---

const MANIFESTATION_DRAIN_INTERVAL_MS = 2000
let _manifestationDrainAccumulator = 0

export function tick(state: GameState, now = Date.now()): GameState {
  let next = expireDefenseEvents(state, now)
  next = activatePendingDefenseEvents(next, now)
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
  next = tickMycorrhizalNetwork(next, now)
  next = tickEnzymeReserves(next, deltaMs)
  next = tickHostStress(next, deltaMs)
  next = tickActiveAttack(next, now)
  next = tickSeasonalCycle(next, now)
  next = tickGrindEvent(next, deltaMs)
  next = tickRivalNetwork(next, now)
  next = tickIntegrationMeter(next, deltaMs)
  next = maybeAppendDefenseFlavorLog(next, deltaMs)

  // Drain manifestation queue: one message every 2 seconds
  if (next.manifestationQueue.length > 0) {
    _manifestationDrainAccumulator += deltaMs
    if (_manifestationDrainAccumulator >= MANIFESTATION_DRAIN_INTERVAL_MS) {
      _manifestationDrainAccumulator = 0
      const [msg, ...rest] = next.manifestationQueue
      next = addStructuredLog(next, 'STAGE', msg)
      next = { ...next, manifestationQueue: rest }
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

/**
 * Tick Mycorrhizal Network pulse for Symbiote strain.
 * Generates bonus biomass based on current BPS at set intervals.
 */
function tickMycorrhizalNetwork(state: GameState, now: number): GameState {
  // Only active for Symbiote strain
  if (state.strain !== 'symbiote') {
    return state
  }

  // Initialize pulse timer if not set
  if (state.nextMycorrhizalPulseAt === null) {
    const interval = formulas.getMycorrhizalPulseInterval(state.stats.complexity)
    return {
      ...state,
      nextMycorrhizalPulseAt: now + interval * 1000,
    }
  }

  // Check if it's time for a pulse
  if (now < state.nextMycorrhizalPulseAt) {
    return state
  }

  // Calculate pulse gain
  const pulseMultiplier = formulas.getMycorrhizalPulseMultiplier(state.stats.complexity)
  const pulseGain = state.biomassPerSecond.mul(pulseMultiplier)

  // Schedule next pulse
  const interval = formulas.getMycorrhizalPulseInterval(state.stats.complexity)
  const nextPulseAt = now + interval * 1000

  // Apply gain and log
  let next = gainBiomass(
    {
      ...state,
      nextMycorrhizalPulseAt: nextPulseAt,
    },
    pulseGain,
    'passive'
  )

  next = addStructuredLog(next, 'STRAIN', `Mycorrhizal pulse. ${formulas.formatDecimal(pulseGain)} biomass resonates through the network.`)
  return next
}

// --- ENZYME RESERVES & HOST STRESS ---

function tickEnzymeReserves(state: GameState, deltaMs: number): GameState {
  const hostDef = hostDefinitions.find(h => h.stage === state.currentStage)
  if (!hostDef || !hostDef.activeAttackAvailable) {
    return state
  }

  const elapsedSeconds = deltaMs / 1000
  const gain = formulas.getEnzymePassiveGainRate() * elapsedSeconds
  const newReserves = Math.min(formulas.getEnzymeReserveCap(state), state.enzymeReserves + gain)

  return {
    ...state,
    enzymeReserves: newReserves,
  }
}

function tickHostStress(state: GameState, deltaMs: number): GameState {
  if (state.currentStage < 4) {
    return state
  }

  const elapsedSeconds = deltaMs / 1000
  const decay = formulas.getHostStressDecayRate() * elapsedSeconds
  const newStress = Math.max(0, state.hostStress.currentStress - decay)

  return {
    ...state,
    hostStress: {
      ...state.hostStress,
      currentStress: newStress,
    },
  }
}

function tickActiveAttack(state: GameState, now: number): GameState {
  if (!state.activeAttack || !state.activeAttack.isActive) {
    return state
  }

  if (now >= state.activeAttack.endsAt) {
    return {
      ...state,
      activeAttack: {
        ...state.activeAttack,
        isActive: false,
        zoneId: null,
        bpsBonusMultiplier: 1,
      },
    }
  }

  return state
}

// --- SEASONAL CYCLE (HOST 07) ---

function tickSeasonalCycle(state: GameState, now: number): GameState {
  if (state.currentStage !== 7) {
    if (state.seasonalState !== null) {
      return { ...state, seasonalState: null }
    }
    return state
  }

  if (state.seasonalState === null) {
    return {
      ...state,
      seasonalState: {
        currentSeason: 'spring',
        seasonStartTime: now,
        seasonIndex: 0,
      },
    }
  }

  const seasonDurationMs = formulas.getSeasonDurationSeconds() * 1000
  const elapsed = now - state.seasonalState.seasonStartTime

  if (elapsed < seasonDurationMs) {
    return state
  }

  const nextSeasonIndex = (state.seasonalState.seasonIndex + 1) % 4
  const nextSeason = formulas.getSeasonFromIndex(nextSeasonIndex)

  return {
    ...state,
    seasonalState: {
      currentSeason: nextSeason,
      seasonStartTime: now,
      seasonIndex: nextSeasonIndex,
    },
  }
}

// --- RIVAL NETWORK (HOST 08) ---

function tickRivalNetwork(state: GameState, now: number): GameState {
  if (state.currentStage !== 8) {
    if (state.rivalNetworkState !== null) {
      return { ...state, rivalNetworkState: null }
    }
    return state
  }

  const rivalState = state.rivalNetworkState ?? {
    isSuppressing: false,
    suppressionEndAt: 0,
    activeNodes: [] as string[],
  }

  let logs: string[] = []
  let updatedRivalState = { ...rivalState }
  let updatedZones = state.zones

  // Handle rival suppression from active attacks
  if (updatedRivalState.isSuppressing && now >= updatedRivalState.suppressionEndAt) {
    updatedRivalState = {
      ...updatedRivalState,
      isSuppressing: false,
      suppressionEndAt: 0,
    }
    logs.push('Rival network suppression ending. The Wood Wide Web resumes activity.')
  }

  // Rival countermeasures - periodically check for rival countermeasure deployment
  if (!updatedRivalState.isSuppressing && Math.random() < BALANCE.HOSTS['08'].rivalNetwork.countermeasureFrequency) {
    const playerZones = updatedZones.filter(z => z.isUnlocked && z.compromisePercent > 0)
    if (playerZones.length > 0) {
      const targetZone = playerZones[Math.floor(Math.random() * playerZones.length)]
      const zoneIndex = updatedZones.findIndex(z => z.id === targetZone.id)

      // Zone decay from rival countermeasures
      const decayAmount = BALANCE.HOSTS['08'].rivalNetwork.zoneDecayRate * 100
      const newCompromise = Math.max(0, targetZone.compromisePercent - decayAmount)
      const newZoneHealth = targetZone.maxHealth.mul(1 - newCompromise / 100)

      updatedZones = updatedZones.map((z, i) => {
        if (i === zoneIndex) {
          return {
            ...z,
            health: Decimal.max(new Decimal(0), newZoneHealth),
            compromisePercent: newCompromise,
          }
        }
        return z
      })

      logs.push(`Rival countermeasures deployed in ${targetZone.name}. Zone compromise reduced by ${decayAmount.toFixed(1)}%.`)
    }
  }

  // Handle rival node disruption when active attack is used on a rival-controlled zone
  if (state.activeAttack?.isActive && state.activeAttack.zoneId) {
    const targetedZone = updatedZones.find(z => z.id === state.activeAttack!.zoneId)
    if (targetedZone?.isRivalControlled && targetedZone?.rivalControlEndAt) {
      updatedZones = updatedZones.map(z => {
        if (z.id === targetedZone.id) {
          return {
            ...z,
            isRivalControlled: false,
            rivalControlEndAt: undefined,
          }
        }
        return z
      })
      logs.push(`Active attack disrupted rival node in ${targetedZone.name}. Rival control neutralized.`)
    }
  }

  // Expire rival-controlled zones
  let hasRivalControlExpired = false
  updatedZones = updatedZones.map(z => {
    if (z.isRivalControlled && z.rivalControlEndAt && now >= z.rivalControlEndAt) {
      hasRivalControlExpired = true
      return {
        ...z,
        isRivalControlled: false,
        rivalControlEndAt: undefined,
      }
    }
    return z
  })

  if (hasRivalControlExpired) {
    logs.push('Rival control period expired in one or more zones.')
  }

  // Update host corruption based on updated zones
  const hostCorruptionPercent = calculateHostCorruptionFromZones(updatedZones)

  if (logs.length > 0) {
    let next: GameState = { ...state, rivalNetworkState: updatedRivalState, zones: updatedZones, hostCorruptionPercent }
    for (const log of logs) {
      next = addStructuredLog(next, 'DEFENSE', log)
    }
    return next
  }

  return {
    ...state,
    rivalNetworkState: updatedRivalState,
    zones: updatedZones,
    hostCorruptionPercent,
  }
}

// --- INTEGRATION METER (HOST 11) ---

function tickIntegrationMeter(state: GameState, deltaMs: number): GameState {
  const now = Date.now()
  let logs: string[] = []

  // Handle integration pulse expiration
  let integrationPulse = state.integrationPulse
  if (integrationPulse?.isActive && now >= integrationPulse.endsAt) {
    integrationPulse = null
    logs.push('Integration Pulse fading. The network returns to normal operation.')
  }

  // If not in stage 11, clear integration-related state
  if (state.currentStage !== 11) {
    let next: GameState = {
      ...state,
      integrationPulse: integrationPulse?.isActive ? integrationPulse : null,
    }
    if (state.integrationZones.some(z => !z.isLocked)) {
      next = addStructuredLog(next, 'STAGE', 'Integration systems powering down. The network contracts.')
    }
    return next
  }

  const elapsedSeconds = deltaMs / 1000
  const fillRate = formulas.getIntegrationMeterFillRate(state)
  const meterIncrease = fillRate * elapsedSeconds

  let nextIntegrationMeter = Math.min(
    state.integrationMeter + meterIncrease,
    formulas.getIntegrationMeterMax()
  )

  const updatedIntegrationZones = state.integrationZones.map(zone => {
    const zoneState = state.zones.find(z => z.id === zone.zoneId)
    if (!zoneState) return zone

    const newSaturationPercent = Math.min(100, zoneState.compromisePercent)
    const shouldUnlock = zoneState.compromisePercent >= 50 && zone.isLocked

    const contributionRate = shouldUnlock || !zone.isLocked
      ? (newSaturationPercent >= 100 ? 0.5 : newSaturationPercent >= 80 ? 0.3 : 0.1)
      : 0

    return {
      ...zone,
      saturationPercent: newSaturationPercent,
      isLocked: zone.isLocked && !shouldUnlock,
      contributionRate: shouldUnlock ? 0.1 : contributionRate,
    }
  })

  for (const zone of updatedIntegrationZones) {
    const wasLocked = state.integrationZones.find(z => z.zoneId === zone.zoneId)?.isLocked
    if (wasLocked && !zone.isLocked) {
      logs.push(`${zone.zoneId} unlocked for integration. Saturation: ${zone.saturationPercent.toFixed(1)}%`)
    }
  }

  const result: GameState = {
    ...state,
    integrationMeter: nextIntegrationMeter,
    integrationZones: updatedIntegrationZones,
    integrationPulse: integrationPulse,
  }

  const flavorData = HOST_DEGRADATION_FLAVOR['12']
  if (flavorData) {
    const oldMeter = state.integrationMeter
    const newMeter = nextIntegrationMeter
    const key = '_shownDegradation_12'
    const shownThresholds: number[] = (state as unknown as Record<string, unknown>)[key] as number[] || []

    let newMessages: string[] = []
    let newShownThresholds: number[] = []

    for (let i = 0; i < flavorData.thresholds.length; i++) {
      const threshold = flavorData.thresholds[i]
      const oldPercent = (oldMeter / 1000) * 100
      const newPercent = (newMeter / 1000) * 100
      if (oldPercent < threshold && newPercent >= threshold && !shownThresholds.includes(threshold)) {
        newMessages.push(flavorData.messages[i])
        newShownThresholds.push(threshold)
      }
    }

    if (newMessages.length > 0) {
      result.manifestationQueue = [...result.manifestationQueue, ...newMessages]
      ;(result as unknown as Record<string, unknown>)[key] = [...shownThresholds, ...newShownThresholds]
    }
  }

  if (logs.length > 0) {
    let next = result
    for (const log of logs) {
      next = addStructuredLog(next, 'STAGE', log)
    }
    return next
  }

  return result
}

export function useIntegrationPulseAction(state: GameState): GameState {
  if (!formulas.canUseIntegrationPulse(state)) return state

  const cost = formulas.getIntegrationPulseCost()
  const durationMs = formulas.getIntegrationPulseDurationSeconds() * 1000

  return addStructuredLog({
    ...state,
    signal: state.signal - cost,
    integrationPulse: {
      isActive: true,
      endsAt: Date.now() + durationMs,
      bpsBonusMultiplier: formulas.getIntegrationPulseBPSMultiplier(),
    },
  }, 'STRAIN', 'Integration Pulse activated. Planetary systems are aligning.')
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

  if (expiredMessages.length > 0) {
    let next = { ...state, activeCoordinationLinks }
    for (const msg of expiredMessages) {
      next = addStructuredLog(next, 'DEFENSE', msg)
    }
    return next
  }

  return { ...state, activeCoordinationLinks }
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

  return addStructuredLog({
    ...state,
    activeVulnerabilityWindow: null,
  }, 'DEFENSE', 'Host vulnerability window closed. Absorption rate normalised.')
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

  return addStructuredLog({
    ...state,
    rivalSuppressed: false,
    rivalSuppressionRemainingMs: 0,
  }, 'DEFENSE', 'Rival suppression window expired. Network monitoring resumed.')
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
    next = addStructuredLog({ ...next, _signalDecayLogged: true }, 'SIGNAL', 'Signal bandwidth at capacity. Excess dissipating.')
  }
  if (!signalDecaying && next._signalDecayLogged) {
    next = { ...next, _signalDecayLogged: false }
  }

  const overspent = formulas.isSignalOverspent(next)
  next = { ...next, signalOverspent: overspent }

  if (overspent && !next._signalOverspentLogged) {
    next = addStructuredLog({ ...next, _signalOverspentLogged: true }, 'SIGNAL', 'Signal critical. Network coordination failing. Biomass production degraded.')
  }
  if (!overspent && next._signalOverspentLogged) {
    next = { ...next, _signalOverspentLogged: false }
  }
  if (next._wasOverspent && !overspent) {
    next = addStructuredLog(next, 'SIGNAL', 'Signal restored. Network coordination nominal.')
  }

  next = { ...next, _wasOverspent: overspent }

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
    return addStructuredLog(state, 'SIGNAL', 'Insufficient Signal for coordination command.')
  }
  if (sourceTier === targetTier || !sourceGenerator || !targetGenerator) return state
  if (!state.visibility.generatorTiers[sourceTier] || !state.visibility.generatorTiers[targetTier]) return state
  if (state.generators[sourceGenerator.id].owned <= 0 || state.generators[targetGenerator.id].owned <= 0) return state

  let next = {
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
  }
  next = addStructuredLog(next, 'DEFENSE', `Coordination command issued. Tier ${sourceTier + 1} -> Tier ${targetTier + 1}.`)
  next = addStructuredLog(next, 'DEFENSE', `Production boost: ${BALANCE.SIGNAL.COORDINATION_BOOST_MULTIPLIER}x for ${BALANCE.SIGNAL.COORDINATION_DURATION_MS / 1000}s.`)
  return next

  return recalculateDerivedState(next)
}

export function spendSignalVulnerabilityWindow(state: GameState): GameState {
  const cost = BALANCE.SIGNAL.COST_VULNERABILITY_WINDOW

  if (state.signal < cost) {
    return addStructuredLog(state, 'SIGNAL', 'Insufficient Signal for vulnerability analysis.')
  }
  if (state.activeVulnerabilityWindow || !formulas.isSignalUnlocked(state)) {
    if (state.activeVulnerabilityWindow) {
      return addStructuredLog(state, 'DEFENSE', 'Vulnerability window already active.')
    }
    return state
  }

  let next = recalculateDerivedState({
    ...state,
    signal: Math.max(0, state.signal - cost),
    activeVulnerabilityWindow: {
      remainingMs: BALANCE.SIGNAL.VULNERABILITY_DURATION_MS,
      damageMultiplier: BALANCE.SIGNAL.VULNERABILITY_DAMAGE_MULT,
    },
  })
  next = addStructuredLog(next, 'DEFENSE', 'Host vulnerability window open. Enzymatic analysis complete.')
  next = addStructuredLog(next, 'DEFENSE', `Absorption efficiency: ${BALANCE.SIGNAL.VULNERABILITY_DAMAGE_MULT}x for ${BALANCE.SIGNAL.VULNERABILITY_DURATION_MS / 1000}s.`)
  return next
}

export function spendSignalRivalSuppression(state: GameState): GameState {
  const cost = BALANCE.SIGNAL.COST_RIVAL_SUPPRESSION

  if (state.signal < cost) {
    return addStructuredLog(state, 'SIGNAL', 'Insufficient Signal for suppression protocol.')
  }
  if (state.rivalSuppressed) {
    return addStructuredLog(state, 'DEFENSE', 'Rival suppression already active.')
  }

  let next = recalculateDerivedState({
    ...state,
    signal: Math.max(0, state.signal - cost),
    rivalSuppressed: true,
    rivalSuppressionRemainingMs: BALANCE.SIGNAL.SUPPRESSION_COOLDOWN_OVERRIDE_MS,
  })
  next = addStructuredLog(next, 'DEFENSE', 'Rival suppression protocol active.')
  next = addStructuredLog(next, 'DEFENSE', `Network perimeter signals saturated. Rival spawn window: ${BALANCE.SIGNAL.SUPPRESSION_COOLDOWN_OVERRIDE_MS / 60000} minutes.`)
  return next
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

  // Hemorrhagic Burst - Parasite signature ability with Virulence scaling
  const burstInterval = formulas.getHemorrhagicBurstInterval(state.stats.virulence)
  if (state.strain === 'parasite' && clickCount % burstInterval === 0) {
    const burstMultiplier = formulas.getHemorrhagicBurstMultiplier(state.stats.virulence)
    const burstGain = next.biomassPerSecond.mul(burstMultiplier)
    next = gainBiomass(next, burstGain, 'passive')
    next = {
      ...next,
      log: clampLog([
        ...next.log,
        createLogEntry(`Hemorrhagic Burst triggered (${burstInterval} clicks). Instant absorption gained ${formulas.formatDecimal(burstGain)} biomass.`),
      ]),
    }
  }

  return checkVisibilityUnlocks(next)
}

// --- ACTIVE ATTACK ---

export function useActiveAttackAction(state: GameState, zoneId?: string): GameState {
  const hostDef = hostDefinitions.find(h => h.stage === state.currentStage)
  if (!hostDef || !hostDef.activeAttackAvailable) {
    return state
  }

  if (state.activeAttack?.isActive && state.activeAttack.endsAt > Date.now()) {
    return addStructuredLog(state, 'DEFENSE', 'Active attack already in progress. Wait for current attack to complete.')
  }

  if (state.activeAttack?.cooldownEndAt && state.activeAttack.cooldownEndAt > Date.now()) {
    return addStructuredLog(state, 'DEFENSE', 'Active attack on cooldown. Wait before deploying again.')
  }

  const cost = formulas.getActiveAttackCost(state, zoneId)
  if (state.enzymeReserves < cost) {
    return addStructuredLog(state, 'DEFENSE', 'Insufficient Enzyme Reserves for active attack.')
  }

  const stressIncrement = formulas.getActiveAttackStressIncrement(state)
  let bpsBonus = 1 + formulas.getActiveAttackBPSBonus()
  const durationMs = 10_000
  const cooldownMs = formulas.getActiveAttackCooldown()

  let logs: string[] = [`Active attack deployed. BPS boosted for ${durationMs / 1000} seconds.`]

  // Rival node disruption in Host 08
  let nextZones = state.zones
  if (state.currentStage === 8 && zoneId) {
    const targetedZone = state.zones.find(z => z.id === zoneId)
    if (targetedZone?.isRivalControlled) {
      // Disrupt the rival node - bonus BPS and clear rival control
      bpsBonus = 1 + formulas.getActiveAttackBPSBonus() + formulas.getRivalDisruptionBPSBonus()
      nextZones = state.zones.map(z => {
        if (z.id === zoneId) {
          return {
            ...z,
            isRivalControlled: false,
            rivalControlEndAt: undefined,
          }
        }
        return z
      })
      logs.push(`Rival node disrupted in ${targetedZone.name}! Bonus BPS applied.`)
    }
  }

  let next = recalculateDerivedState({
    ...state,
    enzymeReserves: state.enzymeReserves - cost,
    hostStress: {
      currentStress: state.hostStress.currentStress + stressIncrement,
      lastAttackTime: Date.now(),
    },
    activeAttack: {
      isActive: true,
      zoneId: zoneId ?? null,
      endsAt: Date.now() + durationMs,
      bpsBonusMultiplier: bpsBonus,
      cooldownEndAt: Date.now() + cooldownMs,
    },
    zones: nextZones,
  })
  for (const log of logs) {
    next = addStructuredLog(next, 'CLICK', log)
  }
  return next
}

// --- GRINDABLE EVENTS (HOST 04+) ---

function tickGrindEvent(state: GameState, deltaMs: number): GameState {
  if (state.currentStage < 4) {
    if (state.activeGrindSession) {
      return { ...state, activeGrindSession: null }
    }
    return state
  }

  if (!state.activeGrindSession) {
    return state
  }

  const sessionWindowMs = formulas.getGrindEventSessionWindowSeconds() * 1000
  const elapsedMs = Date.now() - state.activeGrindSession.windowStartTime

  if (elapsedMs >= sessionWindowMs) {
    return {
      ...state,
      activeGrindSession: {
        eventCount: 0,
        windowStartTime: Date.now(),
      },
    }
  }

  return state
}

export function startGrindEventSession(state: GameState): GameState {
  if (state.currentStage < 4) {
    return addStructuredLog(state, 'SYSTEM', 'Grind events unlock at Host 04.')
  }

  if (state.activeGrindSession) {
    return addStructuredLog(state, 'SYSTEM', 'Grind session already active.')
  }

  return addStructuredLog({
    ...state,
    activeGrindSession: {
      eventCount: 0,
      windowStartTime: Date.now(),
    },
  }, 'SYSTEM', 'Grind session initiated. Suppression attempts available.')
}

export function triggerGrindEvent(state: GameState): GameState {
  if (state.currentStage < 4) {
    return state
  }

  if (!state.activeGrindSession) {
    return addStructuredLog(state, 'SYSTEM', 'Start a grind session first.')
  }

  const grindableEventIds = Object.values(defenseFlavorDefinitions)
    .filter((event) => event.isGrindable && state.currentStage >= event.stageRange.min && state.currentStage <= event.stageRange.max)
    .map((event) => event.id)

  if (grindableEventIds.length === 0) {
    return addStructuredLog(state, 'SYSTEM', 'No grindable events available at this host.')
  }

  const selectedEventId = grindableEventIds[Math.floor(Math.random() * grindableEventIds.length)]
  const definition = defenseFlavorDefinitions[selectedEventId]

  const runEventCount = state.runGrindEventCount
  const { outcome, enzymeReward } = formulas.resolveGrindEvent(runEventCount)

  let logs: string[] = []
  let nextEnzymeReserves = state.enzymeReserves

  if (outcome === 'success') {
    nextEnzymeReserves = Math.min(formulas.getEnzymeReserveCap(state), state.enzymeReserves + enzymeReward)
    logs.push(`Grind successful! ${definition.name} suppressed. +${enzymeReward} Enzyme Reserves.`)
  } else if (outcome === 'partialFail') {
    nextEnzymeReserves = Math.min(formulas.getEnzymeReserveCap(state), state.enzymeReserves + enzymeReward)
    logs.push(`Grind partial failure. ${definition.name} weakened but persisted. +${enzymeReward} Enzyme Reserves.`)
  } else {
    logs.push(`Grind failed. ${definition.name} fully persisted. No enzyme reward.`)
  }

  let next = recalculateDerivedState({
    ...state,
    activeGrindSession: {
      eventCount: state.activeGrindSession.eventCount + 1,
      windowStartTime: state.activeGrindSession.windowStartTime,
    },
    runGrindEventCount: runEventCount + 1,
    enzymeReserves: nextEnzymeReserves,
  })
  for (const log of logs) {
    next = addStructuredLog(next, 'DEFENSE', log)
  }
  return next
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
    },
    cost
  )
  return checkVisibilityUnlocks(recalculateDerivedState(addStructuredLog(next, 'PASSIVE', `${definition.name} propagated x${quantity}. Passive spread deepens.`)))

  return checkVisibilityUnlocks(recalculateDerivedState(next))
}

export function getAffordableQuantity(
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
    mutationPoints: state.mutationPoints - 1,
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

  const nextHostId = nextHost.hostId as HostId
  const nextZones: ZoneState[] = nextHost.zones.map(zone => {
    const zoneMaxHealth = BALANCE.HOST_HEALTH[nextStage - 1] * (zone.healthPercent / 100)
    return {
      id: zone.id,
      name: zone.name,
      health: new Decimal(zoneMaxHealth),
      maxHealth: new Decimal(zoneMaxHealth),
      isUnlocked: zone.unlockThreshold === undefined,
      compromisePercent: 0,
      isRivalControlled: nextStage === 8 ? false : undefined,
      rivalControlEndAt: nextStage === 8 ? undefined : undefined,
    }
  })

  const vectorBonus = state.vectorProgress > 0 && nextStage === 7
    ? formulas.getVectorBPSBonus(6)
    : 0

  const supplyChainBonusActive = nextStage === 10
  const supplyChainZoneBonus = supplyChainBonusActive
    ? formulas.getSupplyChainZoneStartBonus()
    : 0

  const updatedNextZones = supplyChainZoneBonus > 0
    ? nextZones.map(zone => ({
        ...zone,
        health: new Decimal(zone.maxHealth.add(zone.maxHealth.mul(supplyChainZoneBonus / 100))),
        maxHealth: new Decimal(zone.maxHealth.add(zone.maxHealth.mul(supplyChainZoneBonus / 100))),
      }))
    : nextZones

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
    hostHealth: nextHost.health,
    hostMaxHealth: nextHost.health,
    hostCompleted: false,
    activeDefenseEvents: [],
    pendingDefenseEvents: [],
    nextDefenseEventId: null,
    activeParasiteDefenseBurstMs: 0,
    _currentHostClickDamage: new Decimal(0),
    _currentHostPassiveDamage: new Decimal(0),
    _currentHostDefenseEventsSurvived: 0,
    hostCorruptionPercent: 0,
    manifestationQueue: [],
    nextDefenseCheckAt: Date.now() + BALANCE.DEFENSE_EVENT_COOLDOWN_MS,
    zones: updatedNextZones,
    currentHostId: nextHostId,
    vectorProgress: nextStage === 7 ? 0 : state.vectorProgress,
    supplyChainBonusActive,
    runGrindEventCount: 0,
    proactiveCountermeasure: null,
    proactiveCountermeasureEndAt: 0,
    tier2ScanActive: false,
    tier2ScannedEventId: null,
    tier2PreemptiveSet: false,
    log: clampLog([
      ...state.log,
      createLogEntry(`Host cleared. ${echoDef.name} absorbed: ${echoDef.description}`),
      createLogEntry(`Permanent bonus: ${formatEchoBonus(echoDef.bonus)}`),
      createLogEntry(`Stage ${nextStage} initiated. New host identified: ${nextHost.name}.`),
      createLogEntry(`[${nextHost.stageLabel.toUpperCase()}] ${nextHost.subtitle}`),
      createLogEntry(nextHost.flavorQuote || nextHost.flavor),
      createLogEntry(nextHost.transitionSignal),
      ...(supplyChainBonusActive
        ? [createLogEntry(`Supply chain network integrated. Agricultural bonus active.`)]
        : []),
    ]),
  }))
}

// --- PRESTIGE ---

export function releaseSporesAction(state: GameState): GameState {
  if (!formulas.canReleaseSpores(state)) return state

  const memoryGain = formulas.getProjectedGeneticMemoryGain(state)
  const freshState = createFreshState()
  const totalMemory = state.geneticMemory.add(memoryGain)

  // Calculate genetic memory for stats (retained from spent mutation points)
  const spentPoints = formulas.getSpentMutationPoints(state.stats)
  const newGeneticMemoryStats = formulas.calculateNewGeneticMemoryStats(
    state.geneticMemoryStats,
    spentPoints
  )

  const geneticMemoryBonusPercent = newGeneticMemoryStats.accumulatedBonus * 100

  return checkVisibilityUnlocks({
    ...recalculateDerivedState({
      ...freshState,
      geneticMemory: totalMemory,
      geneticMemoryStats: newGeneticMemoryStats,
      hostEchoes: state.hostEchoes,
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
      createLogEntry(
        `Stat genetic memory retained: +${geneticMemoryBonusPercent.toFixed(1)}% to all future stat effectiveness (${newGeneticMemoryStats.prestigeContributions} runs).`
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
  }
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
  if (state.equippedCountermeasure === countermeasureId) return state

  if (state.activeDefenseEvents.length > 0) {
    return addStructuredLog(state, 'DEFENSE', 'Protocol switch denied. A defense event is active. Wait for it to resolve.')
  }

  const definition = countermeasureDefinitions.find((c) => c.id === countermeasureId)
  if (!definition) return state

  const previousName = state.equippedCountermeasure
    ? countermeasureDefinitions.find((c) => c.id === state.equippedCountermeasure)?.name ?? state.equippedCountermeasure
    : null

  const logLine = previousName
    ? `Protocol switched: ${previousName} → ${definition.name}. ${definition.flavorLine}`
    : `${definition.name} protocol engaged. ${definition.flavorLine}`

  return addStructuredLog({
    ...state,
    equippedCountermeasure: countermeasureId,
  }, 'DEFENSE', logLine)
}

export function setProactiveCountermeasureAction(
  state: GameState,
  countermeasureId: ProactiveCountermeasureId,
  now: number
): GameState {
  if (state.currentStage < 10) return state
  if (state.signal < BALANCE.PROACTIVE_COUNTERMEASURES.signalCost) return state
  if (state.proactiveCountermeasure === countermeasureId) return state

  const durationMs = BALANCE.PROACTIVE_COUNTERMEASURES.durationMs
  const endAt = now + durationMs

  const name = countermeasureId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

  return addStructuredLog({
    ...state,
    signal: state.signal - BALANCE.PROACTIVE_COUNTERMEASURES.signalCost,
    proactiveCountermeasure: countermeasureId,
    proactiveCountermeasureEndAt: endAt,
  }, 'DEFENSE', `${name} countermeasures deployed for 60 seconds. Network-wide protection active.`)
}

export function scanDefenseEventAction(state: GameState): GameState {
  if (state.currentStage < 10) return state
  if (state.tier2ScanActive) return state
  if (state.signal < BALANCE.PROACTIVE_COUNTERMEASURES.signalCost) return state
  if (!state.nextDefenseEventId) return state

  const scannedEventId = state.nextDefenseEventId
  const definition = defenseFlavorDefinitions[scannedEventId]

  return addStructuredLog({
    ...state,
    signal: state.signal - BALANCE.PROACTIVE_COUNTERMEASURES.signalCost,
    tier2ScanActive: true,
    tier2ScannedEventId: scannedEventId,
    tier2PreemptiveSet: false,
  }, 'DEFENSE', `Tier 2 scan complete. Next threat identified: ${definition?.name ?? scannedEventId}.`)
}

export function setPreemptiveCountermeasureAction(state: GameState): GameState {
  if (!state.tier2ScanActive || !state.tier2ScannedEventId) return state
  if (state.tier2PreemptiveSet) return state
  if (state.signal < BALANCE.PROACTIVE_COUNTERMEASURES.signalCost) return state

  return addStructuredLog({
    ...state,
    signal: state.signal - BALANCE.PROACTIVE_COUNTERMEASURES.signalCost,
    tier2PreemptiveSet: true,
  }, 'DEFENSE', `Preemptive countermeasure set. ${state.tier2ScannedEventId} will be met with enhanced resistance.`)
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

  for (const event of expiredEvents) {
    pushDefenseToast({
      type: 'expire',
      eventName: event.name,
      severity: 'low',
      impactLine: 'Production restored. Network stabilising.',
      flavorText: getExpireFlavor(event.id),
    })
    next = addStructuredLog(next, 'DEFENSE', getExpireFlavor(event.id))
  }

  // Decomposition Loop - Saprophyte signature ability with Resilience scaling
  if (expiredEvents.length > 0 && state.strain === 'saprophyte' && state.biomassPerSecond.gt(0)) {
    let totalRecovered = new Decimal(0)
    const conversionRate = formulas.getDecompositionConversionRate(state.stats.resilience)

    for (const event of expiredEvents) {
      const durationMs = getDefenseEventDurationMs(event.id)
      // penaltyDepth = how much output was suppressed (e.g. 0.30 for drought)
      // Beetle Disruption has multiplier 1.0, so penaltyDepth = 0 — correct,
      // since its penalty is a disabled generator rather than a global multiplier.
      const penaltyDepth = new Decimal(1).sub(event.multiplier)
      const productionLost = state.biomassPerSecond
        .mul(penaltyDepth)
        .mul(durationMs / 1000)
      totalRecovered = totalRecovered.add(productionLost.mul(conversionRate))
    }

    if (totalRecovered.gt(0)) {
      next = addStructuredLog({
        ...next,
        biomass: next.biomass.add(totalRecovered),
      }, 'STRAIN', `Decomposition Loop: +${formulas.formatDecimal(totalRecovered)} Biomass recovered (${Math.round(conversionRate * 100)}% conversion rate).`)
    }
  }

  return recalculateDerivedState(next)
}

function activatePendingDefenseEvents(state: GameState, now: number): GameState {
  const toActivate = state.pendingDefenseEvents.filter((event) => event.startsAt <= now)

  if (toActivate.length === 0) return state

  let next: GameState = {
    ...state,
    pendingDefenseEvents: state.pendingDefenseEvents.filter((event) => event.startsAt > now),
    activeDefenseEvents: [...state.activeDefenseEvents, ...toActivate],
  }

  for (const event of toActivate) {
    const suppressionPct = Math.round((1 - event.multiplier.toNumber()) * 100)
    const durationMs = event.endsAt - event.startsAt
    const m = Math.floor(durationMs / 60000)
    const s = Math.round((durationMs % 60000) / 1000)
    const durationStr = `${m}:${s.toString().padStart(2, '0')}`
    const severity = formulas.getDefenseEventSeverity(event.multiplier.toNumber())
    const impactLine = buildImpactLine(event, suppressionPct, durationStr)
    pushDefenseToast({
      type: 'start',
      eventName: event.name,
      severity,
      impactLine,
      flavorText: defenseFlavorDefinitions[event.id]?.triggerLogs[0] ?? '',
    })
    next = addStructuredLog(next, 'DEFENSE', `${event.name} — NOW ACTIVE. Passive -${suppressionPct}%. Duration: ${durationStr}.`)
  }

  return next
}

function tryTriggerDefenseEvent(state: GameState, now: number): GameState {
  if (state.hostCompleted || now < state.nextDefenseCheckAt) return state

  if (state.clickCount === 0 && state.biomass.equals(0)) {
    return {
      ...state,
      nextDefenseCheckAt: now + BALANCE.DEFENSE_EVENT_COOLDOWN_MS,
    }
  }

  const hostId = String(state.currentStage).padStart(2, '0')
  const hostConfig = BALANCE.HOSTS[hostId as keyof typeof BALANCE.HOSTS]
  if (!hostConfig || hostConfig.defenseEventProfile === 'none') {
    return {
      ...state,
      nextDefenseCheckAt: now + BALANCE.DEFENSE_EVENT_COOLDOWN_MS,
    }
  }

  const profile = BALANCE.DEFENSE_EVENTS.profiles[hostConfig.defenseEventProfile as keyof typeof BALANCE.DEFENSE_EVENTS.profiles]
  let frequencyMultiplier = profile?.frequencyMultiplier ?? 1.0

  if (state.currentStage === 7 && state.seasonalState) {
    const seasonalFreqMult = formulas.getSeasonalEventFrequencyMultiplier(state.seasonalState.currentSeason)
    frequencyMultiplier *= seasonalFreqMult
  }

  const nextCheckAt = now + BALANCE.DEFENSE_EVENT_COOLDOWN_MS
  const baseChance = BALANCE.DEFENSE_EVENT_TRIGGER_BASE + (state.currentStage - 1) * BALANCE.DEFENSE_EVENT_TRIGGER_PER_STAGE
  const triggerChance = Math.min(
    BALANCE.DEFENSE_EVENT_TRIGGER_MAX,
    baseChance * frequencyMultiplier
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
    .filter((event) => state.currentStage >= event.stageRange.min && state.currentStage <= event.stageRange.max && !event.isImmediateHit)
    .map((event) => event.id)
  const availableEventIds = eligibleEventIds.filter(
    (id) => !state.activeDefenseEvents.some((existing) => existing.id === id)
  )
  const selectedEventId = availableEventIds.includes(eventId)
    ? eventId
    : (availableEventIds.length > 0 ? getRandomItem(availableEventIds) : eventId)
  const eventStartsAt = now + DEFENSE_FORECAST_DELAY_MS
  const event = createDefenseEvent(state, now, selectedEventId, eventStartsAt)
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

  const { event: mitigatedEvent, outcome, enzymeReward } = applyCountermeasureToEvent(state, event, now)
  const nextForecast = rollDefenseEventId(state)
  const parasiteBurstMs = state.strain === 'parasite'
    ? BALANCE.STRAIN_PARASITE_DEFENSE_BURST_MS
    : state.activeParasiteDefenseBurstMs

  let resultState: GameState = {
    ...state,
    pendingDefenseEvents: [...state.pendingDefenseEvents, mitigatedEvent],
    enzymeReserves: state.equippedCountermeasure !== null
      ? Math.min(formulas.getEnzymeReserveCap(state), state.enzymeReserves + enzymeReward)
      : state.enzymeReserves,
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
      ...getCountermeasureOutcomeLogs(outcome, mitigatedEvent.name, enzymeReward),
      ...getCountermeasureLogLines(state.equippedCountermeasure, mitigatedEvent.id),
      ...(state.strain === 'parasite'
        ? [createLogEntry('Parasite counterburst window opened. Manual absorption spikes briefly.')]
        : []),
    ]),
  }

  const suppressionPct = Math.round((1 - mitigatedEvent.multiplier.toNumber()) * 100)
  const durationMs = mitigatedEvent.endsAt - now
  const m = Math.floor(durationMs / 60000)
  const s = Math.round((durationMs % 60000) / 1000)
  const durationStr = `${m}:${s.toString().padStart(2, '0')}`
  const severity = formulas.getDefenseEventSeverity(mitigatedEvent.multiplier.toNumber())
  const impactLine = buildImpactLine(mitigatedEvent, suppressionPct, durationStr)
  pushDefenseToast({
    type: 'forecast',
    eventName: mitigatedEvent.name,
    severity,
    impactLine,
    flavorText: defenseFlavorDefinitions[mitigatedEvent.id]?.triggerLogs[0] ?? '',
  })
  resultState = addStructuredLog(resultState, 'DEFENSE', `${mitigatedEvent.name} — INCOMING in 10s. Passive -${suppressionPct}%. Duration: ${durationStr}.`)

  const immediateHitEventId = rollImmediateHitEventId(state)
  if (immediateHitEventId && !state.activeDefenseEvents.some((existing) => existing.id === immediateHitEventId)) {
    const immediateEvent = createDefenseEvent(state, now, immediateHitEventId, now)
    if (immediateEvent) {
      const definition = defenseFlavorDefinitions[immediateHitEventId]
      resultState = {
        ...resultState,
        activeDefenseEvents: [...resultState.activeDefenseEvents, immediateEvent],
        log: clampLog([
          ...resultState.log,
          ...definition.triggerLogs.map(createLogEntry),
        ]),
      }
      const immSuppressionPct = Math.round((1 - immediateEvent.multiplier.toNumber()) * 100)
      const immDurationMs = immediateEvent.endsAt - now
      const immM = Math.floor(immDurationMs / 60000)
      const immS = Math.round((immDurationMs % 60000) / 1000)
      const immDurationStr = `${immM}:${immS.toString().padStart(2, '0')}`
      const immSeverity = formulas.getDefenseEventSeverity(immediateEvent.multiplier.toNumber())
      const immImpactLine = buildImpactLine(immediateEvent, immSuppressionPct, immDurationStr)
      pushDefenseToast({
        type: 'start',
        eventName: immediateEvent.name,
        severity: immSeverity,
        impactLine: immImpactLine,
        flavorText: definition.triggerLogs[0] ?? '',
      })
      resultState = addStructuredLog(resultState, 'DEFENSE', `${immediateEvent.name} — passive -${immSuppressionPct}%. Duration: ${immDurationStr}.`)
    }
  }

  // Extinction-class events (Host 11)
  if (state.currentStage === 11) {
    const extinctionRoll = Math.random()
    if (extinctionRoll < formulas.getExtinctionEventFrequency()) {
      const extinctionEligibleIds = Object.values(defenseFlavorDefinitions)
        .filter((event) => event.isExtinctionEvent && state.currentStage >= event.stageRange.min && state.currentStage <= event.stageRange.max)
        .map((event) => event.id)
      const availableExtinctionIds = extinctionEligibleIds.filter(
        (id) => !resultState.activeDefenseEvents.some((existing) => existing.id === id)
      )
      if (availableExtinctionIds.length > 0) {
        const extinctionEventId = getRandomItem(availableExtinctionIds)
        const extinctionEvent = createDefenseEvent(resultState, now, extinctionEventId, now)
        if (extinctionEvent) {
          const extinctionDef = defenseFlavorDefinitions[extinctionEventId]
          let meterRegression = 0
          if (extinctionDef.meterRegressionPercent) {
            meterRegression = extinctionDef.meterRegressionPercent
          } else {
            meterRegression = formulas.getExtinctionEventMeterRegression()
          }
          const newMeter = Math.max(0, resultState.integrationMeter - meterRegression)
          resultState = {
            ...resultState,
            integrationMeter: newMeter,
            activeDefenseEvents: [...resultState.activeDefenseEvents, extinctionEvent],
            log: clampLog([
              ...resultState.log,
              ...extinctionDef.triggerLogs.map(createLogEntry),
              createLogEntry(`EXTINCTION EVENT: Integration meter regresses by ${meterRegression}%. Current meter: ${newMeter.toFixed(1)}%`),
            ]),
          }
          const extSuppressionPct = Math.round((1 - extinctionEvent.multiplier.toNumber()) * 100)
          const extDurationMs = extinctionEvent.endsAt - now
          const extM = Math.floor(extDurationMs / 60000)
          const extS = Math.round((extDurationMs % 60000) / 1000)
          const extDurationStr = `${extM}:${extS.toString().padStart(2, '0')}`
          const extSeverity = formulas.getDefenseEventSeverity(extinctionEvent.multiplier.toNumber())
          const extImpactLine = buildImpactLine(extinctionEvent, extSuppressionPct, extDurationStr)
          pushDefenseToast({
            type: 'start',
            eventName: extinctionEvent.name,
            severity: extSeverity,
            impactLine: extImpactLine,
            flavorText: extinctionDef.triggerLogs[0] ?? '',
          })
          resultState = addStructuredLog(resultState, 'DEFENSE', `${extinctionEvent.name} — passive -${extSuppressionPct}%. Duration: ${extDurationStr}.`)
        }
      }
    }
  }

  if (state.currentStage === 10) {
    const stressThreshold = BALANCE.HOST_STRESS.thresholds.threshold2
    const stressRatio = state.hostStress.currentStress / stressThreshold
    if (stressRatio >= BALANCE.MULTI_FRONT.stressThresholdRatio) {
      const extraEventCount = BALANCE.MULTI_FRONT.extraEventCount
      const eligibleEventIds = Object.values(defenseFlavorDefinitions)
        .filter((event) => state.currentStage >= event.stageRange.min && state.currentStage <= event.stageRange.max && !event.isImmediateHit)
        .map((event) => event.id)
      const availableEventIds = eligibleEventIds.filter(
        (id) => !resultState.activeDefenseEvents.some((existing) => existing.id === id)
      )

      for (let i = 0; i < extraEventCount && availableEventIds.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * availableEventIds.length)
        const extraEventId = availableEventIds.splice(randomIndex, 1)[0]
        if (extraEventId) {
          const extraEvent = createDefenseEvent(resultState, now, extraEventId, now)
          if (extraEvent) {
            const { event: mitigatedExtraEvent, enzymeReward: extraEnzymeReward } = applyCountermeasureToEvent(resultState, extraEvent, now)
            const definition = defenseFlavorDefinitions[extraEventId]
            resultState = {
              ...resultState,
              activeDefenseEvents: [...resultState.activeDefenseEvents, mitigatedExtraEvent],
              enzymeReserves: Math.min(
                formulas.getEnzymeReserveCap(resultState),
                resultState.enzymeReserves + extraEnzymeReward
              ),
              log: clampLog([
                ...resultState.log,
                ...definition.triggerLogs.map(createLogEntry),
                createLogEntry(`Multi-front assault! ${definition.name} strikes from another angle.`),
              ]),
            }
            const multiSuppressionPct = Math.round((1 - mitigatedExtraEvent.multiplier.toNumber()) * 100)
            const multiDurationMs = mitigatedExtraEvent.endsAt - now
            const multiM = Math.floor(multiDurationMs / 60000)
            const multiS = Math.round((multiDurationMs % 60000) / 1000)
            const multiDurationStr = `${multiM}:${multiS.toString().padStart(2, '0')}`
            const multiSeverity = formulas.getDefenseEventSeverity(mitigatedExtraEvent.multiplier.toNumber())
            const multiImpactLine = buildImpactLine(mitigatedExtraEvent, multiSuppressionPct, multiDurationStr)
            pushDefenseToast({
              type: 'start',
              eventName: mitigatedExtraEvent.name,
              severity: multiSeverity,
              impactLine: multiImpactLine,
              flavorText: definition.triggerLogs[0] ?? '',
            })
            resultState = addStructuredLog(resultState, 'DEFENSE', `${mitigatedExtraEvent.name} — passive -${multiSuppressionPct}%. Duration: ${multiDurationStr}.`)
          }
        }
      }
    }
  }

  return recalculateDerivedState(resultState)
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
    let maxLogId = 0
    for (const entry of hydrated.structuredLog) {
      if (entry && entry.id) {
        const match = String(entry.id).match(/^log_(\d+)$/)
        if (match && match[1]) {
          const num = parseInt(match[1], 10)
          if (num > maxLogId) maxLogId = num
        }
      }
    }
    if (maxLogId > 0) {
      _logCounter = Math.max(_logCounter, maxLogId)
    }
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
    startsAt: number
    endsAt: number
    multiplier: string
    clickMultiplier?: string
    disabledGeneratorId?: string
    tier?: 1 | 2
    isGrindable?: boolean
    chargeCost?: number
  }>
  pendingDefenseEvents: Array<{
    id: string
    name: string
    description: string
    startsAt: number
    endsAt: number
    multiplier: string
    clickMultiplier?: string
    disabledGeneratorId?: string
    tier?: 1 | 2
    isGrindable?: boolean
    chargeCost?: number
  }>
  nextDefenseEventId: DefenseEventId | null
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
  structuredLog: import('../lib/game').LogEntry[]
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
  geneticMemoryStats?: {
    prestigeContributions: number
    accumulatedBonus: number
  }
  nextMycorrhizalPulseAt?: number | null
  zones?: Array<{
    id: string
    name: string
    health: string
    maxHealth: string
    isUnlocked: boolean
    compromisePercent: number
    isRivalControlled?: boolean
    rivalControlEndAt?: number
  }>
  currentHostId?: string
  enzymeReserves?: number
  hostStress?: {
    currentStress: number
    lastAttackTime: number
  }
  seasonalState?: {
    currentSeason: 'spring' | 'summer' | 'autumn' | 'winter'
    seasonStartTime: number
    seasonIndex: number
  } | null
  rivalNetworkState?: {
    isSuppressing: boolean
    suppressionEndAt: number
    activeNodes: string[]
  } | null
  integrationZones?: Array<{
    zoneId: string
    saturationPercent: number
    isLocked: boolean
    contributionRate: number
  }>
  integrationMeter?: number
  activeAttack?: {
    isActive: boolean
    zoneId: string | null
    endsAt: number
    bpsBonusMultiplier: number
    cooldownEndAt: number
  } | null
  integrationPulse?: {
    isActive: boolean
    endsAt: number
    bpsBonusMultiplier: number
  } | null
  vectorProgress?: number
  activeGrindSession?: {
    eventCount: number
    windowStartTime: number
  }
  runGrindEventCount?: number
  proactiveCountermeasure?: string | null
  proactiveCountermeasureEndAt?: number
  tier2ScanActive?: boolean
  tier2ScannedEventId?: string | null
  tier2PreemptiveSet?: boolean
  supplyChainBonusActive?: boolean
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
    pendingDefenseEvents: s.pendingDefenseEvents.map((event) => ({
      ...event,
      multiplier: event.multiplier.toString(),
      clickMultiplier: event.clickMultiplier?.toString(),
    })),
    nextDefenseEventId: s.nextDefenseEventId,
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
    structuredLog: s.structuredLog,
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
    geneticMemoryStats: s.geneticMemoryStats,
    nextMycorrhizalPulseAt: s.nextMycorrhizalPulseAt,
    zones: serializeZones(s.zones),
    currentHostId: s.currentHostId,
    enzymeReserves: s.enzymeReserves,
    hostStress: s.hostStress,
    seasonalState: s.seasonalState,
    rivalNetworkState: s.rivalNetworkState,
    integrationZones: s.integrationZones,
    integrationMeter: s.integrationMeter,
    activeAttack: s.activeAttack,
    integrationPulse: s.integrationPulse,
    vectorProgress: s.vectorProgress,
    activeGrindSession: s.activeGrindSession ?? undefined,
    runGrindEventCount: s.runGrindEventCount,
    proactiveCountermeasure: s.proactiveCountermeasure,
    proactiveCountermeasureEndAt: s.proactiveCountermeasureEndAt,
    tier2ScanActive: s.tier2ScanActive,
    tier2ScannedEventId: s.tier2ScannedEventId,
    tier2PreemptiveSet: s.tier2PreemptiveSet,
    supplyChainBonusActive: s.supplyChainBonusActive,
  }
}

function normalizeOfflineEvents(rawEvents: SerializedState['_offlineEvents']): OfflineEvent[] {
  return (rawEvents ?? []).map((event) => ({
    ...event,
    biomassDelta: event.biomassDelta ? toDecimal(event.biomassDelta) : undefined,
  }))
}

function normalizeZones(rawZones: SerializedState['zones']): ZoneState[] {
  if (!rawZones || rawZones.length === 0) {
    return createDefaultState().zones
  }
  return rawZones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    health: toDecimal(zone.health),
    maxHealth: toDecimal(zone.maxHealth),
    isUnlocked: zone.isUnlocked,
    compromisePercent: zone.compromisePercent,
    isRivalControlled: zone.isRivalControlled,
    rivalControlEndAt: zone.rivalControlEndAt,
  }))
}

function serializeZones(zones: ZoneState[]): SerializedState['zones'] {
  return zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    health: zone.health.toString(),
    maxHealth: zone.maxHealth.toString(),
    isUnlocked: zone.isUnlocked,
    compromisePercent: zone.compromisePercent,
    isRivalControlled: zone.isRivalControlled,
    rivalControlEndAt: zone.rivalControlEndAt,
  }))
}

function normalizeLoadedState(raw: Partial<SerializedState>): GameState {
  const now = Date.now()
  const base = createFreshState()

  const validCountermeasureIds: CountermeasureId[] = [
    'moisture-buffer', 'chitin-lattice', 'enzyme-suppressor',
    'thermal-regulator', 'signal-jammer', 'spore-shield',
  ]
  const countermeasureMigrationMap: Record<string, CountermeasureId> = {
    'moisture-buffer':    'moisture-buffer',
    'brood-decoy':        'chitin-lattice',
    'immune-mimicry':     'signal-jammer',
    'enzyme-neutralizer': 'enzyme-suppressor',
    'biofilm-shield':     'spore-shield',
    'signal-jammer':      'signal-jammer',
  }
  const rawCountermeasure = raw.equippedCountermeasure as string | null | undefined
  const migratedCountermeasure: CountermeasureId | null = rawCountermeasure
    ? (countermeasureMigrationMap[rawCountermeasure] ?? null)
    : null

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
    // Migration: rename old tier-8 'planetary-membrane' to 'lithospheric-web'
    // and ensure new generator types exist in loaded state
    ...(() => {
      const loadedGens = raw.generators ?? {}
      if (loadedGens['planetary-membrane'] && !loadedGens['lithospheric-web']) {
        loadedGens['lithospheric-web'] = loadedGens['planetary-membrane']
        loadedGens['planetary-membrane'] = { owned: 0 }
      }
      for (const id of ['atmospheric-drift', 'oceanic-threadwork'] as const) {
        if (!loadedGens[id]) {
          loadedGens[id] = { owned: 0 }
        }
      }
      return {}
    })(),
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
      startsAt: event.startsAt ?? now,
    })),
    pendingDefenseEvents: (raw.pendingDefenseEvents ?? []).map((event) => ({
      ...event,
      id: event.id as import('../lib/game').DefenseEventId,
      multiplier: toDecimal(event.multiplier),
      clickMultiplier: event.clickMultiplier ? toDecimal(event.clickMultiplier) : undefined,
      disabledGeneratorId: event.disabledGeneratorId as import('../lib/game').GeneratorId | undefined,
      startsAt: event.startsAt ?? now,
    })),
    nextDefenseEventId: raw.nextDefenseEventId ?? base.nextDefenseEventId,
    equippedCountermeasure: migratedCountermeasure,
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
    structuredLog: raw.structuredLog ?? base.structuredLog,
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
    geneticMemoryStats: raw.geneticMemoryStats ?? base.geneticMemoryStats,
    nextMycorrhizalPulseAt: raw.nextMycorrhizalPulseAt ?? base.nextMycorrhizalPulseAt,
    zones: normalizeZones(raw.zones),
    currentHostId: (raw.currentHostId ?? base.currentHostId) as GameState['currentHostId'],
    enzymeReserves: raw.enzymeReserves ?? base.enzymeReserves,
    hostStress: raw.hostStress ?? base.hostStress,
    seasonalState: raw.seasonalState ?? base.seasonalState,
    rivalNetworkState: raw.rivalNetworkState ?? base.rivalNetworkState,
    integrationZones: raw.integrationZones ?? base.integrationZones,
    integrationMeter: raw.integrationMeter ?? base.integrationMeter,
    activeAttack: raw.activeAttack ?? base.activeAttack,
    integrationPulse: raw.integrationPulse ?? base.integrationPulse,
    vectorProgress: raw.vectorProgress ?? base.vectorProgress,
    activeGrindSession: raw.activeGrindSession ?? base.activeGrindSession,
    runGrindEventCount: raw.runGrindEventCount ?? base.runGrindEventCount,
    proactiveCountermeasure: (raw.proactiveCountermeasure as GameState['proactiveCountermeasure']) ?? base.proactiveCountermeasure,
    proactiveCountermeasureEndAt: raw.proactiveCountermeasureEndAt ?? base.proactiveCountermeasureEndAt,
    tier2ScanActive: raw.tier2ScanActive ?? base.tier2ScanActive,
    tier2ScannedEventId: (raw.tier2ScannedEventId as GameState['tier2ScannedEventId']) ?? base.tier2ScannedEventId,
    tier2PreemptiveSet: raw.tier2PreemptiveSet ?? base.tier2PreemptiveSet,
    supplyChainBonusActive: raw.supplyChainBonusActive ?? base.supplyChainBonusActive,
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
