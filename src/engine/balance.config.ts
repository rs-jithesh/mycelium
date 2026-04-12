/**
 * balance.config.ts
 * THE ONLY FILE WHERE TUNABLE CONSTANTS LIVE.
 * No imports. No functions. No Decimal objects. No conditional logic.
 * Plain numbers and arrays only.
 */

export const BALANCE = {

  // Game tick interval in milliseconds
  TICK_MS: 100,

  // ─────────────────────────────────────────────
  // SIGNAL ECONOMY
  // All Signal-related tunable constants.
  // This codebase uses 1-indexed stages, so Stage 3 unlocks at 3.
  // ─────────────────────────────────────────────

  SIGNAL: {

    // Base production rate — Signal units per second at Stage 3 unlock
    BASE_PRODUCTION_PER_SECOND: 0.15,

    // Production scales with stage beyond Stage 3
    PRODUCTION_PER_STAGE_BONUS: 0.08,

    // Decay — Signal lost per second when above DECAY_THRESHOLD
    DECAY_RATE_PER_SECOND: 0.08,
    DECAY_THRESHOLD: 0.70,

    // Overspend penalty — applied when Signal drops below PENALTY_THRESHOLD
    PENALTY_THRESHOLD: 0.10,
    PENALTY_BPS_MULTIPLIER: 0.85,
    PENALTY_RECOVERY_RATE: 0.15,

    // Base cap — maximum Signal storable
    BASE_CAP: 8,

    // Complexity stat bonuses
    COMPLEXITY_CAP_BONUS_PER_POINT: 1.5,
    COMPLEXITY_DECAY_REDUCTION_PER_POINT: 0.005,

    // Strain modifiers
    STRAIN_SYMBIOTE_PRODUCTION_MULT: 1.5,
    STRAIN_PARASITE_CAP_PENALTY: 0.75,
    STRAIN_SAPROPHYTE_DECAY_MULT: 0.60,

    // Signal spend costs
    COST_COORDINATION_COMMAND: 2,
    COST_VULNERABILITY_WINDOW: 4,
    COST_RIVAL_SUPPRESSION: 5,
    COST_NETWORK_ISOLATION: 3,

    // Coordination command duration
    COORDINATION_DURATION_MS: 30 * 1000,
    COORDINATION_BOOST_MULTIPLIER: 2.0,

    // Vulnerability window
    VULNERABILITY_DURATION_MS: 30 * 1000,
    VULNERABILITY_DAMAGE_MULT: 3.0,

    // Rival suppression
    SUPPRESSION_COOLDOWN_OVERRIDE_MS: 15 * 60 * 1000,

    // Unlock (1-indexed in this codebase)
    UNLOCK_STAGE: 3,
  },

  // Auto-save interval in milliseconds (30 seconds)
  SAVE_INTERVAL_MS: 30_000,

  // localStorage key for save data
  STORAGE_KEY: 'mycelium-protocol-save',

  // Maximum number of log entries to keep
  LOG_LIMIT: 24,

  // Maximum offline time cap in milliseconds (3 hours)
  OFFLINE_CAP_MS: 3 * 60 * 60 * 1000,

  // Base offline efficiency (100% of normal production)
  BASE_OFFLINE_EFFICIENCY: 1.0,

  // Dormancy Protocol skill offline efficiency bonus (+15%)
  DORMANCY_PROTOCOL_OFFLINE_BONUS: 0.15,

  // Resilience >= 3 offline efficiency bonus (+10%)
  RESILIENCE_OFFLINE_BONUS: 0.1,

  // Generator cost scaling exponent — high enough that each purchase matters
  GENERATOR_COST_EXPONENT: 1.28,

  // Generator base costs (index 0 = Tier 1: Hyphae Strand)
  // Index 7 = Lithospheric Web, index 8 = Atmospheric Drift, index 9 = Oceanic Threadwork, index 10 = Planetary Membrane
  GENERATOR_BASE_COSTS: [
    6, 50, 400, 4_000,
    30_000, 250_000, 2_000_000, 15_000_000,
    120_000_000, 1_000_000_000, 9_000_000_000,
  ],

  // Generator base production per second (index 0 = Tier 1)
  GENERATOR_BASE_PRODUCTION: [
    0.008, 0.04, 0.2, 1,
    5, 25, 120, 600,
    3_000, 15_000, 80_000,
  ],

  // Previous-tier ownership needed to reveal the next generator tier
  GENERATOR_UNLOCK_THRESHOLDS: [0, 6, 6, 6, 8, 7, 6, 5, 4, 4, 3],

  // Tier 4 unlocks when Stage 2 host progress >= this value (0–100 scale)
  TIER4_STAGE2_HOST_PROGRESS_GATE: 0,

  // Stage gate: minimum stage that must be active before this tier is visible
  // (0 = no stage gate). Tier 9 unlocks at Stage 7, tier 10 at Stage 9, tier 11 at Stage 11.
  GENERATOR_STAGE_GATES: [0, 0, 1, 2, 2, 3, 4, 5, 7, 9, 11],

  // Genetic Memory prestige threshold (minimum lifetime biomass to earn any Gamma)
  GENETIC_MEMORY_DIVISOR: 5e11,

  // Genetic Memory gain exponent. Lower values slow permanent scaling hard in the late game.
  GENETIC_MEMORY_GAIN_EXPONENT: 0.18,

  // Genetic Memory bonus per Gamma — lowered from 0.005 to slow permanent scaling
  GENETIC_MEMORY_BONUS_PER_GAMMA: 0.003,

  // Strain modifiers
  STRAIN_PARASITE_CLICK_MULT: 5,
  STRAIN_PARASITE_PASSIVE_MULT: 0.5,
  STRAIN_SYMBIOTE_CLICK_MULT: 0,
  STRAIN_SYMBIOTE_PASSIVE_MULT: 2,
  STRAIN_SAPROPHYTE_CLICK_MULT: 1.5,
  STRAIN_SAPROPHYTE_PASSIVE_MULT: 1.5,

  // Defense event trigger cooldown in milliseconds
  DEFENSE_EVENT_COOLDOWN_MS: 90_000,

  // Average interval for random defense flavor logs while events are active.
  DEFENSE_CREEP_LOG_MEAN_INTERVAL_MS: 45_000,

  // Average interval for ambient resistance flavor logs between active events.
  DEFENSE_AMBIENT_LOG_MEAN_INTERVAL_MS: 120_000,

  // Defense event trigger chance: min(MAX, BASE + (stage-1) * PER_STAGE)
  DEFENSE_EVENT_TRIGGER_MAX: 0.60,
  DEFENSE_EVENT_TRIGGER_BASE: 0.22,
  DEFENSE_EVENT_TRIGGER_PER_STAGE: 0.04,

  // Defense control
  DEFENSE_FORECAST_UNLOCK_STAGE: 2,

  // Defense forecast warning window in milliseconds.
  // When the next defense check is within this window, the UI shows the
  // incoming threat name and a countdown. Note: the event may not trigger
  // (random roll can fail) — UI must communicate uncertainty, not certainty.
  DEFENSE_FORECAST_WARNING_MS: 30_000,
  COUNTERMEASURE_MOISTURE_BUFFER_MITIGATION: 0.15,
  COUNTERMEASURE_IMMUNE_MIMICRY_MITIGATION: 0.18,
  COUNTERMEASURE_BROOD_DECOY_FALLBACK_MULTIPLIER: 0.78,

  // ─── COUNTERMEASURE TIER SYSTEM ───────────────────────────────────────────
  // Full coverage: equipped protocol directly targets this event
  COUNTERMEASURE_FULL_MITIGATION: 0.70,

  // Partial coverage: adjacent protocol partially covers this event
  COUNTERMEASURE_PARTIAL_MITIGATION: 0.30,

  // Resilience stat bonus stacks additively on top of tier mitigation
  // At Resilience 5: +0.05 × 5 = +0.25 additional mitigation
  COUNTERMEASURE_RESILIENCE_BONUS_PER_POINT: 0.05,

  // Hard cap — mitigation never exceeds this regardless of bonuses
  // At max investment (full + Resilience 5 + Chitin Shell + Spore Hardening):
  // 0.70 + 0.25 + 0.12 + 0.08 = 1.15 → capped at 0.90
  // Some penalty always reaches the player. This is intentional.
  COUNTERMEASURE_TIER_MITIGATION_CAP: 0.90,

  STRAIN_SYMBIOTE_ACTIVE_DEFENSE_MITIGATION_BONUS: 0.06,
  STRAIN_PARASITE_DEFENSE_BURST_MS: 12_000,
  STRAIN_PARASITE_DEFENSE_BURST_CLICK_MULT: 1.5,
  // Saprophyte recovery: fraction of production lost during an event that is
  // reclaimed on expiry. Replaces STRAIN_SAPROPHYTE_DEFENSE_RECOVERY_SECONDS.
  STRAIN_SAPROPHYTE_DEFENSE_RECOVERY_FRACTION: 0.25,

  // Defense mitigation: resilience reduces penalty severity
  DEFENSE_MITIGATION_PER_RESILIENCE: 0.08,
  DEFENSE_MITIGATION_MAX_FROM_RESILIENCE: 0.6,
  DEFENSE_MITIGATION_CAP: 0.8,

  // Chitin Shell skill defense mitigation bonus
  CHITIN_SHELL_MITIGATION_BONUS: 0.12,

  // Spore Hardening skill defense mitigation bonus
  SPORE_HARDENING_MITIGATION_BONUS: 0.08,

  // Virulence click bonus per point (15%)
  VIRULENCE_CLICK_BONUS_PER_POINT: 0.15,

  // Virulence threshold bonus at >= 3 (25%)
  VIRULENCE_THRESHOLD_BONUS: 1.25,

  // Complexity passive bonus per point (5%)
  COMPLEXITY_PASSIVE_BONUS_PER_POINT: 0.05,

  // Complexity upgrade-effectiveness bonus per point (2%)
  COMPLEXITY_UPGRADE_EFFECTIVENESS_PER_POINT: 0.02,

  // Enzymatic Breakdown skill passive bonus (10%)
  ENZYMATIC_BREAKDOWN_PASSIVE_BONUS: 1.1,

  // Quorum Recursion skill passive bonus (8%)
  QUORUM_RECURSION_PASSIVE_BONUS: 1.08,

  // Distributed Cognition skill passive bonus (12%)
  DISTRIBUTED_COGNITION_PASSIVE_BONUS: 1.12,

  // Spore Hardening skill passive bonus (10%)
  SPORE_HARDENING_PASSIVE_BONUS: 1.1,

  // Signal Amplification upgrade effectiveness multiplier (5%)
  SIGNAL_AMPLIFICATION_EFFECTIVENESS_MULTIPLIER: 1.05,

  // Upgrade tuning. Keep broad effects modest so they do not erase tier pacing.
  CHITINOUS_REINFORCEMENT_COST: 400,
  CHITINOUS_REINFORCEMENT_BASE_BONUS: 0.12,
  EXOENZYME_SECRETION_COST: 30_000,
  EXOENZYME_SECRETION_BASE_BONUS: 0.05,
  EXOENZYME_SECRETION_MAX_TIER: 3,
  LATERAL_TRANSFER_COST: 500_000,
  LATERAL_TRANSFER_CLICK_MULTIPLIER: 1.35,
  LATERAL_TRANSFER_TIER4_BASE_BONUS: 0.3,
  LATERAL_TRANSFER_TIER4_STAGE3_BONUS: 0.8,
  RHIZOMORPH_LOWER_TIER_SCALING_PER_OWNED: 0.015,
  RHIZOMORPH_LOWER_TIER_SCALING_CAP: 2.5,
  SPOROCARP_STAGE3_CARRY_BONUS: 0.35,
  CANOPY_VENTILATION_COST: 5e12,
  CANOPY_VENTILATION_BASE_BONUS: 0.08,
  CANOPY_VENTILATION_HOST_HEALTH_THRESHOLD: 0.5,
  DECOMPOSER_SURGE_COST: 8e16,
  DECOMPOSER_SURGE_BASE_BONUS: 0.05,
  NEXUS_OVERWEAVE_COST: 2e22,
  NEXUS_OVERWEAVE_BASE_BONUS: 0.1,
  MEMBRANE_TENSION_COST: 5e27,
  MEMBRANE_TENSION_BASE_BONUS: 0.06,

  // Acidic Secretion click bonus (20%)
  ACIDIC_SECRETION_CLICK_BONUS: 1.2,

  // Hemorrhagic Spread click bonus (30%)
  HEMORRHAGIC_SPREAD_CLICK_BONUS: 1.3,

  // Parasite Hemorrhagic Burst click multiplier (base 5x, with skill 6.5x)
  PARASITE_BURST_CLICK_THRESHOLD: 50,
  PARASITE_BURST_MULTIPLIER: 5,
  PARASITE_BURST_MULTIPLIER_WITH_SKILL: 6.5,

  // Symbiote scaling: 0.025% per other owned generator
  SYMBIOTE_SCALING_PER_OTHER: 0.00025,

  // ═══════════════════════════════════════════════════════════════════════════
  // HOST SYSTEM — ZONES, PROGRESSION, AND HOST-SPECIFIC SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  // Host health values per stage (index 0 = Stage 1, corresponding to Host 01)
  // Each host can have different total health based on its scale and difficulty
  HOST_HEALTH: [
    300,      // 01: The Fallen Leaf (micro, inert)
    8_000,    // 02: The Woodlouse (micro, living)
    60_000,   // 03: The Ant Colony (superorganism)
    320_000,  // 04: The Rotting Elm (macro, plant)
    1_000_000,// 05: The Corvid (warm-blooded)
    5_000_000,// 06: The Boar (large fauna)
    25_000_000,// 07: The River Network (ecosystem)
    100_000_000,// 08: The Old-Growth Forest (rival network)
    500_000_000,// 09: The Agricultural System (human-adjacent)
    2_000_000_000,// 10: The Urban Microbiome (civilizational)
    10_000_000_000,// 11: The Biosphere (planetary)
  ],

  // Per-host zone configuration
  // Each entry contains zone definitions and unlock thresholds
  HOSTS: {
    // Host 01: The Fallen Leaf — Single zone, no defense events
    '01': {
      zones: [
        { id: 'leaf_surface', name: 'Leaf Surface', healthPercent: 100 },
      ],
      defenseEventProfile: 'none',
      activeAttackAvailable: false,
      winCondition: 'healthToZero',
    },
    // Host 02: The Woodlouse — Single zone, basic defense events
    '02': {
      zones: [
        { id: 'carapace', name: 'Carapace', healthPercent: 100 },
      ],
      defenseEventProfile: 'basic',
      activeAttackAvailable: false,
      winCondition: 'healthToZero',
    },
    // Host 03: The Ant Colony — Two zones, Queen Node mechanic
    '03': {
      zones: [
        { id: 'outer_colony', name: 'Outer Colony', healthPercent: 60 },
        { id: 'queen_node', name: 'Queen Node', healthPercent: 40, unlockThreshold: 0.6 },
      ],
      defenseEventProfile: 'clustered',
      activeAttackAvailable: false,
      winCondition: 'healthToZero',
      queenNode: {
        healthPercent: 40,
        collapseDrainMultiplier: 3.0,
      },
    },
    // Host 04: The Rotting Elm — Two zones, active attacks introduced
    '04': {
      zones: [
        { id: 'bark_layer', name: 'Bark Layer', healthPercent: 50 },
        { id: 'heartwood', name: 'Heartwood', healthPercent: 50, unlockThreshold: 0.5 },
      ],
      defenseEventProfile: 'rare_high_impact',
      activeAttackAvailable: true,
      winCondition: 'healthToZero',
    },
    // Host 05: The Corvid — Three zones, stress cascade introduced
    '05': {
      zones: [
        { id: 'peripheral_tissue', name: 'Peripheral Tissue', healthPercent: 40 },
        { id: 'circulatory', name: 'Circulatory', healthPercent: 30, unlockThreshold: 0.4 },
        { id: 'neural', name: 'Neural', healthPercent: 30, unlockThreshold: 0.7 },
      ],
      defenseEventProfile: 'time_sensitive',
      activeAttackAvailable: true,
      winCondition: 'healthToZero',
      stress: {
        cascadeThreshold: 0.7,
        neuralStressReductionPct: 0.35,
      },
    },
    // Host 06: The Boar — Three zones, vector mechanic introduced
    '06': {
      zones: [
        { id: 'gut', name: 'Gut', healthPercent: 35 },
        { id: 'circulatory', name: 'Circulatory', healthPercent: 35 },
        { id: 'neural', name: 'Neural', healthPercent: 30 },
      ],
      defenseEventProfile: 'countermeasure_charges',
      activeAttackAvailable: true,
      winCondition: 'healthToZero',
      vector: {
        progressThreshold: 100,
        bpsBonusPercent: 15,
      },
    },
    // Host 07: The River Network — Three zones, seasonal cycle
    '07': {
      zones: [
        { id: 'tributary_network', name: 'Tributary Network', healthPercent: 33 },
        { id: 'main_channel', name: 'Main Channel', healthPercent: 34 },
        { id: 'aquifer', name: 'Aquifer', healthPercent: 33 },
      ],
      defenseEventProfile: 'environmental',
      activeAttackAvailable: true,
      winCondition: 'healthToZero',
      seasonal: {
        durationSeconds: 120,
        springEventFrequencyMultiplier: 1.5,
        summerBpsBonusPercent: 20,
        winterBpsPenaltyPercent: 30,
        mainChannelAttackAreaPercent: 50,
      },
    },
    // Host 08: The Old-Growth Forest — Four zones, rival network
    '08': {
      zones: [
        { id: 'root_periphery', name: 'Root Periphery', healthPercent: 25 },
        { id: 'canopy_interface', name: 'Canopy Interface', healthPercent: 25 },
        { id: 'deep_network', name: 'Deep Network', healthPercent: 25 },
        { id: 'heartroot', name: 'Heartroot', healthPercent: 25, unlockThreshold: 0.5 },
      ],
      defenseEventProfile: 'rival_network',
      activeAttackAvailable: true,
      winCondition: 'healthToZero',
      rivalNetwork: {
        zoneDecayRate: 0.02,
        countermeasureFrequency: 0.1,
        countermeasureBpsHaltSeconds: 10,
      },
    },
    // Host 09: The Agricultural System — Four zones, chemical defense
    '09': {
      zones: [
        { id: 'field_substrate', name: 'Field Substrate', healthPercent: 25 },
        { id: 'storage_facilities', name: 'Storage Facilities', healthPercent: 25 },
        { id: 'processing_network', name: 'Processing Network', healthPercent: 25 },
        { id: 'distribution_chain', name: 'Distribution Chain', healthPercent: 25 },
      ],
      defenseEventProfile: 'chemical',
      activeAttackAvailable: true,
      winCondition: 'healthToZero',
      supplyChain: {
        bonusPercent: 25,
      },
    },
    // Host 10: The Urban Microbiome — Five zones, human countermeasures
    '10': {
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
      researchZone: {
        defenseReductionPercent: 0.15,
      },
      multiFront: {
        stressThreshold: 0.6,
      },
    },
    // Host 11: The Biosphere — Six zones, integration meter (inverted win)
    '11': {
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
      integrationMeter: {
        maxValue: 1000,
        zones: [
          { id: 'atmosphere', name: 'Atmosphere', saturationThreshold: 200, contributionPerSecond: 1.0 },
          { id: 'hydrosphere', name: 'Hydrosphere', saturationThreshold: 200, contributionPerSecond: 1.0 },
          { id: 'lithosphere', name: 'Lithosphere', saturationThreshold: 150, contributionPerSecond: 0.8 },
          { id: 'biotic_layer', name: 'Biotic Layer', saturationThreshold: 250, contributionPerSecond: 1.2 },
          { id: 'technosphere', name: 'Technosphere', saturationThreshold: 100, contributionPerSecond: 0.5 },
          { id: 'noosphere', name: 'Noosphere', saturationThreshold: 100, contributionPerSecond: 0.5 },
        ],
        extinctionEvents: {
          frequencySeconds: 180,
          meterRegressionPercent: 0.10,
          responseWindowSeconds: 30,
        },
        integrationPulse: {
          cost: 40,
          durationSeconds: 20,
          fillRateMultiplier: 2.0,
          cooldownSeconds: 120,
        },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DEFENSE EVENT SYSTEM — FAILURE STATES AND ESCALATING PRESSURE
  // ═══════════════════════════════════════════════════════════════════════════

  DEFENSE_EVENTS: {
    // Three-outcome countermeasure resolution
    partialFailMitigationPercent: 0.50,
    fullFailTimerExtensionSeconds: 5,
    fullFailShareOfFailRate: 0.30,

    // Base countermeasure fail rate (overridden per host)
    countermeasureFailRateBase: 0.15,
    // Countermeasure fail rates per host
    countermeasureFailRateByHost: {
      '02': 0.15,
      '03': 0.20,
      '04': 0.25,
      '05': 0.28,
      '06': 0.30,
      '07': 0.32,
      '08': 0.35,
      '09': 0.38,
      '10': 0.40,
      '11': 0.45,
    },

    // Escalating pressure — deduction ramps over timer duration
    rampCurve: 'exponential',
    startDeductionPercent: 0.15,

    // Defense event profiles per host type
    profiles: {
      none: { frequencyMultiplier: 0, severityMultiplier: 0 },
      basic: { frequencyMultiplier: 1.0, severityMultiplier: 1.0 },
      clustered: { frequencyMultiplier: 1.3, severityMultiplier: 1.1, clusterSize: 3 },
      rare_high_impact: { frequencyMultiplier: 0.6, severityMultiplier: 1.5 },
      time_sensitive: { frequencyMultiplier: 1.2, severityMultiplier: 1.2, partialFailEnabled: true },
      countermeasure_charges: { frequencyMultiplier: 1.4, severityMultiplier: 1.3, chargeCost: 2 },
      environmental: { frequencyMultiplier: 1.0, severityMultiplier: 1.0, seasonal: true },
      rival_network: { frequencyMultiplier: 1.8, severityMultiplier: 1.6 },
      chemical: { frequencyMultiplier: 1.5, severityMultiplier: 1.4, suppressionDurationSeconds: 15 },
      human_countermeasures: { frequencyMultiplier: 2.0, severityMultiplier: 1.7, tier2Enabled: true },
      extinction_class: { frequencyMultiplier: 2.5, severityMultiplier: 2.0, extinctionEnabled: true },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIVE ATTACK SYSTEM — ENZYME RESERVES
  // ═══════════════════════════════════════════════════════════════════════════

  ENZYME_RESERVES: {
    passiveGainRate: 0.1,
    cap: 100,
    grindReward: 5,
  },

  ACTIVE_ATTACKS: {
    // Enzyme gain when player successfully suppresses a standard defense event
    enzymeGainFromSuccessfulCountermeasure: 2,

    // Base cost per host range (can be overridden per host)
    costByHostRange: {
      '04-06': { baseCost: 10, stressIncrement: 5 },
      '07-08': { baseCost: 20, stressIncrement: 10 },
      '09-10': { baseCost: 35, stressIncrement: 15 },
      '11': { baseCost: 50, stressIncrement: 0 },
    },
    // BPS bonus percentage when active attack is used
    bpsBonusPercent: 50,
    // Cooldown between active attacks (milliseconds)
    cooldownMs: 30_000,
    // Zone-specific cost multipliers
    zoneCostMultipliers: {
      gut: 0.8,
      peripheral_tissue: 1.0,
      circulatory: 1.2,
      neural: 1.5,
      field_substrate: 0.8,
      distribution_chain: 1.5,
      human_carriers: 2.0,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HOST STRESS SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  HOST_STRESS: {
    decayRatePerSecond: 0.5,
    thresholds: {
      threshold1: 30,
      threshold2: 70,
    },
    effects: {
      threshold1FrequencyMultiplier: 1.3,
      threshold2SeverityMultiplier: 1.5,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GRINDABLE EVENTS SYSTEM (Host 04+)
  // ═══════════════════════════════════════════════════════════════════════════

  GRIND_EVENTS: {
    enabled: true,
    unlockHost: 4,
    timerSeconds: 45,
    baseStatDeductionPercent: 15,
    baseFailRate: 0.25,

    enzymeRewardBase: 5,
    enzymeRewardOnSuccess: 5,
    enzymeRewardOnPartialFail: 2,
    enzymeRewardOnFullFail: 0,

    diminishingReturns: {
      enabled: true,
      reductionPerEvent: 0.10,
      minRewardMultiplier: 0.25,
    },

    failRateEscalation: {
      enabled: true,
      increasePerEvent: 0.05,
      maxFailRate: 0.60,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER SYSTEM (Host 10+)
  // ═══════════════════════════════════════════════════════════════════════════

  EVENT_TIERS: {
    tier2ScanUnlockHost: 10,
    tier2PreemptiveSuccessRateBonus: 0.20,
    tier2EscalationSeverityMultiplier: 1.5,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PROACTIVE COUNTERMEASURE SYSTEM (Host 10+)
  // ═══════════════════════════════════════════════════════════════════════════

  PROACTIVE_COUNTERMEASURES: {
    signalCost: 3,
    durationMs: 60_000,
    preemptiveSuccessRateBonus: 0.25,
    matchingEvents: {
      'preemptive-enzyme': ['fungicide-spray', 'soil-fumigation', 'biocontrol-application'],
      'preemptive-biofilm': ['resistance-breaker', 'quarantine-protocol'],
      'preemptive-signal': ['public-awareness-campaign', 'research-crackdown'],
      'preemptive-quorum': ['regulatory-crackdown'],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MULTI-FRONT EVENT SYSTEM (Host 10)
  // ═══════════════════════════════════════════════════════════════════════════

  MULTI_FRONT: {
    extraEventCount: 2,
    stressThresholdRatio: 0.6,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // IMMEDIATE HIT EVENTS (Chemical/Fungicide - Host 09-10)
  // ═══════════════════════════════════════════════════════════════════════════

  IMMEDIATE_HIT_EVENTS: [
    'fungicide-spray',
    'soil-fumigation',
    'biocontrol-application',
    'resistance-breaker',
    'quarantine-protocol',
    'research-crackdown',
    'public-awareness-campaign',
    'regulatory-crackdown',
  ] as import('../lib/game').DefenseEventId[],

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPPLY CHAIN SPREAD (Host 09 → 10)
  // ═══════════════════════════════════════════════════════════════════════════

  SUPPLY_CHAIN_SPREAD: {
    bonusCarryoverPercent: 50,
    zoneStartHealthBonus: 10,
  },

  // Skill costs keyed by skill ID (all biomass costs)
  SKILL_COSTS: {
    'enzymatic-breakdown':   8e4,
    'chitin-shell':          1.2e5,
    'quorum-recursion':      2e5,
    'acidic-secretion':      5e6,
    'dormancy-protocol':     8e6,
    'signal-amplification':  1.2e7,
    'hemorrhagic-spread':    1e8,
    'spore-hardening':       1.5e8,
    'distributed-cognition': 2.5e8,
  } as Record<import('../lib/game').SkillId, number>,

  // Per-stage click value as fraction of max host health.
  // Ensures clicking remains meaningful at every stage, independent of BPS.
  // Parasite gets 1.5x (same ratio as CLICK_BPS_FRACTION_PARASITE vs DEFAULT).
  CLICK_HOST_HEALTH_FRACTION_DEFAULT: [
    0.004, 0.001, 0.0005, 0.0005,
    0.0003, 0.0002, 0.0001, 0.00005,
    0.00003, 0.00002, 0.00001,
  ],
  CLICK_HOST_HEALTH_FRACTION_PARASITE: [
    0.006, 0.0015, 0.00075, 0.00075,
    0.00045, 0.0003, 0.00015, 0.000075,
    0.000045, 0.00003, 0.000015,
  ],

  // BPS fraction used as base click value, differentiated by strain.
  // Parasite is the active-play strain and gets a higher fraction.
  // Symbiote and Saprophyte use the lower default.
  CLICK_BPS_FRACTION_DEFAULT: 0.02,
  CLICK_BPS_FRACTION_PARASITE: 0.035,

  // Signal production multiplier divisor (run 2+ only).
  // Applied as: multiplier × (1 + signal / SIGNAL_PRODUCTION_DIVISOR)
  // At Signal cap 10 and divisor 20, max bonus = +50%.
  SIGNAL_PRODUCTION_DIVISOR: 20,

  // Late-game click upgrade costs and multipliers
  NEURAL_PROPAGATION_COST: 5e11,
  NEURAL_PROPAGATION_CLICK_MULTIPLIER: 1.5,
  TERMINUS_STRIKE_COST: 2e16,
  TERMINUS_STRIKE_CLICK_MULTIPLIER: 2,

  // Click boost applied during any active defense event.
  // Makes clicking the correct mechanical response to a defense event
  // rather than a passive wait.
  CLICK_DEFENSE_EVENT_BOOST: 1.5,

  // Host Echoes — permanent bonuses earned based on how each host was cleared.
  HOST_ECHO_AGGRESSIVE_CLICK_THRESHOLD: 0.6,
  HOST_ECHO_PATIENT_CLICK_THRESHOLD: 0.15,
  HOST_ECHO_RESILIENT_DEFENSE_THRESHOLD: 3,

  HOST_ECHO_BONUS_AGGRESSIVE: 0.05,
  HOST_ECHO_BONUS_EFFICIENT: 0.03,
  HOST_ECHO_BONUS_RESILIENT: 0.05,
  HOST_ECHO_BONUS_PATIENT: 0.5,

  // Notation thresholds
  NOTATION_LOCALE_MAX: 1_000,
  NOTATION_LOCALE_MAX_FULL: 1_000_000,
  NOTATION_SHORTHAND_MAX: 1e15,

  // ═══════════════════════════════════════════════════════════════════════════
  // STRAIN & MUTATION SYSTEM
  // All tunables for the strain-stat synergy, soft caps, and signature abilities.
  // ═══════════════════════════════════════════════════════════════════════════

  // --- Stat Soft Caps ---
  // Past this point spend, each additional point yields diminishing returns
  // Threshold at 3: Allows meaningful early investment while creating strategic
  // tension around point 4-5. Players feel the cap without it being oppressive.
  STAT_SOFT_CAP_THRESHOLD: 3,
  // 65% falloff: Each point past cap is worth 65% of previous. This creates a
  // smooth curve where point 4 = 65%, point 5 = 42%, point 6 = 27% effectiveness.
  // At 50% falloff the drop feels too harsh; at 75% the cap barely matters.
  SOFT_CAP_FALLOFF: 0.65,

  // --- Strain-Stat Interaction Multipliers ---
  // 35% synergy bonus: Creates meaningful identity. Aligned stat feels "correct".
  STRAIN_SYNERGY_MULTIPLIER: 1.35,
  // 30% opposition penalty: Opposed stat still viable but clearly suboptimal.
  // 0.70 (vs 1.35) creates a ~2x power gap which defines build identity.
  STRAIN_OPPOSITION_MULTIPLIER: 0.70,

  // --- Stat Thresholds ---
  // Virulence threshold for bonus application
  VIRULENCE_THRESHOLD: 3,
  // Resilience defense per point for stat synergy calculations
  RESILIENCE_DEFENSE_PER_POINT: 0.08,

  // --- Saprophyte Unique Mechanics ---
  // 3% BPS per Resilience: Makes Resilience economically interesting for Saprophyte
  // where it's normally just defensive. 3% × 5 points = 15% extra BPS.
  SAPROPHYTE_RESILIENCE_CONVERTS_TO_PASSIVE: 0.03,
  // Hybrid threshold at 5: Requires meaningful diversification. Prevents "1 point
  // in everything" abuse while rewarding genuine hybrid builds.
  SAPROPHYTE_HYBRID_BONUS_THRESHOLD: 5,
  // 20% bonus when hybrid: Significant but not overwhelming. Rewards the
  // opportunity cost of not maxing one stat.
  SAPROPHYTE_HYBRID_BONUS_MULTIPLIER: 1.20,

  // --- Prestige Genetic Memory ---
  // 10% retention: Each prestige, 10% of spent points become permanent bonus.
  // At 20 points spent, that's 2 permanent stacks. Slow but noticeable growth.
  GENETIC_MEMORY_POINTS_RETAINED_PERCENT: 0.10,
  // Cap at 5 stacks: Prevents infinite scaling. 5 prestiges = max memory bonus.
  GENETIC_MEMORY_MAX_STACKS: 5,
  // 2% per stack: At max stacks, +10% to all stat effectiveness permanently.
  // Compounds with other bonuses for meaningful long-term progression.
  GENETIC_MEMORY_BONUS_PER_STACK: 0.02,

  // --- Mutation Point Earning ---
  // First host grants 2 points: Allows immediate meaningful choice (1 point in
  // two stats, or 2 in one). Creates early build direction.
  FIRST_HOST_POINTS: 2,
  // Subsequent hosts grant 1 point: Slower growth maintains point value.
  SUBSEQUENT_HOST_POINTS: 1,

  // --- Hemorrhagic Burst (Parasite Signature) ---
  // Base interval 10 clicks: Frequent enough to feel active, not spammy.
  HEMORRHAGIC_BURST_BASE_INTERVAL: 10,
  // Base 3x multiplier: Significant burst without being game-breaking.
  HEMORRHAGIC_BURST_BASE_MULTIPLIER: 3.0,
  // Each Virulence point reduces interval by 0.5: At 6 Virulence, burst every 7 clicks.
  HEMORRHAGIC_VIRULENCE_INTERVAL_REDUCTION: 0.5,
  // Each Virulence point adds 15% to burst: At 6 Virulence, 3.0 × 1.9 = 5.7x burst.
  HEMORRHAGIC_VIRULENCE_MULTIPLIER_BONUS: 0.15,

  // --- Mycorrhizal Network (Symbiote Signature) ---
  // Base interval 30 seconds: Passive rhythm, not frantic.
  MYCORRHIZAL_BASE_INTERVAL_SECONDS: 30,
  // Base pulse 2x BPS: Worth waiting for, but not dominant.
  MYCORRHIZAL_BASE_PULSE_MULTIPLIER: 2.0,
  // Each Complexity point reduces interval by 2s: At 5 Complexity, pulse every 20s.
  MYCORRHIZAL_COMPLEXITY_INTERVAL_REDUCTION: 2,
  // Each Complexity point adds 20% to pulse: At 5 Complexity, 2.0 × 2.0 = 4x BPS pulse.
  MYCORRHIZAL_COMPLEXITY_PULSE_BONUS: 0.20,

  // --- Decomposition Loop (Saprophyte Signature) ---
  // Base 15% conversion: Meaningful recovery without being the primary income.
  DECOMPOSITION_BASE_CONVERSION_RATE: 0.15,
  // Each Resilience point adds 3%: At 5 Resilience, 15% + 15% = 30% conversion.
  DECOMPOSITION_RESILIENCE_BONUS_PER_POINT: 0.03,

  // ═══════════════════════════════════════════════════════════════════════════
  // FLAVOR MESSAGE SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  FLAVOR_MESSAGES: {
    enabled: true,
    displayDurationSeconds: 4,
    queueMaxSize: 3,
    showOnlyFirstRun: false,
  },

  // ─────────────────────────────────────────────
  // SUBSTRATE DEPENDENCY CHAIN
  // Each generator tier's BPS is scaled by whether
  // the tier below it is sufficiently stocked.
  // Index 0 = tier 1 (no dependency).
  // ─────────────────────────────────────────────
  SUBSTRATE: {
    // How many of tier (n-1) are needed per unit of tier n for full efficiency.
    // Index 0 is unused (tier 1 has no dependency).
    RATIOS: [0, 4, 3, 3, 2, 2, 2, 2, 1.5, 1.5, 1],
    // Minimum output fraction when substrate is fully depleted (0.0–1.0).
    // At 0.20, a tier with zero substrate still outputs 20% of its base BPS.
    FLOOR: 0.20,
  },
};
