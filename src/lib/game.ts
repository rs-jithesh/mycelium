import Decimal from 'break_eternity.js'
import { BALANCE } from '../engine/balance.config'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type BuyAmount = 1 | 10 | 100 | 'MAX'
export type StrainId = 'parasite' | 'symbiote' | 'saprophyte'
export type StatId = 'virulence' | 'resilience' | 'complexity'
export type SkillId =
  | 'enzymatic-breakdown'
  | 'acidic-secretion'
  | 'hemorrhagic-spread'
  | 'chitin-shell'
  | 'dormancy-protocol'
  | 'spore-hardening'
  | 'quorum-recursion'
  | 'signal-amplification'
  | 'distributed-cognition'
export type GeneratorId =
  | 'hyphae-strand'
  | 'mycelial-mat'
  | 'rhizomorph-cord'
  | 'sporocarp-cluster'
  | 'fruiting-canopy'
  | 'decomposer-bloom'
  | 'subterranean-nexus'
  | 'planetary-membrane'
export type UpgradeId = 'chitinous-reinforcement' | 'exoenzyme-secretion' | 'lateral-transfer'
  | 'canopy-ventilation' | 'decomposer-surge' | 'nexus-overweave' | 'membrane-tension'
  | 'neural-propagation' | 'terminus-strike'
export type DefenseEventId =
  | 'drought'
  | 'beetle-disruption'
  | 'cold-snap'
  | 'spore-competition'
  | 'immune-response'
  | 'desiccation-pulse'
  | 'antifungal-exudates'
  | 'microbial-rivalry'
  | 'uv-surge'
  | 'lignin-fortification'
  | 'root-allelopathy'
  | 'insect-vector-swarm'
  | 'viral-hijack'
  | 'nutrient-sequestration'
  | 'spore-predation'
  | 'thermal-stratification'
  | 'ecosystem-feedback'
export type CountermeasureId = 'moisture-buffer' | 'brood-decoy' | 'immune-mimicry'
export type HostEchoType = 'aggressive' | 'efficient' | 'resilient' | 'patient'

export interface HostEchoDefinition {
  id: HostEchoType
  name: string
  description: string
  bonus: {
    type: 'clickMultiplier' | 'passiveMultiplier' | 'defenseMitigation' | 'maxSignal'
    value: number
  }
}

export interface GeneratorDefinition {
  id: GeneratorId
  tier: number
  name: string
  flavor: string
  baseCost: Decimal
  baseProduction: Decimal
}

export interface UpgradeDefinition {
  id: UpgradeId
  name: string
  cost: Decimal
  description: string
  requiredGenerator: GeneratorId
  requiredOwned: number
}

export interface StrainDefinition {
  id: StrainId
  name: string
  summary: string
  clickModifier: number
  passiveModifier: number
  signature: string
  lore: string
  locked: boolean
}

export interface SkillDefinition {
  id: SkillId
  name: string
  branch: StatId
  requiredStat: number
  cost: Decimal
  description: string
}

export interface HostDefinition {
  stage: number
  name: string
  stageLabel: string
  subtitle: string
  health: Decimal
  flavor: string
  threatLevel: 'low' | 'medium' | 'high' | 'extreme'
  defenseSignature: string
  transitionSignal: string
}

export interface ActiveDefenseEvent {
  id: DefenseEventId
  name: string
  description: string
  endsAt: number
  multiplier: Decimal
  clickMultiplier?: Decimal
  disabledGeneratorId?: GeneratorId
}

export interface OfflineEvent {
  type: 'defense' | 'milestone' | 'expansion' | 'dormant'
  name: string
  durationMs: number
  outcome: 'weathered' | 'overcame' | 'breached' | 'awaited'
  biomassDelta?: Decimal
}

export interface OfflineNarrative {
  gains: Decimal
  events: OfflineEvent[]
  summary: string
}

export interface CountermeasureDefinition {
  id: CountermeasureId
  name: string
  description: string
  targetEventIds: DefenseEventId[]
}

export interface ActiveCoordinationLink {
  sourceTier: number
  targetTier: number
  remainingMs: number
  boostMultiplier: number
}

export interface ActiveVulnerabilityWindow {
  remainingMs: number
  damageMultiplier: number
}

export interface VisibilityState {
  absorbButton: boolean
  biomassDisplay: boolean
  observationLog: boolean
  bpsDisplay: boolean
  generatorPanel: boolean
  generatorTiers: boolean[]
  upgradePanel: boolean
  strainPrompt: boolean
  statsPanel: boolean
  skillTree: boolean
  hostHealthBar: boolean
  signalPanel: boolean
  stageDisplay: boolean
  prestigeButton: boolean
  useScientificNotation: boolean
  logPanelOpen: boolean
  isNew: Record<string, boolean>
  generatorPanelUnlockAt: number | null
}

export interface GameState {
  biomass: Decimal
  biomassPerClick: Decimal
  biomassPerSecond: Decimal
  lifetimeBiomass: Decimal
  geneticMemory: Decimal
  signal: number
  signalPerSecond: number
  signalCap: number
  signalDecaying: boolean
  signalOverspent: boolean
  prestigeCount: number
  hasPrestiged: boolean
  currentStage: number
  highestStageReached: number
  hostName: string
  stageLabel: string
  subtitle: string
  hostHealth: Decimal
  hostMaxHealth: Decimal
  hostCompleted: boolean
  strain: StrainId | null
  mutationPoints: number
  unlockedStrains: Record<StrainId, boolean>
  stats: Record<StatId, number>
  unlockedSkills: SkillId[]
  clickCount: number
  generators: Record<GeneratorId, { owned: number }>
  upgrades: Record<UpgradeId, boolean>
  buyAmount: BuyAmount
  activeDefenseEvents: ActiveDefenseEvent[]
  nextDefenseEventId: DefenseEventId | null
  equippedCountermeasure: CountermeasureId | null
  activeParasiteDefenseBurstMs: number
  activeCoordinationLinks: ActiveCoordinationLink[]
  activeVulnerabilityWindow: ActiveVulnerabilityWindow | null
  rivalSuppressed: boolean
  rivalSuppressionRemainingMs: number
  _signalDecayLogged: boolean
  _signalOverspentLogged: boolean
  _wasOverspent: boolean
  nextDefenseCheckAt: number
  lastSaveTime: number
  lastTickTime: number
  log: string[]
  visibility: VisibilityState
  hostEchoes: Record<number, HostEchoType>
  _currentHostClickDamage: Decimal
  _currentHostPassiveDamage: Decimal
  _currentHostDefenseEventsSurvived: number
  _offlineEvents: OfflineEvent[]
  _pendingOfflineEvents: OfflineEvent[]
  hostCorruptionPercent: number
  manifestationQueue: string[]
}

// ============================================================================
// DATA DEFINITIONS
// ============================================================================

export const generatorDefinitions: GeneratorDefinition[] = [
  {
    id: 'hyphae-strand',
    tier: 1,
    name: 'Hyphae Strand',
    flavor: 'Thin filaments push into the soil.',
    baseCost: new Decimal(BALANCE.GENERATOR_BASE_COSTS[0]),
    baseProduction: new Decimal(BALANCE.GENERATOR_BASE_PRODUCTION[0]),
  },
  {
    id: 'mycelial-mat',
    tier: 2,
    name: 'Mycelial Mat',
    flavor: 'A web of consumption spreads beneath the bark.',
    baseCost: new Decimal(BALANCE.GENERATOR_BASE_COSTS[1]),
    baseProduction: new Decimal(BALANCE.GENERATOR_BASE_PRODUCTION[1]),
  },
  {
    id: 'rhizomorph-cord',
    tier: 3,
    name: 'Rhizomorph Cord',
    flavor: 'Thick cables of tissue bridge rot and root.',
    baseCost: new Decimal(BALANCE.GENERATOR_BASE_COSTS[2]),
    baseProduction: new Decimal(BALANCE.GENERATOR_BASE_PRODUCTION[2]),
  },
  {
    id: 'sporocarp-cluster',
    tier: 4,
    name: 'Sporocarp Cluster',
    flavor: 'Fruiting bodies pulse with reproductive urgency.',
    baseCost: new Decimal(BALANCE.GENERATOR_BASE_COSTS[3]),
    baseProduction: new Decimal(BALANCE.GENERATOR_BASE_PRODUCTION[3]),
  },
  {
    id: 'fruiting-canopy',
    tier: 5,
    name: 'Fruiting Canopy',
    flavor: 'The canopy drips with spores. Photosynthesis is irrelevant.',
    baseCost: new Decimal(BALANCE.GENERATOR_BASE_COSTS[4]),
    baseProduction: new Decimal(BALANCE.GENERATOR_BASE_PRODUCTION[4]),
  },
  {
    id: 'decomposer-bloom',
    tier: 6,
    name: 'Decomposer Bloom',
    flavor: 'Entire forests collapse into nutrient slurry.',
    baseCost: new Decimal(BALANCE.GENERATOR_BASE_COSTS[5]),
    baseProduction: new Decimal(BALANCE.GENERATOR_BASE_PRODUCTION[5]),
  },
  {
    id: 'subterranean-nexus',
    tier: 7,
    name: 'Subterranean Nexus',
    flavor: 'Continents tremble. The deep network awakens.',
    baseCost: new Decimal(BALANCE.GENERATOR_BASE_COSTS[6]),
    baseProduction: new Decimal(BALANCE.GENERATOR_BASE_PRODUCTION[6]),
  },
  {
    id: 'planetary-membrane',
    tier: 8,
    name: 'Planetary Membrane',
    flavor: 'The biosphere is a single organism. Ours.',
    baseCost: new Decimal(BALANCE.GENERATOR_BASE_COSTS[7]),
    baseProduction: new Decimal(BALANCE.GENERATOR_BASE_PRODUCTION[7]),
  },
]

export const upgradeDefinitions: UpgradeDefinition[] = [
  {
    id: 'chitinous-reinforcement',
    name: 'Chitinous Reinforcement',
    cost: new Decimal(BALANCE.CHITINOUS_REINFORCEMENT_COST),
    description: 'Hyphae Strand production +18%.',
    requiredGenerator: 'hyphae-strand',
    requiredOwned: 5,
  },
  {
    id: 'exoenzyme-secretion',
    name: 'Exoenzyme Secretion',
    cost: new Decimal(BALANCE.EXOENZYME_SECRETION_COST),
    description: 'Tiers 1-3 gain +8% output, with stronger support for Rhizomorph scaling.',
    requiredGenerator: 'mycelial-mat',
    requiredOwned: 5,
  },
  {
    id: 'lateral-transfer',
    name: 'Lateral Transfer',
    cost: new Decimal(BALANCE.LATERAL_TRANSFER_COST),
    description: 'Click value x2. Sporocarp Cluster gains +20% output and a stronger Stage 3 carry bonus.',
    requiredGenerator: 'rhizomorph-cord',
    requiredOwned: 5,
  },
  {
    id: 'canopy-ventilation',
    name: 'Canopy Ventilation',
    cost: new Decimal(BALANCE.CANOPY_VENTILATION_COST),
    description: 'Fruiting Canopy production +8% while the host remains above 50% health.',
    requiredGenerator: 'fruiting-canopy',
    requiredOwned: 10,
  },
  {
    id: 'decomposer-surge',
    name: 'Decomposer Surge',
    cost: new Decimal(BALANCE.DECOMPOSER_SURGE_COST),
    description: 'Decomposer Bloom production +5%.',
    requiredGenerator: 'decomposer-bloom',
    requiredOwned: 10,
  },
  {
    id: 'nexus-overweave',
    name: 'Nexus Overweave',
    cost: new Decimal(BALANCE.NEXUS_OVERWEAVE_COST),
    description: 'Subterranean Nexus production +10% during active defense events.',
    requiredGenerator: 'subterranean-nexus',
    requiredOwned: 10,
  },
  {
    id: 'membrane-tension',
    name: 'Membrane Tension',
    cost: new Decimal(BALANCE.MEMBRANE_TENSION_COST),
    description: 'Planetary Membrane production +6% in Stage 8.',
    requiredGenerator: 'planetary-membrane',
    requiredOwned: 10,
  },
  {
    id: 'neural-propagation',
    name: 'Neural Propagation',
    cost: new Decimal(BALANCE.NEURAL_PROPAGATION_COST),
    description: 'Click value ×1.5. Absorption impulses propagate faster through saturated substrate.',
    requiredGenerator: 'decomposer-bloom',
    requiredOwned: 10,
  },
  {
    id: 'terminus-strike',
    name: 'Terminus Strike',
    cost: new Decimal(BALANCE.TERMINUS_STRIKE_COST),
    description: 'Click value ×2. Each manual strike now collapses planetary-scale tissue.',
    requiredGenerator: 'planetary-membrane',
    requiredOwned: 10,
  },
]

export const countermeasureDefinitions: CountermeasureDefinition[] = [
  {
    id: 'moisture-buffer',
    name: 'Moisture Buffer',
    description: 'Reduces Drought severity and stabilises dry-host collapse windows.',
    targetEventIds: ['drought'],
  },
  {
    id: 'brood-decoy',
    name: 'Brood Decoy',
    description: 'Converts Beetle Disruption into a softer colony-wide penalty instead of a full sever.',
    targetEventIds: ['beetle-disruption'],
  },
  {
    id: 'immune-mimicry',
    name: 'Immune Mimicry',
    description: 'Reduces Immune Response suppression by masking parts of the colony signature.',
    targetEventIds: ['immune-response'],
  },
]

export const strainDefinitions: StrainDefinition[] = [
  {
    id: 'parasite',
    name: 'Parasite',
    summary: 'Exploit the host with high click power and reduced passive spread.',
    clickModifier: BALANCE.STRAIN_PARASITE_CLICK_MULT,
    passiveModifier: BALANCE.STRAIN_PARASITE_PASSIVE_MULT,
    signature: 'Hemorrhagic Burst',
    lore:
      'The analysis is complete. Exploitation is the most efficient path. Every host is a resource to be spent.',
    locked: false,
  },
  {
    id: 'symbiote',
    name: 'Symbiote',
    summary: 'Abandon manual gathering and turn the colony into a passive engine.',
    clickModifier: BALANCE.STRAIN_SYMBIOTE_CLICK_MULT,
    passiveModifier: BALANCE.STRAIN_SYMBIOTE_PASSIVE_MULT,
    signature: 'Mycorrhizal Network',
    lore:
      'The analysis is complete. Integration yields superior long-term returns. The patient network wins.',
    locked: false,
  },
  {
    id: 'saprophyte',
    name: 'Saprophyte',
    summary: 'A prestige-locked balanced strain that feeds on inherited memory.',
    clickModifier: BALANCE.STRAIN_SAPROPHYTE_CLICK_MULT,
    passiveModifier: BALANCE.STRAIN_SAPROPHYTE_PASSIVE_MULT,
    signature: 'Decomposition Loop',
    lore:
      'The analysis is complete. Death is not an end state. Every fallen organism is a library. We will read them all.',
    locked: true,
  },
]

export const skillDefinitions: SkillDefinition[] = [
  {
    id: 'enzymatic-breakdown',
    name: 'Enzymatic Breakdown',
    branch: 'virulence',
    requiredStat: 1,
    cost: new Decimal(BALANCE.SKILL_COSTS['enzymatic-breakdown']),
    description: 'Acidic secretions increase passive spread by 10%.',
  },
  {
    id: 'acidic-secretion',
    name: 'Acidic Secretion',
    branch: 'virulence',
    requiredStat: 3,
    cost: new Decimal(BALANCE.SKILL_COSTS['acidic-secretion']),
    description: 'Click power gains another 20% multiplier.',
  },
  {
    id: 'hemorrhagic-spread',
    name: 'Hemorrhagic Spread',
    branch: 'virulence',
    requiredStat: 5,
    cost: new Decimal(BALANCE.SKILL_COSTS['hemorrhagic-spread']),
    description: 'Parasite bursts strike harder and all clicks gain 30% power.',
  },
  {
    id: 'chitin-shell',
    name: 'Chitin Shell',
    branch: 'resilience',
    requiredStat: 1,
    cost: new Decimal(BALANCE.SKILL_COSTS['chitin-shell']),
    description: 'Defense penalties are reduced further by 12%.',
  },
  {
    id: 'dormancy-protocol',
    name: 'Dormancy Protocol',
    branch: 'resilience',
    requiredStat: 3,
    cost: new Decimal(BALANCE.SKILL_COSTS['dormancy-protocol']),
    description: 'Offline gain efficiency rises by another 15%.',
  },
  {
    id: 'spore-hardening',
    name: 'Spore Hardening',
    branch: 'resilience',
    requiredStat: 5,
    cost: new Decimal(BALANCE.SKILL_COSTS['spore-hardening']),
    description: 'Passive output gains 10% while defense mitigation deepens.',
  },
  {
    id: 'quorum-recursion',
    name: 'Quorum Recursion',
    branch: 'complexity',
    requiredStat: 1,
    cost: new Decimal(BALANCE.SKILL_COSTS['quorum-recursion']),
    description: 'Generator synergies add another 8% passive output.',
  },
  {
    id: 'signal-amplification',
    name: 'Signal Amplification',
    branch: 'complexity',
    requiredStat: 3,
    cost: new Decimal(BALANCE.SKILL_COSTS['signal-amplification']),
    description: 'Upgrade effects gain another 5% strength.',
  },
  {
    id: 'distributed-cognition',
    name: 'Distributed Cognition',
    branch: 'complexity',
    requiredStat: 5,
    cost: new Decimal(BALANCE.SKILL_COSTS['distributed-cognition']),
    description: 'Passive output gains another 12% and scales better with the colony.',
  },
]

export const hostDefinitions: HostDefinition[] = [
  {
    stage: 1,
    name: 'Dead Leaf',
    stageLabel: 'Germination',
    subtitle: "The Leaf Doesn't Notice",
    health: new Decimal(BALANCE.HOST_HEALTH[0]),
    flavor: 'A dry autumn remnant. Fragile. The first meal.',
    threatLevel: 'low',
    defenseSignature: 'Brittle tissue. Minimal resistance.',
    transitionSignal: 'Capillary spread is enough. No complex response detected.',
  },
  {
    stage: 2,
    name: 'Rotting Log',
    stageLabel: 'Colonisation',
    subtitle: 'The Log Softens',
    health: new Decimal(BALANCE.HOST_HEALTH[1]),
    flavor: 'Bark splits. Beetles scatter. Ours now.',
    threatLevel: 'medium',
    defenseSignature: 'Insect disruption and moisture instability.',
    transitionSignal: 'Mass must be redirected into denser channels before bark collapse.',
  },
  {
    stage: 3,
    name: 'Forest Floor',
    stageLabel: 'Saturation',
    subtitle: 'The Soil Forgets Itself',
    health: new Decimal(BALANCE.HOST_HEALTH[2]),
    flavor: 'Entire square meters of soil rewritten.',
    threatLevel: 'medium',
    defenseSignature: 'Temperature fluctuation and broad competing colonies.',
    transitionSignal: 'Surface spread is no longer enough. Networked digestion required.',
  },
  {
    stage: 4,
    name: 'Ancient Oak',
    stageLabel: 'Penetration',
    subtitle: 'The Oak Remembers Resistance',
    health: new Decimal(BALANCE.HOST_HEALTH[3]),
    flavor: 'The tree resists. It has fought fungi before.',
    threatLevel: 'high',
    defenseSignature: 'Internal transport barriers and host memory responses.',
    transitionSignal: 'Woody resistance detected. Assimilation must tunnel through living structure.',
  },
  {
    stage: 5,
    name: 'Forest System',
    stageLabel: 'Convergence',
    subtitle: 'The Forest Stops Communicating',
    health: new Decimal(BALANCE.HOST_HEALTH[4]),
    flavor: 'The mycorrhizal network of a thousand trees. Absorb it.',
    threatLevel: 'high',
    defenseSignature: 'Distributed immune signaling across multiple organisms.',
    transitionSignal: 'Single-host logic fails here. The colony must act as a system.',
  },
  {
    stage: 6,
    name: 'Watershed',
    stageLabel: 'Diffusion',
    subtitle: 'The Water Carries Us Now',
    health: new Decimal(BALANCE.HOST_HEALTH[5]),
    flavor: 'Water carries the signal now.',
    threatLevel: 'high',
    defenseSignature: 'Hydraulic flushing and long-range contamination pressure.',
    transitionSignal: 'Fluid dynamics rewrite the battlefield. Persistence outruns precision.',
  },
  {
    stage: 7,
    name: 'Continental Soil',
    stageLabel: 'Dominance',
    subtitle: 'The Ground Is Ours',
    health: new Decimal(BALANCE.HOST_HEALTH[6]),
    flavor: 'Continents are just substrate.',
    threatLevel: 'extreme',
    defenseSignature: 'Planet-scale competitors and ecosystem-wide suppression.',
    transitionSignal: 'Local dominance is irrelevant. The colony must think in biomes.',
  },
  {
    stage: 8,
    name: 'The Biosphere',
    stageLabel: 'Terminus',
    subtitle: 'There Is No Host Remaining',
    health: new Decimal(BALANCE.HOST_HEALTH[7]),
    flavor: 'Final Stage. The organism becomes the planet.',
    threatLevel: 'extreme',
    defenseSignature: 'Total ecological backlash. Every system resists at once.',
    transitionSignal: 'No higher host remains. Collapse here feeds the release loop.',
  },
]

export const hostEchoDefinitions: HostEchoDefinition[] = [
  {
    id: 'aggressive',
    name: 'Predatory Instinct',
    description: 'You tore through the host in a frenzy of consumption.',
    bonus: { type: 'clickMultiplier', value: BALANCE.HOST_ECHO_BONUS_AGGRESSIVE },
  },
  {
    id: 'efficient',
    name: 'Optimized Metabolism',
    description: 'You balanced active assault with passive growth.',
    bonus: { type: 'passiveMultiplier', value: BALANCE.HOST_ECHO_BONUS_EFFICIENT },
  },
  {
    id: 'resilient',
    name: 'Stress Hardening',
    description: 'You thrived despite active defense events.',
    bonus: { type: 'defenseMitigation', value: BALANCE.HOST_ECHO_BONUS_RESILIENT },
  },
  {
    id: 'patient',
    name: 'Dormant Potential',
    description: 'You allowed the mycelium to grow undisturbed.',
    bonus: { type: 'maxSignal', value: BALANCE.HOST_ECHO_BONUS_PATIENT },
  },
]

// ============================================================================
// HELPER FUNCTIONS (pure lookups, no side effects)
// ============================================================================

export function getCurrentHostDefinition(state: GameState): HostDefinition {
  const definition = hostDefinitions.find((entry) => entry.stage === state.currentStage)
  if (!definition) {
    throw new Error(`Unknown host stage: ${state.currentStage}`)
  }
  return definition
}

export function getThreatLevelLabel(level: HostDefinition['threatLevel']): string {
  return level.toUpperCase()
}

export function hasNextStage(state: GameState): boolean {
  return state.currentStage < hostDefinitions.length
}
