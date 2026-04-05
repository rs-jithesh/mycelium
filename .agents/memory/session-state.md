# Session State

## Current Project State

- Project scaffolded as a Svelte 5 + Vite + TypeScript app in an originally empty workspace.
- Tailwind CSS v4 is connected through `@tailwindcss/vite` in `vite.config.ts` and `@import 'tailwindcss';` in `src/app.css`.
- Large-number handling is implemented with `break_eternity.js`.
- Core gameplay logic currently lives in `src/lib/game.ts`.
- Main UI shell and all current screen composition live in `src/App.svelte`.
- Reusable UI components now live under `src/lib/ui/`.
- Small supporting UI pieces still include `src/lib/Icon.svelte` and `src/lib/InfoTip.svelte`.

## What Was Implemented In This Session

### Phase 1 Completed

- Built the initial prototype loop:
  - click button to gather biomass
  - 100ms heartbeat
  - state persistence with `localStorage`
  - offline gains on load / tab return
- Added initial terminal-styled UI and CRT-inspired presentation.
- Set up number formatting for small, medium, and very large values.

### Phase 2 Completed

- Expanded the game store to support:
  - stage state for Stage 1 (`Dead Leaf`)
  - host health and completion
  - generator ownership
  - upgrade ownership
  - buy amount selection (`1`, `10`, `100`, `MAX`)
  - active defense events
- Added generators for tiers 1-4:
  - Hyphae Strand
  - Mycelial Mat
  - Rhizomorph Cord
  - Sporocarp Cluster
- Implemented generator cost scaling using `baseCost * 1.15^owned`.
- Added upgrades:
  - Chitinous Reinforcement
  - Exoenzyme Secretion
  - Lateral Transfer
- Reworked BPS and BPC as derived values based on upgrades and generator state.
- Added first defense events:
  - Drought
  - Beetle Disruption
- Added log entries for milestones, purchases, upgrades, defense events, save issues, offline gains, and host completion.
- Added ASCII host progress display and real host depletion based on biomass gained.

## UI Changes Made During This Session

### Early UI Refinements

- Simplified visible copy to make the interface easier to understand.
- Renamed or clarified several labels:
  - `ABSORB` -> `GATHER`
  - `PURGE` -> `RESET SAVE`
  - `Observation Log` -> `Activity Log`
  - `Host Status` -> `Progress`
  - `Heartbeat` -> `Game Info`
- Restored abbreviated stat labels in the biomass panel:
  - `BPC`
  - `BPS`
  - `EP`
  - `LTB`
- Added info icons with tap-friendly tooltips for those abbreviations using `src/lib/InfoTip.svelte`.
- Placed the info icons next to the labels rather than next to the values.
- Added monochrome SVG icons for generator rows and upgrade rows using `src/lib/Icon.svelte`.

### Design System And Shell Rebuild

- Added reusable Organic Brutalism UI components:
  - `src/lib/ui/TerminalPanel.svelte`
  - `src/lib/ui/TerminalButton.svelte`
  - `src/lib/ui/TerminalProgressBar.svelte`
  - `src/lib/ui/PromptField.svelte`
  - `src/lib/ui/TypewriterLog.svelte`
- Reworked the app into a command-center shell with:
  - left dock/sidebar
  - top system bar
  - workspace area with screen switching
  - bottom observation log footer
- Added desktop navigation/views for:
  - Terminal
  - Evolution
  - Spore
- Rebuilt the terminal screen into a command-center layout with biomass chamber, host panel, generator rail, and footer log.
- Implemented real `SYSTEM LOGS` toggle behavior so the footer log can be shown/hidden.
- Added CSS-native resizable support to `TerminalPanel` and applied it to major desktop sections.
- Made the footer observation log resizable and relaxed rigid footer sizing that was crushing alternate screens.

### Activity Log Improvements

- Improved the activity log:
  - stretches vertically where appropriate
  - duller text color for readability
  - auto-scrolls to bottom only when new entries arrive and the user is already near the bottom
  - remains scrollable/selectable for manual interaction

### Mobile Screens Added

- Added a dedicated mobile Terminal screen.
- Added a dedicated mobile Evolution screen.
- Added a dedicated mobile Spore screen.
- Added a fixed bottom mobile tab bar for screen switching.
- Split desktop-only and mobile-only layouts so phones do not render desktop Evolution/Spore screens underneath the mobile views.

## Technical Notes / Decisions

- `game.ts` is currently a single, central store file rather than being split into multiple modules.
- The current save format already serializes Decimal values and defense events safely.
- The current reset button is a hard local save reset only, not prestige.
- `EP` is currently tied directly to `lifetimeBiomass`, consistent with the earlier prototype implementation.
- Current offline efficiency is fixed at `10%`.
- Current host implementation is only Stage 1 (`Dead Leaf`) even though the state shape is ready for further stage expansion.
- Current command-center shell uses explicit desktop/mobile view branching inside `src/App.svelte`.
- `SYSTEM LOGS` state is currently controlled locally in `App.svelte` via `logsVisible`.
- Resizing is currently CSS-native (`resize`) rather than a custom drag system.
- Current Phase 3 gameplay systems are still not implemented in `game.ts`; the Evolution and Spore screens are UI-first shells that use existing state where possible.

## Verification Completed In This Session

- Repeatedly ran `npm run check` successfully after each meaningful change.
- Repeatedly ran `npm run build` successfully after each meaningful change.
- Repaired an early corrupted `node_modules` state caused by overlapping installs by reinstalling dependencies cleanly.

## Important Current Files

- `src/lib/game.ts`: central game logic, persistence, offline gains, generators, upgrades, host state, and defense events
- `src/App.svelte`: desktop/mobile command-center shell and all current screen composition
- `src/lib/Icon.svelte`: SVG icon set for generators and upgrades
- `src/lib/InfoTip.svelte`: touch-friendly info tooltip component
- `src/lib/ui/TerminalPanel.svelte`: reusable brutalist panel shell with optional CSS-native resize support
- `src/lib/ui/TerminalButton.svelte`: reusable primary/secondary/tertiary terminal button component
- `src/lib/ui/TerminalProgressBar.svelte`: reusable ASCII/block progress bar component
- `src/lib/ui/PromptField.svelte`: prompt-style display field component
- `src/lib/ui/TypewriterLog.svelte`: reusable scroll-following log component
- `src/app.css`: command-center shell, desktop/mobile screen styling, brutalist tokens, log and resize styling

## Next Step

### Phase 3 Changes To Implement Next

- Add Level 10 strain selection flow:
  - Parasite
  - Symbiote
  - Saprophyte (locked until first prestige for now)
- Add real mutation points and stat allocation logic to back the Evolution UI:
  - Virulence
  - Resilience
  - Complexity
- Add stat thresholds and at least the first implemented bonuses from each stat branch.
- Add initial skill tree structure and unlock rules.
- Add strain-specific modifiers and signature behavior hooks.
- Add strain lore entries and level milestone log entries.
- Wire the Evolution mobile/desktop screens to real state instead of placeholder values.
- Wire the Spore screen to a real prestige / release flow once Phase 4 starts.
- Ensure two different strain choices create meaningfully different runs.

## Cross-Check Summary

- The above notes match the current codebase state in `src/lib/game.ts`, `src/App.svelte`, `src/lib/Icon.svelte`, `src/lib/InfoTip.svelte`, and the reusable UI components under `src/lib/ui/`.
- No real Phase 3 gameplay systems are implemented yet, but the app now has dedicated Evolution and Spore UI shells on both desktop and mobile.
