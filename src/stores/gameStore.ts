/**
 * gameStore.ts
 * Svelte store wrapper around the engine.
 * Components import from here only — never from engine/ directly.
 */

import { writable } from 'svelte/store'
import type { BuyAmount, CountermeasureId, GeneratorId, OfflineNarrative, UpgradeId, StatId, StrainId, SkillId } from '../lib/game'
import {
  tick as engineTick,
  absorb as engineAbsorb,
  buyGeneratorAction,
  buyUpgradeAction,
  purchaseSkillAction,
  allocateStatAction,
  chooseStrainAction,
  advanceStageAction,
  releaseSporesAction,
  setBuyAmountAction,
  equipCountermeasureAction,
  toggleLogPanelAction,
  handleVisibilityChange,
  acknowledgeRevealAction,
  loadStateWithNarrative,
  saveState,
  maybeAppendMilestoneLog,
  createFreshState,
  startGrindEventSession,
  triggerGrindEvent,
  scanDefenseEventAction,
  setPreemptiveCountermeasureAction,
  // Signal economy temporarily disabled.
  // spendSignalCoordinationCommand,
  // spendSignalVulnerabilityWindow,
  // spendSignalRivalSuppression,
  // spendSignalNetworkIsolation,
} from '../engine/happenings'
import type { GameState } from '../lib/game'
import { BALANCE } from '../engine/balance.config'

declare global {
  interface Window {
    gameDebug: {
      getTimeScale: () => number
      setTimeScale: (scale: number) => void
      speedUp: () => void
      slowDown: () => void
      pause: () => void
      resume: () => void
      getState: () => GameState | undefined
    }
  }
}

export const _pendingOfflineNarrative = writable<OfflineNarrative | null>(null)

let timeScale = 1.0
let lastTickTime = Date.now()

export function createGameStore() {
  const loaded = loadStateWithNarrative()
  const state = writable<GameState>(loaded.state)
  let tickTimer: number | undefined
  let saveTimer: number | undefined

  _pendingOfflineNarrative.set(loaded.narrative)

  function updateState(updater: (current: GameState) => GameState) {
    state.update((current) => {
      const next = updater(current)
      return maybeAppendMilestoneLog(current, next)
    })
  }

  function runStateAction(updater: (current: GameState) => GameState): boolean {
    let changed = false

    state.update((current) => {
      const next = maybeAppendMilestoneLog(current, updater(current))
      changed = next !== current
      return next
    })

    return changed
  }

  function tick(now = Date.now()) {
    const scaledNow = lastTickTime + (now - lastTickTime) * timeScale
    lastTickTime = now
    updateState((current) =>
      engineTick(current, scaledNow)
    )
  }

  function absorb() {
    updateState((current) => engineAbsorb(current))
  }

  function setBuyAmount(amount: BuyAmount) {
    updateState((current) => setBuyAmountAction(current, amount))
  }

  function equipCountermeasure(countermeasureId: CountermeasureId) {
    updateState((current) => equipCountermeasureAction(current, countermeasureId))
  }

  function toggleLogPanel() {
    updateState((current) => toggleLogPanelAction(current))
  }

  function buyGenerator(generatorId: GeneratorId) {
    updateState((current) => buyGeneratorAction(current, generatorId))
  }

  function buyUpgrade(upgradeId: UpgradeId) {
    updateState((current) => buyUpgradeAction(current, upgradeId))
  }

  function purchaseSkill(skillId: SkillId) {
    updateState((current) => purchaseSkillAction(current, skillId))
  }

  function allocateStat(statId: StatId) {
    updateState((current) => allocateStatAction(current, statId))
  }

  function chooseStrain(strainId: StrainId) {
    updateState((current) => chooseStrainAction(current, strainId))
  }

  function advanceStage() {
    updateState((current) => advanceStageAction(current))
  }

  function releaseSpores() {
    updateState((current) => releaseSporesAction(current))
  }

  function acknowledgeReveal(key: string) {
    updateState((current) => acknowledgeRevealAction(current, key))
  }

  function startGrindSession() {
    updateState((current) => startGrindEventSession(current))
  }

  function grindEvent() {
    updateState((current) => triggerGrindEvent(current))
  }

  function scanDefenseEvent() {
    updateState((current) => scanDefenseEventAction(current))
  }

  function setPreemptiveCountermeasure() {
    updateState((current) => setPreemptiveCountermeasureAction(current))
  }

  // Signal economy temporarily disabled.
  // function coordinationCommand(sourceTier: number, targetTier: number) {
  //   return runStateAction((current) => spendSignalCoordinationCommand(current, sourceTier, targetTier))
  // }

  // function vulnerabilityWindow() {
  //   return runStateAction((current) => spendSignalVulnerabilityWindow(current))
  // }

  // function rivalSuppression() {
  //   return runStateAction((current) => spendSignalRivalSuppression(current))
  // }

  // function networkIsolation() {
  //   return runStateAction((current) => spendSignalNetworkIsolation(current))
  // }

  function saveNow() {
    let snapshot: GameState | undefined
    const unsubscribe = state.subscribe((value) => {
      snapshot = value
    })
    unsubscribe()

    if (snapshot) {
      const prepared = {
        ...snapshot,
        lastSaveTime: Date.now(),
      }
      saveState(prepared)
      state.set(prepared)
    }
  }

  function getSnapshot(): GameState | null {
    let snapshot: GameState | null = null
    const unsubscribe = state.subscribe((value) => {
      snapshot = value
    })
    unsubscribe()
    return snapshot
  }

  function debugSimulateOffline(minutes = 10) {
    if (!import.meta.env.DEV) return

    const snapshot = getSnapshot()
    if (!snapshot) return

    const simulated = {
      ...snapshot,
      lastSaveTime: Date.now() - Math.max(1, minutes) * 60 * 1000,
    }

    saveState(simulated)
    const loadedSimulation = loadStateWithNarrative()
    state.set(loadedSimulation.state)
    _pendingOfflineNarrative.set(loadedSimulation.narrative)
    saveState(loadedSimulation.state)
  }

  function handleVisibilityChangeAction() {
    if (typeof document === 'undefined') return

    if (document.hidden) {
      stop()
      saveNow()
      return
    }

    updateState((current) => handleVisibilityChange(current))
    start()
  }

  function start() {
    if (typeof window === 'undefined') return

    lastTickTime = Date.now()

    if (!tickTimer) {
      tickTimer = window.setInterval(() => tick(), BALANCE.TICK_MS)
    }

    if (!saveTimer) {
      saveTimer = window.setInterval(() => saveNow(), BALANCE.SAVE_INTERVAL_MS)
    }
  }

  function stop() {
    if (tickTimer) {
      window.clearInterval(tickTimer)
      tickTimer = undefined
    }

    if (saveTimer) {
      window.clearInterval(saveTimer)
      saveTimer = undefined
    }
  }

  function reset() {
    const freshState = createFreshState()
    state.set(freshState)
    saveState(freshState)
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChangeAction)
  }

  if (typeof window !== 'undefined') {
    window.gameDebug = {
      getTimeScale: () => timeScale,
      setTimeScale: (scale: number) => {
        timeScale = scale
        console.log(`[DEBUG] Time scale set to ${timeScale}x`)
      },
      speedUp: () => {
        const newScale = Math.min(timeScale * 2, 1024)
        timeScale = newScale
        console.log(`[DEBUG] Time scale: ${timeScale}x`)
      },
      slowDown: () => {
        const newScale = Math.max(timeScale / 2, 0)
        timeScale = newScale
        console.log(`[DEBUG] Time scale: ${timeScale}x`)
      },
      pause: () => {
        timeScale = 0
        console.log('[DEBUG] Game paused')
      },
      resume: () => {
        timeScale = 1
        console.log('[DEBUG] Game resumed (1x speed)')
      },
      getState: () => {
        let snapshot: GameState | undefined
        const unsubscribe = state.subscribe((v) => { snapshot = v })
        unsubscribe()
        return snapshot
      },
    }
  }

  return {
    subscribe: state.subscribe,
    absorb,
    buyGenerator,
    buyUpgrade,
    equipCountermeasure,
    chooseStrain,
    allocateStat,
    purchaseSkill,
    advanceStage,
    releaseSpores,
    acknowledgeReveal,
    startGrindSession,
    grindEvent,
    scanDefenseEvent,
    setPreemptiveCountermeasure,
    // coordinationCommand,
    // vulnerabilityWindow,
    // rivalSuppression,
    // networkIsolation,
    reset,
    saveNow,
    debugSimulateOffline,
    setBuyAmount,
    toggleLogPanel,
    start,
    stop,
  }
}

export const game = createGameStore()

// Signal economy temporarily disabled.
// export const signalActions = {
//   coordinationCommand: (sourceTier: number, targetTier: number) =>
//     game.coordinationCommand(sourceTier, targetTier),
//   vulnerabilityWindow: () => game.vulnerabilityWindow(),
//   rivalSuppression: () => game.rivalSuppression(),
//   networkIsolation: () => game.networkIsolation(),
// }
