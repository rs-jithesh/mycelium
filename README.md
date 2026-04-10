# The Mycelium Protocol

A browser-based incremental (idle/clicker) game themed around fungal colony expansion. Grow your mycelium network by accumulating biomass, purchasing generator tiers, evolving through strain specialization, consuming progressively larger hosts across 11 stages, and eventually prestiging via "Spore Release."

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

1. **Absorb** -- Click to generate biomass and damage hosts
2. **Buy Generators** -- Spend biomass on 8 tiers of passive producers
3. **Advance Hosts** -- Consume hosts across 11 stages with escalating complexity
   - Stage 1 (The Fallen Leaf): Single-zone introduction
   - Stage 2 (The Woodlouse): Basic defense events
   - Stage 3 (The Ant Colony): Multi-zone with Queen Node mechanic
   - Stage 4 (The Rotting Elm): Active attacks introduced
   - Stage 5 (The Corvid): Stress cascade and three zones
   - Stage 6 (The Boar): Host-as-vector mechanic
   - Stage 7 (The River Network): Environmental events, seasonal cycles
   - Stage 8 (The Old-Growth Forest): Rival network defense
   - Stage 9 (The Agricultural System): Chemical defense, supply chain spread
   - Stage 10 (The Urban Microbiome): Human countermeasures, tier-2 events
   - Stage 11 (The Biosphere): Integration meter win condition, extinction-class events
4. **Allocate Stats** -- Earn mutation points on host advancement and distribute them across Virulence, Resilience, and Complexity
5. **Active Attacks** -- Spend enzyme reserves to launch targeted assaults on specific host zones (Stage 4+)
6. **Prestige** -- Trigger a "Spore Release" to reset your run in exchange for Genetic Memory and permanent bonuses

## Balance Philosophy

The Mycelium Protocol is designed as a **slow-burn incremental** experience with real compounding payoffs:

- **First Hour**: Players should feel meaningful progress with Stage 1 and early Stage 2
- **First Day**: Stages 1-5 deliver unlock spikes, zone mechanics, and active attack introduction
- **First Week**: Mid-game hosts (6-8) introduce environmental challenges and rival networks
- **Full Run**: Late-game hosts (9-11) feature human countermeasures and planetary-scale integration

Key tuning decisions:
- Generator cost exponent creates meaningful bulk-buy decisions without trivializing costs
- Tier unlocks create efficiency cliffs that feel rewarding
- Click values stay relevant through Host Echo bonuses and active attack mechanics
- Zone-based hosts create tactical decisions about where to focus damage

### Strains

Choose a specialization that shapes your playstyle. Each strain has a signature ability that triggers based on your build:

- **Parasite** -- Click-focused with Hemorrhagic Burst (periodic massive click multipliers). Virulence reduces burst interval and increases multiplier. Thrives on active play.
- **Symbiote** -- Passive-focused with Mycorrhizal Network (periodic BPS pulses). Complexity reduces pulse interval and increases pulse strength. Optimized for idle progression.
- **Saprophyte** -- Balanced hybrid with Decomposition Loop (recovers lost biomass from expired defense events). Resilience improves recovery rate. Features hybrid bonus when distributing stats across multiple branches. Unlocked after first prestige.

### Skills & Upgrades

**Skills (9 total)** -- Unlocked at Stage 3, each requires stat investment:
- **Virulence branch**: Enzymatic Breakdown, Acidic Secretion, Hemorrhagic Spread
- **Resilience branch**: Chitin Shell, Dormancy Protocol, Spore Hardening  
- **Complexity branch**: Quorum Recursion, Signal Amplification, Distributed Cognition

**Upgrades (9 total)** -- One-time purchases that persist until prestige:
- **Early game**: Chitinous Reinforcement, Exoenzyme Secretion, Lateral Transfer
- **Tier 5-8**: Canopy Ventilation, Decomposer Surge, Nexus Overweave, Membrane Tension
- **Late game**: Neural Propagation, Terminus Strike

### Defense Events

Survive escalating defense events using countermeasures (one per run):

- **30+ defense events**: Drought, Beetle Disruption, Cold Snap, Immune Response, Fungicide Spray, Atmospheric Collapse, Mass Extinction Pulse, and more
- **6 Countermeasures** with tiered coverage (70% full / 30% partial mitigation):
  - **Moisture Buffer** — Full: Drought, Desiccation Pulse / Partial: Cold Snap, Antifungal Exudates
  - **Chitin Lattice** — Full: Beetle Disruption, Insect Vector Swarm / Partial: Lignin Fortification, Spore Predation
  - **Enzyme Suppressor** — Full: Antifungal Exudates, Microbial Rivalry / Partial: Viral Hijack, Root Allelopathy
  - **Thermal Regulator** — Full: Cold Snap, Thermal Stratification, UV Surge / Partial: Desiccation Pulse, Ecosystem Feedback
  - **Signal Jammer** — Full: Immune Response, Spore Competition / Partial: Viral Hijack, Microbial Rivalry
  - **Spore Shield** — Full: Spore Predation, Lignin Fortification / Partial: Insect Vector Swarm, Nutrient Sequestration
- **Defense profiles vary by host**: Basic, Clustered, Rare High-Impact, Time-Sensitive, Countermeasure Charges, Environmental, Rival Network, Chemical, Human Countermeasures, Extinction-Class
- **Tier 2 events** (Host 10+): More severe variants with escalated failure rates
- **Multi-front events**: Simultaneous defense pressure in late-game hosts

### Other Features

- **Host Zones** -- Multi-zone hosts (Stage 3+) require strategic zone-by-zone consumption with unlock thresholds
- **Host Echoes** -- Earn permanent bonuses based on how you clear each host (Aggressive, Efficient, Resilient, Patient)
- **Active Attacks** -- Spend enzyme reserves to assault specific zones (Stage 4+)
- **Grindable Events** -- Host 4+ introduces grindable defense events with diminishing returns
- **Signal Economy** -- Prestige-layer resource (Stage 3+, Run 2+). Signal provides production bonuses, can be spent on Coordination Commands, Vulnerability Windows, and Rival Suppression. Currently implemented but UI exposure is experimental.
- **Stat Soft Caps** -- Stats have diminishing returns past 3 points, encouraging hybrid builds
- **Progressive UI reveal** -- Elements unlock at gameplay milestones
- **Offline gains** -- Up to 3 hours of offline progress at full efficiency
- **Offline Narrative** -- Story events that occurred while away
- **Auto-save** -- Every 30 seconds via localStorage
- **In-game Wiki** -- Reference documentation with search and browse

## UI

4 main views with a dark terminal aesthetic (CRT scanlines, green-on-dark palette):

- **Terminal** -- Main gameplay screen with biomass chamber, host analysis, defense controls, generator modules, and upgrades
- **Evolution** -- Strain selection, stat allocation with soft-cap visualization, skill trees, and Host Echo display
- **Spore** -- Prestige interface with Genetic Memory projection
- **Wiki** -- In-game reference with searchable entries

Additional panels:
- **Grind Panel** -- Grindable event interface (Host 4+)
- **Defense Toast** -- Active defense event notifications
- **Host Visual** -- Zone visualization for current host

Responsive layout with separate desktop and mobile markup.

## Project Structure

```
src/
  engine/              # Core game logic
    balance.config.ts  # All tunable constants (BALANCE object)
    formulas.ts        # Pure calculation functions
    happenings.ts      # State transitions, defense events, ticks
    simulation.ts      # Headless balance verification
    values.ts          # Default state helpers
  stores/
    gameStore.ts       # Svelte store wrapping engine actions
  lib/                 # Shared types and data
    game.ts            # Type definitions, generator/upgrade/skill definitions
    wiki.ts            # In-game wiki content
    SignalPanel.svelte # Signal economy UI (experimental)
  components/          # UI components
    DefenseToast.svelte
    GrindPanel.svelte
    HostVisual.svelte
  lib/ui/              # Reusable UI components
    TerminalButton.svelte
    TerminalPanel.svelte
    TerminalProgressBar.svelte
    TypewriterLog.svelte
  utils/               # Utility functions
    formatNumber.ts
docs/                  # Design documents
```

## Deployment

Automated via GitHub Actions (`.github/workflows/deploy.yml`) to GitHub Pages at `/mycelium/`.
