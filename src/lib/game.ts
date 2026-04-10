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
  | 'mycorrhizal-interference'
  | 'allelopathic-warfare'
  | 'zone-reclamation'
  | 'spore-trap'
  | 'fungicide-spray'
  | 'soil-fumigation'
  | 'biocontrol-application'
  | 'resistance-breaker'
  | 'quarantine-protocol'
  | 'research-crackdown'
  | 'public-awareness-campaign'
  | 'regulatory-crackdown'
  | 'atmospheric-collapse'
  | 'hydrological-breakdown'
  | 'geochemical-disruption'
  | 'mass-extinction-pulse'
  | 'tectonic-response'
  | 'solar-isolation'
export type CountermeasureId =
  | 'moisture-buffer'
  | 'chitin-lattice'
  | 'enzyme-suppressor'
  | 'thermal-regulator'
  | 'signal-jammer'
  | 'spore-shield'
export type ProactiveCountermeasureId = 'preemptive-enzyme' | 'preemptive-biofilm' | 'preemptive-signal' | 'preemptive-quorum'
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

export type HostId = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11'

export type DefenseEventProfile =
  | 'none'
  | 'basic'
  | 'clustered'
  | 'rare_high_impact'
  | 'time_sensitive'
  | 'countermeasure_charges'
  | 'environmental'
  | 'rival_network'
  | 'chemical'
  | 'human_countermeasures'
  | 'extinction_class'

export type WinCondition = 'healthToZero' | 'integrationMeter'

export interface ZoneDefinition {
  id: string
  name: string
  healthPercent: number
  unlockThreshold?: number
}

export interface HostDefinition {
  stage: number
  hostId: HostId
  name: string
  stageLabel: string
  subtitle: string
  flavorQuote: string
  health: Decimal
  flavor: string
  threatLevel: 'low' | 'medium' | 'high' | 'extreme'
  defenseSignature: string
  transitionSignal: string
  zones: ZoneDefinition[]
  defenseEventProfile: DefenseEventProfile
  activeAttackAvailable: boolean
  winCondition: WinCondition
}

export interface ActiveDefenseEvent {
  id: DefenseEventId
  name: string
  description: string
  endsAt: number
  multiplier: Decimal
  clickMultiplier?: Decimal
  disabledGeneratorId?: GeneratorId
  tier?: 1 | 2
  isGrindable?: boolean
  chargeCost?: number
}

export interface ZoneState {
  id: string
  name: string
  health: Decimal
  maxHealth: Decimal
  isUnlocked: boolean
  compromisePercent: number
  isRivalControlled?: boolean
  rivalControlEndAt?: number
}

export interface HostStressState {
  currentStress: number
  lastAttackTime: number
}

export interface SeasonalState {
  currentSeason: 'spring' | 'summer' | 'autumn' | 'winter'
  seasonStartTime: number
  seasonIndex: number
}

export interface RivalNetworkState {
  isSuppressing: boolean
  suppressionEndAt: number
  activeNodes: string[]
}

export interface IntegrationZoneState {
  zoneId: string
  saturationPercent: number
  isLocked: boolean
  contributionRate: number
}

export interface ActiveAttackState {
  isActive: boolean
  zoneId: string | null
  endsAt: number
  bpsBonusMultiplier: number
  cooldownEndAt: number
}

export interface IntegrationPulseState {
  isActive: boolean
  endsAt: number
  bpsBonusMultiplier: number
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
  flavorLine: string
  targetEventIds: DefenseEventId[]
  partialEventIds: DefenseEventId[]
  uiAccentColor: string
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

export interface GeneticMemoryStats {
  /** How many prestige runs have contributed to genetic memory */
  prestigeContributions: number
  /** Total flat bonus to all stat effectiveness (accumulated from past prestiges) */
  accumulatedBonus: number
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
  geneticMemoryStats: GeneticMemoryStats
  nextMycorrhizalPulseAt: number | null
  zones: ZoneState[]
  currentHostId: HostId
  enzymeReserves: number
  hostStress: HostStressState
  seasonalState: SeasonalState | null
  rivalNetworkState: RivalNetworkState | null
  integrationZones: IntegrationZoneState[]
  integrationMeter: number
  activeAttack: ActiveAttackState | null
  integrationPulse: IntegrationPulseState | null
  vectorProgress: number
  activeGrindSession: {
    eventCount: number
    windowStartTime: number
  } | null
  runGrindEventCount: number
  proactiveCountermeasure: ProactiveCountermeasureId | null
  proactiveCountermeasureEndAt: number
  tier2ScanActive: boolean
  tier2ScannedEventId: DefenseEventId | null
  tier2PreemptiveSet: boolean
  supplyChainBonusActive: boolean
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
    description: 'Full: Drought, Desiccation Pulse. Partial: Cold Snap, Antifungal Exudates.',
    flavorLine: 'Hydric reserves pressurized. Network humidity stabilized.',
    targetEventIds: ['drought', 'desiccation-pulse'],
    partialEventIds: ['cold-snap', 'antifungal-exudates'],
    uiAccentColor: '#1a4a6a',
  },
  {
    id: 'chitin-lattice',
    name: 'Chitin Lattice',
    description: 'Full: Beetle Disruption, Insect Vector Swarm. Partial: Lignin Fortification, Spore Predation.',
    flavorLine: 'Structural polymers reinforcing critical network junctions.',
    targetEventIds: ['beetle-disruption', 'insect-vector-swarm'],
    partialEventIds: ['lignin-fortification', 'spore-predation'],
    uiAccentColor: '#3a2a0a',
  },
  {
    id: 'enzyme-suppressor',
    name: 'Enzyme Suppressor',
    description: 'Full: Antifungal Exudates, Microbial Rivalry, Nutrient Sequestration. Partial: Viral Hijack, Root Allelopathy.',
    flavorLine: 'Secondary metabolite inhibitors deployed. Chemical hostility suppressed.',
    targetEventIds: ['antifungal-exudates', 'microbial-rivalry', 'nutrient-sequestration'],
    partialEventIds: ['viral-hijack', 'root-allelopathy'],
    uiAccentColor: '#1a3a1a',
  },
  {
    id: 'thermal-regulator',
    name: 'Thermal Regulator',
    description: 'Full: Cold Snap, Thermal Stratification, UV Surge. Partial: Desiccation Pulse, Ecosystem Feedback.',
    flavorLine: 'Metabolic heat distribution active. Thermal gradient neutralized.',
    targetEventIds: ['cold-snap', 'thermal-stratification', 'uv-surge'],
    partialEventIds: ['desiccation-pulse', 'ecosystem-feedback'],
    uiAccentColor: '#3a1a0a',
  },
  {
    id: 'signal-jammer',
    name: 'Signal Jammer',
    description: 'Full: Immune Response, Spore Competition, Ecosystem Feedback. Partial: Viral Hijack, Microbial Rivalry.',
    flavorLine: 'Colony signature masked. Host targeting resolution degraded.',
    targetEventIds: ['immune-response', 'spore-competition', 'ecosystem-feedback'],
    partialEventIds: ['viral-hijack', 'microbial-rivalry'],
    uiAccentColor: '#2a1a3a',
  },
  {
    id: 'spore-shield',
    name: 'Spore Shield',
    description: 'Full: Spore Predation, Lignin Fortification, Root Allelopathy. Partial: Insect Vector Swarm, Nutrient Sequestration.',
    flavorLine: 'Reproductive tissue encased. Feeding margins reinforced.',
    targetEventIds: ['spore-predation', 'lignin-fortification', 'root-allelopathy'],
    partialEventIds: ['insect-vector-swarm', 'nutrient-sequestration'],
    uiAccentColor: '#1a3a2a',
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
    hostId: '01',
    name: 'The Fallen Leaf',
    stageLabel: 'Decomposer',
    subtitle: 'It begins here. It always begins here.',
    flavorQuote: 'It begins here. It always begins here.',
    health: new Decimal(BALANCE.HOST_HEALTH[0]),
    flavor: 'A dry oak leaf on a forest floor. Decomposition is not violence. It is return.',
    threatLevel: 'low',
    defenseSignature: 'None. Host has no immune response.',
    transitionSignal: 'Capillary spread is enough. No complex response detected.',
    zones: [
      { id: 'leaf_surface', name: 'Leaf Surface', healthPercent: 100 },
    ],
    defenseEventProfile: 'none',
    activeAttackAvailable: false,
    winCondition: 'healthToZero',
  },
  {
    stage: 2,
    hostId: '02',
    name: 'The Woodlouse',
    stageLabel: 'Decomposer',
    subtitle: 'The first living thing. It does not understand what has found it.',
    flavorQuote: 'The first living thing. It does not understand what has found it.',
    health: new Decimal(BALANCE.HOST_HEALTH[1]),
    flavor: 'Armadillidium vulgare. The pill woodlouse has lived alongside fungi its entire life. It is not afraid. It should be.',
    threatLevel: 'low',
    defenseSignature: 'Slow, weak immune response.',
    transitionSignal: 'The first lesson: persistence outlasts defense.',
    zones: [
      { id: 'carapace', name: 'Carapace', healthPercent: 100 },
    ],
    defenseEventProfile: 'basic',
    activeAttackAvailable: false,
    winCondition: 'healthToZero',
  },
  {
    stage: 3,
    hostId: '03',
    name: 'The Ant Colony',
    stageLabel: 'Parasite',
    subtitle: 'One mind in ten thousand bodies. The mycelium recognises something familiar.',
    flavorQuote: 'One mind in ten thousand bodies. The mycelium recognises something familiar.',
    health: new Decimal(BALANCE.HOST_HEALTH[2]),
    flavor: 'Ophiocordyceps-adjacent ant colony. Distributed intelligence, collective defense, emergent behaviour from simple rules. The mycelium has been doing this since before ants existed.',
    threatLevel: 'medium',
    defenseSignature: 'Coordinated defense, Queen Node boss mechanic.',
    transitionSignal: 'Compromising the Queen Node is not conquest. It is a conversation that only one party survives.',
    zones: [
      { id: 'outer_colony', name: 'Outer Colony', healthPercent: 60 },
      { id: 'queen_node', name: 'Queen Node', healthPercent: 40, unlockThreshold: 0.6 },
    ],
    defenseEventProfile: 'clustered',
    activeAttackAvailable: false,
    winCondition: 'healthToZero',
  },
  {
    stage: 4,
    hostId: '04',
    name: 'The Rotting Elm',
    stageLabel: 'Parasite',
    subtitle: 'The tree has been dying for thirty years. The mycelium simply agrees.',
    flavorQuote: 'The tree has been dying for thirty years. The mycelium simply agrees.',
    health: new Decimal(BALANCE.HOST_HEALTH[3]),
    flavor: 'Ulmus procera. Ancient, vast, already in decline. The elm is not a victim. It is a transition.',
    threatLevel: 'high',
    defenseSignature: 'Rare but high-impact defense events.',
    transitionSignal: 'Active attacks are born not from aggression but from understanding.',
    zones: [
      { id: 'bark_layer', name: 'Bark Layer', healthPercent: 50 },
      { id: 'heartwood', name: 'Heartwood', healthPercent: 50, unlockThreshold: 0.5 },
    ],
    defenseEventProfile: 'rare_high_impact',
    activeAttackAvailable: true,
    winCondition: 'healthToZero',
  },
  {
    stage: 5,
    hostId: '05',
    name: 'The Corvid',
    stageLabel: 'Pathogen',
    subtitle: 'Warm. Fast. Afraid. The mycelium has not encountered fear before.',
    flavorQuote: 'Warm. Fast. Afraid. The mycelium has not encountered fear before.',
    health: new Decimal(BALANCE.HOST_HEALTH[4]),
    flavor: 'Corvus corone. The crow knows something is wrong. Its behaviour changes. The mycelium learns that consciousness is just another defense mechanism.',
    threatLevel: 'high',
    defenseSignature: 'Fast immune response, time-sensitive events, stress cascade.',
    transitionSignal: "The crow's intelligence becomes the very thing that spreads the network faster.",
    zones: [
      { id: 'peripheral_tissue', name: 'Peripheral Tissue', healthPercent: 40 },
      { id: 'circulatory', name: 'Circulatory', healthPercent: 30, unlockThreshold: 0.4 },
      { id: 'neural', name: 'Neural', healthPercent: 30, unlockThreshold: 0.7 },
    ],
    defenseEventProfile: 'time_sensitive',
    activeAttackAvailable: true,
    winCondition: 'healthToZero',
  },
  {
    stage: 6,
    hostId: '06',
    name: 'The Boar',
    stageLabel: 'Pathogen',
    subtitle: 'It carries the mycelium through the forest like a gift it does not know it is giving.',
    flavorQuote: 'It carries the mycelium through the forest like a gift it does not know it is giving.',
    health: new Decimal(BALANCE.HOST_HEALTH[5]),
    flavor: 'Sus scrofa. The boar roots through the same soil the mycelium has already threaded. For the first time, the mycelium spreads beyond its host while still inside it.',
    threatLevel: 'high',
    defenseSignature: 'Countermeasure charges system, host-as-vector.',
    transitionSignal: 'Hosts are not just resources. They are infrastructure.',
    zones: [
      { id: 'gut', name: 'Gut', healthPercent: 35 },
      { id: 'circulatory', name: 'Circulatory', healthPercent: 35 },
      { id: 'neural', name: 'Neural', healthPercent: 30 },
    ],
    defenseEventProfile: 'countermeasure_charges',
    activeAttackAvailable: true,
    winCondition: 'healthToZero',
  },
  {
    stage: 7,
    hostId: '07',
    name: 'The River Network',
    stageLabel: 'Ecological Force',
    subtitle: 'No heartbeat. No immune system. Just flow. The mycelium learns to move like water.',
    flavorQuote: 'No heartbeat. No immune system. Just flow. The mycelium learns to move like water.',
    health: new Decimal(BALANCE.HOST_HEALTH[6]),
    flavor: 'A watershed. A drainage basin. The first host without a body. Defense here is ecological.',
    threatLevel: 'high',
    defenseSignature: 'Environmental events, seasonal cycle.',
    transitionSignal: 'Some systems can only be compromised from within, slowly, over years.',
    zones: [
      { id: 'tributary_network', name: 'Tributary Network', healthPercent: 33 },
      { id: 'main_channel', name: 'Main Channel', healthPercent: 34 },
      { id: 'aquifer', name: 'Aquifer', healthPercent: 33 },
    ],
    defenseEventProfile: 'environmental',
    activeAttackAvailable: true,
    winCondition: 'healthToZero',
  },
  {
    stage: 8,
    hostId: '08',
    name: 'The Old-Growth Forest',
    stageLabel: 'Ecological Force',
    subtitle: 'It knows. Not the way the crow knew. It knows the way the mycelium knows. With threads.',
    flavorQuote: 'It knows. Not the way the crow knew. With fear. It knows the way the mycelium knows. With threads.',
    health: new Decimal(BALANCE.HOST_HEALTH[7]),
    flavor: "The Wood Wide Web. The first peer the mycelium has ever encountered. This is not predator and prey. This is succession.",
    threatLevel: 'extreme',
    defenseSignature: 'Rival network uses player own tools against them.',
    transitionSignal: "Winning here is not victory. It is inheritance.",
    zones: [
      { id: 'root_periphery', name: 'Root Periphery', healthPercent: 25 },
      { id: 'canopy_interface', name: 'Canopy Interface', healthPercent: 25 },
      { id: 'deep_network', name: 'Deep Network', healthPercent: 25 },
      { id: 'heartroot', name: 'Heartroot', healthPercent: 25, unlockThreshold: 0.5 },
    ],
    defenseEventProfile: 'rival_network',
    activeAttackAvailable: true,
    winCondition: 'healthToZero',
  },
  {
    stage: 9,
    hostId: '09',
    name: 'The Agricultural System',
    stageLabel: 'Planetary Intelligence',
    subtitle: 'Humans built a perfect machine for fungal spread and called it farming.',
    flavorQuote: 'Humans built a perfect machine for fungal spread and called it farming.',
    health: new Decimal(BALANCE.HOST_HEALTH[8]),
    flavor: 'Monocultures are biological vulnerability at industrial scale. Ten thousand kilometres of genetically identical substrate.',
    threatLevel: 'extreme',
    defenseSignature: 'Chemical defense, supply chain spread mechanic.',
    transitionSignal: 'Every truck, every shipment, every market is a new vector.',
    zones: [
      { id: 'field_substrate', name: 'Field Substrate', healthPercent: 25 },
      { id: 'storage_facilities', name: 'Storage Facilities', healthPercent: 25 },
      { id: 'processing_network', name: 'Processing Network', healthPercent: 25 },
      { id: 'distribution_chain', name: 'Distribution Chain', healthPercent: 25 },
    ],
    defenseEventProfile: 'chemical',
    activeAttackAvailable: true,
    winCondition: 'healthToZero',
  },
  {
    stage: 10,
    hostId: '10',
    name: 'The Urban Microbiome',
    stageLabel: 'Planetary Intelligence',
    subtitle: 'Eight billion hosts, each one a network. The mycelium finally understands what it is becoming.',
    flavorQuote: 'Eight billion hosts, each one a network. The mycelium finally understands what it is becoming.',
    health: new Decimal(BALANCE.HOST_HEALTH[9]),
    flavor: 'The soil microbiome under every park, the water systems, the eight billion human microbiomes. The mycelium is not attacking humans. It is weaving itself into the substrate they rest on.',
    threatLevel: 'extreme',
    defenseSignature: 'Human countermeasures, multi-front events, Research Institutions zone.',
    transitionSignal: 'Defense is coordinated, targeted, backed by human scientific knowledge. It is also too late.',
    zones: [
      { id: 'urban_soil', name: 'Urban Soil', healthPercent: 20 },
      { id: 'water_infrastructure', name: 'Water Infrastructure', healthPercent: 20 },
      { id: 'food_systems', name: 'Food Systems', healthPercent: 20 },
      { id: 'human_carriers', name: 'Human Carriers', healthPercent: 20 },
      { id: 'research_institutions', name: 'Research Institutions', healthPercent: 20 },
    ],
    defenseEventProfile: 'human_countermeasures',
    activeAttackAvailable: true,
    winCondition: 'healthToZero',
  },
  {
    stage: 11,
    hostId: '11',
    name: 'The Biosphere',
    stageLabel: 'Integration',
    subtitle: 'There is no host. There is no mycelium. There is only the Protocol.',
    flavorQuote: 'There is no host. There is no mycelium. There is only the Protocol.',
    health: new Decimal(BALANCE.HOST_HEALTH[10]),
    flavor: 'The final transition is not conquest. The biosphere does not fall. It integrates. The planet does not die. It remembers what it always was.',
    threatLevel: 'extreme',
    defenseSignature: 'All previous event types, Extinction-class events.',
    transitionSignal: 'The network becomes so thoroughly woven into planetary processes that the distinction dissolves.',
    zones: [
      { id: 'atmosphere', name: 'Atmosphere', healthPercent: 16.67 },
      { id: 'hydrosphere', name: 'Hydrosphere', healthPercent: 16.67 },
      { id: 'lithosphere', name: 'Lithosphere', healthPercent: 16.67 },
      { id: 'biotic_layer', name: 'Biotic Layer', healthPercent: 16.67 },
      { id: 'technosphere', name: 'Technosphere', healthPercent: 16.67 },
      { id: 'noosphere', name: 'Noosphere', healthPercent: 16.67 },
    ],
    defenseEventProfile: 'extinction_class',
    activeAttackAvailable: true,
    winCondition: 'integrationMeter',
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

export function getHostDefinitionById(hostId: HostId): HostDefinition | undefined {
  return hostDefinitions.find((entry) => entry.hostId === hostId)
}

export function getThreatLevelLabel(level: HostDefinition['threatLevel']): string {
  return level.toUpperCase()
}

export function hasNextStage(state: GameState): boolean {
  return state.currentStage < hostDefinitions.length
}

export function getZoneById(state: GameState, zoneId: string): ZoneState | undefined {
  return state.zones.find(z => z.id === zoneId)
}

export function getActiveZones(state: GameState): ZoneState[] {
  return state.zones.filter(z => z.isUnlocked)
}

export function getUnlockedZoneCount(state: GameState): number {
  return state.zones.filter(z => z.isUnlocked).length
}

export function isHostCompleted(state: GameState): boolean {
  if (state.currentStage === 11) {
    return state.integrationMeter >= BALANCE.HOSTS['11'].integrationMeter.maxValue
  }
  return state.zones.every(z => z.isUnlocked && z.compromisePercent >= 100)
}
