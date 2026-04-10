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
  GENERATOR_BASE_COSTS: [
    10, 80, 600, 4_000,
    30_000, 250_000, 2_000_000, 15_000_000,
  ],

  // Generator base production per second (index 0 = Tier 1)
  GENERATOR_BASE_PRODUCTION: [
    0.008, 0.04, 0.2, 1,
    5, 25, 120, 600,
  ],

  // Previous-tier ownership needed to reveal the next generator tier
  GENERATOR_UNLOCK_THRESHOLDS: [0, 8, 7, 6, 8, 7, 6, 5],

  // Tier 4 unlocks when Stage 2 host progress >= this value (0–100 scale)
  TIER4_STAGE2_HOST_PROGRESS_GATE: 0,

  // Stage gate: minimum stage that must be active before this tier is visible
  // (0 = no stage gate)
  GENERATOR_STAGE_GATES: [0, 0, 1, 2, 2, 3, 4, 5],

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

  // Host health values per stage (index 0 = Stage 1)
  HOST_HEALTH: [
    600, 14_000, 90_000, 320_000,
    1_000_000, 5_000_000, 25_000_000, 100_000_000,
  ],

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
  ],
  CLICK_HOST_HEALTH_FRACTION_PARASITE: [
    0.006, 0.0015, 0.00075, 0.00075,
    0.00045, 0.0003, 0.00015, 0.000075,
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

  // --- Stat Base Values ---
  // 15% click bonus: At 3 points with synergy, Parasite gets ~60% click boost
  // which feels significant without overshadowing generators.
  VIRULENCE_CLICK_BONUS_PER_POINT: 0.15,
  // Threshold bonus at 25%: Reward for committing to 3 points in a stat.
  // Applies after synergy multipliers for maximum impact.
  VIRULENCE_THRESHOLD_BONUS: 0.25,
  VIRULENCE_THRESHOLD: 3,
  // 8% defense mitigation: At 3 points with synergy, Saprophyte gets ~32% mitigation
  // which meaningfully extends event survival without trivializing defenses.
  RESILIENCE_DEFENSE_PER_POINT: 0.08,
  // 5% BPS per point: Modest but stacking. At 5 points with synergy, ~33% BPS boost.
  COMPLEXITY_PASSIVE_PER_POINT: 0.05,
  // 2% upgrade effectiveness: Subtle but compounds with other bonuses.
  COMPLEXITY_UPGRADE_EFFECTIVENESS_PER_POINT: 0.02,

  // --- Strain-Stat Interaction Multipliers ---
  // 35% synergy bonus: Creates meaningful identity. Aligned stat feels "correct".
  STRAIN_SYNERGY_MULTIPLIER: 1.35,
  // 30% opposition penalty: Opposed stat still viable but clearly suboptimal.
  // 0.70 (vs 1.35) creates a ~2x power gap which defines build identity.
  STRAIN_OPPOSITION_MULTIPLIER: 0.70,

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
};
