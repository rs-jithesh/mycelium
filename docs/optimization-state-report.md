# Optimization State Report

## Purpose

This report captures the current economy state, pacing results, core progression curves, and operative formulas for `The Mycelium Protocol`.

It is intended as a handoff artifact for an AI agent that will optimize the economy.

## Current Status

- The 8-tier economy is implemented.
- Stage-gated tiers 5-8 are implemented and verified.
- The efficiency cliff target is preserved across all 7 tier transitions.
- The headless simulation now completes in about `0.1s` wall time for a 10-day run.
- `getLevelFromEp()` was changed from iterative to inverse-formula-based to avoid catastrophic performance at high EP.
- Build status: `svelte-check` passes, `vite build` passes.

## Primary Balance Problems

These are the main issues the optimization agent should solve:

- Upgrades are too efficient and accelerate the economy too sharply.
- Once multiplicative effects start stacking, the economy blows out of proportion quickly.
- Mid and late progression become unstable because multiple systems compound too aggressively at once.
- The current balance is functional, but not yet stable.

Implication:

- Optimization should focus on stabilizing growth, not just preserving current clear times.
- The agent should assume that upgrade power is currently overtuned unless proven otherwise.

## Source Of Truth Files

- `src/engine/balance.config.ts`
- `src/engine/formulas.ts`
- `src/engine/simulation.ts`
- `src/lib/game.ts`

## Economy Goals

- Preserve the tier-to-tier efficiency cliff. Target window: `500x-800x`, nominal target `~600x`.
- Stage pacing target:
  - Stage 1: `~12m`
  - Stage 2: `~90m`
  - Stage 3: `~4h`
  - Stage 4: `~10h`
  - Stage 5: `~24h`
  - Stage 6: `~48h`
  - Stage 7: `~4d`
  - Stage 8: `~7d`
- Tiers 1-4 should unlock by ownership progression.
- Tiers 5-8 should unlock as stage-clear paradigm shifts.

## Current Generator Curve

Generator cost curve:

```ts
cost(generator, owned) = baseCost * 1.18^owned
```

Generator production curve:

```ts
production(generator, owned, state) = baseProduction * owned * productionMultiplier(state, generator)
```

Generator efficiency definition used for cliff verification:

```ts
efficiency(generator, owned) = baseProduction / cost(generator, owned)
```

Biomass per second:

```ts
bps(state) = sum(generatorProduction(state, generatorId) for all generators)
```

### Base Generator Values

| Tier | Generator | Base Cost | Base Production | Stage Gate |
|---|---|---:|---:|---:|
| 1 | Hyphae Strand | `10` | `0.1` | `0` |
| 2 | Mycelial Mat | `100` | `114.64` | `0` |
| 3 | Rhizomorph Cord | `2,500` | `328,560` | `0` |
| 4 | Sporocarp Cluster | `28,000` | `422,610,800` | `0` |
| 5 | Fruiting Canopy | `56,000,000` | `9.69e13` | clear Stage `2` |
| 6 | Decomposer Bloom | `112,000,000,000` | `2.222e19` | clear Stage `4` |
| 7 | Subterranean Nexus | `224,000,000,000,000` | `5.094e24` | clear Stage `6` |
| 8 | Planetary Membrane | `4.48e17` | `1.168e30` | clear Stage `7` |

Unlock ownership thresholds:

```ts
GENERATOR_UNLOCK_THRESHOLDS = [0, 10, 10, 10, 10, 10, 10, 10]
```

Stage gates:

```ts
GENERATOR_STAGE_GATES = [0, 0, 0, 0, 2, 4, 6, 7]
```

Semantics:

- Tier 2 visible when Tier 1 owned >= 10.
- Tier 5 visible when Tier 4 owned >= 10 and `currentStage > 2`.
- Tier 6 visible when Tier 5 owned >= 10 and `currentStage > 4`.
- Tier 7 visible when Tier 6 owned >= 10 and `currentStage > 6`.
- Tier 8 visible when Tier 7 owned >= 10 and `currentStage > 7`.

## Efficiency Cliff Constraint

The game depends on each newly unlocked tier being dramatically more efficient than the previous tier at that previous tier's unlock threshold.

Verification logic:

```ts
cliff(tier n -> n+1) = efficiency(nextTier, 0) / efficiency(currentTier, unlockThreshold)
```

Target contract:

- Must stay in `500x-800x`
- Intended center is `~600x`

This is a hard optimization constraint, not a soft preference.

## Host / Stage Curve

Host depletion is linear against total biomass production:

```ts
hostHealth(t + dt) = max(0, hostHealth(t) - productionDuringDt)
hostProgress = (hostMaxHealth - hostHealth) / hostMaxHealth
```

Current host health values:

| Stage | Host Health | Intended Dominant Tier |
|---|---:|---|
| 1 | `1_000` | Tier 1 |
| 2 | `2.31e14` | Tiers 2-4 |
| 3 | `1.34e20` | Tier 5 |
| 4 | `3.45e20` | Tier 5 |
| 5 | `2.18e26` | Tier 6 |
| 6 | `3.94e26` | Tier 6 |
| 7 | `2.05e32` | Tier 7 |
| 8 | `8.04e37` | Tier 8 |

This curve is a staged step function, not a smooth analytic curve.

## Upgrades State

Only 3 upgrades currently exist:

| Upgrade | Cost | Effect | Unlock |
|---|---:|---|---|
| Chitinous Reinforcement | `75` | Hyphae Strand `+25%` | 5 Hyphae |
| Exoenzyme Secretion | `12,000` | All generators `+5%` | 5 Mycelial Mat |
| Lateral Transfer | `2,500,000` | Click value `x2` | 5 Rhizomorph Cord |

Known gap:

- There are no upgrades yet for tiers 5-8.

Known balance problem:

- The existing upgrade model is already too explosive even before adding tier 5-8 upgrades.
- Additional upgrades should not simply continue the same power pattern.
- Upgrade effects likely need to be reduced, flattened, delayed, capped, or shifted away from broad multiplicative scaling.

## Multipliers And Meta Curves

### Passive production multiplier

Per-generator production multiplier:

```ts
productionMultiplier(state, generator) =
  upgradeMultipliers
  * strainPassiveModifier
  * passiveStatMultiplier
  * geneticMemoryMultiplier
  * defensePenaltyMultipliers
  * symbioteExtraScalingIfApplicable
```

Relevant passive contributors:

- Complexity stat: `+5%` passive per point
- Complexity >= 1: additional `x1.05`
- Enzymatic Breakdown: `x1.1`
- Quorum Recursion: `x1.08`
- Distributed Cognition: `x1.12`
- Spore Hardening: `x1.1`
- Exoenzyme Secretion: `+5%`, scaled by upgrade effectiveness
- Chitinous Reinforcement: Tier-1-only `+25%`, scaled by upgrade effectiveness
- Symbiote strain: base passive `x2.5`, plus `+0.1%` per other owned generator
- Parasite strain: passive `x0.5`
- Saprophyte strain: passive `x1.5`
- Genetic memory: `1 + 0.02 * gamma`

Balance concern:

- Too many independent multiplicative sources touch passive production.
- Even when each individual bonus looks modest, the stack compounds into runaway growth.
- Optimization should audit whether some of these should become additive, tier-scoped, conditional, or weaker.

### Click curve

```ts
clickValue(state) =
  1
  * lateralTransferIfOwned
  * strainClickModifier
  * (1 + virulence * 0.15)
  * virulenceThresholdBonusIfVirulence>=3
  * acidicSecretionIfOwned
  * hemorrhagicSpreadIfOwned
  * defenseClickMultipliers
  * geneticMemoryMultiplier
```

### Upgrade effectiveness curve

```ts
upgradeEffectiveness = 1 + complexity * 0.05 + signalAmplificationBonus
```

Note: the current implementation adds the `signal-amplification` bonus additively on top of the base complexity term rather than multiplying.

Balance concern:

- Upgrade scaling is part of the blow-up problem.
- Effects that improve upgrade effectiveness amplify every upgrade downstream and can destabilize the economy fast.

## Level / EP Curve

Current formula:

```ts
EP required for level L = 150 * L^2.6
```

Current implementation derives level from lifetime biomass directly:

```ts
evolutionPoints = lifetimeBiomass
level = floor((EP / 150)^(1 / 2.6)), then corrected upward by verification loop
```

### Important Observation

This level curve is computationally fixed but balance-wise highly inflated.

Examples from current formula:

- `1e10 EP -> level ~1,022`
- `1e15 EP -> level ~85,561`
- `1e20 EP -> level ~7,167,200`
- `1e30 EP -> level ~50,292,515,902`

This means long-run levels are now astronomically large. That may be mathematically acceptable for simulation, but it is probably not good product balance for progression, UI, prestige pacing, or skill/stat economy.

This is likely a major optimization target.

## Prestige Curve

Current prestige gain:

```ts
if lifetimeBiomass < 1e14:
  gain = 0
else:
  gain = floor(sqrt(lifetimeBiomass / 1e14))
```

Genetic memory bonus:

```ts
geneticMemoryMultiplier = 1 + 0.02 * totalGamma
```

Potential concern:

- Since lifetime biomass and level now explode very hard late game, prestige pacing may need to be re-audited against the new 8-tier economy.

## Simulation Model

`src/engine/simulation.ts` uses a hybrid model:

- Phase 1: real tick simulation through Stage 1
- Phase 2: analytical jump simulation for later stages

Analytical phase logic, approximately:

1. Buy all currently affordable generators/upgrades in bulk.
2. Auto-advance stage if the host is complete.
3. Compute BPS from current owned generators.
4. Jump forward to the next meaningful event:
   - host depletion
   - next highest-tier purchase, batched with a minimum `300s` jump
   - or `1/4` of remaining host time for periodic purchase cycles

This model is optimized for balance exploration, not exact frame-accurate gameplay.

## Current Simulation Results

Command used:

```bash
npx tsx src/engine/simulation.ts 240
```

Observed result:

```text
Stage 1 cleared     12m
Stage 2 cleared     1h 39m
Stage 3 cleared     4h 5m
Stage 4 cleared     9h 49m
Stage 5 cleared     23h 10m
Stage 6 cleared     1d 22h 11m
Stage 7 cleared     3d 20h 1m
Stage 8 cleared     6d 16h 55m
```

Tier unlock timeline:

```text
Tier 2   7m
Tier 3   17m
Tier 4   22m
Tier 5   1h 39m
Tier 6   9h 49m
Tier 7   1d 22h 11m
Tier 8   3d 20h 1m
```

Final state after full run:

```text
Stage: 8 (completed)
Level: 55,206,077,445,049
BPS: 3.299e32
Generators:
  Tier 1  467
  Tier 2  455
  Tier 3  440
  Tier 4  431
  Tier 5  389
  Tier 6  348
  Tier 7  307
  Tier 8  269
```

## Pacing Curve Vs Targets

| Stage | Simulated Clear Time | Simulated Segment Length | Target Segment Length | Notes |
|---|---:|---:|---:|---|
| 1 | `12m` | `12m` | `~12m` | on target |
| 2 | `1h 39m` | `1h 27m` | `~90m` | close |
| 3 | `4h 5m` | `2h 25m` | `~4h total` | close on cumulative |
| 4 | `9h 49m` | `5h 44m` | `~10h total` | close on cumulative |
| 5 | `23h 10m` | `13h 20m` | `~24h total` | close on cumulative |
| 6 | `1d 22h 11m` | `23h 1m` | `~48h total` | slightly fast |
| 7 | `3d 20h 1m` | `1d 21h 49m` | `~4d total` | close |
| 8 | `6d 16h 55m` | `2d 20h 54m` | `~7d total` | slightly fast |

Interpretation:

- The stage pacing is broadly successful.
- Late-game is a bit fast, but not catastrophically so.
- The economy now fully traverses all 8 stages with meaningful tier transitions.

## Progress Curves To Optimize

### 1. Tier unlock curve

This is now a staircase progression with major discrete jumps:

- Fast unlock chain from T1 -> T4 in early game
- Large stage-clear gates for T5 -> T8

Optimization target:

- Preserve the dramatic jumps.
- Prevent early tiers from feeling irrelevant too soon.

### 2. Stage-health curve

Current shape is piecewise stepped by intended dominant tier. This is working, but could be refined to tighten late-game pacing.

Optimization target:

- Keep Stage 1 simple.
- Keep Stage 2 around 90m.
- Tighten Stage 6-8 if exact targets matter.

### 3. Level curve

This is the weakest current curve from a game-design perspective.

Optimization target:

- Replace the current `EP = 150 * level^2.6` relation with something that does not yield trillions of levels by endgame.
- Preserve fast early level access for strain/skill unlocks.
- Decide whether `evolutionPoints = lifetimeBiomass` should remain 1:1.

### 4. Upgrade curve

This is incomplete because the economy now has 8 tiers but only 3 upgrades.

Optimization target:

- First stabilize existing upgrade efficiency before adding more upgrade content.
- Add upgrades for tiers 5-8.
- Ensure the upgrade economy does not flatten the efficiency cliff.
- Decide whether upgrades should be per-tier, global, or milestone-based.

Specific warning:

- Do not extend the current upgrade pattern blindly.
- Broad global multipliers are especially risky.
- Prefer upgrades that create texture or local decisions rather than universal acceleration.

### 5. Prestige curve

This likely needs a full pass now that late-game biomass is far larger and stage pacing is longer.

Optimization target:

- Re-evaluate the prestige divisor and square-root scaling.
- Verify expected first-prestige timing and post-prestige acceleration.

## Hard Constraints For Optimization Agent

Do not violate these without explicit approval:

- Keep the 8-tier structure.
- Keep tiers 5-8 stage-gated.
- Keep the efficiency cliff in the `500x-800x` range.
- Keep Stage 1 health at `1000` unless explicitly changed.
- Keep all tunable constants in `balance.config.ts`.
- Keep generator definitions in `game.ts` reading from `BALANCE`.
- Keep Decimal-based production and costs.

## Recommended Optimization Questions

1. Should the level curve be decoupled from raw lifetime biomass?
2. Should late-stage host health rise slightly to hit Stage 8 closer to exactly 7 days?
3. Which upgrade effects should be nerfed, capped, delayed, or redesigned to stop runaway compounding?
4. What is the intended number and shape of upgrades for tiers 5-8 once the current system is stabilized?
5. Should Stage 2 be tightened from `1h 39m` down closer to `1h 30m`?
6. Should early tiers contribute more meaningfully after a new tier unlocks, or is current obsolescence acceptable?
7. What should the expected first-prestige timing be under the new 8-tier economy?

## Short Summary

The economy is now functional end-to-end and the core pacing is close to target.

The main remaining balance problems are:

- upgrades are too efficient and accelerate progression too hard
- multiplicative systems compound into runaway growth quickly
- level inflation is extreme
- upgrades stop at tier 3
- prestige has not been re-tuned for the new curve
- late-game pacing is slightly faster than target
