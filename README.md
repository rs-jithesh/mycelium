# The Mycelium Protocol

A browser-based incremental (idle/clicker) game themed around fungal colony expansion. Grow your mycelium network by accumulating biomass, purchasing generator tiers, evolving through strain specialization, consuming progressively larger hosts, and eventually prestiging via "Spore Release."

## Tech Stack

| Technology | Role |
|---|---|
| Svelte 5 | UI framework |
| TypeScript | Primary language |
| Vite 8 | Build tool |
| Tailwind CSS v4 | Styling |
| break_eternity.js | Arbitrary-precision math for large numbers |
| GitHub Pages | Deployment target |

## Setup

**Prerequisites:** Node.js 20+

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type-check
npm run check
```

## Gameplay

### Scale Philosophy

Mycelium Protocol operates on **fungal scale** with readable compounding growth:

- **Readable numbers**: Biomass counts in ones, tens, thousands, millions
- **Readable BPS**: Passive output ranges from 0.01 to ~200,000 by endgame
- **No scientific notation**: Standard notation stays readable throughout the run
- **Meaningful decisions**: Every generator purchase matters and each new tier feels explosive
- **Week-long arc**: Full completion still aims for roughly 7 days

### Core Loop

1. **Absorb** -- Click to generate biomass (10-50 biomass per click early)
2. **Buy Generators** -- Spend biomass on 8 tiers of passive producers with compounding efficiency jumps (6x-17x)
3. **Advance Hosts** -- Consume hosts across 8 stages
   - Stage 1 (Dead Leaf): ~1 hour
   - Stage 2 (Fallen Log): ~2-3 hours
   - Stage 3 (Rotting Stump): ~6-8 hours
   - Stage 4 (Tree Trunk): ~1 day
   - Stage 5 (Forest Floor): ~2 days
   - Stage 6 (Root Network): ~4 days
   - Stage 7 (The Grove): ~6 days
   - Stage 8 (The Biosphere): ~7 days
4. **Allocate Stats** -- Earn stat points on host advancement and distribute them across Virulence, Resilience, and Complexity
5. **Prestige** -- Trigger a "Spore Release" to reset your run in exchange for a Genetic Memory multiplier

## Balance Philosophy

The Mycelium Protocol is designed as a **slow-burn incremental** experience with real compounding payoffs:

- **First Hour**: Players should feel meaningful progress without immediately exhausting Stage 1
- **First Day**: Stages 1-4 should deliver multiple unlock spikes and noticeable efficiency cliffs
- **First Week**: Full completion to Stage 8 should still land around 7 days of active/idle play
- **Prestige Layer**: Run 2+ introduces the Signal economy and earlier Genetic Memory relevance

Key tuning decisions:
- Generator cost exponent is low enough to allow meaningful bulk-buy acceleration without trivializing costs
- Tier unlocks create 10x-50x efficiency cliffs that feel rewarding
- Click values stay relevant early and during pressure spikes without replacing generator progression

### Strains

Choose a specialization that shapes your playstyle:

- **Parasite** -- Click-focused, rewarding active play
- **Symbiote** -- Passive/zero-click, favoring idle progression
- **Saprophyte** -- Balanced hybrid (unlocked after first prestige)

### Skills & Upgrades

- **9 Skills** across 3 branches, unlocked at Host Stage 3
- **9 Upgrades** -- 3 early-game and 6 for higher generator tiers (5-8)

### Defense Events

Survive 17 different defense events using one of 3 countermeasures (locked once equipped per run).

### Other Features

- **Progressive UI reveal** -- Elements unlock at gameplay milestones
- **Offline gains** -- Up to 3 hours of offline progress at 10% base efficiency
- **Auto-save** -- Every 30 seconds via localStorage
- **In-game Wiki** -- 7 sections with 16+ reference entries

## UI

4 views with a dark terminal aesthetic (CRT scanlines, green-on-dark palette):

- **Terminal** -- Main gameplay screen
- **Evolution** -- Strain selection, stat allocation, skill trees
- **Spore** -- Prestige interface
- **Wiki** -- In-game reference

Responsive layout with separate desktop and mobile markup.

## Project Structure

```
src/
  engine/        # Core game logic
    balance.config.ts   # All tunable constants
    values.ts           # Default state, getters/setters
    game.ts             # Type definitions and static data
    formulas.ts         # Pure calculation functions
    happenings.ts       # State transitions (tick, buy, prestige, etc.)
  stores/
    gameStore.ts        # Svelte store wrapping engine actions
  lib/             # Shared types and data
  utils/           # Utility functions
docs/              # Design documents and references
```

## Deployment

Automated via GitHub Actions (`.github/workflows/deploy.yml`) to GitHub Pages at `/mycelium/`.
