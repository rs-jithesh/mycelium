# Signal Economy Reimplementation Guide

This document describes how to restore the Signal economy after it was temporarily disabled with code comments.

The codebase is TypeScript and differs from the original JS-oriented prompt in a few important ways:

- `currentStage` is effectively 1-indexed for stage labels and progression.
- Engine logic is immutable `GameState -> GameState`, not in-place mutation.
- Components read from the Svelte store in `src/stores/gameStore.ts`.

## Current status

Signal scaffolding still exists in the codebase:

- state fields remain in `src/lib/game.ts` and `src/engine/values.ts`
- balance constants remain in `src/engine/balance.config.ts`
- the `SignalPanel.svelte` component still exists at `src/lib/SignalPanel.svelte`

What is currently commented out is the runtime wiring.

## Files to restore

### `src/App.svelte`

Restore the import:

```ts
import SignalPanel from './lib/SignalPanel.svelte'
```

Restore both panel insertions:

- desktop terminal under the biomass chamber
- mobile hero section under the defense strip

Search for:

- `Signal economy temporarily disabled.`

and uncomment the `SignalPanel` usage.

### `src/stores/gameStore.ts`

Restore the commented imports from `../engine/happenings`:

- `spendSignalCoordinationCommand`
- `spendSignalVulnerabilityWindow`
- `spendSignalRivalSuppression`
- `spendSignalNetworkIsolation`

Restore the four wrapper actions:

- `coordinationCommand`
- `vulnerabilityWindow`
- `rivalSuppression`
- `networkIsolation`

Restore them in the returned store object.

Restore the exported `signalActions` object at the bottom of the file.

### `src/engine/formulas.ts`

Re-enable the Signal-driven production hooks:

1. In `getProductionMultiplier(...)`
- restore the Stage 3 carry bonus for `sporocarp-cluster`
- restore the extra `lateral-transfer` Stage 3 carry bonus

2. In `getGeneratorProduction(...)`
- restore the coordination link multiplier block:

```ts
const coordinationMultiplier = getCoordinationMultiplierForTier(state, tierIndex)
if (coordinationMultiplier !== 1) {
  production = production.mul(coordinationMultiplier)
}
```

3. In `calculateBiomassPerSecond(...)`
- restore the overspend multiplier:

```ts
return total.mul(getSignalOverspendMultiplier(state))
```

The Signal formula helpers are still present in this file and do not need to be rewritten unless the design changes.

### `src/engine/happenings.ts`

Restore the runtime behavior in four places.

1. In `gainBiomass(...)`
- restore vulnerability-based host damage:

```ts
const vulnerabilityMultiplier = formulas.getVulnerabilityWindowMultiplier(state)
const hostDamage = amount.mul(vulnerabilityMultiplier)
```

2. In `recalculateDerivedState(...)`
- restore derived Signal state:

```ts
signalCap: formulas.isSignalUnlocked(state) ? formulas.getSignalCap(state) : 0,
signalPerSecond: formulas.isSignalUnlocked(state) ? formulas.getSignalPerSecond(state) : 0,
signalDecaying: formulas.isSignalUnlocked(state) ? formulas.getSignalDecayRate(state) > 0 : false,
signalOverspent: formulas.isSignalUnlocked(state) ? formulas.isSignalOverspent(state) : false,
```

3. In `checkVisibilityUnlocks(...)`
- restore the `signalPanel` unlock block and its three log lines

4. In `tick(...)`
- restore the call to `tickSignalSystem(next, deltaMs)` before `tickDefenseResponseState(...)`

There is also a full Signal section lower in the file containing:

- `tickSignalSystem`
- `tickCoordinationLinks`
- `tickVulnerabilityWindow`
- `tickRivalSuppression`
- `spendSignalCoordinationCommand`
- `spendSignalVulnerabilityWindow`
- `spendSignalRivalSuppression`
- `spendSignalNetworkIsolation`

That block was left in place and can be reused as-is unless you want to redesign Signal.

### `src/engine/simulation.ts`

Restore Signal-specific simulation behavior.

1. Uncomment imports:

- `tickSignalSystem`
- `spendSignalCoordinationCommand`
- `spendSignalVulnerabilityWindow`
- `spendSignalRivalSuppression`

2. Restore Signal milestones:

- `Signal unlocked (Stage 3)`
- `First coord command issued`
- `Signal cap maxed (>= cap)`

3. Restore helper functions:

- `getOwnedSignalTiers(...)`
- `autoSpendSignal(...)`

4. In `advanceAnalyticalChunk(...)`
- restore vulnerability-based host damage
- restore `tickSignalSystem(next, seconds * 1000)`

5. In both simulation phases
- restore calls to `autoSpendSignal(state)`

6. In the analytical loop
- restore 1-second chunking after Signal unlock:

```ts
const chunk = Math.min(formulas.isSignalUnlocked(state) ? 1 : 30, remainingJump)
```

7. Restore the final Signal summary line.

## Supporting files already in place

These do not need to be recreated:

- `src/lib/SignalPanel.svelte`
- Signal-related state fields in `src/lib/game.ts`
- Signal-related default values in `src/engine/values.ts`
- Signal balance constants in `src/engine/balance.config.ts`

## Re-enable checklist

1. Uncomment the runtime integration in the five files above.
2. Run:

```bash
npm run check
npm run build
```

3. Run the simulator:

```bash
npx tsx src/engine/simulation.ts 24
```

4. Verify:

- Signal panel appears at Stage 3
- overspend affects BPS again
- coordination links change generator output again
- vulnerability windows increase host damage again
- simulation prints Signal milestones and summary again

## Notes

- The rival-combat system referenced by the original Signal prompt is still not present as a complete standalone module in this repo, so `networkIsolation` remains only a store/engine action until combat wiring exists.
- The structural early-tier pacing rework was not removed. Only Signal-related runtime behavior was disabled.
