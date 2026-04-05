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
    BASE_PRODUCTION_PER_SECOND: 0.5,

    // Production scales with stage beyond Stage 3
    PRODUCTION_PER_STAGE_BONUS: 0.3,

    // Decay — Signal lost per second when above DECAY_THRESHOLD
    DECAY_RATE_PER_SECOND: 0.08,
    DECAY_THRESHOLD: 0.70,

    // Overspend penalty — applied when Signal drops below PENALTY_THRESHOLD
    PENALTY_THRESHOLD: 0.10,
    PENALTY_BPS_MULTIPLIER: 0.85,
    PENALTY_RECOVERY_RATE: 0.15,

    // Base cap — maximum Signal storable
    BASE_CAP: 10,

    // Complexity stat bonuses
    COMPLEXITY_CAP_BONUS_PER_POINT: 2,
    COMPLEXITY_DECAY_REDUCTION_PER_POINT: 0.005,

    // Strain modifiers
    STRAIN_SYMBIOTE_PRODUCTION_MULT: 1.5,
    STRAIN_PARASITE_CAP_PENALTY: 0.75,
    STRAIN_SAPROPHYTE_DECAY_MULT: 0.60,

    // Signal spend costs
    COST_COORDINATION_COMMAND: 3,
    COST_VULNERABILITY_WINDOW: 6,
    COST_RIVAL_SUPPRESSION: 8,
    COST_NETWORK_ISOLATION: 5,

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

  // Base offline efficiency (10% of normal production)
  BASE_OFFLINE_EFFICIENCY: 0.1,

  // Dormancy Protocol skill offline efficiency bonus (+15%)
  DORMANCY_PROTOCOL_OFFLINE_BONUS: 0.15,

  // Resilience >= 3 offline efficiency bonus (+10%)
  RESILIENCE_OFFLINE_BONUS: 0.1,

  // Generator cost scaling exponent — lowered from 1.18 to slow bulk-buy curve
  GENERATOR_COST_EXPONENT: 1.15,

  // Generator base costs (index 0 = Tier 1: Hyphae Strand)
  GENERATOR_BASE_COSTS: [
    10, 120, 6_000, 100_000,
    1_800_000, 4e10, 2e15, 1.5e21,
  ],

  // Generator base production per second (index 0 = Tier 1)
  GENERATOR_BASE_PRODUCTION: [
    0.1, 90, 720, 8_000,
    100_000, 2.5e9, 6e14, 1.5e20,
  ],

  // Previous-tier ownership needed to reveal the next generator tier
  GENERATOR_UNLOCK_THRESHOLDS: [0, 18, 12, 8, 10, 10, 10, 10],

  // Tier 4 unlocks when Stage 2 host progress >= this value (0–100 scale)
  TIER4_STAGE2_HOST_PROGRESS_GATE: 25,

  // Stage gate: minimum stage that must be active before this tier is visible
  // (0 = no stage gate)
  GENERATOR_STAGE_GATES: [0, 0, 2, 2, 3, 4, 6, 7],

  // Genetic Memory prestige threshold (minimum lifetime biomass to earn any Gamma)
  GENETIC_MEMORY_DIVISOR: 1e24,

  // Genetic Memory gain exponent. Lower values slow permanent scaling hard in the late game.
  GENETIC_MEMORY_GAIN_EXPONENT: 0.2,

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
  CHITINOUS_REINFORCEMENT_BASE_BONUS: 0.18,
  EXOENZYME_SECRETION_COST: 30_000,
  EXOENZYME_SECRETION_BASE_BONUS: 0.08,
  EXOENZYME_SECRETION_MAX_TIER: 3,
  LATERAL_TRANSFER_COST: 500_000,
  LATERAL_TRANSFER_CLICK_MULTIPLIER: 2,
  LATERAL_TRANSFER_TIER4_BASE_BONUS: 0.2,
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

  // Host health values per stage (index 0 = Stage 1)
  HOST_HEALTH: [
    1_000,               // Stage 1: ~12m
    26_300_000,          // Stage 2: ~1.5h
    3_800_000_000,       // Stage 3: ~4h
    122_000_000_000,     // Stage 4: ~10h
    1.7e15,              // Stage 5: ~24h
    6e16,                // Stage 6: ~2d
    3.6e22,              // Stage 7: ~4d
    6e26,                // Stage 8: ~2-3d final push
  ],

  // Skill costs keyed by skill ID (all biomass costs)
  SKILL_COSTS: {
    'enzymatic-breakdown':   5e8,
    'chitin-shell':          8e8,
    'quorum-recursion':      1.2e9,
    'acidic-secretion':      2e11,
    'dormancy-protocol':     4e11,
    'signal-amplification':  6e11,
    'hemorrhagic-spread':    5e13,
    'spore-hardening':       8e13,
    'distributed-cognition': 1.2e14,
  } as Record<import('../lib/game').SkillId, number>,

  // Per-stage click value as fraction of current host health.
  // Ensures clicking remains meaningful at every stage, independent of BPS.
  // Parasite gets 1.5x (same ratio as CLICK_BPS_FRACTION_PARASITE vs DEFAULT).
  CLICK_HOST_HEALTH_FRACTION_DEFAULT: [
    0.001,   0.0005,  0.0003,  0.0002,
    0.00015, 0.0001,  0.00008, 0.00005,
  ],
  CLICK_HOST_HEALTH_FRACTION_PARASITE: [
    0.0015,  0.00075, 0.00045, 0.0003,
    0.000225, 0.00015, 0.00012, 0.000075,
  ],

  // BPS fraction used as base click value, differentiated by strain.
  // Parasite is the active-play strain and gets a higher fraction.
  // Symbiote and Saprophyte use the lower default.
  CLICK_BPS_FRACTION_DEFAULT: 0.04,
  CLICK_BPS_FRACTION_PARASITE: 0.06,

  // Signal production multiplier divisor (run 2+ only).
  // Applied as: multiplier × (1 + signal / SIGNAL_PRODUCTION_DIVISOR)
  // At Signal cap 10 and divisor 20, max bonus = +50%.
  SIGNAL_PRODUCTION_DIVISOR: 20,

  // Late-game click upgrade costs and multipliers
  NEURAL_PROPAGATION_COST: 3e18,
  NEURAL_PROPAGATION_CLICK_MULTIPLIER: 1.5,
  TERMINUS_STRIKE_COST: 8e29,
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
};
