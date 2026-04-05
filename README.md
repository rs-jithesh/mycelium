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

### Core Loop

1. **Absorb** -- Click to generate biomass (primary currency)
2. **Buy Generators** -- Spend biomass on 8 tiers of passive producers (Hyphae Strand through Planetary Membrane)
3. **Advance Hosts** -- Consume hosts across 8 stages (Dead Leaf through The Biosphere), each with escalating health pools
4. **Allocate Stats** -- Earn stat points on host advancement and distribute them across Virulence, Resilience, and Complexity
5. **Prestige** -- Trigger a "Spore Release" to reset your run in exchange for a Genetic Memory multiplier

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
