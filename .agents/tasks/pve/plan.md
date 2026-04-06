# PvE Enemy System Plan

## Overview

This plan describes a repo-native implementation of a PvE enemy system for The Mycelium Protocol. It adapts the original design intent to the current codebase architecture:

- immutable `GameState` transitions
- pure engine logic in `src/engine`
- a thin Svelte store wrapper in `src/stores/gameStore.ts`
- explicit save/load serialization in `src/engine/happenings.ts`
- existing defense-event and countermeasure systems

The goal is to add ecological enemy encounters that feel like host resistance and ecosystem conflict rather than a separate RPG combat layer.

## Design Principles

1. PvE must fit the existing fungal takeover theme.
2. PvE should reuse the current stat system:
   - Virulence for offensive pressure
   - Resilience for survival and attrition
   - Complexity for detection, extraction, and encounter quality
3. PvE should use the existing equipped countermeasure system rather than introducing a second combat-only countermeasure set.
4. PvE should coexist with the incremental loop instead of replacing it.
5. All PvE state must persist through the existing save/load pipeline.
6. The first version should be narrow and low-risk:
   - one active encounter at a time
   - immediate resolution when engaged
   - lightweight rewards and penalties
   - limited permanent bonuses

## Scope

### Core Systems

- Enemy bestiary and encounter definitions
- Enemy spawn rules tied to current host stage
- Encounter resolution using current build state
- Temporary debuffs from poor encounter outcomes
- Bestiary discovery and defeat tracking
- Terminal-view encounter presentation
- Save/load support for all PvE state

### Explicit Non-Goals For V1

- Real-time action combat
- Turn-based combat loops
- A second independent countermeasure inventory
- Heavy Signal economy dependence
- New top-level navigation tabs unless the feature proves necessary

## Repo Fit Notes

The original concept needs these adaptations to fit the current codebase:

1. Use `GameState`, not `PlayerState`.
2. Use the existing `CountermeasureId` values from `src/lib/game.ts`.
3. Keep spawn logic as pure state transitions instead of a stateful runtime class.
4. Avoid generic dispatch buses in favor of engine actions exposed by the store.
5. Follow existing terminal UI patterns instead of generic modal/Tailwind-only scaffolding.

## Proposed Files

### New Files

- `src/engine/pve/enemy.types.ts`
- `src/engine/pve/enemies.ts`
- `src/engine/pve/combat.ts`
- `src/engine/pve/spawn.ts`
- `src/components/pve/CombatEncounter.svelte`
- `src/components/pve/DebuffTracker.svelte`
- `src/components/pve/Bestiary.svelte`
- `src/utils/pveDebug.ts` (development-only, optional)

### Updated Files

- `src/lib/game.ts`
- `src/engine/values.ts`
- `src/engine/happenings.ts`
- `src/stores/gameStore.ts`
- `src/App.svelte`
- `src/lib/wiki.ts`
- `docs/game-reference.md`

## Data Model

### PvE Types

Create dedicated PvE types in `src/engine/pve/enemy.types.ts`.

Recommended types:

- `EnemyBehavior`
- `EnemyPowerValue = number | ((state: GameState) => number)`
- `EnemyRewardValue = number | ((state: GameState) => number)`
- `Enemy`
- `DropEntry`
- `DropResult`
- `PermanentBonus`
- `CombatOutcome`
- `CombatResult`
- `EnemyDebuffEffect`
- `EnemyDebuff`

### GameState Additions

Extend `GameState` in `src/lib/game.ts` with flat PvE fields to match current style.

Suggested fields:

- `activeEnemyEncounter: ActiveEnemyEncounter | null`
- `knownEnemies: string[]`
- `enemyEncounterCounts: Record<string, number>`
- `enemyVictoryCounts: Record<string, number>`
- `enemyDefeatCounts: Record<string, number>`
- `totalEnemiesDefeated: number`
- `totalEnemiesFailed: number`
- `activeEnemyDebuffs: ActiveEnemyDebuff[]`
- `nextEnemyCheckAt: number`
- `pendingEnemyNotification: string | null`
- `forcedEnemyId: string | null`

Optional run-level reward fields if rewards affect formulas directly:

- `enemyBpsMultiplierBonus: number`
- `enemyClickMultiplierBonus: number`
- `enemySignalMultiplierBonus: number`
- `enemyBonusStatPoints: number`
- `enemyCountermeasureSlotsBonus: number`

### Countermeasure Mapping

Enemy weaknesses and resistances should use existing `CountermeasureId` values:

- `moisture-buffer`
- `chitin-lattice`
- `enzyme-suppressor`
- `thermal-regulator`
- `signal-jammer`
- `spore-shield`

## Enemy Bestiary

Implement the 17-enemy bestiary in `src/engine/pve/enemies.ts`, but adapt the fields to the current codebase.

### Rules

1. `hostStageMax` must be `number | null`.
2. `power` may be static or state-derived.
3. `biomassReward` may be static or state-derived.
4. State-derived rewards must use existing state fields only.
5. Enemy flavor should reinforce ecological resistance and host conflict.

### Thematic Fit

Enemies should read as ecological threats to fungal spread:

- decomposers
- burrowers
- herbivores
- mollusks
- insectivores
- apex intrusions
- legendary ecosystem responses

## Combat Resolution

Implement pure combat logic in `src/engine/pve/combat.ts`.

### Core Functions

- `calculateEnemyPower(state, enemy)`
- `calculatePlayerEncounterPower(state, enemy)`
- `resolveCombat(state, enemy)`
- `rollDrops(state, enemy, outcome)`
- `createDebuff(enemy, outcome)`
- `getCombatFlavorMessage(enemy, outcome)`

### Player Power Inputs

Use current gameplay state:

- `state.stats.virulence`
- `state.stats.resilience`
- `state.stats.complexity`
- `state.strain`
- `state.equippedCountermeasure`
- `state.currentStage`
- unlocked skills
- host echoes if useful

### Enemy Behaviors

Recommended behaviors:

- `standard`
- `swarmer`
- `burrower`
- `armored`
- `stealer`
- `adapting`
- `sacrificial`

These should modify resolution cleanly without introducing a second gameplay loop.

### Outcomes

Use four outcomes:

- `perfect`
- `victory`
- `pyrrhic`
- `defeat`

### Reward Rules

Rewards may include:

- biomass gain
- optional Signal gain
- drops
- bestiary progression
- rare permanent or run-level bonus

### Penalty Rules

Poor outcomes may apply temporary debuffs such as:

- BPS reduction
- click reduction
- faster enemy spawn checks

## Spawn System

Implement spawn logic in `src/engine/pve/spawn.ts` as pure functions.

### Core Functions

- `getEligibleEnemies(state)`
- `getEnemySpawnCooldownMs(state)`
- `shouldAttemptEnemySpawn(state, now)`
- `rollEnemySpawn(state, now)`

### Spawn Inputs

Spawn logic should consider:

- current stage
- whether a host is completed
- whether an enemy encounter is already active
- current cooldown from `nextEnemyCheckAt`
- complexity-based spawn chance or detection quality
- resilience-based cooldown adjustment if desired

### V1 Constraints

- only one active enemy encounter at a time
- encounters should not replace defense events
- spawns should be infrequent enough to avoid overwhelming the run

## Engine Integration

Integrate PvE into `src/engine/happenings.ts`.

### Tick Flow Changes

Add these steps to the existing tick pipeline:

1. Tick active enemy debuffs.
2. Attempt PvE enemy spawn when eligible.
3. Update pending encounter notification state if an enemy appears.

### New Actions

Add engine actions for:

- `engageEnemyAction(state)`
- `dismissEnemyNotificationAction(state)`
- `forceEnemySpawnAction(state, enemyId)` for dev only
- optional `clearEnemyDebuffsAction(state)` for dev only

### Encounter Resolution Application

When an encounter is engaged:

1. resolve combat
2. apply rewards
3. apply debuffs if needed
4. update counts and codex discovery
5. append flavor logs
6. clear active encounter

### Stage And Prestige Interactions

On stage advance:

- clear current active encounter
- clear pending encounter notification
- keep long-term bestiary progress

On prestige:

- preserve bestiary progress if PvE is meant to be meta knowledge
- preserve only explicitly permanent bonuses
- reset run-level PvE bonuses and active debuffs

## Persistence

Extend save/load in `src/engine/happenings.ts`.

### Required Updates

1. extend `SerializedState`
2. serialize all PvE fields
3. rehydrate all PvE fields in `normalizeLoadedState`
4. provide safe defaults for old saves

### Important Constraint

This repo uses fully explicit serialization. Any new PvE state not added here will be lost on save/load.

## Store Integration

Update `src/stores/gameStore.ts` to expose thin wrappers for new engine actions.

Recommended store methods:

- `engageEnemy()`
- `dismissEnemyNotification()`
- `forceEnemySpawn(enemyId)` in development only

Do not add a generic event dispatcher.

## UI Plan

### Combat Encounter UI

Create `src/components/pve/CombatEncounter.svelte`.

Requirements:

1. Use the existing equipped countermeasure from `$game`.
2. Show countermeasure matchup quality rather than allowing a second selection.
3. Use terminal-style styling consistent with the rest of the app.
4. Allow immediate engagement and result display.

### Debuff Tracker

Create `src/components/pve/DebuffTracker.svelte`.

Requirements:

1. Show only active debuffs.
2. Display countdown and effect magnitude.
3. Match the existing alert/terminal tone.

### Bestiary UI

Create `src/components/pve/Bestiary.svelte`.

Requirements:

1. Track encountered and defeated enemies.
2. Reveal additional knowledge after repeated victories or encounters.
3. Use repo-native styling rather than generic utility-card presentation.

### Placement In App

Recommended placement in `src/App.svelte`:

1. A compact enemy threat card near `HostVisual` and `SUBSTRATE ANALYSIS`
2. A small PvE stats module in the sidebar
3. Global overlay rendering for the combat encounter UI
4. Debuff tracker rendered near the existing toast/overlay region

### Bestiary Placement

Recommended first approach:

- integrate as part of the existing wiki/codex flow
- avoid a new top-level nav item in v1

## Formula Integration

If PvE bonuses are intended to affect run power immediately, update `src/engine/formulas.ts`.

Possible integration points:

- passive production multiplier bonus
- click multiplier bonus
- Signal multiplier bonus if Signal is re-enabled
- stat-point or mutation-point reward handling where appropriate

### V1 Recommendation

Keep combat rewards conservative:

- biomass rewards
- bestiary progress
- temporary debuffs
- very limited permanent bonuses

This minimizes balance risk.

## Debug Tooling

If included, add `src/utils/pveDebug.ts` in development only.

Potential helpers:

- force spawn enemy
- clear debuffs
- unlock bestiary
- print enemy list

Any debug action should route through store and engine actions rather than mutating global state directly.

## Documentation

Update these docs after implementation:

- `src/lib/wiki.ts`
- `docs/game-reference.md`

Document:

- enemy spawn behavior
- combat outcome rules
- debuffs
- bestiary unlock behavior
- save/persistence behavior

## Implementation Order

### Phase 1: Foundations

1. Add PvE types
2. Add enemy definitions
3. Extend `GameState`
4. Add default values in `src/engine/values.ts`
5. Extend serialization and rehydration

### Phase 2: Engine

1. Implement pure combat resolution
2. Implement pure spawn logic
3. Integrate spawn and debuff ticking into `happenings.ts`
4. Add encounter engagement and resolution actions
5. Expose store actions

### Phase 3: UI

1. Add active encounter card
2. Add encounter overlay
3. Add debuff tracker
4. Add PvE sidebar stats
5. Add bestiary view

### Phase 4: Polish

1. Add dev tooling
2. Add wiki documentation
3. Add game reference documentation
4. Run verification and tune balance

## Verification

After each meaningful implementation step:

1. Run `npm run check`
2. Run `npm run build`
3. Verify save/load compatibility
4. Verify terminal and mobile layouts
5. Verify PvE does not drown out defense-event readability

## Risks

### Mechanical Risks

- encounter frequency overwhelming the incremental loop
- permanent bonuses destabilizing progression
- too much overlap with defense events

### Technical Risks

- save compatibility regressions
- duplicate or conflicting state between encounter UI and engine state
- introducing non-persistent class-based runtime state

### UX Risks

- adding too much noise to the terminal view
- making the player manage too many tactical systems simultaneously

## V1 Recommendation

The first shipping version should be intentionally narrow:

1. existing countermeasure affinity only
2. one active encounter at a time
3. immediate resolution on engage
4. biomass, logs, codex progress, and temporary debuffs as primary outputs
5. very rare permanent bonuses only

## Open Decision

Before full implementation, confirm whether enemy permanent bonuses should persist across prestige, or whether only codex/bestiary progress should persist in v1.
