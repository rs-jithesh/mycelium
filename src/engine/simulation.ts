/**
 * simulation.ts
 * Headless balance verification runner.
 *
 * Uses the real game engine for the early game (tick-by-tick),
 * then switches to analytical fast-forward for later stages where
 * the engine is too slow to simulate days of game time.
 *
 * Defense events are disabled for clean pacing measurements.
 *
 * Run:  npx tsx src/engine/simulation.ts [duration_hours]
 * E.g.: npx tsx src/engine/simulation.ts 240   (10 days)
 */

import {
  createFreshState,
  tick,
  advanceStageAction,
  absorb as engineAbsorb,
  checkVisibilityUnlocks,
  buyGeneratorAction,
  buyUpgradeAction,
  purchaseSkillAction,
  allocateStatAction,
  chooseStrainAction,
  // Signal economy temporarily disabled.
  // tickSignalSystem,
  // spendSignalCoordinationCommand,
  // spendSignalVulnerabilityWindow,
  // spendSignalRivalSuppression,
} from './happenings'
import * as formulas from './formulas'
import { BALANCE } from './balance.config'
import type { GameState, GeneratorId, SkillId, StatId } from '../lib/game'
import { generatorDefinitions, skillDefinitions, upgradeDefinitions } from '../lib/game'
import Decimal from 'break_eternity.js'

declare const process: { argv: string[]; cwd(): string; platform: string }

const dynamicImport = (specifier: string): Promise<any> => (0, eval)(`import(${JSON.stringify(specifier)})`)
const fs = await dynamicImport('fs')
const path = await dynamicImport('path')
const { exec } = await dynamicImport('child_process')

const args = process.argv.slice(2)
const verbose = args.includes('--verbose')
const positionalArgs = args.filter((a) => !a.startsWith('--'))
const DURATION_HOURS = parseFloat(positionalArgs[0] ?? '240')
const MAX_GAME_SECONDS = DURATION_HOURS * 3600
const TICK_MS = BALANCE.TICK_MS
const ACTIVE_PLAY_UNTIL_SECONDS = 12 * 3600
const CLICK_INTERVALS_MS_BY_STAGE = [3500, 6000, 9000, 10000, 11000, 12000, 13000, 14000, 15000, 16000, 17000]
const STAT_PRIORITY: StatId[] = ['virulence', 'virulence', 'complexity', 'virulence', 'resilience', 'complexity', 'virulence', 'resilience', 'complexity', 'virulence', 'resilience']
const SKILL_PRIORITY: SkillId[] = ['enzymatic-breakdown', 'quorum-recursion', 'chitin-shell', 'acidic-secretion', 'signal-amplification', 'dormancy-protocol', 'hemorrhagic-spread', 'distributed-cognition', 'spore-hardening']

// ── Milestones ──────────────────────────────────────────────────────────

const milestones = [
  { label: 'First generator', check: (s: GameState) => s.generators['hyphae-strand'].owned >= 1 },
  { label: 'First host cleared (Strain)', check: (s: GameState) => formulas.getCompletedHosts(s) >= 1 },
  { label: 'Stage 3 reached (Skills)', check: (s: GameState) => s.currentStage >= 3 },
  { label: 'Stage 1 cleared', check: (s: GameState) => s.currentStage >= 2 },
  { label: 'Stage 2 cleared', check: (s: GameState) => s.currentStage >= 3 },
  // Signal economy temporarily disabled.
  // { label: 'Signal unlocked (Stage 3)', check: (s: GameState) => s.currentStage >= 3 },
  { label: 'Stage 3 cleared', check: (s: GameState) => s.currentStage >= 4 },
  { label: 'Stage 4 cleared', check: (s: GameState) => s.currentStage >= 5 },
  { label: 'Stage 5 cleared', check: (s: GameState) => s.currentStage >= 6 },
  { label: 'Stage 6 cleared', check: (s: GameState) => s.currentStage >= 7 },
  { label: 'Stage 7 cleared', check: (s: GameState) => s.currentStage >= 8 },
  { label: 'Stage 8 cleared', check: (s: GameState) => s.currentStage >= 9 },
  { label: 'Stage 9 cleared', check: (s: GameState) => s.currentStage >= 10 },
  { label: 'Stage 10 cleared', check: (s: GameState) => s.currentStage >= 11 },
  { label: 'Stage 11 cleared', check: (s: GameState) => s.currentStage >= 11 && s.hostCompleted },
  // { label: 'First coord command issued', check: (s: GameState) => s.activeCoordinationLinks.length > 0 },
  // { label: 'Signal cap maxed (>= cap)', check: (s: GameState) => s.signal >= formulas.getSignalCap(s) * 0.95 },
]
for (let t = 1; t < generatorDefinitions.length; t++) {
  const gen = generatorDefinitions[t]
  milestones.push({
    label: `Tier ${t + 1} unlocked (${gen.name})`,
    check: (s: GameState) => s.visibility.generatorTiers[t],
  })
}
const reached = new Map<string, number>()

interface SimSnapshot {
  gameSeconds: number
  bps: number
  biomass: number
  stage: number
  milestone?: string
}

// ── Helpers ─────────────────────────────────────────────────────────────

function fmt(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatReadable(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (value >= 100) {
    return Math.round(value).toLocaleString('en-US')
  }
  if (value >= 1) {
    return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  }
  if (value > 0) {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  }
  return '0'
}

function genSummary(s: GameState): string {
  return generatorDefinitions.map((g) => `${g.name.charAt(0)}:${s.generators[g.id].owned}`).join(' ')
}

function suppressDefense(state: GameState, fakeTime: number): GameState {
  if (state.activeDefenseEvents.length === 0 && state.nextDefenseCheckAt > fakeTime) return state
  return { ...state, nextDefenseCheckAt: fakeTime + 1e12, activeDefenseEvents: [], pendingDefenseEvents: [] }
}

// Signal economy temporarily disabled.
// function getOwnedSignalTiers(state: GameState): number[] {
//   return generatorDefinitions
//     .map((generator, index) => ({ generator, index }))
//     .filter(({ generator, index }) => state.visibility.generatorTiers[index] && state.generators[generator.id].owned > 0)
//     .map(({ index }) => index)
// }

// function autoSpendSignal(state: GameState): GameState {
//   if (!formulas.isSignalUnlocked(state)) return state
//   if (state.signal < formulas.getSignalCap(state) * 0.7) return state
//   return state
// }

function advanceAnalyticalChunk(state: GameState, seconds: number): GameState {
  const bps = formulas.calculateBiomassPerSecond(state)
  const production = bps.mul(seconds)
  // Signal economy temporarily disabled.
  const hostDamage = production

  let next: GameState = {
    ...state,
    biomass: state.biomass.add(production),
    lifetimeBiomass: state.lifetimeBiomass.add(production),
    hostHealth: Decimal.max(0, state.hostHealth.sub(hostDamage)),
    hostCompleted: state.hostHealth.sub(hostDamage).lte(0),
    biomassPerSecond: bps,
  }

  return next
}

function checkMs(state: GameState, gs: number): void {
  for (const m of milestones) {
    if (!reached.has(m.label) && m.check(state)) {
      reached.set(m.label, gs)
      console.log(`${fmt(gs).padStart(15)} | \u2713 ${m.label}`)
    }
  }
}

function recordSnapshot(
  snapshots: SimSnapshot[],
  state: GameState,
  gameSeconds: number,
  nextSnapshotAtRef: { value: number },
  intervalSeconds: number,
  force = false,
): void {
  if (force) {
    snapshots.push({
      gameSeconds,
      bps: state.biomassPerSecond.toNumber(),
      biomass: state.lifetimeBiomass.toNumber(),
      stage: state.currentStage,
    })
    return
  }

  while (gameSeconds >= nextSnapshotAtRef.value) {
    snapshots.push({
      gameSeconds,
      bps: state.biomassPerSecond.toNumber(),
      biomass: state.lifetimeBiomass.toNumber(),
      stage: state.currentStage,
    })
    nextSnapshotAtRef.value += intervalSeconds
  }
}

function generateChartHtml(snapshots: SimSnapshot[]): string {
  function fmtTime(seconds: number): string {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    if (days > 0) return `${days}d ${hours}h`
    return `${hours}h`
  }

  function escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
  }

  const labels = snapshots.map((s) => fmtTime(s.gameSeconds))
  const bpsData = snapshots.map((s) => s.bps)
  const biomassData = snapshots.map((s) => s.biomass)
  const stageData = snapshots.map((s) => s.stage)
  const bpsPoints = snapshots.map((s) => ({ x: s.gameSeconds, y: s.bps }))
  const biomassPoints = snapshots.map((s) => ({ x: s.gameSeconds, y: s.biomass }))
  const stagePoints = snapshots.map((s) => ({ x: s.gameSeconds, y: s.stage }))
  const maxStage = Math.max(...stageData, 1)

  const milestoneRows = snapshots
    .filter((s) => s.milestone)
    .map((s) => `<tr><td>${fmtTime(s.gameSeconds)}</td><td>${s.stage}</td><td>${escapeHtml(s.milestone ?? '')}</td></tr>`)
    .join('\n')

  const jumpPoints: Array<{ label: string; magnitude: number }> = []
  for (let i = 1; i < snapshots.length; i++) {
    const jump = bpsData[i] - bpsData[i - 1]
    if (jump >= 2) {
      jumpPoints.push({
        label: labels[i],
        magnitude: Math.round(jump * 10) / 10,
      })
    }
  }

  const jumpRows = jumpPoints
    .map((j) => `<tr><td>${j.label}</td><td>+${j.magnitude} OOM</td></tr>`)
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Mycelium Protocol - Simulation Output</title>
<style>
  body { font-family: monospace; background: #0e0e0e; color: #ccc; margin: 0; padding: 24px; box-sizing: border-box; }
  h1 { font-size: 14px; color: #3a3; letter-spacing: 0.1em; margin: 0 0 4px; }
  .subtitle { font-size: 11px; color: #555; margin: 0 0 24px; }
  .chart-wrap { position: relative; width: 100%; height: 420px; background: #111; border: 1px solid #222; padding: 16px; box-sizing: border-box; margin-bottom: 24px; }
  .tables { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .table-section h2 { font-size: 11px; color: #555; letter-spacing: 0.08em; margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; color: #444; padding: 4px 8px; border-bottom: 1px solid #222; }
  td { padding: 4px 8px; border-bottom: 1px solid #1a1a1a; color: #aaa; }
  .no-jumps { font-size: 11px; color: #2a7a4a; margin-top: 4px; }
  .legend { display: flex; gap: 20px; margin-bottom: 12px; font-size: 11px; color: #555; flex-wrap: wrap; }
  .legend-item { display: flex; align-items: center; gap: 6px; }
  .legend-dot { width: 20px; height: 2px; }
  @media (max-width: 900px) {
    .tables { grid-template-columns: 1fr; }
    .chart-wrap { height: 360px; }
  }
</style>
</head>
<body>

<h1>&gt; MYCELIUM PROTOCOL - SIMULATION OUTPUT</h1>
<p class="subtitle">Both resource axes use raw values. Snapshots every game-hour in Phase 1 and every analytical step in Phase 2.</p>

<div class="legend">
  <div class="legend-item"><div class="legend-dot" style="background:#3a3"></div> BPS</div>
  <div class="legend-item"><div class="legend-dot" style="background:#2a6;border-top:2px dashed #2a6;height:0"></div> Biomass</div>
  <div class="legend-item"><div class="legend-dot" style="background:#444"></div> Stage</div>
</div>

<div class="chart-wrap">
  <canvas id="simChart"></canvas>
</div>

<div class="tables">
  <div class="table-section">
    <h2>// MILESTONES</h2>
    <table>
      <thead><tr><th>Time</th><th>Stage</th><th>Event</th></tr></thead>
      <tbody>${milestoneRows || '<tr><td colspan="3" style="color:#333">No milestones recorded</td></tr>'}</tbody>
    </table>
  </div>
  <div class="table-section">
    <h2>// BPS JUMPS &gt;= 2 OOM</h2>
    ${jumpPoints.length === 0
      ? '<p class="no-jumps">No major BPS jumps detected. Curve looks smooth.</p>'
      : `<table>
          <thead><tr><th>Time</th><th>Jump</th></tr></thead>
          <tbody>${jumpRows}</tbody>
        </table>`
    }
  </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
<script>
const bpsData = ${JSON.stringify(bpsPoints)};
const biomassData = ${JSON.stringify(biomassPoints)};
const stageData = ${JSON.stringify(stagePoints)};
const maxStage = ${JSON.stringify(maxStage)};

function fmtTime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return days + 'd ' + hours + 'h';
  return hours + 'h';
}

new Chart(document.getElementById('simChart'), {
  type: 'line',
  data: {
    datasets: [
      {
        label: 'BPS',
        data: bpsData,
        borderColor: '#3a3',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        pointRadius: 0,
        yAxisID: 'yLeft',
        tension: 0.2,
      },
      {
        label: 'Biomass',
        data: biomassData,
        borderColor: '#2a6',
        backgroundColor: 'transparent',
        borderWidth: 1,
        pointRadius: 0,
        borderDash: [4, 2],
        yAxisID: 'yRight',
        tension: 0.2,
      },
      {
        label: 'Stage',
        data: stageData,
        borderColor: '#333',
        backgroundColor: 'transparent',
        borderWidth: 1,
        pointRadius: 0,
        yAxisID: 'yStage',
        tension: 0,
        stepped: true,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111',
        borderColor: '#333',
        borderWidth: 1,
        titleColor: '#3a3',
        bodyColor: '#888',
        titleFont: { family: 'monospace', size: 11 },
        bodyFont: { family: 'monospace', size: 10 },
        callbacks: {
          title: (items) => items.length > 0 ? fmtTime(Number(items[0].parsed.x)) : '',
          label: (ctx) => {
            if (ctx.dataset.label === 'Stage') return 'Stage: ' + ctx.parsed.y
            const val = Number(ctx.parsed.y)
            return ctx.dataset.label + ': ' + new Intl.NumberFormat('en-US', {
              minimumFractionDigits: val < 1 ? 2 : 0,
              maximumFractionDigits: val < 1 ? 4 : 2,
            }).format(val)
          }
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        ticks: {
          color: '#444',
          font: { family: 'monospace', size: 10 },
          maxTicksLimit: 16,
          maxRotation: 0,
          autoSkip: true,
          callback: (v) => fmtTime(Number(v)),
        },
        grid: { color: '#1a1a1a' },
        title: {
          display: true,
          text: 'game time',
          color: '#444',
          font: { family: 'monospace', size: 10 },
        },
      },
      yLeft: {
        type: 'linear',
        position: 'left',
        ticks: {
          color: '#444',
          font: { family: 'monospace', size: 10 },
          callback: (v) => String(Math.round(Number(v))),
        },
        grid: { color: '#1a1a1a' },
        title: {
          display: true,
          text: 'BPS',
          color: '#444',
          font: { family: 'monospace', size: 10 },
        },
      },
      yRight: {
        type: 'linear',
        position: 'right',
        ticks: {
          color: '#4a7',
          font: { family: 'monospace', size: 10 },
          callback: (v) => String(Math.round(Number(v))),
        },
        grid: { display: false },
        title: {
          display: true,
          text: 'Biomass',
          color: '#4a7',
          font: { family: 'monospace', size: 10 },
        },
      },
      yStage: {
        type: 'linear',
        position: 'right',
        offset: true,
        min: 1,
        max: maxStage,
        ticks: {
          color: '#333',
          font: { family: 'monospace', size: 10 },
          stepSize: 1,
          callback: (v) => 'S' + v,
        },
        grid: { display: false },
      },
    },
  },
});
</script>
</body>
</html>`
}

function getActiveClickIntervalMs(state: GameState, gameSeconds: number): number | null {
  if (gameSeconds > ACTIVE_PLAY_UNTIL_SECONDS) return null
  const stageIndex = state.currentStage - 1
  if (stageIndex < 0 || stageIndex >= CLICK_INTERVALS_MS_BY_STAGE.length) return null
  if (state.strain === 'symbiote') return null
  return CLICK_INTERVALS_MS_BY_STAGE[stageIndex]
}

function getSimulatedManualBps(state: GameState, gameSeconds: number): number {
  const intervalMs = getActiveClickIntervalMs(state, gameSeconds)
  if (!intervalMs) return 0
  return state.biomassPerClick.toNumber() * (1000 / intervalMs)
}

function chooseGeneratorPurchase(state: GameState): GeneratorId | null {
  const reserve = Decimal.max(state.biomassPerClick.mul(8), state.biomassPerSecond.mul(45))

  const affordable = generatorDefinitions
    .filter((gen, index) => state.visibility.generatorTiers[index])
    .map((gen) => ({
      gen,
      cost: formulas.getGeneratorCostByOwned(gen.id, state.generators[gen.id].owned),
    }))
    .filter(({ cost }) => state.biomass.gte(cost) && state.biomass.sub(cost).gte(reserve))

  if (affordable.length === 0) {
    const firstCost = formulas.getGeneratorCostByOwned('hyphae-strand', state.generators['hyphae-strand'].owned)
    return state.biomass.gte(firstCost) ? 'hyphae-strand' : null
  }

  let best = affordable[0]
  let bestScore = best.gen.baseProduction.toNumber() / Math.max(1, best.cost.toNumber())
  for (const candidate of affordable) {
    const score = candidate.gen.baseProduction.toNumber() / Math.max(1, candidate.cost.toNumber())
    if (score > bestScore) {
      best = candidate
      bestScore = score
    }
  }

  for (let i = affordable.length - 1; i >= 0; i--) {
    const candidate = affordable[i]
    const score = candidate.gen.baseProduction.toNumber() / Math.max(1, candidate.cost.toNumber())
    if (score >= bestScore * 0.65) {
      return candidate.gen.id
    }
  }

  return best.gen.id
}

function simulatePlayerChoices(state: GameState, fakeTime: number): { state: GameState; purchased: boolean } {
  let s = checkVisibilityUnlocks(state, fakeTime)
  let purchased = false
  let progressed = true
  let safety = 0

  while (progressed && safety < 200) {
    progressed = false
    safety++

    if (formulas.getCompletedHosts(s) >= 1 && s.strain === null) {
      const next = chooseStrainAction(s, 'parasite')
      if (next !== s) {
        s = next
        purchased = true
        progressed = true
        continue
      }
    }

    while (s.mutationPoints > 0) {
      const spent = formulas.getSpentMutationPoints(s.stats)
      const statId = STAT_PRIORITY[spent] ?? 'complexity'
      const next = allocateStatAction(s, statId)
      if (next === s) break
      s = next
      purchased = true
      progressed = true
    }
    if (progressed) continue

    for (const skillId of SKILL_PRIORITY) {
      const next = purchaseSkillAction(s, skillId)
      if (next !== s) {
        s = next
        purchased = true
        progressed = true
        break
      }
    }
    if (progressed) continue

    for (const upg of upgradeDefinitions) {
      const next = buyUpgradeAction(s, upg.id)
      if (next !== s) {
        s = next
        purchased = true
        progressed = true
        break
      }
    }
    if (progressed) continue

    const generatorId = chooseGeneratorPurchase(s)
    if (!generatorId) break
    const next = buyGeneratorAction(s, generatorId)
    if (next === s) break
    s = next
    purchased = true
    progressed = true
  }

  return { state: s, purchased }
}

// ── Phase 1: Tick-by-tick engine run (up to the switchover point) ───────

/** Run the real engine tick-by-tick for precise early-game timing. */
function runTickPhase(
  state: GameState,
  fakeTime: number,
  gameSeconds: number,
  maxSeconds: number,
  snapshots: SimSnapshot[],
  nextSnapshotAtRef: { value: number },
  snapshotIntervalSeconds: number,
): { state: GameState; fakeTime: number; gameSeconds: number } {
  const maxTicks = Math.floor((maxSeconds - gameSeconds) * 1000 / TICK_MS)
  let lastMinute = -1
  let nextAutoClickAt = fakeTime

  for (let i = 0; i < maxTicks; i++) {
    fakeTime += TICK_MS
    gameSeconds += TICK_MS / 1000

    let clickIntervalMs = getActiveClickIntervalMs(state, gameSeconds)
    while (clickIntervalMs !== null && fakeTime >= nextAutoClickAt) {
      state = engineAbsorb(state)
      nextAutoClickAt += clickIntervalMs
      clickIntervalMs = getActiveClickIntervalMs(state, gameSeconds)
    }

    state = tick(state, fakeTime)
    state = suppressDefense(state, fakeTime)

    // Debug: periodic status (only if verbose)
    if (verbose) {
      const cm = Math.floor(gameSeconds / 60)
      if (cm !== lastMinute) {
        lastMinute = cm
        console.log(`${fmt(gameSeconds).padStart(15)} |   S${state.currentStage} BPS=${formatReadable(state.biomassPerSecond.toNumber())} HP=${formatReadable(state.hostHealth.toNumber())} | ${genSummary(state)}`)
      }
    }

    ;({ state } = simulatePlayerChoices(state, fakeTime))
    checkMs(state, gameSeconds)
    recordSnapshot(snapshots, state, gameSeconds, nextSnapshotAtRef, snapshotIntervalSeconds)

    // Auto-advance
    if (state.hostCompleted && formulas.hasNextStage(state)) {
      state = advanceStageAction(state)
    }

    checkMs(state, gameSeconds)

    if (reached.size === milestones.length) break

    if (gameSeconds >= ACTIVE_PLAY_UNTIL_SECONDS) break
  }

  return { state, fakeTime, gameSeconds }
}

// ── Phase 2: Analytical fast-forward ────────────────────────────────────

/**
 * After the early game, production is dominated by the highest unlocked tier.
 * We analytically compute time to deplete host health, buy generators, and
 * unlock new tiers without running the expensive per-tick engine.
 */
function runAnalyticalPhase(
  state: GameState,
  fakeTime: number,
  gameSeconds: number,
  snapshots: SimSnapshot[],
  nextSnapshotAtRef: { value: number },
  snapshotIntervalSeconds: number,
): { state: GameState; fakeTime: number; gameSeconds: number } {

  const MAX_ITER = 200_000
  let lastLoggedMinute = -1

  for (let iter = 0; iter < MAX_ITER && gameSeconds < MAX_GAME_SECONDS; iter++) {
    ;({ state } = simulatePlayerChoices(state, fakeTime))

    // Auto-advance stage
    if (state.hostCompleted && formulas.hasNextStage(state)) {
      state = advanceStageAction(state)
      ;({ state } = simulatePlayerChoices(state, fakeTime))
    }

    checkMs(state, gameSeconds)
    if (reached.size === milestones.length) break

    // Compute BPS for time jumps
    const bps = formulas.calculateBiomassPerSecond(state)
    const effectiveBps = bps.add(getSimulatedManualBps(state, gameSeconds))
    if (effectiveBps.lte(0)) break

    // ── Determine time to next meaningful event ──

    let jumpSeconds = MAX_GAME_SECONDS - gameSeconds  // default: jump to end

    // 1) Time until host depletes — this is always the hard upper bound
    if (!state.hostCompleted && state.hostHealth.gt(0)) {
      const s = state.hostHealth.div(effectiveBps).toNumber()
      if (s > 0 && s < jumpSeconds) jumpSeconds = s
    }

    const nextGeneratorId = chooseGeneratorPurchase(state)
    if (nextGeneratorId) {
      const cost = formulas.getGeneratorCostByOwned(nextGeneratorId, state.generators[nextGeneratorId].owned)
      const deficit = cost.sub(state.biomass)
      if (deficit.gt(0)) {
        const s = deficit.div(effectiveBps).toNumber()
        if (s > 0 && s < jumpSeconds) jumpSeconds = s
      }
    }

    // Clamp the jump to at most 1/4 of remaining host time for responsiveness.
    if (!state.hostCompleted && state.hostHealth.gt(0)) {
      const hostTimeRemaining = state.hostHealth.div(effectiveBps).toNumber()
      const quarterTime = hostTimeRemaining / 4
      if (quarterTime > 1 && quarterTime < jumpSeconds) {
        jumpSeconds = quarterTime
      }
    }

    // 3) Time until cheapest available upgrade
    for (const upg of upgradeDefinitions) {
      if (state.upgrades[upg.id]) continue
      if (state.generators[upg.requiredGenerator].owned < upg.requiredOwned) continue
      const deficit = upg.cost.sub(state.biomass)
      if (deficit.gt(0)) {
        const s = deficit.div(effectiveBps).toNumber()
        if (s > 0 && s < jumpSeconds) jumpSeconds = s
      }
    }

    for (const skillId of SKILL_PRIORITY) {
      if (state.unlockedSkills.includes(skillId)) continue
      const def = skillDefinitions.find((entry) => entry.id === skillId)
      if (!def) continue
      if (state.currentStage < 3 || state.stats[def.branch] < def.requiredStat) continue
      const deficit = def.cost.sub(state.biomass)
      if (deficit.gt(0)) {
        const s = deficit.div(effectiveBps).toNumber()
        if (s > 0 && s < jumpSeconds) jumpSeconds = s
      }
    }

    // Minimum jump: 1 second (avoid spinning)
    jumpSeconds = Math.max(1, jumpSeconds + 0.01)
    const jump = Math.min(jumpSeconds, MAX_GAME_SECONDS - gameSeconds)
    if (jump <= 0) break

    let remainingJump = jump
    while (remainingJump > 0) {
      checkMs(state, gameSeconds)
      const chunk = Math.min(30, remainingJump)
      state = advanceAnalyticalChunk(state, chunk)
      const clickIntervalMs = getActiveClickIntervalMs(state, gameSeconds)
      if (clickIntervalMs !== null) {
        const simulatedClicks = Math.floor((chunk * 1000) / clickIntervalMs)
        for (let i = 0; i < simulatedClicks; i++) {
          state = engineAbsorb(state)
        }
      }
      fakeTime += chunk * 1000
      gameSeconds += chunk
      remainingJump -= chunk
      checkMs(state, gameSeconds)

      if (state.hostCompleted) {
        break
      }
    }

    recordSnapshot(snapshots, state, gameSeconds, nextSnapshotAtRef, snapshotIntervalSeconds, true)

    state = suppressDefense(state, fakeTime)

    // Verbose logging
    if (verbose) {
      const cm = Math.floor(gameSeconds / 60)
      if (cm !== lastLoggedMinute) {
        lastLoggedMinute = cm
        console.log(`${fmt(gameSeconds).padStart(15)} |   S${state.currentStage} BPS=${formatReadable(state.biomassPerSecond.toNumber())} HP=${formatReadable(state.hostHealth.toNumber())} | ${genSummary(state)}`)
      }
    }
  }

  return { state, fakeTime, gameSeconds }
}

// ── Main ────────────────────────────────────────────────────────────────

console.log(`\nSimulating ${DURATION_HOURS}h (${(DURATION_HOURS / 24).toFixed(1)} days)...`)
console.log(`Defense events: DISABLED (clean pacing)\n`)
console.log('GAME TIME       | EVENT')
console.log('\u2500'.repeat(70))

let state = createFreshState()
let fakeTime = Date.now()
let gameSeconds = 0
const snapshots: SimSnapshot[] = []
const SNAPSHOT_INTERVAL_SECONDS = 3600
const nextSnapshotAtRef = { value: 0 }

state = suppressDefense(state, fakeTime)
recordSnapshot(snapshots, state, gameSeconds, nextSnapshotAtRef, SNAPSHOT_INTERVAL_SECONDS)

const startWall = Date.now()

// Phase 1: Tick-by-tick until Stage 1 clears (precise early-game timing)
console.log(`${fmt(0).padStart(15)} | [Phase 1: tick-by-tick through Stage 1]`)
;({ state, fakeTime, gameSeconds } = runTickPhase(
  state,
  fakeTime,
  gameSeconds,
  MAX_GAME_SECONDS,
  snapshots,
  nextSnapshotAtRef,
  SNAPSHOT_INTERVAL_SECONDS,
))

// Phase 2: Analytical fast-forward for the remaining duration
if (gameSeconds < MAX_GAME_SECONDS && reached.size < milestones.length) {
  console.log(`${fmt(gameSeconds).padStart(15)} | [Phase 2: analytical fast-forward to ${fmt(MAX_GAME_SECONDS)}]`)
  ;({ state, fakeTime, gameSeconds } = runAnalyticalPhase(
    state,
    fakeTime,
    gameSeconds,
    snapshots,
    nextSnapshotAtRef,
    SNAPSHOT_INTERVAL_SECONDS,
  ))
}

const elapsedWall = ((Date.now() - startWall) / 1000).toFixed(1)
const peakBps = snapshots.reduce((max, snapshot) => Math.max(max, snapshot.bps), 0)
const maxBiomass = snapshots.reduce((max, snapshot) => Math.max(max, snapshot.biomass), 0)

// ── Summary ─────────────────────────────────────────────────────────────

console.log('\n' + '\u2500'.repeat(70))
console.log(`Simulation complete in ${elapsedWall}s wall time.\n`)

console.log('Final state:')
console.log(`  Stage: ${state.currentStage}${state.hostCompleted ? ' (completed)' : ''}`)
console.log(`  Hosts:  ${formulas.getCompletedHosts(state)}`)
console.log(`  BPS:   ${formatReadable(state.biomassPerSecond.toNumber())}`)
console.log(`  Peak BPS: ${formatReadable(peakBps)}`)
console.log(`  Max biomass: ${formatReadable(maxBiomass)}`)
// Signal economy temporarily disabled.
// console.log(`  Signal: ${state.signal.toFixed(1)} / ${formulas.getSignalCap(state).toFixed(0)} | SPS: ${formulas.getSignalPerSecond(state).toFixed(2)}`)
console.log(`  Generators: ${genSummary(state)}`)
console.log(`  Milestones: ${reached.size}/${milestones.length}`)

// Pacing summary
const stageClears = [...reached.entries()].filter(([l]) => l.startsWith('Stage')).sort(([, a], [, b]) => a - b)
if (stageClears.length > 0) {
  console.log('\nPacing summary:')
  console.log('  STAGE CLEAR       | GAME TIME   | ELAPSED')
  console.log('  ' + '\u2500'.repeat(50))
  let prev = 0
  for (let i = 0; i < stageClears.length; i++) {
    const [label, sec] = stageClears[i]
    const elapsed = sec - prev
    console.log(`  ${label.padEnd(19)} | ${fmt(sec).padEnd(11)} | ${fmt(elapsed)}`)
    prev = sec
  }
}

// Tier unlock timeline
const tierUnlocks = [...reached.entries()].filter(([l]) => l.startsWith('Tier')).sort(([, a], [, b]) => a - b)
if (tierUnlocks.length > 0) {
  console.log('\nTier unlock timeline:')
  for (const [label, sec] of tierUnlocks) {
    console.log(`  ${fmt(sec).padStart(11)} | ${label}`)
  }
}

recordSnapshot(snapshots, state, gameSeconds, nextSnapshotAtRef, SNAPSHOT_INTERVAL_SECONDS, true)

const finalizedMilestones = [...reached.entries()]
  .map(([label, gameSeconds]) => ({ label, gameSeconds }))
  .sort((a, b) => a.gameSeconds - b.gameSeconds)

for (const milestone of finalizedMilestones) {
  let closest: SimSnapshot | undefined
  let closestDiff = Number.POSITIVE_INFINITY
  for (const snapshot of snapshots) {
    const diff = Math.abs(snapshot.gameSeconds - milestone.gameSeconds)
    if (diff < closestDiff) {
      closestDiff = diff
      closest = snapshot
    }
  }
  if (closest) {
    closest.milestone = closest.milestone
      ? `${closest.milestone}; ${milestone.label}`
      : milestone.label
  }
}

const html = generateChartHtml(snapshots)
const outputPath = path.resolve(process.cwd(), 'simulation-output.html')
fs.writeFileSync(outputPath, html, 'utf-8')
console.log(`\n> Chart written: ${outputPath}`)

const openCommand =
  process.platform === 'win32' ? `start "" "${outputPath}"` :
  process.platform === 'darwin' ? `open "${outputPath}"` :
  `xdg-open "${outputPath}"`

exec(openCommand, (err: unknown) => {
  if (err) console.log('> Could not open browser automatically. Open the file manually.')
})
