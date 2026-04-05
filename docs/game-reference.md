# The Mycelium Protocol Reference

This document is the all-included implementation reference for the game as it exists now.

It is intended to be self-contained:

- it describes the game loop, progression model, balance model, UI structure, save/load behavior, and simulation tooling
- it includes representative code excerpts and implementation references by module name
- it intentionally avoids filesystem path references

## 1. Game Overview

The game is an incremental fungal takeover simulator with these major layers:

1. Biomass accumulation
2. Generator-based passive production
3. Host progression across staged substrates
4. Strain specialization after the first host clear
5. Mutation stats and skills after deeper progression
6. Defense events and countermeasures
7. Prestige through Spore Release and Genetic Memory
8. A Signal economy that is inactive on run 1 and becomes a live optimization layer from run 2 onward

The current game is built around immutable state transitions. The engine computes new `GameState` objects rather than mutating the live state in place inside UI components.

## 2. Architectural Rules

The project is organized around a few strong rules:

1. `balance.config.ts` contains tunable numbers only.
2. `values.ts` defines default state and visibility.
3. `formulas.ts` contains pure calculations.
4. `happenings.ts` contains state transitions and game events.
5. `gameStore.ts` is the Svelte store boundary used by components.
6. `App.svelte` is the main UI shell that renders the game.
7. `simulation.ts` is the headless balance runner.

## 3. State Model

The central state type is `GameState`.

Core resource and progression fields:

```ts
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
}
```

### Default State

The default state starts the player at Stage 1 with zero generators, no strain, no upgrades, no skills, and the host bar already visible.

Representative excerpt:

```ts
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
  ...
}
```

### Visibility State

The visibility system controls what the player sees and when.

```ts
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
    isNew: {},
    generatorPanelUnlockAt: null,
  }
}
```

## 4. Domain Definitions

### Generators

The generator ladder is:

1. Hyphae Strand
2. Mycelial Mat
3. Rhizomorph Cord
4. Sporocarp Cluster
5. Fruiting Canopy
6. Decomposer Bloom
7. Subterranean Nexus
8. Planetary Membrane

### Strains

Three strains exist:

- `parasite`
- `symbiote`
- `saprophyte`

Their identities are expressed through click and passive modifiers and a signature ability fantasy.

### Skills

Skills are divided across three mutation branches:

- Virulence
- Resilience
- Complexity

Examples:

- `enzymatic-breakdown`
- `chitin-shell`
- `distributed-cognition`

### Hosts

Hosts form the stage ladder:

1. Dead Leaf
2. Rotting Log
3. Forest Floor
4. Ancient Oak
5. Forest System
6. Watershed
7. Continental Soil
8. The Biosphere

Each host contains:

- name
- stage label
- subtitle
- health
- flavor
- threat level
- defense signature
- transition signal

## 5. Balance Model

Balance is centralized in `BALANCE`.

### Tick and save timing

```ts
TICK_MS: 100,
SAVE_INTERVAL_MS: 30_000,
OFFLINE_CAP_MS: 3 * 60 * 60 * 1000,
BASE_OFFLINE_EFFICIENCY: 0.1,
```

### Generator tuning

Current generator settings:

```ts
GENERATOR_BASE_COSTS: [
  10, 120, 6_000, 100_000,
  1_800_000, 4e10, 2e15, 1.5e21,
],

GENERATOR_BASE_PRODUCTION: [
  0.1, 90, 720, 8_000,
  100_000, 2.5e9, 6e14, 1.5e20,
],

GENERATOR_UNLOCK_THRESHOLDS: [0, 18, 12, 8, 10, 10, 10, 10],
GENERATOR_STAGE_GATES: [0, 0, 2, 2, 3, 4, 6, 7],
```

Note: Tiers 3 and 4 share the same `GENERATOR_STAGE_GATES` value of 2, which means both become stage-eligible at Stage 2. Tier 4 has a separate progress gate (see below) that delays it within Stage 2.

### Early structural pacing

The current early structural pacing model delays Tier 4 based on Stage 2 host progress.

```ts
TIER4_STAGE2_HOST_PROGRESS_GATE: 25,
```

`getHostProgress` returns a 0–100 scale value, so 25 means Tier 4 unlocks at 25% into the Stage 2 host bar.

Tier 3 is unlocked by reaching Stage 2. Tier 4 requires Stage 2 host progress.

### Strain modifiers

```ts
STRAIN_PARASITE_CLICK_MULT: 5,
STRAIN_PARASITE_PASSIVE_MULT: 0.5,
STRAIN_SYMBIOTE_CLICK_MULT: 0,
STRAIN_SYMBIOTE_PASSIVE_MULT: 2,
STRAIN_SAPROPHYTE_CLICK_MULT: 1.5,
STRAIN_SAPROPHYTE_PASSIVE_MULT: 1.5,
```

### Defense tuning

Key defense constants:

```ts
DEFENSE_EVENT_COOLDOWN_MS: 90_000,
DEFENSE_EVENT_TRIGGER_MAX: 0.60,
DEFENSE_EVENT_TRIGGER_BASE: 0.22,
DEFENSE_EVENT_TRIGGER_PER_STAGE: 0.04,
DEFENSE_FORECAST_UNLOCK_STAGE: 2,
DEFENSE_FORECAST_WARNING_MS: 30_000,
```

`DEFENSE_FORECAST_WARNING_MS` is the window before the next defense check when the UI begins showing the incoming threat name and a countdown. The event is not guaranteed to fire (the random roll can fail), so UI language uses hedged phrasing.

Countermeasure constants:

```ts
COUNTERMEASURE_MOISTURE_BUFFER_MITIGATION: 0.15,
COUNTERMEASURE_IMMUNE_MIMICRY_MITIGATION: 0.18,
COUNTERMEASURE_BROOD_DECOY_FALLBACK_MULTIPLIER: 0.78,
```

### Upgrade constants

Representative upgrade tuning:

```ts
CHITINOUS_REINFORCEMENT_BASE_BONUS: 0.18,
EXOENZYME_SECRETION_BASE_BONUS: 0.08,
EXOENZYME_SECRETION_MAX_TIER: 3,
LATERAL_TRANSFER_CLICK_MULTIPLIER: 2,
LATERAL_TRANSFER_TIER4_BASE_BONUS: 0.2,
LATERAL_TRANSFER_TIER4_STAGE3_BONUS: 0.8,
RHIZOMORPH_LOWER_TIER_SCALING_PER_OWNED: 0.015,
RHIZOMORPH_LOWER_TIER_SCALING_CAP: 2.5,
SPOROCARP_STAGE3_CARRY_BONUS: 0.35,
```

### Host health pacing

```ts
HOST_HEALTH: [
  1_000,           // Stage 1: ~13m
  26_300_000,      // Stage 2: ~1.5h
  3_800_000_000,   // Stage 3: ~3.5h
  122_000_000_000, // Stage 4: ~8.5h
  1.7e15,          // Stage 5: ~14h
  6e16,            // Stage 6: ~4d
  3.6e22,          // Stage 7: ~7d
  6e26,            // Stage 8: ~1d final push
],
```

These values produce a verified 12.2-day total first run for a medium-active player (see Section 17).

## 6. Progression Model

### Biomass

Biomass is both the currency and the host-damage driver.

Clicking and passive production both route through `gainBiomass(...)`, which:

1. adds biomass
2. adds lifetime biomass
3. reduces current host health
4. sets `hostCompleted` when health reaches zero

Representative excerpt:

```ts
function gainBiomass(state: GameState, amount: Decimal): GameState {
  if (amount.lte(0)) return state

  const hostDamage = amount
  const remainingHost = Decimal.max(0, state.hostHealth.sub(hostDamage))

  return recalculateDerivedState({
    ...state,
    biomass: state.biomass.add(amount),
    lifetimeBiomass: state.lifetimeBiomass.add(amount),
    hostHealth: remainingHost,
    hostCompleted: remainingHost.lte(0),
    highestStageReached: Math.max(state.highestStageReached, state.currentStage),
  })
}
```

Note: host damage is not multiplied by vulnerability windows on run 1. On run 2+, Signal-funded vulnerability windows can amplify host damage when active.

### Completed Hosts and Mutation Points

The game currently awards mutation points per completed host, not per level.

```ts
export function getCompletedHosts(state: GameState): number {
  return Math.max(0, state.currentStage - 1 + (state.hostCompleted ? 1 : 0))
}

export function getTotalMutationPointsEarned(state: GameState): number {
  const completedHosts = getCompletedHosts(state)
  if (completedHosts === 0) {
    return 0
  }
  return completedHosts + 1
}
```

### Strain Unlock

Strain selection is unlocked after the first completed host.

### Skill Unlock

Skills are unlocked once the player reaches Stage 3.

### Prestige

Prestige is called Spore Release. It is gated behind consuming the final host.

```ts
export function canReleaseSpores(state: GameState): boolean {
  return state.currentStage === hostDefinitions.length && state.hostCompleted
}
```

Spore Release resets the run, preserves and increases Genetic Memory, unlocks Saprophyte, and starts a fresh state.

## 7. Cost, Efficiency, and Production Formulas

### Generator cost formula

```ts
export function getGeneratorCostByOwned(generatorId: GeneratorId, owned: number): Decimal {
  const definition = getGenDef(generatorId)
  return definition.baseCost.mul(Decimal.pow(BALANCE.GENERATOR_COST_EXPONENT, owned))
}
```

### Generator efficiency

```ts
export function getGeneratorEfficiencyByOwned(generatorId: GeneratorId, owned: number): Decimal {
  const definition = getGenDef(generatorId)
  const cost = getGeneratorCostByOwned(generatorId, owned)
  if (cost.eq(0)) {
    return new Decimal(0)
  }
  return definition.baseProduction.div(cost)
}
```

### Production multiplier composition

Production multipliers are built from:

1. upgrades
2. tier identity hooks
3. strain passive modifier
4. passive stat multiplier
5. Genetic Memory bonus
6. active defense penalties
7. Signal bonus (prestige run 2+ only, when Signal is unlocked and above zero)

Representative excerpt:

```ts
multiplier = multiplier.mul(getPassiveStatMultiplier(state))
multiplier = multiplier.mul(getGeneticMemoryBonusMultiplier(state))

for (const event of state.activeDefenseEvents) {
  multiplier = multiplier.mul(getMitigatedPenaltyMultiplier(event.multiplier, state, event.id))
}

// Signal production multiplier — active on run 2+ only.
if (state.prestigeCount > 0 && isSignalUnlocked(state) && state.signal > 0) {
  const signalBonus = 1 + (state.signal / BALANCE.SIGNAL_PRODUCTION_DIVISOR)
  multiplier = multiplier.mul(signalBonus)
}
```

At Signal cap 10 and `SIGNAL_PRODUCTION_DIVISOR: 20`, the maximum Signal bonus is +50%. This layer is fully absent from run 1 (`prestigeCount === 0`).

### Early-tier structural identity

Current early-tier identity logic:

```ts
if (generatorId === 'rhizomorph-cord') {
  const lowerTierOwned = state.generators['hyphae-strand'].owned + state.generators['mycelial-mat'].owned
  const scalingBonus = Math.min(
    BALANCE.RHIZOMORPH_LOWER_TIER_SCALING_CAP,
    lowerTierOwned * BALANCE.RHIZOMORPH_LOWER_TIER_SCALING_PER_OWNED
  )
  multiplier = multiplier.mul(1 + scalingBonus)
}

if (generatorId === 'sporocarp-cluster' && state.upgrades['lateral-transfer']) {
  let tier4Bonus = BALANCE.LATERAL_TRANSFER_TIER4_BASE_BONUS
  multiplier = multiplier.mul(new Decimal(1).add(new Decimal(tier4Bonus).mul(upgradeEffectiveness)))
}
```

This is the basis of the current early-game structural rework:

- Tier 2 is a bridge tier
- Tier 3 scales from lower-tier density
- Tier 4 is a high-cost breakout tier with upgrade support

## 8. Defense System

The defense system has forecasting, active events, mitigation, and countermeasures.

### Forecasting

Once the forecast stage is reached, the game rolls and stores `nextDefenseEventId`.

```ts
function ensureDefenseForecast(state: GameState): GameState {
  if (state.currentStage < BALANCE.DEFENSE_FORECAST_UNLOCK_STAGE || state.nextDefenseEventId) {
    return state
  }

  return {
    ...state,
    nextDefenseEventId: rollDefenseEventId(state),
  }
}
```

### Event pool by stage

The likely event pool changes by stage:

- early: drought, beetle disruption
- mid: cold snap, beetle disruption, drought
- later: spore competition, immune response, beetle disruption
- final: immune response, spore competition

### Countermeasures

Three one-per-run countermeasures exist:

- Moisture Buffer
- Brood Decoy
- Immune Mimicry

The player may only equip one, and only once per run.

### Strain interactions with defense

- Symbiote gets extra mitigation during active defenses
- Parasite gains a temporary click burst window after a defense trigger
- Saprophyte reclaims biomass when defense events expire

Representative excerpts:

```ts
if (state.strain === 'symbiote' && state.activeDefenseEvents.length > 0) {
  mitigation += BALANCE.STRAIN_SYMBIOTE_ACTIVE_DEFENSE_MITIGATION_BONUS
}
```

```ts
const parasiteBurstMs = state.strain === 'parasite'
  ? BALANCE.STRAIN_PARASITE_DEFENSE_BURST_MS
  : state.activeParasiteDefenseBurstMs
```

```ts
if (expiredEvents.length > 0 && state.strain === 'saprophyte' && state.biomassPerSecond.gt(0)) {
  // Duration table matches the actual event durations set in happenings.ts
  const eventDurationMs: Record<string, number> = {
    'drought':           4 * 60 * 1000,
    'beetle-disruption': 3 * 60 * 1000,
    'cold-snap':         5 * 60 * 1000,
    'spore-competition': 6 * 60 * 1000,
    'immune-response':   7 * 60 * 1000,
  }

  let totalRecovered = new Decimal(0)

  for (const event of expiredEvents) {
    const durationMs = eventDurationMs[event.id] ?? 4 * 60 * 1000
    // penaltyDepth = fraction of output suppressed (Beetle Disruption = 0, no global mult)
    const penaltyDepth = new Decimal(1).sub(event.multiplier)
    const productionLost = state.biomassPerSecond
      .mul(penaltyDepth)
      .mul(durationMs / 1000)
    totalRecovered = totalRecovered.add(
      productionLost.mul(BALANCE.STRAIN_SAPROPHYTE_DEFENSE_RECOVERY_FRACTION)
    )
  }
  ...
}
```

Saprophyte recovery is bounded by actual production lost: it computes `BPS × penaltyDepth × eventDurationSeconds × STRAIN_SAPROPHYTE_DEFENSE_RECOVERY_FRACTION`. The old `STRAIN_SAPROPHYTE_DEFENSE_RECOVERY_SECONDS` constant has been removed.

## 9. Unlock and Visibility Logic

The game uses progressive reveal logic inside `checkVisibilityUnlocks(...)`.

Important reveals:

- observation log after any lifetime biomass
- generator panel after a short delay
- BPS display after passive generation begins
- upgrades when upgrade prerequisites are satisfied
- strain prompt after first host clear
- stats panel after choosing a strain
- skill tree at Stage 3
- stage display at Stage 2+
- prestige button at the final host

Representative excerpt:

```ts
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
```

### Generator unlock logic

Generator unlocks are not purely linear anymore.

Current logic:

```ts
const previousOwnedReady = next.generators[previousGenerator.id].owned >= BALANCE.GENERATOR_UNLOCK_THRESHOLDS[tierIndex]
const stageReady = stageGate === 0 || next.currentStage > stageGate
const tier3GateReady = tierIndex !== 2 || next.currentStage >= 2
const tier4ProgressReady = next.currentStage > 2 || (
  next.currentStage === 2 &&
  formulas.getHostProgress(next) >= BALANCE.TIER4_STAGE2_HOST_PROGRESS_GATE
)
const tier4GateReady = tierIndex !== 3 || tier4ProgressReady
```

This means:

- Tier 2: previous-tier ownership only
- Tier 3: requires Stage 2 and previous-tier ownership
- Tier 4: requires previous-tier ownership and Stage 2 host progress
- Tier 5+: still stage-gated by cleared hosts/stages

The unlock logs also contain role-based guidance rather than generic “always buy the new tier” advice.

## 10. Actions and Happenings

The main user-facing actions are:

- absorb
- buy generator
- buy upgrade
- purchase skill
- allocate stat
- choose strain
- advance stage
- equip countermeasure
- release spores

Representative excerpts:

```ts
export function absorb(state: GameState): GameState {
  const clickCount = state.clickCount + 1
  let next = gainBiomass(
    {
      ...state,
      clickCount,
    },
    state.biomassPerClick
  )
  ...
  return checkVisibilityUnlocks(next)
}
```

```ts
export function buyGeneratorAction(state: GameState, generatorId: GeneratorId): GameState {
  const quantity = getAffordableQuantity(state, generatorId, state.buyAmount)
  ...
  return checkVisibilityUnlocks(recalculateDerivedState(next))
}
```

```ts
export function advanceStageAction(state: GameState): GameState {
  if (!state.hostCompleted || !hasNextStageUtil(state)) return state
  ...
}
```

## 11. Save / Load

State is serialized to localStorage via JSON.

Important behavior:

1. Decimal values are stringified on save
2. values are converted back to Decimal on load
3. older visibility arrays are padded to expected tier count
4. offline gains are applied after load
5. save corruption falls back to a fresh run with log messages

Representative serialization excerpt:

```ts
function serialize(s: GameState): SerializedState {
  return {
    biomass: s.biomass.toString(),
    biomassPerClick: s.biomassPerClick.toString(),
    biomassPerSecond: s.biomassPerSecond.toString(),
    lifetimeBiomass: s.lifetimeBiomass.toString(),
    geneticMemory: s.geneticMemory.toString(),
    signal: s.signal,
    ...
  }
}
```

Representative load/offline excerpt:

```ts
const hydrated = normalizeLoadedState(parsed)
const offlineGain = formulas.calculateOfflineGains(hydrated)
const withOffline = gainBiomass(hydrated, offlineGain)
```

## 12. Store Layer

The Svelte store wraps all engine actions and is the component-facing API.

Representative structure:

```ts
export function createGameStore() {
  const state = writable<GameState>(loadState())
  ...
  function tick(now = Date.now()) {
    updateState((current) => engineTick(current, now))
  }
  ...
  return {
    subscribe: state.subscribe,
    absorb,
    buyGenerator,
    buyUpgrade,
    equipCountermeasure,
    chooseStrain,
    allocateStat,
    purchaseSkill,
    advanceStage,
    releaseSpores,
    acknowledgeReveal,
    reset,
    saveNow,
    setBuyAmount,
    start,
    stop,
  }
}
```

The store also handles:

- starting/stopping the tick timer
- periodic autosave
- visibility-change offline gain handling
- reset/debug state replacement

## 13. UI Structure

The UI is centered around a terminal/brutalist control-room presentation with multiple views:

- Terminal
- Evolution
- Spore
- Wiki

### Terminal view

Contains:

- biomass chamber
- absorb button
- host analysis panel
- defense control panel
- generator modules panel
- upgrades list

Representative structure:

```svelte
{#if activeView === 'terminal'}
  <div class="desktop-terminal workspace-grid">
    <section class="workspace-main">
      ... biomass chamber ...
      ... host analysis ...
      ... defense control ...
    </section>

    <section class="workspace-modules">
      ... generator cards ...
      ... upgrade rows ...
    </section>
  </div>
{/if}
```

### Evolution view

Contains:

- overview stats
- core attributes
- strain status/selection
- neural mutations / skill tree

### Spore view

Contains prestige/release readiness information and the Genetic Memory projection UI.

### Mobile UI

A separate mobile layout exists alongside the desktop layout, not merely a CSS collapse of the same markup.

## 14. Current Early-Game Structural Rework

The current gameplay shape after recent pacing work is:

- Tier 2 acts as the bridge out of Stage 1
- Tier 3 acts as the Stage 2 scaling tier
- Tier 4 unlocks later in Stage 2 based on host progress and acts as the breakout tier
- Tier 5 takes over after the Stage 2 clear and Stage 3 transition

This structure is reflected in both unlock messaging and formulas.

Representative unlock guidance:

```ts
const guidance = tierIndex === 2
  ? 'Recommendation: Let lower tiers feed it. Rhizomorph output scales with network density.'
  : tierIndex === 3
    ? 'Recommendation: High-cost assault pathway. It remains effective into early Signal routing.'
    : 'Recommendation: Prioritize immediately.'
```

Even though Signal on run 1 is fully disabled, the Tier 4 description still references the intended carry role into Signal routing on run 2+.

## 15. Signal Economy Status

Signal is a prestige-layer feature. It is fully absent from run 1 and becomes active starting run 2.

### What is active

- `tickSignalSystem` is called every tick and is the live runtime entry point
- Signal panel mounts in the UI, gated on `prestigeCount > 0 && isSignalUnlocked`
- Signal production/decay/overspend tick logic runs on run 2+
- Signal provides a production bonus to all generators (`+signal / SIGNAL_PRODUCTION_DIVISOR`)
- `recalculateDerivedState` computes Signal values conditionally on `prestigeCount > 0`

### What is gated to prestige run 2+

- `tickSignalSystem` has an early return guard: `if (state.prestigeCount === 0 || !isSignalUnlocked(state)) return state`
- Signal panel visibility is blocked: `signalPanel` stays `false` on run 1
- Signal production multiplier in `getProductionMultiplier` is also guarded by `prestigeCount > 0`

### What remains scaffolded but not yet player-facing

- Signal spend actions (Coordination Command, Vulnerability Window, Rival Suppression, Network Isolation) exist in the engine but are not fully surfaced in the UI
- Signal simulation milestones are commented out in `simulation.ts`

Representative tick guard:

```ts
export function tickSignalSystem(state: GameState, deltaMs: number): GameState {
  if (state.prestigeCount === 0 || !isSignalUnlocked(state)) {
    return state  // Signal is a prestige-layer feature, inactive on run 1
  }
  ...
}
```

Representative production guard:

```ts
if (state.prestigeCount > 0 && isSignalUnlocked(state) && state.signal > 0) {
  const signalBonus = 1 + (state.signal / BALANCE.SIGNAL_PRODUCTION_DIVISOR)
  multiplier = multiplier.mul(signalBonus)
}
```

## 16. Simulation Runner

The simulation runner is used to validate pacing.

It has two phases:

1. precise tick-by-tick simulation through early game
2. analytical fast-forward for later hosts

Representative excerpts:

```ts
console.log(`${fmt(0).padStart(15)} | [Phase 1: tick-by-tick through Stage 1]`)
```

```ts
console.log(`${fmt(gameSeconds).padStart(15)} | [Phase 2: analytical fast-forward to ${fmt(MAX_GAME_SECONDS)}]`)
```

The simulation buys highest visible generators first, buys available upgrades, auto-advances stages, and records milestone timings.

Current milestones include:

- first generator
- first host clear
- Stage 3 reached
- stage clears
- tier unlocks

Signal-specific milestones are commented out (the simulation models a first run, where Signal is inactive).

## 17. Current Pacing Shape

The current structural tuning targets a **7–14 day first run** for a medium-active player. The verified simulation output (as of the balance rework) is:

| Milestone | Time |
|-----------|------|
| Stage 1 cleared | ~13m |
| Stage 2 cleared | ~1h 31m |
| Stage 3 cleared (Skills unlocked) | ~3h 13m |
| Stage 4 cleared | ~8h 30m |
| Stage 5 cleared | ~13h 48m |
| Stage 6 cleared | ~4d 1h |
| Stage 7 cleared | ~11d 7h |
| Stage 8 cleared (full run) | ~12d 6h |

Stages 2 and 3 always fire in the same simulation tick. This is a structural artifact of how stage gates work: Stage 3 became immediately reachable the moment Stage 2 cleared, so the simulation advances both in one pass.

**Important calibration note:** The analytical model (`analytical-model.ts --derive`) cannot model the BPS spike from Tier 6/7 unlocks. Stages 5–8 timing must be verified against `simulation.ts`, not the analytical derivation. Only `HOST_HEALTH` is adjusted to tune pacing — generator costs and production values are not changed for pacing.

## 18. Important Implementation Notes

1. Decimal math is used for biomass and host health.
2. Signal intentionally uses plain `number` values.
3. The store is the only UI-facing API.
4. Offline gains are applied through the same biomass flow.
5. Defense events are fully integrated into both production and click value.
6. Prestige is host-based, not level-based.
7. Mutation points are host-completion based in the current design.
8. Signal is a prestige-layer feature. Run 1 has zero Signal presence. From run 2 onward, Signal is live but spend actions are not yet fully exposed in the UI. Distinguish between the active tick/production layer and the dormant spend scaffolding.

## 19. Representative Module Roles

### `balance.config.ts`

Purpose: all tunable constants.

### `values.ts`

Purpose: default state and live-state helpers.

### `game.ts`

Purpose: type system and static content definitions.

### `formulas.ts`

Purpose: pure math, progression formulas, formatting helpers.

### `happenings.ts`

Purpose: state transitions, ticks, purchases, unlocks, defense events, prestige, save/load.

### `gameStore.ts`

Purpose: store wrapper around engine actions.

### `App.svelte`

Purpose: primary UI composition across desktop and mobile views.

### `simulation.ts`

Purpose: automated pacing verification.

## 20. Quick Reference Snippets

### Tick loop

```ts
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
    perTick
  )

  next = tickSignalSystem(next, deltaMs)
  next = tickDefenseResponseState(next, deltaMs)

  return checkVisibilityUnlocks(next, now)
}
```

`tickSignalSystem` is a no-op on run 1 (guarded by `prestigeCount === 0` check inside).

### Advance stage

```ts
export function advanceStageAction(state: GameState): GameState {
  if (!state.hostCompleted || !hasNextStageUtil(state)) return state
  ...
}
```

### Release spores

```ts
export function releaseSporesAction(state: GameState): GameState {
  if (!formulas.canReleaseSpores(state)) return state
  ...
}
```

### Store startup

```ts
onMount(() => {
  game.start()

  return () => {
    game.stop()
    game.saveNow()
  }
})
```

## 21. Summary

The game currently consists of:

- a host-based incremental progression model
- generator tiers with a recent structural early-game pacing rework
- three strains
- mutation stats and branch-based skills
- stage-based host progression
- a defense and countermeasure subsystem
- prestige via Spore Release and Genetic Memory
- a headless simulation runner for tuning
- a Signal economy active from prestige run 2 onward, with spend actions scaffolded for future player-facing exposure

This document should be treated as the primary high-level implementation reference for the current state of the project.
