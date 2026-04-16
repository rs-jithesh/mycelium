/**
 * values.ts
 * Game state. Pure data, no logic.
 * Defines the shape of the game state and exports a mutable state object.
 */

import Decimal from 'break_eternity.js'
import { BALANCE } from './balance.config'
import type {
  BuyAmount,
  StrainId,
  StatId,
  SkillId,
  GeneratorId,
  UpgradeId,
  DefenseEventId,
  ActiveDefenseEvent,
  GameState,
  VisibilityState,
  HostEchoType,
  HostId,
  ZoneState,
  HostStressState,
  SeasonalState,
  RivalNetworkState,
  IntegrationZoneState,
  ActiveAttackState,
  ProactiveCountermeasureId,
} from '../lib/game'
import { hostDefinitions } from '../lib/game'

function createDefaultVisibilityState(): VisibilityState {
  return {
    absorbButton: true,
    biomassDisplay: true,
    observationLog: false,
    bpsDisplay: false,
    generatorPanel: false,
    generatorTiers: [true, false, false, false, false, false, false, false, false, false, false],
    upgradePanel: false,
    strainPrompt: false,
    statsPanel: false,
    skillTree: false,
    hostHealthBar: true,
    signalPanel: false,
    stageDisplay: false,
    prestigeButton: false,
    useScientificNotation: false,
    logPanelOpen: true,
    isNew: {},
    generatorPanelUnlockAt: null,
  }
}

function createInitialZones(stage: number): ZoneState[] {
  const hostDef = hostDefinitions.find(h => h.stage === stage)
  if (!hostDef) return []

  return hostDef.zones.map(zone => {
    const zoneMaxHealth = BALANCE.HOST_HEALTH[stage - 1] * (zone.healthPercent / 100)
    return {
      id: zone.id,
      name: zone.name,
      health: new Decimal(zoneMaxHealth),
      maxHealth: new Decimal(zoneMaxHealth),
      isUnlocked: zone.unlockThreshold === undefined,
      compromisePercent: 0,
    }
  })
}

function createInitialIntegrationZones(): IntegrationZoneState[] {
  return [
    { zoneId: 'atmosphere', saturationPercent: 0, isLocked: true, contributionRate: 0 },
    { zoneId: 'hydrosphere', saturationPercent: 0, isLocked: true, contributionRate: 0 },
    { zoneId: 'lithosphere', saturationPercent: 0, isLocked: true, contributionRate: 0 },
    { zoneId: 'biotic_layer', saturationPercent: 0, isLocked: true, contributionRate: 0 },
    { zoneId: 'technosphere', saturationPercent: 0, isLocked: true, contributionRate: 0 },
    { zoneId: 'noosphere', saturationPercent: 0, isLocked: true, contributionRate: 0 },
  ]
}

export function createDefaultState(): GameState {
  const now = Date.now()
  const initialHost = hostDefinitions[0]

  return {
    biomass: new Decimal(0),
    biomassPerClick: new Decimal(1),
    biomassPerSecond: new Decimal(0),
    lifetimeBiomass: new Decimal(5),
    geneticMemory: new Decimal(0),
    signal: 0,
    signalPerSecond: 0,
    signalCap: 0,
    signalDecaying: false,
    signalOverspent: false,
    prestigeCount: 0,
    hasPrestiged: false,
    currentStage: 1,
    highestStageReached: 1,
    hostName: initialHost.name,
    stageLabel: initialHost.stageLabel,
    subtitle: initialHost.subtitle,
    hostHealth: new Decimal(BALANCE.HOST_HEALTH[0]),
    hostMaxHealth: new Decimal(BALANCE.HOST_HEALTH[0]),
    hostCompleted: false,
    strain: null,
    mutationPoints: 0,
    unlockedStrains: {
      parasite: true,
      symbiote: true,
      saprophyte: false,
    },
    stats: {
      virulence: 0,
      resilience: 0,
      complexity: 0,
    },
    unlockedSkills: [],
    clickCount: 0,
    generators: {
      'hyphae-strand':      { owned: 0 },
      'mycelial-mat':       { owned: 0 },
      'rhizomorph-cord':    { owned: 0 },
      'sporocarp-cluster':  { owned: 0 },
      'fruiting-canopy':    { owned: 0 },
      'decomposer-bloom':   { owned: 0 },
      'subterranean-nexus': { owned: 0 },
      'lithospheric-web':   { owned: 0 },
      'atmospheric-drift':  { owned: 0 },
      'oceanic-threadwork': { owned: 0 },
      'planetary-membrane': { owned: 0 },
    },
    upgrades: {
      'chitinous-reinforcement': false,
      'exoenzyme-secretion': false,
      'lateral-transfer': false,
      'canopy-ventilation': false,
      'decomposer-surge': false,
      'nexus-overweave': false,
      'membrane-tension': false,
      'neural-propagation': false,
      'terminus-strike': false,
    },
    buyAmount: 1,
    activeDefenseEvents: [],
    pendingDefenseEvents: [],
    nextDefenseEventId: null,
    equippedCountermeasure: null,
    activeParasiteDefenseBurstMs: 0,
    activeCoordinationLinks: [],
    activeVulnerabilityWindow: null,
    rivalSuppressed: false,
    rivalSuppressionRemainingMs: 0,
    _signalDecayLogged: false,
    _signalOverspentLogged: false,
    _wasOverspent: false,
    nextDefenseCheckAt: now + 12_000,
    lastSaveTime: now,
    lastTickTime: now,
    log: [],
    structuredLog: [],
    visibility: createDefaultVisibilityState(),
    hostEchoes: {},
    _currentHostClickDamage: new Decimal(0),
    _currentHostPassiveDamage: new Decimal(0),
    _currentHostDefenseEventsSurvived: 0,
    _offlineEvents: [],
    _pendingOfflineEvents: [],
    hostCorruptionPercent: 0,
    manifestationQueue: [],
    geneticMemoryStats: {
      prestigeContributions: 0,
      accumulatedBonus: 0,
    },
    nextMycorrhizalPulseAt: null,
    zones: createInitialZones(1),
    currentHostId: '01',
    enzymeReserves: 0,
    hostStress: {
      currentStress: 0,
      lastAttackTime: 0,
    },
    seasonalState: null,
    rivalNetworkState: null,
    integrationZones: createInitialIntegrationZones(),
    integrationMeter: 0,
    activeAttack: null,
    integrationPulse: null,
    vectorProgress: 0,
    activeGrindSession: {
      eventCount: 0,
      windowStartTime: now,
    },
    runGrindEventCount: 0,
    proactiveCountermeasure: null,
    proactiveCountermeasureEndAt: 0,
    tier2ScanActive: false,
    tier2ScannedEventId: null,
    tier2PreemptiveSet: false,
    supplyChainBonusActive: false,
  }
}

// The live game state. Mutated only by happenings.ts.
export let state = createDefaultState()

// Reset state to defaults (used by prestige)
export function resetState(preserveFields: (keyof GameState)[] = []): GameState {
  const preserved: Record<string, GameState[keyof GameState]> = {}
  for (const field of preserveFields) {
    preserved[field] = state[field]
  }
  state = createDefaultState()
  for (const [key, value] of Object.entries(preserved)) {
    Object.assign(state, { [key]: value })
  }
  return state
}

// Set the live state (used by store to sync)
export function setState(newState: GameState): void {
  state = newState
}

// Get the live state
export function getState(): GameState {
  return state
}
