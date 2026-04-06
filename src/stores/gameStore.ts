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
  engageEnemyAction,
  attackEnemyAction,
  dismissEnemyNotificationAction,
  forceEnemySpawnAction,
  clearEnemyDebuffsAction,
  // Signal economy temporarily disabled.
  // spendSignalCoordinationCommand,
  // spendSignalVulnerabilityWindow,
  // spendSignalRivalSuppression,
  // spendSignalNetworkIsolation,
} from '../engine/happenings'
import type { GameState } from '../lib/game'
import { BALANCE } from '../engine/balance.config'

export const _pendingOfflineNarrative = writable<OfflineNarrative | null>(null)

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

  function updateGameplayState(updater: (current: GameState) => GameState) {
    const now = Date.now()

    state.update((current) => {
      const settled = engineTick(current, now)
      const next = updater(settled)
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
    updateState((current) =>
      engineTick(current, now)
    )
  }

  function absorb() {
    updateGameplayState((current) => engineAbsorb(current))
  }

  function setBuyAmount(amount: BuyAmount) {
    updateState((current) => setBuyAmountAction(current, amount))
  }

  function equipCountermeasure(countermeasureId: CountermeasureId) {
    updateGameplayState((current) => equipCountermeasureAction(current, countermeasureId))
  }

  function toggleLogPanel() {
    updateState((current) => toggleLogPanelAction(current))
  }

  function buyGenerator(generatorId: GeneratorId) {
    updateGameplayState((current) => buyGeneratorAction(current, generatorId))
  }

  function buyUpgrade(upgradeId: UpgradeId) {
    updateGameplayState((current) => buyUpgradeAction(current, upgradeId))
  }

  function purchaseSkill(skillId: SkillId) {
    updateGameplayState((current) => purchaseSkillAction(current, skillId))
  }

  function allocateStat(statId: StatId) {
    updateGameplayState((current) => allocateStatAction(current, statId))
  }

  function chooseStrain(strainId: StrainId) {
    updateGameplayState((current) => chooseStrainAction(current, strainId))
  }

  function advanceStage() {
    updateGameplayState((current) => advanceStageAction(current))
  }

  function releaseSpores() {
    updateGameplayState((current) => releaseSporesAction(current))
  }

  function engageEnemy() {
    updateGameplayState((current) => engageEnemyAction(current))
  }

  function attackEnemy() {
    updateGameplayState((current) => attackEnemyAction(current))
  }

  function dismissEnemyNotification() {
    updateGameplayState((current) => dismissEnemyNotificationAction(current))
  }

  function forceEnemySpawn(enemyId: string) {
    if (!import.meta.env.DEV) return
    updateGameplayState((current) => forceEnemySpawnAction(current, enemyId))
  }

  function clearEnemyDebuffs() {
    if (!import.meta.env.DEV) return
    updateGameplayState((current) => clearEnemyDebuffsAction(current))
  }

  function acknowledgeReveal(key: string) {
    updateState((current) => acknowledgeRevealAction(current, key))
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
    engageEnemy,
    attackEnemy,
    dismissEnemyNotification,
    forceEnemySpawn,
    clearEnemyDebuffs,
    acknowledgeReveal,
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
