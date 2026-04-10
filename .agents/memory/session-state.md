# Session State

## Current Project State

- Project: The Mycelium Protocol - an idle/incremental game about fungal network growth
- Tech stack: Svelte 5 + Vite + TypeScript + Tailwind CSS v4 + break_eternity.js
- Architecture follows a strict pattern:
  - `balance.config.ts` - ALL tunable constants (single source of truth)
  - `game.ts` - Type definitions and static data (hosts, generators, skills, strains)
  - `values.ts` - Default state and state getter/setter
  - `formulas.ts` - Pure calculation functions
  - `happennings.ts` - ALL state mutations and event handlers
  - `gameStore.ts` - Svelte store wrapper
- Core game loop: click to gather biomass → passive BPS generation → progress through hosts → prestige

## Implementation Prompt (April 2026)

The Mycelium Protocol Host Sequence Redesign - expanding from 8 to 11 hosts with new mechanics:

### Narrative Arc
- Hosts 01-02: Decomposer phase (awakening, no consciousness)
- Hosts 03-04: Parasite phase (living hosts, patience vs aggression)
- Hosts 05-06: Pathogen phase (warm-blooded, fast immune response)
- Hosts 07-08: Ecological Force (ecosystems, rival network)
- Hosts 09-11: Planetary Intelligence (human systems, integration)

### Host Specifications
1. **Host 01 - The Fallen Leaf**: Single zone, no defense events, tutorial
2. **Host 02 - The Woodlouse**: Single zone, basic defense events, ~15% countermeasure fail rate
3. **Host 03 - The Ant Colony**: Two zones (Outer Colony + Queen Node), Queen Node boss mechanic, colony collapse on kill
4. **Host 04 - The Rotting Elm**: Two zones, active attacks INTRODUCED, rare high-impact defense
5. **Host 05 - The Corvid**: Three zones, time-sensitive events, stress cascade, partial/full failure
6. **Host 06 - The Boar**: Three zones, countermeasure charges, vector mechanic (carry-over to next host)
7. **Host 07 - The River Network**: Three zones, environmental defense, SEASONAL CYCLE (spring/summer/autumn/winter)
8. **Host 08 - The Old-Growth Forest**: Four zones, rival network uses player's own tools
9. **Host 09 - The Agricultural System**: Four zones, chemical defense, supply chain spread
10. **Host 10 - The Urban Microbiome**: Five zones, human countermeasures, multi-front events, Research Institutions zone
11. **Host 11 - The Biosphere**: Six zones, INTEGRATION METER (inverted win condition), extinction-class events

### Defense Event System Rework
- **Failure states**: Partial failure (50% deduction, timer continues) and Full failure (100% deduction, timer extends)
- **Escalating pressure**: Deduction ramps over timer duration (starts at 25%, ramps to 100%)
- **Tier system (Host 10+)**: Tier 1 (random, unavoidable) and Tier 2 (scannable, higher success rate with pre-emptive countermeasure)
- **Grindable events (Host 04+)**: Manual trigger low-intensity events for Enzyme Reserves, escalating fail rate

### Active Attack System
- **Enzyme Reserves**: Secondary resource for active attacks, passive gain + grind rewards, capped at 100
- **Attack types by host range**: Low cost (04-06), Medium (07-08), High (09-10), Integration Pulse (11)
- **Host Stress**: Hidden accumulator,increases with attacks, decays over time, triggers frequency/severity multipliers at thresholds

### Config Structure Added
```
BALANCE.HOSTS - Per-host zone configs, defense profiles, win conditions
BALANCE.DEFENSE_EVENTS - Failure states, profiles, per-host fail rates
BALANCE.ENZYME_RESERVES - Passive gain, cap, grind rewards
BALANCE.ACTIVE_ATTACKS - Cost by host range, BPS bonus, cooldown, zone multipliers
BALANCE.HOST_STRESS - Decay rate, thresholds, effect multipliers
BALANCE.GRIND_EVENTS - Timer, base fail rate, escalation, rewards
BALANCE.EVENT_TIERS - Tier 2 unlock, success bonuses
```

## What Was Implemented In This Session

### Phase 1: Zone System & Host Definitions ✅

**balance.config.ts** (~700 lines now)
- Added `HOSTS` config with 11 host configurations
- Each host has: zones[], defenseEventProfile, activeAttackAvailable, winCondition
- Host-specific configs: queenNode, stress, vector, seasonal, rivalNetwork, supplyChain, researchZone, integrationMeter
- Added `DEFENSE_EVENTS` config: profiles, failure states, ramp curves, per-host fail rates
- Added `ACTIVE_ATTACKS`, `ENZYME_RESERVES`, `HOST_STRESS`, `GRIND_EVENTS`, `EVENT_TIERS` configs

**game.ts** (updated types + host definitions)
- New types: `HostId`, `DefenseEventProfile`, `WinCondition`, `ZoneDefinition`, `ZoneState`, `HostStressState`, `SeasonalState`, `RivalNetworkState`, `IntegrationZoneState`, `ActiveAttackState`
- Updated `GameState` with new fields: zones, currentHostId, enzymeReserves, hostStress, seasonalState, rivalNetworkState, integrationZones, integrationMeter, activeAttack, vectorProgress, activeGrindSession
- Updated `HostDefinition` with: hostId, zones[], defenseEventProfile, activeAttackAvailable, winCondition, flavorQuote
- New 11 host definitions with full narrative from spec

**values.ts**
- Added `createInitialZones()`, `createInitialIntegrationZones()` helpers
- Updated `createDefaultState()` with all new fields initialized

**formulas.ts** (~1420 lines now)
- Added zone formulas: `getZoneCompromisePercent`, `isZoneUnlocked`, `getHostCompromisePercent`, `getZoneDamageContribution`
- Added enzyme formulas: `getEnzymeReserveCap`, `getEnzymePassiveGainRate`, `getEnzymeGrindReward`, `canAffordActiveAttack`, `getActiveAttackCost`, `getActiveAttackBPSBonus`, `getActiveAttackCooldown`, `getActiveAttackStressIncrement`
- Added stress formulas: `getHostStressDecayRate`, `getHostStressThreshold1/2`, `getHostStressFrequencyMultiplier`, `getHostStressSeverityMultiplier`, `isHostUnderStress`
- Added defense formulas: `getCountermeasureFailRate`, `getPartialFailDeductionReduction`, `getFullFailTimerExtension`, `getDefenseEventFrequencyMultiplier`, `getDefenseEventSeverityMultiplier`, `getDefenseEventProfile`, `isDefenseEventProfileActive`
- Added grind formulas: `getGrindEventTimerSeconds`, `getGrindEventBaseFailRate`, `getGrindEventFailRateEscalation`, `getGrindEventEnzymeReward`, `getGrindEventSessionWindowSeconds`, `getGrindEventCurrentFailRate`
- Added integration formulas: `getIntegrationMeterMax`, `getIntegrationMeterSaturationThreshold`, `getIntegrationPulseCost`, `getIntegrationPulseDurationSeconds`, `getExtinctionEventFrequency`, `getExtinctionEventMeterRegression`, `isIntegrationComplete`, `getIntegrationContributionRate`
- Added vector formulas: `getVectorProgressThreshold`, `getVectorBPSBonus`
- Added seasonal formulas: `getSeasonDurationSeconds`, `getSeasonFromIndex`, `getSeasonalBPSModifier`, `getSeasonalEventFrequencyMultiplier`, `getMainChannelAttackAreaPercent`
- Added rival formulas: `getRivalZoneDecayRate`, `getRivalCountermeasureFrequency`, `getRivalCountermeasureBpsHaltSeconds`, `getHeartrootUnlockThreshold`, `isRivalNetworkSuppressed`, `getRivalControlZoneMultiplier`, `isZoneRivalControlled`, `getRivalDisruptionBPSBonus`
- Added research formulas: `getResearchZoneDefenseReduction`, `getMultiFrontStressThreshold`
- Added special zone formulas: `getQueenNodeHealthPercent`, `getQueenNodeCollapseDrainMultiplier`, `getNeuralStressReductionPercent`
- Updated `getProductionMultiplier` to include active attack BPS bonus and rival control zone multiplier

**happennings.ts** (~2900 lines now)
- Added zone helpers: `calculateZoneCorruptionPercent`, `calculateHostCorruptionFromZones`, `updateZoneStates`, `checkZoneUnlocks`
- Updated `gainBiomass` to handle zone-based damage distribution
- Updated `advanceStageAction` to initialize zones for next host, handle vector bonus carry-over
- Added enzyme/stress ticks: `tickEnzymeReserves`, `tickHostStress`, `tickActiveAttack`
- Added seasonal tick: `tickSeasonalCycle`
- Added `tickRivalNetwork` for Host 08 rival network mechanics
- Added `useActiveAttackAction` for spending enzyme reserves
- Updated `tick` to call new tick functions
- Updated `tryTriggerDefenseEvent` to use defense event profiles and seasonal modifiers
- Added `serializeZones`, `normalizeZones` for serialization
- Updated SerializedState interface and normalizeLoadedState for new fields
- Updated `canReleaseSpores` to handle Host 11 integration meter win condition
- Added rival network defense events (mycorrhizal-interference, allelopathic-warfare, zone-reclamation, spore-trap)

### Phase 2: Active Attack System & Host Stress ✅
- `useActiveAttackAction` function: spends enzyme reserves, applies BPS bonus, increments stress, sets cooldown
- `tickEnzymeReserves`: passive gain over time, respects cap
- `tickHostStress`: decay when no attacks used
- `tickActiveAttack`: handles attack duration expiration
- Active attack BPS bonus applied in `getProductionMultiplier`

### Phase 3: Seasonal Cycle - Host 07 ✅
- `tickSeasonalCycle`: initializes on stage 7, cycles through spring/summer/autumn/winter
- Seasonal BPS modifier applied in `getProductionMultiplier` (summer +20%, winter -30%)
- Seasonal event frequency modifier applied in `tryTriggerDefenseEvent` (spring 1.5x, winter 1.2x)

### Phase 4: Rival Network (Host 08) ✅
- **New defense events**: Added 4 Host 08-specific events (mycorrhizal-interference, allelopathic-warfare, zone-reclamation, spore-trap)
- **DefenseEventId type**: Updated to include new rival network events
- **`tickRivalNetwork` function**: Initializes rivalNetworkState on stage 8, handles rival countermeasures, zone decay, and node disruption
- **Rival countermeasures**: Periodically deploys countermeasures that reduce zone compromise by zoneDecayRate
- **Rival node disruption**: Active attacks on rival-controlled zones clear rival control and grant bonus BPS
- **`useActiveAttackAction` update**: Now handles rival disruption bonus in Host 08 (+25% BPS)
- **Production multiplier**: Applies rival control zone multiplier (50%) when attacking rival-controlled zones
- **Zone initialization**: advanceStageAction initializes zones with isRivalControlled=false for Host 08
- **New formulas**: `isRivalNetworkSuppressed`, `getRivalControlZoneMultiplier`, `isZoneRivalControlled`, `getRivalDisruptionBPSBonus`

## Technical Notes

### Design Principles Followed
- All tunable values in `balance.config.ts` - no hardcoded numbers
- Pure functions in `formulas.ts` - no side effects
- All mutations in `happennings.ts` - single source of truth
- Type-safe with TypeScript interfaces for all structures
- Serialization handles both old saves (with defaults) and new fields

### Key State Fields Added
```typescript
zones: ZoneState[]              // Per-host zone health and unlock state
currentHostId: HostId           // '01' through '11'
enzymeReserves: number          // Secondary resource for active attacks
hostStress: {                  // Hidden stress accumulator
  currentStress: number
  lastAttackTime: number
}
seasonalState: SeasonalState | null  // spring/summer/autumn/winter
rivalNetworkState: RivalNetworkState | null  // Host 08
integrationZones: IntegrationZoneState[]  // Host 11 planetary systems
integrationMeter: number       // Host 11 progress (0-100)
activeAttack: ActiveAttackState | null  // Current attack state
integrationPulse: IntegrationPulseState | null  // Signal-based BPS boost (Host 11)
vectorProgress: number         // Carry-over progress to next host
activeGrindSession: {          // Grindable event tracking
  eventCount: number
  windowStartTime: number
}
```

## Verification

- `npm run check` - 0 errors (4 CSS warnings in DefenseToast.svelte)
- `npm run build` - Successful (300KB JS, 67KB CSS)

## Important Current Files

- `src/engine/balance.config.ts` - All tunable constants (~740 lines)
- `src/lib/game.ts` - Types and 11 host definitions (~940 lines)
- `src/engine/values.ts` - State initialization (~225 lines)
- `src/engine/formulas.ts` - ~1610 lines of formula functions
- `src/engine/happenings.ts` - ~3520 lines of state management

## What Was Implemented In This Session

### Phase 5: Chemical Defense & Supply Chain (Hosts 09-10) ✅

**New Defense Event IDs (game.ts)**
- Added 8 new chemical/human countermeasure events: fungicide-spray, soil-fumigation, biocontrol-application, resistance-breaker, quarantine-protocol, research-crackdown, public-awareness-campaign, regulatory-crackdown
- Added ProactiveCountermeasureId type: preemptive-enzyme, preemptive-biofilm, preemptive-signal, preemptive-quorum

**New State Fields (game.ts, values.ts)**
- `proactiveCountermeasure: ProactiveCountermeasureId | null`
- `proactiveCountermeasureEndAt: number`
- `tier2ScanActive: boolean`
- `tier2ScannedEventId: DefenseEventId | null`
- `tier2PreemptiveSet: boolean`
- `supplyChainBonusActive: boolean`

**Balance Config (balance.config.ts)**
- Added `PROACTIVE_COUNTERMEASURES`: signalCost, durationMs, preemptiveSuccessRateBonus, matchingEvents
- Added `MULTI_FRONT`: extraEventCount (2), stressThresholdRatio (0.6)
- Added `SUPPLY_CHAIN_SPREAD`: bonusCarryoverPercent (50%), zoneStartHealthBonus (10%)
- Added `IMMEDIATE_HIT_EVENTS`: list of event IDs that trigger immediately without forecast
- Added `isImmediateHit: true` flag to chemical/human defense event definitions

**New Formulas (formulas.ts)**
- `getProactiveCountermeasureCost()`, `getProactiveCountermeasureDurationMs()`, `getProactiveCountermeasureSuccessBonus()`, `getProactiveCountermeasureMatchingEvents()`, `isProactiveCountermeasureActive()`, `doesProactiveCountermeasureMatchEvent()`
- `isTier2ScanningAvailable()`, `getTier2ScanCost()`, `getTier2PreemptiveBonus()`, `isTier2BonusApplied()`
- `getMultiFrontExtraEventCount()`, `getMultiFrontStressThresholdRatio()`, `isMultiFrontTriggered()`
- `getSupplyChainSpreadBonusCarryover()`, `getSupplyChainZoneStartBonus()`, `getSupplyChainBPSBonus()`
- `isImmediateHitEvent()`, `getImmediateHitDamageMultiplier()`
- Updated `getProductionMultiplier()` to include supply chain BPS bonus for Stage 10

**New Actions (happennings.ts)**
- `setProactiveCountermeasureAction()`: Spends Signal to set a proactive countermeasure that auto-activates when matching events trigger
- `scanDefenseEventAction()`: Spends Signal to reveal the next defense event (Host 10)
- `setPreemptiveCountermeasureAction()`: Sets a preemptive countermeasure after scanning for tier 2 bonus

**Event Logic Updates (happennings.ts)**
- `rollDefenseEventId()`: Now filters out immediate hit events (they won't be forecasted)
- `rollImmediateHitEventId()`: New function to roll for immediate hit events separately
- `tryTriggerDefenseEvent()`: 
  - Filters immediate hit events from eligible events list
  - Triggers immediate hit events in addition to normal events
  - Multi-front events trigger extra events when stress ratio >= 0.6 at Host 10
- `applyCountermeasureToEvent()`: Now applies proactive countermeasure bonus and tier 2 preemptive bonus
- `advanceStageAction()`: Now handles supply chain bonus carryover to Host 10, applies zone health bonus

**Defense Event Flavor Definitions (happennings.ts)**
- Added 8 new chemical/human countermeasure events with isImmediateHit: true flag
- Events include: fungicide-spray (35% output, 15s), soil-fumigation (50% output, 20s), biocontrol-application (40% output, 18s), resistance-breaker (45% output, 25s), quarantine-protocol (60% output, 30s), research-crackdown (55% output, 35s), public-awareness-campaign (40% clicks, 20s), regulatory-crackdown (65% output, 40s)

**Serialization (happennings.ts)**
- Updated `SerializedState` interface with new fields
- Updated `serialize()` and `normalizeLoadedState()` with new fields

### Phase 6: Integration Meter (Host 11) ✅

**New Defense Event IDs (game.ts)**
- Added 6 extinction-class events: atmospheric-collapse, hydrological-breakdown, geochemical-disruption, mass-extinction-pulse, tectonic-response, solar-isolation

**New State Fields (game.ts, values.ts)**
- `IntegrationPulseState`: { isActive, endsAt, bpsBonusMultiplier }
- `integrationPulse: IntegrationPulseState | null`

**New Formulas (formulas.ts)**
- `getZoneSaturationRate()`: Zone saturation rate based on compromise (0 at <50%, up to 0.1 at 100%)
- `getIntegrationMeterFillRate()`: Total fill rate from all unlocked, saturated zones
- `getIntegrationPulseBPSMultiplier()`: Returns 1.5 (50% BPS bonus during pulse)
- `canUseIntegrationPulse()`: Checks stage, signal cost, and active state
- `getIntegrationMeterRegressionMultiplier()`: Returns regression multiplier for extinction events
- Updated `getProductionMultiplier()` to include Integration Pulse BPS bonus

**New Functions (happennings.ts)**
- `tickIntegrationMeter()`: Fills integration meter from zone saturation, handles zone unlocking, handles integration pulse expiration
- `useIntegrationPulseAction()`: Spends 50 Signal to activate 30-second BPS boost

**Extinction Event Logic (happennings.ts)**
- Added `isExtinctionEvent` and `meterRegressionPercent` to `DefenseFlavorDefinition` type
- Added 6 extinction-class defense event definitions with devastating effects (40-70% output reduction, 60-120 second durations)
- `tryTriggerDefenseEvent()`: Rolls for extinction events separately at Host 11 (~5% chance per trigger), applies immediate meter regression

**Serialization (happennings.ts)**
- Added `integrationPulse` to SerializedState interface
- Updated `serialize()` and `normalizeLoadedState()` to handle integrationPulse field

## Next Steps (Remaining Implementation)

### Phase 7: Grindable Events & Tier System ✅ COMPLETE

**Grindable Events System (Host 04+)**
- Marked 4 defense events as grindable: `root-allelopathy`, `spore-predation`, `thermal-stratification`, `ecosystem-feedback`
- Added `isGrindable` to `DefenseFlavorDefinition` type and all event creation functions
- Added `tickGrindEvent()` - session window management (resets after 120s)
- Added `startGrindEventSession()` - starts a grind session
- Added `triggerGrindEvent()` - rolls for success/fail, awards +3 enzymes on success
- Integrated `tickGrindEvent` into main `tick()` function

**GrindPanel UI (new component)**
- Displays enzyme reserves with progress bar
- Shows session timer, events count, current fail rate with breakdown
- "Initiate Grind" / "Suppress" buttons
- Shows when `currentStage >= 4`

**Tier 2 Scanning (Host 10+)**
- Connected `scanDefenseEventAction` to GrindPanel - costs 3 Signal, reveals next threat
- Connected `setPreemptiveCountermeasureAction` to GrindPanel - costs 3 Signal, sets +25% success bonus
- Shows scanned event name and preemptive status
- Buttons appear when `currentStage >= 10`

**Store Integration (gameStore.ts)**
- Added `startGrindSession()`, `grindEvent()`, `scanDefenseEvent()`, `setPreemptiveCountermeasure()`
- All wired up to GrindPanel events in App.svelte

**Type Fixes**
- Made `activeGrindSession` nullable in GameState

## Verification

- `npm run check` - 0 errors (4 CSS warnings in DefenseToast.svelte - pre-existing)
- `npm run build` - Successful (317KB JS, 69KB CSS)

## Session Complete

All phases 1-7 implemented. Game is feature complete per the Host Sequence Redesign specification.
