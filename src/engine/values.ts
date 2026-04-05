/**
 * values.ts
 * Game state. Pure data, no logic.
 * Defines the shape of the game state and exports a mutable state object.
 */

import Decimal from 'break_eternity.js'
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
} from '../lib/game'

function createDefaultVisibilityState(): VisibilityState {
  return {
    absorbButton: true,
    biomassDisplay: true,
    observationLog: false,
    bpsDisplay: false,
    generatorPanel: false,
    generatorTiers: [true, false, false, false, false, false, false, false],
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

export function createDefaultState(): GameState {
  const now = Date.now()

  return {
    biomass: new Decimal(0),
    biomassPerClick: new Decimal(1),
    biomassPerSecond: new Decimal(0),
    lifetimeBiomass: new Decimal(0),
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
    hostName: 'Dead Leaf',
    stageLabel: 'Germination',
    subtitle: "The Leaf Doesn't Notice",
    hostHealth: new Decimal(1_000),
    hostMaxHealth: new Decimal(1_000),
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
      'hyphae-strand': { owned: 0 },
      'mycelial-mat': { owned: 0 },
      'rhizomorph-cord': { owned: 0 },
      'sporocarp-cluster': { owned: 0 },
      'fruiting-canopy': { owned: 0 },
      'decomposer-bloom': { owned: 0 },
      'subterranean-nexus': { owned: 0 },
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
    visibility: createDefaultVisibilityState(),
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
