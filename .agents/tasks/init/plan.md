# Mycelium Protocol Implementation Plan

## Overview

This plan tracks the phased implementation of the current browser prototype based on the game design document. It reflects both what is already built and what remains.

## Phase 1: Germination

### Goal

Establish the basic clicker loop, persistence, and terminal presentation.

### Scope

- Scaffold Svelte 5 + Vite + TypeScript project
- Add Tailwind CSS
- Add `break_eternity.js`
- Create central game store
- Implement manual biomass gain
- Implement 100ms heartbeat
- Implement save/load with `localStorage`
- Implement offline gains calculation on load / tab return
- Add initial terminal-style layout and CRT treatment
- Add baseline number formatting

### Status

- Completed

## Phase 2: Automation And Upgrades

### Goal

Introduce the idle loop, first host progression, and the first reactive disruptions.

### Scope

- Add generator definitions and ownership state
- Add buy amount modes (`1 / 10 / 100 / MAX`)
- Implement generator cost scaling
- Implement generator-driven passive income
- Add one-time upgrades and derived BPC/BPS recalculation
- Add Stage 1 host state and host depletion
- Add ASCII host bar
- Add first defense events
- Expand the activity log for milestone and gameplay events
- Improve usability of the UI

### Status

- Completed

### Implemented In Current Code

- Generators:
  - Hyphae Strand
  - Mycelial Mat
  - Rhizomorph Cord
  - Sporocarp Cluster
- Upgrades:
  - Chitinous Reinforcement
  - Exoenzyme Secretion
  - Lateral Transfer
- Defense events:
  - Drought
  - Beetle Disruption

## Phase 3: Evolutionary Strain

### Goal

Add build identity and meaningful player specialization.

### Scope

- Implement level milestone handling for Level 10 and Level 15
- Add strain selection UI and persistence
- Implement Parasite behavior modifiers
- Implement Symbiote behavior modifiers
- Gate Saprophyte behind first prestige
- Add mutation points earned from leveling
- Add stat allocation system:
  - Virulence
  - Resilience
  - Complexity
- Implement first stat threshold bonuses
- Add initial skill tree shell and unlock states
- Add strain-specific lore entries in the activity log
- Add enough differentiation so two runs feel distinct

### Suggested Implementation Order

1. Add missing state for mutation points, stats, unlocked strains, and skills.
2. Add level-based unlock detection and milestone logging.
3. Build strain selection modal/panel at Level 10.
4. Apply strain modifiers into BPC/BPS calculations.
5. Build stat allocation panel and derived effects.
6. Add first skill tree presentation and unlock logic.
7. Add lore and progression log entries.

### Status

- Next step

## Phase 4: Host Consumption And Prestige

### Goal

Expand stage progression and add the first real reset loop.

### Scope

- Implement stage state machine for multiple hosts
- Add hosts beyond Dead Leaf
- Add richer host progression and transitions
- Expand defense event system to the full set needed for early/mid game
- Implement prestige / Spore Release
- Add Genetic Memory calculation and persistence
- Add prestige confirmation UI
- Add Saprophyte unlock after first prestige
- Track highest stage reached

### Suggested Implementation Order

1. Generalize host data definitions and stage transitions.
2. Add stage completion handling and stage-advance logging.
3. Implement prestige requirements and projection calculations.
4. Add Genetic Memory state and production bonus integration.
5. Unlock Saprophyte after first prestige.

### Status

- Not started

## Phase 5: Terminal Polish

### Goal

Make the game feel atmospheric, coherent, and shareable.

### Scope

- Expand CRT effects and visual polish
- Add procedural audio with Web Audio API
- Add richer typewriter and ambient log behavior
- Add biomass shiver / surge feedback at higher output
- Add prestige transition effects
- Add settings panel:
  - volume
  - CRT toggle
  - font size
- Add export/import save support
- Performance audit
- Cross-browser testing
- Deployment

### Status

- Partially started only in visual styling

## Supporting Workstreams

### UI And UX

- Keep the UI readable despite terminal styling
- Prefer simple labels with flavor preserved where possible
- Continue touch-friendly affordances for mobile
- Add clear distinctions between clickable actions, passive systems, and warning states

### Architecture

- Keep `src/lib/game.ts` as the source of truth until it becomes costly to maintain
- Split logic only when Phase 3 or Phase 4 makes the store unwieldy
- Preserve Decimal-safe serialization in every new system

### Testing / Verification

- Run `npm run check` after each meaningful implementation step
- Run `npm run build` after each meaningful implementation step
- Watch for regressions in save compatibility, mobile layout, and log behavior

## Current Codebase Snapshot

- Framework: Svelte 5
- Build tool: Vite
- Styling: Tailwind CSS v4 + custom CSS
- Large numbers: `break_eternity.js`
- Persistence: `localStorage`
- Major gameplay file: `src/lib/game.ts`
- Main screen: `src/App.svelte`

## Immediate Next Task

Implement Phase 3: strain selection, mutation points, stats, early skill tree scaffolding, and strain-specific gameplay differences.
