# AGENTS.md — Mycelium Protocol

Browser-based incremental game. Fungal colony expansion theme.

## Tech Stack

- **Svelte 5** — UI framework (runes syntax)
- **TypeScript** — strict mode enabled
- **Vite 8** — build tool
- **Tailwind CSS v4** — styling (via `@tailwindcss/vite`)
- **break_eternity.js** — arbitrary-precision math for large numbers
- **GitHub Pages** — deployment target (`/mycelium/` base path)

## Commands

```bash
npm install     # Node.js 20+ required
npm run dev     # Vite dev server
npm run build   # Production build (outputs to dist/)
npm run preview # Preview production build
npm run check   # Runs: svelte-check + tsc (both tsconfig.app.json and tsconfig.node.json)
```

**No test runner** — balance verification is manual via `src/engine/simulation.ts`.

## Architecture

```
src/
  engine/              # Core game logic — STATELESS pure functions
    balance.config.ts  # SINGLE SOURCE OF TRUTH for all tunables
    formulas.ts        # Calculation functions
    happenings.ts      # State transitions, defense events, game ticks
    simulation.ts        # Headless balance verification (manual run)
    values.ts          # Default state helpers
  stores/
    gameStore.ts       # Svelte store wrapping engine actions
                       # COMPONENTS IMPORT FROM HERE ONLY
  lib/
    game.ts            # Type definitions, generator/upgrade/skill defs
    wiki.ts            # In-game wiki content
    SignalPanel.svelte # Signal economy UI (currently disabled)
  components/          # UI components
  lib/ui/              # Reusable UI primitives (TerminalButton, etc.)
  utils/
    formatNumber.ts    # Number formatting for display
```

## Critical Rules

1. **Never import from `engine/` directly in components** — always use `stores/gameStore.ts`
2. **All tunables live in `balance.config.ts`** — no magic numbers elsewhere
3. **State updates happen via store actions** — never mutate game state directly
4. **Signal economy temporarily disabled** — related code is commented out, don't re-enable without design review

## Build & Deploy

- Vite config sets `base: '/mycelium/'` for GitHub Pages subpath
- Deploy workflow: `.github/workflows/deploy.yml`
- Auto-deploys on push to `main`

## Save System

- localStorage auto-save every 30 seconds (`BALANCE.SAVE_INTERVAL_MS`)
- Offline gains calculated on visibility change (up to 3 hours)
- Offline narrative events generated for story continuity

## Debug Features (Dev Only)

```javascript
// Available in browser console when running dev server
window.gameDebug.speedUp()    // 2x time scale
window.gameDebug.slowDown()   // 0.5x time scale
window.gameDebug.pause()      // Stop ticks
window.gameDebug.resume()     // Resume 1x
window.gameDebug.getState()   // Get current game state
```

## Browser Automation

Use `agent-browser` for web automation. Run `agent-browser --help` for all commands.

Core workflow:
1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes

## TypeScript Config

- `tsconfig.json` — project references only
- `tsconfig.app.json` — extends `@tsconfig/svelte`, includes `src/**/*.{ts,js,svelte}`
- `tsconfig.node.json` — Vite config, strict mode with `noUnusedLocals: true`

## Styling

- CSS variables defined in `src/app.css` (dark theme, green-on-dark palette)
- Custom scrollbar styling via CSS variables
- CRT scanline effect via `body::after` pseudo-element

## User Preferences

- Avoid quick summary tables in responses unless explicitly requested
- Prefer inline descriptions over tabular formats for clarity
