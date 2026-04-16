<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { fade, fly } from 'svelte/transition'
  import TerminalButton from './lib/ui/TerminalButton.svelte'
  import TerminalPanel from './lib/ui/TerminalPanel.svelte'
  import TypewriterLog from './lib/ui/TypewriterLog.svelte'
  import SignalPanel from './lib/SignalPanel.svelte'
  import DefenseToast from './components/DefenseToast.svelte'
  import HostBackground from './components/HostBackground.svelte'
  import GrindPanel from './components/GrindPanel.svelte'
  import ObservationFeed from './components/ObservationFeed.svelte'
  import { wikiEntries, wikiSections } from './lib/wiki'
  import { game, _pendingOfflineNarrative, defenseToasts } from './stores/gameStore'
  import {
    canReleaseSpores,
    getGeneticMemoryBonusPercent,
    getCompletedHosts,
    getCurrentHostDefinition,
    getGeneratorCost,
    getGeneratorEfficiencyByOwned,
    getGeneratorProduction,
    getGeneratorProductionPerBuy,
    getHostProgress,
    getProjectedGeneticMemoryBonusPercent,
    getProjectedGeneticMemoryGain,
    getProjectedGeneticMemoryTotal,
    getThreatLevelLabel,
    hasNextStage,
    formatDecimal,
    formatDuration,
    getClicksUntilBurst,
    getStrainSynergyLabel,
    getEffectiveStatBonus,
    formatSkillCost,
    GENERATOR_TIER_ORDER,
    getSubstrateRawEfficiency,
    getSubstrateStatus,
    getSubstrateEfficiencyPercent,
    getDefenseEventSeverity,
  } from './engine/formulas'
  import { BALANCE } from './engine/balance.config'
  import { defenseFlavorDefinitions, getAffordableQuantity } from './engine/happenings'
  import {
    countermeasureDefinitions,
    generatorDefinitions,
    hostEchoDefinitions,
    hostDefinitions,
    skillDefinitions,
    strainDefinitions,
    upgradeDefinitions,
    getHostConfigId,
  } from './lib/game'
  import type { ActiveDefenseEvent, CountermeasureId, DefenseEventId, DefenseEventSeverity, GeneratorId, HostEchoDefinition, OfflineEvent, OfflineNarrative } from './lib/game'
  import { SEVERITY_COLORS } from './lib/game'
  import Decimal from 'break_eternity.js'
  import { formatBiomass, formatBPS } from './utils/formatNumber'
  import InfoTip from './lib/InfoTip.svelte'

  type ViewId = 'terminal' | 'evolution' | 'spore' | 'wiki'

  const navItems: Array<{ label: string; symbol: string; id: ViewId }> = [
    { label: 'TERMINAL', symbol: '[#]', id: 'terminal' },
    { label: 'EVOLUTION', symbol: '[+]', id: 'evolution' },
    { label: 'SPORE', symbol: '[*]', id: 'spore' },
  ]

  const statBranches = ['virulence', 'resilience', 'complexity'] as const
  const HOLD_DELAY_MS = 300
  const HOLD_INTERVAL_MS = 90
  const defenseThreatWindows: Array<{ id: DefenseEventId; minStage: number; maxStage: number }> = [
    { id: 'drought', minStage: 1, maxStage: 8 },
    { id: 'beetle-disruption', minStage: 1, maxStage: 8 },
    { id: 'cold-snap', minStage: 3, maxStage: 4 },
    { id: 'spore-competition', minStage: 5, maxStage: 8 },
    { id: 'immune-response', minStage: 5, maxStage: 8 },
    { id: 'desiccation-pulse', minStage: 1, maxStage: 8 },
    { id: 'antifungal-exudates', minStage: 2, maxStage: 7 },
    { id: 'microbial-rivalry', minStage: 2, maxStage: 6 },
    { id: 'uv-surge', minStage: 1, maxStage: 5 },
    { id: 'lignin-fortification', minStage: 3, maxStage: 8 },
    { id: 'root-allelopathy', minStage: 4, maxStage: 7 },
    { id: 'insect-vector-swarm', minStage: 3, maxStage: 8 },
    { id: 'viral-hijack', minStage: 5, maxStage: 8 },
    { id: 'nutrient-sequestration', minStage: 4, maxStage: 8 },
    { id: 'spore-predation', minStage: 6, maxStage: 8 },
    { id: 'thermal-stratification', minStage: 5, maxStage: 8 },
    { id: 'ecosystem-feedback', minStage: 7, maxStage: 8 },
  ]

  let activeView: ViewId = 'terminal'
  let sidebarTab: 'modules' | 'logs' = 'modules'
  let selectedWikiSection: string = 'basics'
  let selectedWikiEntryId = 'how-the-game-works'
  let wikiQuery = ''
  let isConfirmingSporeRelease = false
  let generatorHoldDelayTimer: number | undefined
  let generatorHoldIntervalTimer: number | undefined
  let biomassPulse = false
  let biomassPulseTimer: ReturnType<typeof setTimeout> | undefined
  let bgGlitching = false
  let lastBgGlitchCount = 0

  let clickFloats: Array<{ id: number; x: number; y: number; value: string }> = []
  let mobileClickFloats: Array<{ id: number; x: number; y: number; value: string }> = []
  let clickFloatCounter = 0
  let clickZoneIdle = true
  let clickZoneIdleTimer: ReturnType<typeof setTimeout> | undefined
  let lastRegisteredClickAt = 0
  let clickCooldownProgress = 1
  let clickCooldownRafId: number | undefined
  let bpsLiftFlash = false
  let panelAlertFlash = false
  let bpsPurchaseFlash = false
  let purchaseFlashMap = new Map<GeneratorId, boolean>()
  let countPulseMap = new Map<GeneratorId, boolean>()
  let buyBtnAcquiredMap = new Map<GeneratorId, boolean>()
  let canAffordFlashMap = new Map<GeneratorId, boolean>()
  let outputTickMap = new Map<GeneratorId, boolean>()
  let previousAffordableMap = new Map<GeneratorId, boolean>()
  let previousEventCount = 0
  let uiNow = Date.now()
  let uiClockTimer: number | undefined
  let forecastCountdownLabel: string | null = null
  let offlineNarrative: OfflineNarrative | null = null
  let showOfflineNarrative = false
  let currentOfflineEventIndex = -1
  let offlineNarrativeRun = 0
  let showCurrencyModal = false
  let showDegradationModal = false
  let filteredWikiEntries = wikiEntries.filter((entry) => entry.section === selectedWikiSection)
  let visibleWikiEntry = filteredWikiEntries[0] ?? null

  const allTopicsSummary = 'Browse the archive by section or search across every topic. The right pane summarizes the current section and includes all matching entries.'

  function getCurrencyTierTooltip(biomass: Decimal): string {
    const tiers = BALANCE.CURRENCY_TIERS
    let currentTierIdx = -1
    const biomassNum = biomass.toNumber()
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (biomassNum >= tiers[i].threshold) {
        currentTierIdx = i
        break
      }
    }
    return tiers
      .map((tier, idx) => {
        const marker = idx === currentTierIdx ? ' ▶ ' : '   '
        return `${marker}${tier.label}: ${formatBiomass(tier.threshold, true)}`
      })
      .join('\n')
  }

  function resetGameForDebug() {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Reset the entire game state? This is intended for debugging only.')
      if (!confirmed) {
        return
      }
    }

    game.reset()
    activeView = 'terminal'
    isConfirmingSporeRelease = false
  }

  function openCurrencyModal() {
    showCurrencyModal = true
  }

  function closeCurrencyModal() {
    showCurrencyModal = false
  }

  function handleCurrencyModalKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeCurrencyModal()
    }
  }

  function openDegradationModal() {
    showDegradationModal = true
  }

  function closeDegradationModal() {
    showDegradationModal = false
  }

  function handleDegradationModalKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeDegradationModal()
    }
  }

  function getOfflineEventIcon(type: OfflineEvent['type']): string {
    switch (type) {
      case 'defense':
        return '[!]'
      case 'milestone':
        return '[>]'
      case 'expansion':
        return '[+]'
      case 'dormant':
        return '[~]'
    }

    return '[ ]'
  }

  function formatOfflineEventOutcome(outcome: OfflineEvent['outcome']): string {
    switch (outcome) {
      case 'weathered':
        return 'WEATHERED'
      case 'overcame':
        return 'OVERCAME'
      case 'breached':
        return 'BREACHED'
      case 'awaited':
        return 'AWAITED'
    }

    return 'UNKNOWN'
  }

  async function playOfflineNarrativeSequence(narrative: OfflineNarrative, runId: number) {
    currentOfflineEventIndex = -1

    for (let index = 0; index < narrative.events.length; index += 1) {
      if (runId !== offlineNarrativeRun) {
        return
      }

      currentOfflineEventIndex = index
      await new Promise((resolve) => window.setTimeout(resolve, 800))
    }
  }

  function dismissOfflineNarrative() {
    offlineNarrativeRun += 1
    showOfflineNarrative = false
    currentOfflineEventIndex = -1
    offlineNarrative = null
    _pendingOfflineNarrative.set(null)
  }

  function clearGeneratorBuyHold() {
    if (generatorHoldDelayTimer) {
      window.clearTimeout(generatorHoldDelayTimer)
      generatorHoldDelayTimer = undefined
    }

    if (generatorHoldIntervalTimer) {
      window.clearInterval(generatorHoldIntervalTimer)
      generatorHoldIntervalTimer = undefined
    }
  }

  function triggerBpsPurchaseFlash() {
    bpsPurchaseFlash = true
    setTimeout(() => { bpsPurchaseFlash = false }, 200)
  }

  function triggerCardPurchaseFlash(generatorId: GeneratorId) {
    purchaseFlashMap.set(generatorId, true)
    purchaseFlashMap = purchaseFlashMap
    setTimeout(() => {
      purchaseFlashMap.set(generatorId, false)
      purchaseFlashMap = purchaseFlashMap
    }, 300)
  }

  function triggerCountPulse(generatorId: GeneratorId) {
    countPulseMap.set(generatorId, true)
    countPulseMap = countPulseMap
    setTimeout(() => {
      countPulseMap.set(generatorId, false)
      countPulseMap = countPulseMap
    }, 200)
  }

  function triggerBuyBtnAcquired(generatorId: GeneratorId) {
    buyBtnAcquiredMap.set(generatorId, true)
    buyBtnAcquiredMap = buyBtnAcquiredMap
    setTimeout(() => {
      buyBtnAcquiredMap.set(generatorId, false)
      buyBtnAcquiredMap = buyBtnAcquiredMap
    }, 400)
  }

  function triggerCanAffordFlash(generatorId: GeneratorId) {
    canAffordFlashMap.set(generatorId, true)
    canAffordFlashMap = canAffordFlashMap
    setTimeout(() => {
      canAffordFlashMap.set(generatorId, false)
      canAffordFlashMap = canAffordFlashMap
    }, 600)
  }

  let audioCtx: AudioContext | null = null

  function playThud() {
    try {
      if (!audioCtx) {
        audioCtx = new AudioContext()
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume()
      }
      const ctx = audioCtx
      const now = ctx.currentTime

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const filter = ctx.createBiquadFilter()

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(150, now)
      filter.frequency.exponentialRampToValueAtTime(40, now + 0.1)

      osc.type = 'sine'
      osc.frequency.setValueAtTime(80, now)
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.08)

      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.15)
    } catch {
      // audio not supported
    }
  }

  function addMobileClickFloat(x: number, y: number) {
    const id = clickFloatCounter++
    const value = `+${formatBiomass($game.biomassPerClick, useScientificNotation)}Ψ`
    mobileClickFloats = [...mobileClickFloats, { id, x, y, value }]
    setTimeout(() => {
      mobileClickFloats = mobileClickFloats.filter(f => f.id !== id)
    }, 900)
  }

  function absorbWithProgress(event?: MouseEvent) {
    if (Date.now() - lastRegisteredClickAt < BALANCE.MIN_CLICK_INTERVAL_MS) {
      return
    }
    lastRegisteredClickAt = Date.now()

    playThud()

    bgGlitching = true
    setTimeout(() => { bgGlitching = false }, BALANCE.FLASH_FADE_OUT_MS)

    const clickValue = $game.biomassPerClick
    const threshold = $game.biomassPerSecond.mul(5)
    if (clickValue.gt(threshold)) {
      biomassPulse = true
      clearTimeout(biomassPulseTimer)
      biomassPulseTimer = setTimeout(() => {
        biomassPulse = false
      }, 150)
    }

    if (event) {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const id = clickFloatCounter++
      const value = `+${formatBiomass($game.biomassPerClick, useScientificNotation)}Ψ`
      clickFloats = [...clickFloats, { id, x, y, value }]
      setTimeout(() => {
        clickFloats = clickFloats.filter(f => f.id !== id)
      }, 900)
    }

    clickZoneIdle = false
    clearTimeout(clickZoneIdleTimer)
    clickZoneIdleTimer = setTimeout(() => {
      clickZoneIdle = true
    }, 3000)

    if (clickCooldownRafId !== undefined) {
      cancelAnimationFrame(clickCooldownRafId)
    }
    const intervalMs = BALANCE.MIN_CLICK_INTERVAL_MS
    const startTime = performance.now()
    clickCooldownProgress = 0

    function updateProgress(now: number) {
      const elapsed = now - startTime
      clickCooldownProgress = Math.min(1, elapsed / intervalMs)
      if (clickCooldownProgress < 1) {
        clickCooldownRafId = requestAnimationFrame(updateProgress)
      } else {
        clickCooldownRafId = undefined
      }
    }
    clickCooldownRafId = requestAnimationFrame(updateProgress)

    game.absorb()
  }

  function getGeneratorBuyGain(generatorId: GeneratorId): string {
    const gain = getGeneratorProductionPerBuy($game, generatorId)
    const n = gain.toNumber()
    // If value is so small it would display as 0.00, use scientific notation instead
    const formatted = n > 0 && n < 0.005
      ? gain.toExponential(2)
      : formatBiomass(gain, useScientificNotation)
    return `+${formatted}/sec`
  }

  function getPrimaryProblem() {
    return $game.activeDefenseEvents[0] ?? null
  }

  function getGeneratorDisruption(generatorId: GeneratorId) {
    return $game.activeDefenseEvents.find((event) => event.disabledGeneratorId === generatorId) ?? null
  }

  function getTotalOwnedGenerators(): number {
    return generatorDefinitions.reduce((total, generator) => total + $game.generators[generator.id].owned, 0)
  }

  function getPurchasedUpgradeCount(): number {
    return upgradeDefinitions.filter((upgrade) => $game.upgrades[upgrade.id]).length
  }

  function getReadinessStatus(): string {
    if ($game.currentStage >= 3) {
      return 'COGNITIVE_BRANCHING_ACTIVE'
    }

    if (getCompletedHosts($game) >= 1) {
      return 'STRAIN_THRESHOLD_REACHED'
    }

    if ($game.visibility.upgradePanel) {
      return 'UPGRADE_TIER_ACTIVE'
    }

    return 'GERMINATION_IN_PROGRESS'
  }

  function getCurrentStrainName(): string {
    const current = strainDefinitions.find((strain) => strain.id === $game.strain)
    return current ? current.name.toUpperCase() : 'UNASSIGNED'
  }

  function canChooseStrain(): boolean {
    return getCompletedHosts($game) >= 1 && $game.strain === null
  }

  function getSpentMutationPoints(): number {
    return $game.stats.virulence + $game.stats.resilience + $game.stats.complexity
  }

  function getSkillsForBranch(branch: (typeof statBranches)[number]) {
    return skillDefinitions.filter((skill) => skill.branch === branch)
  }

  function isNavVisible(id: ViewId): boolean {
    if (id === 'terminal') return true
    if (id === 'evolution') {
      return $game.visibility.upgradePanel || $game.visibility.strainPrompt || $game.visibility.statsPanel || $game.visibility.skillTree
    }
    if (id === 'spore') return $game.visibility.hostHealthBar || $game.visibility.prestigeButton
    return $game.visibility.generatorPanel
  }

  function isNewReveal(key: string): boolean {
    return Boolean($game.visibility.isNew[key])
  }

  function finishReveal(key: string) {
    game.acknowledgeReveal(key)
  }

  function getGeneratorHint(index: number): string {
    const previousGenerator = generatorDefinitions[index - 1]
    if (!previousGenerator) {
      return ''
    }

    const stageGate = BALANCE.GENERATOR_STAGE_GATES[index]
    const threshold = BALANCE.GENERATOR_UNLOCK_THRESHOLDS[index]

    if (stageGate === 0) {
      return `Requires Stage 1, own ${threshold}x ${previousGenerator.name}`
    }

    return `Requires Stage ${stageGate}, own ${threshold}x ${previousGenerator.name}`
  }

  function getGeneratorRelativeEfficiency(generatorId: (typeof generatorDefinitions)[number]['id']): number {
    const efficiency = getGeneratorEfficiencyByOwned(generatorId, $game.generators[generatorId].owned)
    const baseline = getGeneratorEfficiencyByOwned('hyphae-strand', $game.generators['hyphae-strand'].owned)

    if (baseline.lte(0)) {
      return 1
    }

    return efficiency.div(baseline).toNumber()
  }

  function formatEfficiencyLabel(relativeEfficiency: number): string {
    if (relativeEfficiency >= 1_000_000) return `${(relativeEfficiency / 1_000_000).toFixed(1)}Mx eff`
    if (relativeEfficiency >= 1_000) return `${(relativeEfficiency / 1_000).toFixed(1)}Kx eff`
    if (relativeEfficiency >= 1) return `${relativeEfficiency.toFixed(0)}x eff`
    return `${relativeEfficiency.toFixed(2)}x eff`
  }

  function isUpgradeAvailable(upgrade: (typeof upgradeDefinitions)[number]): boolean {
    return $game.generators[upgrade.requiredGenerator].owned >= upgrade.requiredOwned
  }

  function hasSkill(skillId: (typeof skillDefinitions)[number]['id']): boolean {
    return $game.unlockedSkills.includes(skillId)
  }

  function getLatestVisibleEvent(log: string[]): string {
    for (let index = log.length - 1; index >= 0; index -= 1) {
      const entry = log[index]
      if (entry.includes('Dormant metabolism preserved 0.00 biomass.')) {
        continue
      }
      if (entry.includes('Background spread added 0.00 biomass.')) {
        continue
      }
      return entry
    }

    return ''
  }

  $: visibleNavItems = navItems.filter((item) => isNavVisible(item.id))
  $: nextLockedGeneratorTier = generatorDefinitions.findIndex(
    (_, index) => index > 0 && !$game.visibility.generatorTiers[index]
  )
  $: useScientificNotation = $game.visibility.useScientificNotation
  $: suppressionActive = $game.activeDefenseEvents.some(
    (event) => event.multiplier.lt(1) || event.disabledGeneratorId != null
  )
  $: suppressionPct = (() => {
    let combined = 1

    for (const event of $game.activeDefenseEvents) {
      if (event.multiplier.lt(1)) {
        combined *= event.multiplier.toNumber()
      }
    }

    return Math.round((1 - combined) * 100)
  })()
  $: suppressionLabel = (() => {
    const hasMult = $game.activeDefenseEvents.some((e) => e.multiplier.lt(1))
    const disrupted = $game.activeDefenseEvents.find((e) => e.disabledGeneratorId != null)
    if (hasMult && disrupted) return `[⚇ -${suppressionPct}% SUPPRESSED / ${disrupted.disabledGeneratorId} SEVERED]`
    if (hasMult) return `[⚇ -${suppressionPct}% SUPPRESSED]`
    if (disrupted) return `[${disrupted.disabledGeneratorId?.replace(/-/g, ' ').toUpperCase()} SEVERED]`
    return ''
  })()
  $: {
    const currentCount = $game.activeDefenseEvents.length
    if (previousEventCount > 0 && currentCount < previousEventCount && !bpsLiftFlash) {
      bpsLiftFlash = true
      setTimeout(() => {
        bpsLiftFlash = false
      }, 500)
    }
    if (currentCount > previousEventCount && !panelAlertFlash) {
      panelAlertFlash = true
      setTimeout(() => {
        panelAlertFlash = false
      }, 400)
    }
    previousEventCount = currentCount
  }
  $: hostProgressPercent = getHostProgress($game)
  $: hostProgressLabel = formatHostProgress(hostProgressPercent)
  $: currentHostDef = getCurrentHostDefinition($game)
  $: currentHostFlavor = currentHostDef.flavor
  $: latestLogEntry = getLatestVisibleEvent($game.log)
  $: if (activeView !== 'wiki' && !isNavVisible(activeView)) {
    activeView = 'terminal'
  }

  $: canAffordGenerator = new Map(
    generatorDefinitions.map((generator) => [generator.id, $game.biomass.gte(getGeneratorCost($game, generator.id))])
  )

  $: canAffordUpgrade = new Map(
    upgradeDefinitions.map((upgrade) => [upgrade.id, $game.biomass.gte(upgrade.cost)])
  )

  $: canBuySkillMap = new Map(
    skillDefinitions.map((skill) => [
      skill.id,
      $game.currentStage >= 3 &&
        $game.stats[skill.branch] >= skill.requiredStat &&
        !$game.unlockedSkills.includes(skill.id) &&
        $game.biomass.gte(skill.cost)
    ])
  )

  $: {
    for (const generator of generatorDefinitions) {
      const id = generator.id
      const currentlyAffordable = canAffordGenerator.get(id) ?? false
      const wasAffordable = previousAffordableMap.get(id) ?? false
      if (currentlyAffordable && !wasAffordable && wasAffordable !== undefined) {
        triggerCanAffordFlash(id)
      }
      previousAffordableMap.set(id, currentlyAffordable)
    }
    previousAffordableMap = previousAffordableMap
  }

  function startGeneratorBuyHold(generatorId: (typeof generatorDefinitions)[number]['id'], event: PointerEvent) {
    if (event.button !== 0 || !canAffordGenerator.get(generatorId)) {
      return
    }

    clearGeneratorBuyHold()
    game.buyGenerator(generatorId)
    triggerBpsPurchaseFlash()
    triggerCardPurchaseFlash(generatorId)
    triggerCountPulse(generatorId)
    triggerBuyBtnAcquired(generatorId)
    generatorHoldDelayTimer = window.setTimeout(() => {
      generatorHoldIntervalTimer = window.setInterval(() => {
        if (!canAffordGenerator.get(generatorId)) {
          clearGeneratorBuyHold()
          return
        }

        game.buyGenerator(generatorId)
      }, HOLD_INTERVAL_MS)
    }, HOLD_DELAY_MS)
  }

  function getSkillStateLabel(skill: (typeof skillDefinitions)[number]): string {
    if (hasSkill(skill.id)) {
      return 'INTEGRATED'
    }

    if ($game.currentStage < 3) {
      return 'LOCKED'
    }

    if ($game.stats[skill.branch] < skill.requiredStat) {
      return 'LOCKED'
    }

    return formatSkillCost(skill.cost)
  }

  function getSkillRequirementText(skill: (typeof skillDefinitions)[number]): string {
    if (hasSkill(skill.id)) {
      return 'Mutation integrated into the colony.'
    }

    const stageLock = $game.currentStage < 3
    const statLock = $game.stats[skill.branch] < skill.requiredStat
    const costLock = $game.biomass.lt(skill.cost)

    if (stageLock || statLock) {
      const missing: string[] = []
      if (stageLock) missing.push('STAGE 3')
      if (statLock) missing.push(`${skill.branch[0].toUpperCase()}:${skill.requiredStat} (${skill.branch.toUpperCase()})`)
      return `Requires ${missing.join(' · ')}`
    }

    if (costLock) {
      return `Need ${formatSkillCost(skill.cost)} (have ${formatSkillCost($game.biomass)})`
    }

    return 'Ready to integrate.'
  }

  function isWithinReach(skill: (typeof skillDefinitions)[number]): boolean {
    if (hasSkill(skill.id)) return false
    if ($game.currentStage < 3) return false
    const currentRank = $game.stats[skill.branch]
    const neededRank = skill.requiredStat
    if (currentRank >= neededRank) return false
    if (currentRank < neededRank - 1) return false
    return $game.biomass.times(2).gte(skill.cost)
  }

  function getSkillBadgeText(skill: (typeof skillDefinitions)[number]): string {
    if (hasSkill(skill.id)) {
      return 'INTEGRATED'
    }
    if ($game.currentStage < 3 || $game.stats[skill.branch] < skill.requiredStat) {
      return 'LOCKED'
    }
    return `[ PURCHASE · ${formatSkillCost(skill.cost)} ]`
  }

  function formatHostProgress(progress: number) {
    if (progress === 100) {
      return '100%'
    }

    return `${progress.toFixed(2)}%`
  }

  function filterWikiEntries(sectionId: string, query: string) {
    const normalizedQuery = query.trim().toLowerCase()
    return wikiEntries.filter((entry) => {
      const matchesSection = sectionId === 'all' || entry.section === sectionId
      const matchesQuery =
        normalizedQuery.length === 0 ||
        entry.title.toLowerCase().includes(normalizedQuery) ||
        entry.summary.toLowerCase().includes(normalizedQuery) ||
        entry.keywords.some((keyword) => keyword.toLowerCase().includes(normalizedQuery))

      return matchesSection && matchesQuery
    })
  }

  function getSelectedWikiEntry() {
    return wikiEntries.find((entry) => entry.id === selectedWikiEntryId) ?? wikiEntries[0]
  }

  function selectWikiEntry(entryId: string) {
    selectedWikiEntryId = entryId
  }

  function setWikiSection(sectionId: string) {
    selectedWikiSection = sectionId
    const firstMatch = filterWikiEntries(sectionId, wikiQuery)[0]
    if (firstMatch) {
      selectedWikiEntryId = firstMatch.id
    }
  }

  $: filteredWikiEntries = filterWikiEntries(selectedWikiSection, wikiQuery)

  $: if (filteredWikiEntries.length > 0 && !filteredWikiEntries.some((entry) => entry.id === selectedWikiEntryId)) {
    selectedWikiEntryId = filteredWikiEntries[0].id
  }

  $: visibleWikiEntry = filteredWikiEntries.find((entry) => entry.id === selectedWikiEntryId) ?? filteredWikiEntries[0] ?? null

  function getVisibleWikiEntry() {
    return visibleWikiEntry
  }

  function getSelectedWikiSectionInfo() {
    if (selectedWikiSection === 'all') {
      return {
        id: 'all',
        title: 'All Topics',
        summary: allTopicsSummary,
      }
    }

    return wikiSections.find((section) => section.id === selectedWikiSection) ?? wikiSections[0]
  }

  function getCurrentHostFlavor(): string {
    return getCurrentHostDefinition($game).flavor
  }

  function getCurrentHostDefenseSignature(): string {
    return getCurrentHostDefinition($game).defenseSignature
  }

  function getCurrentHostTransitionSignal(): string {
    return getCurrentHostDefinition($game).transitionSignal
  }

  function getCurrentHostThreatLevel(): string {
    return getThreatLevelLabel(getCurrentHostDefinition($game).threatLevel)
  }

  function getDynamicDefensePattern(): string {
    if ($game.activeDefenseEvents.length === 0) {
      return 'No active host response detected.'
    }

    return $game.activeDefenseEvents.map((event) => event.name.toUpperCase()).join(' / ')
  }

  function getDefenseEventLabel(eventId: DefenseEventId | null): string {
    switch (eventId) {
      case 'drought':
        return 'DROUGHT'
      case 'beetle-disruption':
        return 'BEETLE DISRUPTION'
      case 'desiccation-pulse':
        return 'DESICCATION PULSE'
      case 'antifungal-exudates':
        return 'ANTIFUNGAL EXUDATES'
      case 'microbial-rivalry':
        return 'MICROBIAL RIVALRY'
      case 'uv-surge':
        return 'UV SURGE'
      case 'cold-snap':
        return 'COLD SNAP'
      case 'lignin-fortification':
        return 'LIGNIN FORTIFICATION'
      case 'root-allelopathy':
        return 'ROOT ALLELOPATHY'
      case 'insect-vector-swarm':
        return 'INSECT VECTOR SWARM'
      case 'spore-competition':
        return 'SPORE COMPETITION'
      case 'immune-response':
        return 'IMMUNE RESPONSE'
      case 'viral-hijack':
        return 'VIRAL HIJACK'
      case 'nutrient-sequestration':
        return 'NUTRIENT SEQUESTRATION'
      case 'spore-predation':
        return 'SPORE PREDATION'
      case 'thermal-stratification':
        return 'THERMAL STRATIFICATION'
      case 'ecosystem-feedback':
        return 'ECOSYSTEM FEEDBACK'
      default:
        return 'NO FORECAST'
    }
  }

  function getForecastCountdownLabel(): string | null {
    if (!$game.nextDefenseEventId) return null
    const msUntilCheck = $game.nextDefenseCheckAt - uiNow
    if (msUntilCheck > BALANCE.DEFENSE_FORECAST_WARNING_MS) return null
    const secs = Math.max(0, Math.ceil(msUntilCheck / 1000))
    const eventLabel = getDefenseEventLabel($game.nextDefenseEventId)
    if (secs <= 0) {
      return `Incoming pattern — ${eventLabel} — imminent`
    }
    return `Threat signal detected — ${eventLabel} — possible trigger in ~${secs}s`
  }

  function getLikelyThreatForecast(): string {
    if ($game.currentStage < BALANCE.DEFENSE_FORECAST_UNLOCK_STAGE) {
      return 'NO FORECAST'
    }

    return defenseThreatWindows
      .filter((event) => $game.currentStage >= event.minStage && $game.currentStage <= event.maxStage)
      .map((event) => getDefenseEventLabel(event.id))
      .join(' / ')
  }

  function getRemainingDurationLabel(endsAt: number): string {
    return formatDuration(Math.max(0, endsAt - uiNow))
  }

  type EventSeverity = 'LOW' | 'MODERATE' | 'SEVERE' | 'CRITICAL'

  function getEventSeverity(event: ActiveDefenseEvent): EventSeverity {
    let totalPenalty = 0
    if (event.multiplier.lt(1)) {
      totalPenalty += (1 - event.multiplier.toNumber()) * 100
    }
    if (event.clickMultiplier && event.clickMultiplier.lt(1)) {
      totalPenalty += (1 - event.clickMultiplier.toNumber()) * 100
    }
    if (totalPenalty >= 45) return 'CRITICAL'
    if (totalPenalty >= 30) return 'SEVERE'
    if (totalPenalty >= 15) return 'MODERATE'
    return 'LOW'
  }

  function getSeverityRank(severity: EventSeverity): number {
    switch (severity) {
      case 'CRITICAL': return 4
      case 'SEVERE': return 3
      case 'MODERATE': return 2
      case 'LOW': return 1
    }
  }

  function getEventPenaltyBreakdown(event: ActiveDefenseEvent): Array<{ label: string; percent: number; absoluteBps?: string; absoluteClicks?: string }> {
    const penalties: Array<{ label: string; percent: number; absoluteBps?: string; absoluteClicks?: string }> = []
    if (event.multiplier.lt(1)) {
      const pct = Math.round((1 - event.multiplier.toNumber()) * 100)
      const currentBps = $game.biomassPerSecond.toNumber()
      const absoluteBpsLoss = currentBps * (1 - event.multiplier.toNumber())
      penalties.push({
        label: `-${pct}% passive production`,
        percent: pct,
        absoluteBps: `(-${absoluteBpsLoss.toFixed(2)} BPS currently)`
      })
    }
    if (event.clickMultiplier && event.clickMultiplier.lt(1)) {
      const pct = Math.round((1 - event.clickMultiplier.toNumber()) * 100)
      const currentClick = $game.biomassPerClick.toNumber()
      const absoluteClickLoss = currentClick * (1 - event.clickMultiplier.toNumber())
      penalties.push({
        label: `-${pct}% click absorption`,
        percent: pct,
        absoluteClicks: `(-${absoluteClickLoss.toFixed(2)} \u03A8 per click currently)`
      })
    }
    return penalties
  }

  function getCountdownState(remainingMs: number): 'safe' | 'warning' | 'danger' {
    const remainingSecs = remainingMs / 1000
    if (remainingSecs < 30) return 'danger'
    if (remainingSecs < 60) return 'warning'
    return 'safe'
  }

  function getEventDurationMs(event: ActiveDefenseEvent): number {
    return event.endsAt - Date.now() + (Date.now() - uiNow)
  }

  function getRemainingDurationMs(endsAt: number): number {
    return Math.max(0, endsAt - uiNow)
  }

  function getEventFlavorHint(event: ActiveDefenseEvent): string | null {
    const creepLogs = defenseFlavorDefinitions[event.id]?.creepLogs
    if (!creepLogs || creepLogs.length === 0) return null
    const index = Math.abs(hashCode(event.id + event.endsAt)) % creepLogs.length
    return creepLogs[index]
  }

  function hashCode(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return hash
  }

  function getMinRemainingMs(events: ActiveDefenseEvent[], now: number): number {
    return Math.min(...events.map(e => Math.max(0, e.endsAt - now)))
  }

  function formatTimer(ms: number): string {
    const totalSeconds = Math.ceil(ms / 1000)
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  let now = Date.now()
  let timerInterval: ReturnType<typeof setInterval>

  onMount(() => {
    timerInterval = setInterval(() => { now = Date.now() }, 1000)
  })

  onDestroy(() => {
    clearInterval(timerInterval)
  })

  $: activeDefenseEvents = $game.activeDefenseEvents

  $: mostSevereSeverity = (() => {
    if (activeDefenseEvents.length === 0) return null
    let mostSevere: DefenseEventSeverity = 'low'
    let highestRank = 0
    for (const event of activeDefenseEvents) {
      const sev = getDefenseEventSeverity(event.multiplier.toNumber())
      const rank = sev === 'critical' ? 4 : sev === 'high' ? 3 : sev === 'moderate' ? 2 : 1
      if (rank > highestRank) {
        highestRank = rank
        mostSevere = sev
      }
    }
    return mostSevere
  })()

  $: minRemainingMs = activeDefenseEvents.length > 0
    ? getMinRemainingMs(activeDefenseEvents, now)
    : 0

  $: formattedTimer = minRemainingMs > 0 ? formatTimer(minRemainingMs) : ''

  $: suppressionBadges = activeDefenseEvents.map(event => {
    const sev = getDefenseEventSeverity(event.multiplier.toNumber())
    const pct = Math.round((1 - event.multiplier.toNumber()) * 100)
    return {
      eventName: event.name,
      sev,
      pct,
      colors: SEVERITY_COLORS[sev],
    }
  })

  $: equippedCountermeasure = countermeasureDefinitions.find((entry: (typeof countermeasureDefinitions)[number]) => entry.id === $game.equippedCountermeasure) ?? null

  function getCountermeasureCoverage(countermeasureId: CountermeasureId): string {
    const definition = countermeasureDefinitions.find((entry: (typeof countermeasureDefinitions)[number]) => entry.id === countermeasureId)
    if (!definition) return ''
    const full = definition.targetEventIds.map((eventId: DefenseEventId) => getDefenseEventLabel(eventId))
    const partial = definition.partialEventIds.map((eventId: DefenseEventId) => getDefenseEventLabel(eventId))
    const parts: string[] = []
    if (full.length > 0) parts.push(`Full: ${full.join(', ')}`)
    if (partial.length > 0) parts.push(`Partial: ${partial.join(', ')}`)
    return parts.join(' | ')
  }

  function getCountermeasureFullCoverage(countermeasureId: CountermeasureId): string {
    const definition = countermeasureDefinitions.find((entry: (typeof countermeasureDefinitions)[number]) => entry.id === countermeasureId)
    if (!definition) return ''
    return definition.targetEventIds.map((eventId: DefenseEventId) => getDefenseEventLabel(eventId)).join(', ')
  }

  function getCountermeasurePartialCoverage(countermeasureId: CountermeasureId): string {
    const definition = countermeasureDefinitions.find((entry: (typeof countermeasureDefinitions)[number]) => entry.id === countermeasureId)
    if (!definition) return ''
    return definition.partialEventIds.map((eventId: DefenseEventId) => getDefenseEventLabel(eventId)).join(', ')
  }

  function getDefenseStatusLabel(): string {
    if ($game.activeDefenseEvents.length === 0) return ''
    const activeEvent = $game.activeDefenseEvents[0]
    const equipped = $game.equippedCountermeasure
    if (!equipped) return 'Vulnerable'
    const def = countermeasureDefinitions.find((c) => c.id === equipped)
    if (!def) return 'Vulnerable'
    if (def.targetEventIds.includes(activeEvent.id)) return 'Defended'
    if (def.partialEventIds.includes(activeEvent.id)) return 'Partial'
    return 'Vulnerable'
  }

  function getDynamicTransitionSignal(): string {
    const progress = getHostProgress($game)

    if (progress < 25) {
      return 'Outer tissue softening. Maintain pressure on surface channels.'
    }

    if (progress < 60) {
      return 'Resistance dropping. Structural pathways are beginning to open.'
    }

    if (progress < 90) {
      return 'Core substrate exposed. Redirect biomass into deeper channels.'
    }

    return 'Host integrity critical. Final collapse is imminent.'
  }

  function getRunStatusLabel(): string {
    if (canReleaseSpores($game)) {
      return 'RELEASE_READY'
    }

    if ($game.currentStage === hostDefinitions.length) {
      return $game.hostCompleted ? 'HOST_COLLAPSED' : 'FINAL_HOST_ACTIVE'
    }

    return 'ROOTED'
  }

  function getHostEchoDefinition(id: string): HostEchoDefinition | undefined {
    return hostEchoDefinitions.find((entry) => entry.id === id)
  }

  function formatEchoBonus(bonus: HostEchoDefinition['bonus'] | undefined): string {
    if (!bonus) return ''

    switch (bonus.type) {
      case 'clickMultiplier':
        return `+${bonus.value * 100}% click output`
      case 'passiveMultiplier':
        return `+${bonus.value * 100}% passive output`
      case 'defenseMitigation':
        return `+${bonus.value * 100}% defense mitigation`
      case 'maxSignal':
        return `+${bonus.value} max Signal`
      default:
        return `+${bonus.value}`
    }
  }

  function getReleaseRequirementText(): string {
    if (canReleaseSpores($game)) {
      return 'Final host consumed. Spore Release may begin.'
    }

    if ($game.currentStage < hostDefinitions.length) {
      return `Advance to Stage ${hostDefinitions.length} and consume every host to unlock Spore Release.`
    }

    return `Collapse ${$game.hostName.toUpperCase()} to unlock Spore Release.`
  }

  function getReleaseProgressPercent(): number {
    const completedStages = $game.hostCompleted ? $game.currentStage : $game.currentStage - 1
    const partialProgress = $game.hostCompleted ? 0 : getHostProgress($game) / 100
    return Math.min(100, ((completedStages + partialProgress) / hostDefinitions.length) * 100)
  }

  function beginSporeRelease() {
    if (!canReleaseSpores($game)) {
      return
    }

    isConfirmingSporeRelease = true
  }

  function cancelSporeRelease() {
    isConfirmingSporeRelease = false
  }

  function confirmSporeRelease() {
    game.releaseSpores()
    isConfirmingSporeRelease = false
  }

  $: if (activeView !== 'spore' || !canReleaseSpores($game)) {
    isConfirmingSporeRelease = false
  }

  $: if (generatorHoldIntervalTimer && generatorDefinitions.every((generator) => !canAffordGenerator.get(generator.id))) {
    clearGeneratorBuyHold()
  }

  onMount(() => {
    const unsubscribeOfflineNarrative = _pendingOfflineNarrative.subscribe((narrative: OfflineNarrative | null) => {
      if (!narrative || narrative.events.length === 0) {
        return
      }

      offlineNarrative = narrative
      showOfflineNarrative = true
      offlineNarrativeRun += 1
      playOfflineNarrativeSequence(narrative, offlineNarrativeRun)
    })

    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      const debugWindow = window as Window & {
        __myceliumDebug?: {
          simulateOffline: (minutes?: number) => void
        }
      }

      debugWindow.__myceliumDebug = {
        simulateOffline: (minutes = 10) => {
          game.debugSimulateOffline(minutes)
        },
      }
    }

    game.start()
    uiClockTimer = window.setInterval(() => {
      uiNow = Date.now()
    }, 1000)

    const TICK_INTERVAL = 5000
    generatorDefinitions.forEach((generator, index) => {
      const offset = (index * 800) % TICK_INTERVAL
      const timerId = window.setInterval(() => {
        if ($game.visibility.generatorTiers[index]) {
          outputTickMap.set(generator.id, true)
          outputTickMap = outputTickMap
          setTimeout(() => {
            outputTickMap.set(generator.id, false)
            outputTickMap = outputTickMap
          }, 150)
        }
      }, TICK_INTERVAL + offset)
    })

    return () => {
      clearGeneratorBuyHold()
      if (uiClockTimer) {
        window.clearInterval(uiClockTimer)
        uiClockTimer = undefined
      }
      unsubscribeOfflineNarrative()
      game.stop()

      game.saveNow()
    }
  })

  onDestroy(() => {
    offlineNarrativeRun += 1
  })
</script>

<svelte:head>
  <title>MYCELIUM_PROTOCOL_v0.1 | COMMAND_CENTER</title>
  <meta
    name="description"
    content="Organic brutalist command center for The Mycelium Protocol incremental RPG."
  />
</svelte:head>

{#if !$game.visibility.generatorPanel}
  <div class="intro-shell">
    <div class="intro-shell__content">
      <div class="intro-shell__title reveal-enter">
        <h1>THE MYCELIUM PROTOCOL</h1>
        <p>GERMINATION_SEQUENCE_v1.0</p>
      </div>

      {#if $game.visibility.biomassDisplay}
        <div class="intro-biomass reveal-enter" class:intro-biomass--expanded={!$game.visibility.observationLog} on:click={() => absorbWithProgress()}>
          <p>BIOMASS</p>
          <h2>{formatBiomass($game.biomass, useScientificNotation)} <span>Ψ</span></h2>
          {#if $game.visibility.bpsDisplay}
            <strong>+{formatBPS($game.biomassPerSecond, useScientificNotation)} Ψ</strong>
          {/if}
        </div>
      {/if}

      {#if $game.strain === 'parasite'}
        {@const clicksUntilBurst = getClicksUntilBurst($game.clickCount, $game.stats.virulence)}
        <div class="burst-counter">
          <span class="burst-counter__icon">⚡</span>
          <span class="burst-counter__text">Burst in {clicksUntilBurst} click{clicksUntilBurst === 1 ? '' : 's'}</span>
        </div>
      {/if}

      {#if latestLogEntry}
        <section class="intro-latest-event reveal-enter" class:reveal-enter={isNewReveal('observationLog')} on:animationend={() => finishReveal('observationLog')}>
          <span>{latestLogEntry}</span>
        </section>
      {/if}
    </div>
  </div>
{:else}
<div class="command-shell">
  <aside class="dock-shell">
    <div class="dock-header">
      <h1>NODE_01</h1>
      <p>ROOT_ACCESS_GRANTED</p>
    </div>

    <nav class="dock-nav">
      {#each visibleNavItems as item}
        <button class:nav-link={true} class:nav-link--active={activeView === item.id} type="button" on:click={() => (activeView = item.id)}>
          <span>{item.symbol}</span>
          <span>{item.label}</span>
          {#if item.id === 'evolution' && $game.mutationPoints > 0}
            <span class="mutation-dot" title="Mutation points available to spend."></span>
          {/if}
        </button>
      {/each}
    </nav>

    <div class="dock-footer">
      <button class="nav-link nav-link--debug" type="button" on:click={resetGameForDebug}>
        <span>[!]</span>
        <span>RESET GAME</span>
      </button>
    </div>
  </aside>

  <main class="workspace-shell">
    <header class="system-bar">
      <div class="system-bar__title">
        <span>MYCELIUM_PROTOCOL_v0.1</span>
        <span class="system-bar__dot"></span>
      </div>

      <div class="system-bar__status">
        {#if $game.visibility.biomassDisplay && activeView !== 'terminal'}
          <div class="system-bar__segment" title="Your total accumulated biomass.">
            <span class="system-bar__segment-label">BIOMASS</span>
            <span class="system-bar__segment-value">{formatBiomass($game.biomass, useScientificNotation)} Ψ</span>
          </div>
        {/if}
        {#if $game.visibility.bpsDisplay}
          <div class="system-bar__segment" title="Passive biomass per second.">
            <span class="system-bar__segment-label">BPS</span>
            <span
              class="system-bar__segment-value"
              class:bps-suppressed={suppressionActive}
              class:bps-lift-flash={bpsLiftFlash}
              class:bps-purchase-flash={bpsPurchaseFlash}
              style={mostSevereSeverity && activeDefenseEvents.length > 0 ? `color: ${SEVERITY_COLORS[mostSevereSeverity].bpsText}` : ''}
            >+{formatBPS($game.biomassPerSecond, useScientificNotation)}</span>
            {#if activeDefenseEvents.length > 0}
              {#each suppressionBadges as badge}
                <span class="suppression-badge" style="
                  background: {badge.colors.suppressedBg};
                  color: {badge.colors.suppressedText};
                  border: 1px solid {badge.colors.suppressedBorder};
                ">
                  {badge.eventName.toUpperCase()} -{badge.pct}%
                </span>
              {/each}
              {#if mostSevereSeverity}
                <span class="bps-timer" style="color: {SEVERITY_COLORS[mostSevereSeverity].timerText};">
                  {formattedTimer}
                </span>
              {/if}
            {/if}
          </div>
        {/if}
        {#if $game.visibility.stageDisplay}
          <div class="system-bar__segment" title="Stage {$game.currentStage} of {hostDefinitions.length}. Host: {$game.hostName}. Advance by reaching 100% degradation.">
            <span class="system-bar__segment-label">STAGE</span>
            <span class="system-bar__segment-value">{$game.currentStage.toString().padStart(2, '0')}</span>
            <span class="system-bar__stage-name">{$game.stageLabel.toUpperCase()}</span>
          </div>
        {/if}
      </div>
    </header>

    {#if activeView === 'terminal'}
      <div class="desktop-terminal workspace-grid">
        <section class="workspace-main">
            <div class="workspace-main__center">
              <div class="terminal-focus">
<div
                  class="biomass-chamber"
                  class:biomass-chamber--idle={clickZoneIdle}
                  on:click={(e) => absorbWithProgress(e)}
                >
                  <p class="biomass-chamber__label">CURRENT TOTAL BIOMASS</p>
                  <div class="biomass-chamber__value-row">
                    <h2 class="biomass-chamber__value" class:biomass-chamber__value--pulse={biomassPulse}>{formatBiomass($game.biomass, useScientificNotation)}<span> Ψ</span></h2>
                    <button
                      class="biomass-chamber__info-button"
                      type="button"
                      aria-label="Currency notation information"
                      on:click={openCurrencyModal}
                    >
                      i
                    </button>
                  </div>
                  {#if $game.visibility.bpsDisplay}
                    <p class="biomass-chamber__label">
                      PASSIVE ABSORPTION ::
                      <span class:bps-suppressed={suppressionActive} class:bps-lift-flash={bpsLiftFlash}>+{formatBPS($game.biomassPerSecond, useScientificNotation)}</span>
                      {#if suppressionActive}
                        <span class="bps-suppression-tag">{suppressionLabel}</span>
                      {/if}
                    </p>
                    <p class="biomass-chamber__label" title="Each click yields this times your current per-second output. Active play is significantly amplified.">CLICK :: +{formatBiomass($game.biomassPerClick, useScientificNotation)} Ψ [≈ {($game.biomassPerSecond.gt(0) ? $game.biomassPerClick.div($game.biomassPerSecond).toFixed(1) : '—')}&times; BPS]</p>
                  {/if}
                  {#if $game.clickCount === 0}
                    <p class="biomass-chamber__hint biomass-chamber__hint--cta">[ CLICK TO ABSORB ]</p>
                  {/if}
                  {#if $game.manifestationQueue.length > 0}
                    <p class="biomass-chamber__event">{$game.manifestationQueue[0]}</p>
                  {/if}
                  {#each clickFloats as float (float.id)}
                    <span class="click-float" style="left: {float.x}px; top: {float.y}px;">{float.value}</span>
                  {/each}
                </div>

                <!-- Signal economy temporarily disabled. -->
                <!-- <SignalPanel /> -->

              </div>

              {#if $game.visibility.hostHealthBar || ($game.hostCompleted && hasNextStage($game))}
              <TerminalPanel
                title="SUBSTRATE ANALYSIS"
                tag="HOST"
                variant="low"
                className="analysis-panel"
              >
                <div class="analysis-panel__header">
                  <div>
                    <p class="analysis-panel__sub">HOST: {$game.hostName.toUpperCase()}</p>
                  </div>
              </div>

                <div class="analysis-panel__progress">
                  <div class="analysis-panel__row">
                    <span>DEGRADATION PROGRESS</span>
                    <button
                      class="degradation-info-button"
                      type="button"
                      aria-label="Degradation status information"
                      on:click={openDegradationModal}
                    >
                      i
                    </button>
                  </div>
                  <div
                    class="analysis-progress-bar"
                    class:analysis-progress-bar--accelerating={hostProgressPercent >= 50 && hostProgressPercent < 80}
                    class:analysis-progress-bar--critical={hostProgressPercent >= 80}
                    role="progressbar"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow={hostProgressPercent}
                    aria-label="Degradation progress"
                    title="Host degradation represents how deeply the mycelium has compromised this host. At 100%, the host is consumed and you advance to the next stage."
                  >
                    <div class="analysis-progress-bar__fill" aria-hidden="true" style={`width: ${hostProgressPercent}%`}></div>
                    <span class="analysis-progress-bar__label analysis-progress-bar__label--track">
                      {hostProgressLabel}{hostProgressPercent >= 80 ? ' [CRITICAL]' : hostProgressPercent >= 50 ? ' [ACCELERATING]' : ''}
                    </span>
                    <span class="analysis-progress-bar__label analysis-progress-bar__label--fill" aria-hidden="true" style={`clip-path: inset(0 ${100 - hostProgressPercent}% 0 0)`}>
                      {hostProgressLabel}{hostProgressPercent >= 80 ? ' [CRITICAL]' : hostProgressPercent >= 50 ? ' [ACCELERATING]' : ''}
                    </span>
                  </div>
                </div>

              <hr class="log-divider" />
              <ObservationFeed entries={$game.structuredLog} maxVisible={5} />

              {#if $game.hostCompleted && hasNextStage($game)}
                <div class="analysis-panel__advance">
                  <TerminalButton variant="secondary" on:click={() => game.advanceStage()}>[ ADVANCE TO STAGE {$game.currentStage + 1} ]</TerminalButton>
                </div>
              {/if}
              </TerminalPanel>
              {/if}

              {#if $game.currentStage >= BALANCE.DEFENSE_FORECAST_UNLOCK_STAGE}
              <TerminalPanel
                title="DEFENSE CONTROL"
                tag="TACTICS"
                variant="low"
                className="analysis-panel"
              >
                  {#if forecastCountdownLabel !== null}
                    <p class="analysis-panel__flavor analysis-panel__flavor--alert">{forecastCountdownLabel}</p>
                  {/if}
                  {#if $game.activeDefenseEvents.length > 0}
                    <p class="analysis-panel__flavor analysis-panel__flavor--alert">Status: {getDefenseStatusLabel()}</p>
                  {:else if $game.equippedCountermeasure === null}
                    <!-- countermeasure prompt removed -->
                  {:else}
                  {/if}
                  <div class="defense-control__legend">
                    <span><strong>FULL:</strong> completely neutralizes the listed event.</span>
                    <span><strong>PARTIAL:</strong> reduces but does not eliminate the event's effect.</span>
                  </div>
                  <div class="strain-grid defense-control__grid">
                    {#if equippedCountermeasure?.flavorLine}
                      <p class="defense-status">CURRENT STATUS: {equippedCountermeasure.flavorLine}</p>
                    {/if}
                    {#each countermeasureDefinitions as countermeasure}
                      {@const isActive = $game.equippedCountermeasure === countermeasure.id}
                      {@const isLocked = $game.activeDefenseEvents.length > 0 && !isActive}
                      {@const isFullMatch = countermeasure.targetEventIds.some(id => $game.activeDefenseEvents.some(e => e.id === id))}
                      {@const isPartialMatch = countermeasure.partialEventIds.some(id => $game.activeDefenseEvents.some(e => e.id === id))}
                      {@const isEngaged = isFullMatch || isPartialMatch}
                      <button
                        class="strain-card"
                        class:strain-card--locked={isLocked}
                        class:strain-card--active={isActive}
                        class:strain-card--engaged-full={isEngaged && isFullMatch}
                        class:strain-card--engaged-partial={isEngaged && !isFullMatch}
                        disabled={isLocked}
                        type="button"
                        on:click={() => game.equipCountermeasure(countermeasure.id)}
                      >
                        <div class="strain-card__status">
                          {#if isFullMatch}
                            STATUS: ENGAGED [FULL]
                          {:else if isPartialMatch}
                            STATUS: ENGAGED [PARTIAL]
                          {:else}
                            STATUS: DORMANT
                          {/if}
                        </div>
                        <strong>{countermeasure.name}</strong>
                        <small class:strain-card__trigger--full={isFullMatch} class:strain-card__trigger--partial={isPartialMatch && !isFullMatch}>Full: {getCountermeasureFullCoverage(countermeasure.id)}</small>
                        <small class:strain-card__trigger--full={isFullMatch} class:strain-card__trigger--partial={isPartialMatch && !isFullMatch}>Partial: {getCountermeasurePartialCoverage(countermeasure.id)}</small>
                      </button>
                    {/each}
                  </div>
              </TerminalPanel>
              {/if}
            </div>
          </section>

          <aside class="workspace-sidebar">
          <div class="sidebar-modules">
          <div class:reveal-enter={isNewReveal('generatorPanel')} on:animationend={() => finishReveal('generatorPanel')}>
          <TerminalPanel
            title="GENERATOR_MODULES"
            bleedHeader={true}
            className="modules-shell"
          >
            <div class="modules-list">
              {#each generatorDefinitions as generator, index}
                {#if $game.visibility.generatorTiers[index]}
                {@const affordable = canAffordGenerator.get(generator.id) ?? false}
                {@const shortfall = getGeneratorCost($game, generator.id).minus($game.biomass)}
                {@const contribution = $game.biomassPerSecond.gt(0) ? getGeneratorProduction($game, generator.id).div($game.biomassPerSecond).toNumber() : 0}
                {@const generatorCounts = GENERATOR_TIER_ORDER.map(id => $game.generators[id]?.owned ?? 0)}
                {@const rawEff = index > 0 ? getSubstrateRawEfficiency(index, generatorCounts) : 1}
                {@const effPct = index > 0 ? getSubstrateEfficiencyPercent(index, generatorCounts) : 100}
                {@const substrateStatus = index > 0 ? getSubstrateStatus(rawEff) : 'sufficient'}
                <div
                  class="module-card"
                  class:module-card--unaffordable={!affordable}
                  class:module-card--can-afford-flash={canAffordFlashMap.get(generator.id)}
                  class:module-card--purchase-flash={purchaseFlashMap.get(generator.id)}
                  class:reveal-enter={isNewReveal(`generatorTier-${index}`)}
                  on:animationend={() => finishReveal(`generatorTier-${index}`)}
                >
                  <div class="module-card__header">
                    <div>
                      <h3>{generator.name}</h3>
                      <p>{generator.flavor}</p>
                    </div>
                    <span
                      class="module-card__count"
                      class:module-card__count--pulse={countPulseMap.get(generator.id)}
                    >
                      {$game.generators[generator.id].owned.toString().padStart(2, '0')}
                    </span>
                  </div>

                  <div class="module-card__footer">
                    <span class:module-card__output--tick={outputTickMap.get(generator.id)}>
                      {#if getGeneratorDisruption(generator.id)}
                        {@const disruption = getGeneratorDisruption(generator.id)}
                        OUTPUT: DISRUPTED [{disruption ? getRemainingDurationLabel(disruption.endsAt) : ''}]
                      {:else}
                        OUTPUT: +{formatBiomass(getGeneratorProduction($game, generator.id), useScientificNotation)} Ψ/sec
                      {/if}
                    </span>
                    <span>COST: {formatBiomass(getGeneratorCost($game, generator.id), useScientificNotation)} Ψ {#if !affordable}<span class="module-card__shortfall">NEED {formatBiomass(shortfall, false)} MORE Ψ</span>{/if}</span>
                  </div>
                  <div class="module-card__contribution-bar" title="This generator's share of total BPS">
                    <div class="module-card__contribution-fill" style="width: {Math.min(contribution * 100, 100).toFixed(1)}%"></div>
                  </div>
                  <p class="module-card__contribution-label">CONTRIBUTION: {(contribution * 100).toFixed(1)}%</p>
                  {#if index >= 1 && $game.generators[generator.id].owned > 0}
                    <p class="module-card__substrate module-card__substrate--{substrateStatus}">
                      SUBSTRATE: {substrateStatus === 'sufficient' ? 'SUFFICIENT' : substrateStatus === 'strained' ? `STRAINED [${effPct}%]` : `DEPLETED [${effPct}%]`}
                    </p>
                  {/if}
                  <div class="module-card__actions">
                    <span
                      class="module-card__buy-gain"
                      class:module-card__buy-gain--disabled={!affordable}
                      title="Buying one more {generator.name} will increase your passive BPS by this amount."
                    >NEXT: {getGeneratorBuyGain(generator.id)}</span>
                    <button
                      class="terminal-button terminal-button--secondary"
                      class:terminal-button--disabled={!affordable}
                      disabled={!affordable}
                      type="button"
                      on:pointerdown={(event) => startGeneratorBuyHold(generator.id, event)}
                      on:pointerup={clearGeneratorBuyHold}
                      on:pointerleave={clearGeneratorBuyHold}
                      on:pointercancel={clearGeneratorBuyHold}
                    >
                      [ BUY {$game.buyAmount === 'MAX' ? `×MAX (${getAffordableQuantity($game, generator.id, $game.buyAmount)})` : ''}{formatBiomass(getGeneratorCost($game, generator.id, getAffordableQuantity($game, generator.id, $game.buyAmount)), useScientificNotation)}Ψ ]
                    </button>
                  </div>
                </div>
                {/if}
              {/each}

              {#if nextLockedGeneratorTier !== -1}
                <div class="module-card module-card--locked module-card--hint">
                  <div class="module-card__header">
                    <div>
                      <h3>???</h3>
                      <p>PATHWAY LOCKED</p>
                    </div>
                    <span class="module-card__count">LOCK</span>
                  </div>
                  <p class="module-card__locked-note">{getGeneratorHint(nextLockedGeneratorTier)}</p>
                </div>
              {/if}

            </div>

          </TerminalPanel>
          </div>

            {#if $game.visibility.upgradePanel}
            <div class:reveal-enter={isNewReveal('upgradePanel')} on:animationend={() => finishReveal('upgradePanel')}>
            <TerminalPanel
              title="LAB_PATCHES"
              tag="UPGRADES"
              bleedHeader={true}
              className="upgrades-shell"
            >
              <div class="upgrades-list">
                {#each upgradeDefinitions as upgrade}
                  {#if isUpgradeAvailable(upgrade)}
                  <div class="upgrade-row">
                    <div>
                      <h4>{upgrade.name}</h4>
                      <p>{upgrade.description}</p>
                    </div>
                    <TerminalButton
                      variant="secondary"
                      disabled={$game.upgrades[upgrade.id] || !canAffordUpgrade.get(upgrade.id)}
                      on:click={() => game.buyUpgrade(upgrade.id)}
                    >
                      {$game.upgrades[upgrade.id] ? '[ DONE ]' : `[ PATCH: ${formatBiomass(upgrade.cost, useScientificNotation)} Ψ ]`}
                    </TerminalButton>
                  </div>
                  {/if}
                {/each}
              </div>
            </TerminalPanel>
            </div>
            {/if}

            <GrindPanel state={$game}
              on:startGrind={() => game.startGrindSession()}
              on:triggerGrind={() => game.grindEvent()}
              on:scanDefense={() => game.scanDefenseEvent()}
              on:setPreemptive={() => game.setPreemptiveCountermeasure()}
            />
          </div>
          </aside>
      </div>

      <div class="mobile-terminal">
        <header class="mobile-topbar">
          <span class="mobile-topbar__icon mobile-topbar__icon--hidden" aria-hidden="true"></span>
          <div class="mobile-topbar__title">PROTOCOL_1.0</div>
          {#if $game.visibility.stageDisplay}
            <div class="mobile-topbar__stage">STAGE: {$game.stageLabel.toUpperCase()}</div>
          {/if}
        </header>

        <section class="mobile-hero" on:touchstart={(e) => {
            const touch = e.touches[0]
            if (touch) {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              const x = touch.clientX - rect.left
              const y = touch.clientY - rect.top
              addMobileClickFloat(x, y)
            }
            absorbWithProgress()
          }} on:click={(e) => absorbWithProgress(e)}>
          {#each mobileClickFloats as float (float.id)}
            <span class="click-float" style="left: {float.x}px; top: {float.y}px;">{float.value}</span>
          {/each}
          <p class="mobile-hero__label">AVAILABLE BIOMASS</p>
          <div class="mobile-hero__value-row">
            <span class="mobile-hero__glyph">Ψ</span>
            <h2 class="mobile-hero__value">{formatBiomass($game.biomass, useScientificNotation)}</h2>
          </div>

          {#if $game.visibility.bpsDisplay}
            <p class="mobile-hero__label">
              PASSIVE ::
              <span class:bps-suppressed={suppressionActive} class:bps-lift-flash={bpsLiftFlash}>+{formatBPS($game.biomassPerSecond, useScientificNotation)}</span>
              {#if suppressionActive}
                <span class="bps-suppression-tag">{suppressionLabel}</span>
              {/if}
            </p>
            <p class="mobile-hero__label" title="Each click yields this many times your current per-second output. Active play is significantly amplified.">TAP :: +{formatBiomass($game.biomassPerClick, useScientificNotation)} Ψ [≈ {($game.biomassPerSecond.gt(0) ? $game.biomassPerClick.div($game.biomassPerSecond).toFixed(1) : '—')}&times; BPS]</p>
          {/if}

          <!-- Signal economy temporarily disabled. -->
          <!-- <SignalPanel /> -->
        </section>

        {#if $game.visibility.observationLog && $game.visibility.logPanelOpen}
        <TerminalPanel title="OBSERVATION LOG" tag="SYS" variant="low" className="mobile-card mobile-log-card">
          <TypewriterLog entries={$game.log.slice(-12)} />
        </TerminalPanel>
        {/if}

        {#if $game.visibility.hostHealthBar || ($game.hostCompleted && hasNextStage($game))}
        <TerminalPanel title="SUBSTRATE ANALYSIS" tag="+" variant="low" bleedHeader={true} className="mobile-card">
          <div class="mobile-analysis__header">
            <div>
              <p class="mobile-analysis__host">HOST: {$game.hostName.toUpperCase()}</p>
            </div>
          </div>

          <div class="mobile-analysis__progress-row">
            <span>DEGRADATION PROGRESS</span>
            <button
              class="degradation-info-button"
              type="button"
              aria-label="Degradation status information"
              on:click={openDegradationModal}
            >
              i
            </button>
          </div>
          <div
            class="analysis-progress-bar"
            class:analysis-progress-bar--accelerating={hostProgressPercent >= 50 && hostProgressPercent < 80}
            class:analysis-progress-bar--critical={hostProgressPercent >= 80}
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={hostProgressPercent}
            aria-label="Degradation progress"
            title="Host degradation represents how deeply the mycelium has compromised this host. At 100%, the host is consumed and you advance to the next stage."
          >
            <div class="analysis-progress-bar__fill" aria-hidden="true" style={`width: ${hostProgressPercent}%`}></div>
            <span class="analysis-progress-bar__label analysis-progress-bar__label--track">
              {hostProgressLabel}{hostProgressPercent >= 80 ? ' [CRITICAL]' : hostProgressPercent >= 50 ? ' [ACCELERATING]' : ''}
            </span>
            <span class="analysis-progress-bar__label analysis-progress-bar__label--fill" aria-hidden="true" style={`clip-path: inset(0 ${100 - hostProgressPercent}% 0 0)`}>
              {hostProgressLabel}{hostProgressPercent >= 80 ? ' [CRITICAL]' : hostProgressPercent >= 50 ? ' [ACCELERATING]' : ''}
            </span>
          </div>

          <div class="mobile-alert-card">
            <span class="mobile-alert-card__icon">▲</span>
            <div>
              {#if $game.activeDefenseEvents.length > 0}
                {#each $game.activeDefenseEvents as event}
                  {@const severity = getEventSeverity(event)}
                  {@const penalties = getEventPenaltyBreakdown(event)}
                  {@const flavorHint = getEventFlavorHint(event)}
                  <div class="mobile-alert-card__event mobile-alert-card__event--{severity.toLowerCase()}">
                    <p class="mobile-alert-card__header">
                      <span>[{severity}]</span>
                      <span>{event.name.toUpperCase()}</span>
                      <span>[{getRemainingDurationLabel(event.endsAt)}]</span>
                    </p>
                    {#each penalties as penalty}
                      <p class="mobile-alert-card__penalty">{penalty}</p>
                    {/each}
                    {#if flavorHint}
                      <p class="mobile-alert-card__flavor">{flavorHint}</p>
                    {/if}
                  </div>
                {/each}
              {:else}
                <p>HOST DEFENSES</p>
                <strong>NONE DETECTED</strong>
              {/if}
            </div>
          </div>

          <p>{currentHostFlavor}</p>

          {#if $game.hostCompleted && hasNextStage($game)}
            <button class="mobile-generator-row__buy mobile-analysis__advance" type="button" on:click={() => game.advanceStage()}>
              [ ADVANCE TO STAGE {$game.currentStage + 1} ]
            </button>
          {/if}

          <hr style="border: none; border-top: 1px solid #1e2a14; margin: 0.75rem 0;" />
          <ObservationFeed entries={$game.structuredLog} maxVisible={4} fade={false} />
        </TerminalPanel>
        {/if}

        {#if $game.currentStage >= BALANCE.DEFENSE_FORECAST_UNLOCK_STAGE}
        <TerminalPanel title="DEFENSE CONTROL" tag="▲" variant="low" bleedHeader={true} className="mobile-card">
            {#if forecastCountdownLabel !== null}
              <p style="color: #f0c040; font-weight: 600;">{forecastCountdownLabel}</p>
            {/if}
            {#if $game.activeDefenseEvents.length > 0}
              <p style="color: #f0c040; font-weight: 600;">Status: {getDefenseStatusLabel()}</p>
            {:else if $game.equippedCountermeasure === null}
              <!-- countermeasure prompt removed -->
            {:else}
            {/if}
            <div class="mobile-strain-list defense-control__list">
              {#if equippedCountermeasure?.flavorLine}
                <p class="defense-status">CURRENT STATUS: {equippedCountermeasure.flavorLine}</p>
              {/if}
              {#each countermeasureDefinitions as countermeasure}
                {@const isActive = $game.equippedCountermeasure === countermeasure.id}
                {@const isLocked = $game.activeDefenseEvents.length > 0 && !isActive}
                {@const isFullMatch = countermeasure.targetEventIds.some(id => $game.activeDefenseEvents.some(e => e.id === id))}
                {@const isPartialMatch = countermeasure.partialEventIds.some(id => $game.activeDefenseEvents.some(e => e.id === id))}
                {@const isEngaged = isFullMatch || isPartialMatch}
                <button
                  class="mobile-strain-button"
                  class:mobile-strain-button--locked={isLocked}
                  class:mobile-strain-button--active={isActive}
                  class:mobile-strain-button--engaged-full={isEngaged && isFullMatch}
                  class:mobile-strain-button--engaged-partial={isEngaged && !isFullMatch}
                  disabled={isLocked}
                  type="button"
                  on:click={() => game.equipCountermeasure(countermeasure.id)}
                >
                  {#if isFullMatch}
                    <span class="mobile-strain-button__status">STATUS: ENGAGED [FULL]</span>
                  {:else if isPartialMatch}
                    <span class="mobile-strain-button__status">STATUS: ENGAGED [PARTIAL]</span>
                  {:else}
                    <span class="mobile-strain-button__status">STATUS: DORMANT</span>
                  {/if}
                  <strong>{countermeasure.name.toUpperCase()}</strong>
                  <small>Full: {getCountermeasureFullCoverage(countermeasure.id)}</small>
                  <small>Partial: {getCountermeasurePartialCoverage(countermeasure.id)}</small>
                </button>
              {/each}
            </div>
        </TerminalPanel>
        {/if}



        {#if $game.visibility.generatorPanel}
        <TerminalPanel title="GENERATOR MODULES" tag="" variant="low" className="mobile-card mobile-generators" bleedHeader={true}>
          <div slot="header" class="mobile-generators__header-extra">TOTAL EFFICIENCY: {formatBPS($game.biomassPerSecond, useScientificNotation)}</div>
          <div class="mobile-generator-list">
            {#each generatorDefinitions as generator, index}
              {#if $game.visibility.generatorTiers[index]}
              {@const generatorCounts = GENERATOR_TIER_ORDER.map(id => $game.generators[id]?.owned ?? 0)}
              {@const rawEff = index > 0 ? getSubstrateRawEfficiency(index, generatorCounts) : 1}
              {@const effPct = index > 0 ? getSubstrateEfficiencyPercent(index, generatorCounts) : 100}
              {@const substrateStatus = index > 0 ? getSubstrateStatus(rawEff) : 'sufficient'}
              <div class="mobile-generator-row">
                <div class="mobile-generator-row__body">
                  <h3>{generator.name.toUpperCase()} ({$game.generators[generator.id].owned})</h3>
                  <p>{generator.flavor.toUpperCase()}</p>
                  <p class="mobile-generator-row__meta">
                    {#if getGeneratorDisruption(generator.id)}
                      {@const disruption = getGeneratorDisruption(generator.id)}
                      OUTPUT: DISRUPTED [{disruption ? getRemainingDurationLabel(disruption.endsAt) : ''}]
                    {:else}
                      OUTPUT: +{formatBiomass(getGeneratorProduction($game, generator.id), useScientificNotation)} Ψ/SEC
                    {/if}
                  </p>
                  {#if index >= 1 && $game.generators[generator.id].owned > 0}
                    <p class="mobile-generator-row__substrate mobile-generator-row__substrate--{substrateStatus}">
                      SUBSTRATE: {substrateStatus === 'sufficient' ? 'SUFFICIENT' : substrateStatus === 'strained' ? `STRAINED [${effPct}%]` : `DEPLETED [${effPct}%]`}
                    </p>
                  {/if}
                  {#if $game.generators[generator.id].owned > 0}
                    {@const contribution = $game.biomassPerSecond.gt(0) ? getGeneratorProduction($game, generator.id).div($game.biomassPerSecond).toNumber() : 0}
                    {@const relativeEff = getGeneratorRelativeEfficiency(generator.id)}
                    {@const effLabel = formatEfficiencyLabel(relativeEff)}
                    <div class="mobile-generator-row__contribution-bar" title="This generator's share of total BPS">
                      <div class="mobile-generator-row__contribution-fill" style="width: {Math.min(contribution * 100, 100).toFixed(1)}%"></div>
                    </div>
                    <p class="mobile-generator-row__contribution-label">CONTRIBUTION: {(contribution * 100).toFixed(1)}%</p>
                  {/if}
                  <span
                    class="mobile-generator-row__next-gain"
                    class:mobile-generator-row__next-gain--disabled={!canAffordGenerator.get(generator.id)}
                    title="Buying one more {generator.name} will increase your passive BPS by this amount."
                  >NEXT: {getGeneratorBuyGain(generator.id)}</span>
                </div>
                <button class="mobile-generator-row__buy" disabled={!canAffordGenerator.get(generator.id)} type="button"
                  on:pointerdown={(event) => startGeneratorBuyHold(generator.id, event)}
                  on:pointerup={clearGeneratorBuyHold}
                  on:pointerleave={clearGeneratorBuyHold}
                  on:pointercancel={clearGeneratorBuyHold}
                >
                  [BUY: {formatBiomass(getGeneratorCost($game, generator.id), useScientificNotation)} Ψ]
                </button>
              </div>
              {/if}
            {/each}

            {#if nextLockedGeneratorTier !== -1}
              <div class="mobile-generator-row mobile-generator-row--locked-hint">
                <div class="mobile-generator-row__body">
                  <h3>???</h3>
                  <p>{getGeneratorHint(nextLockedGeneratorTier).toUpperCase()}</p>
                </div>
                <div class="mobile-generator-row__buy mobile-generator-row__buy--locked">[LOCKED]</div>
              </div>
            {/if}
          </div>
        </TerminalPanel>
        {/if}

        {#if $game.visibility.upgradePanel}
        <TerminalPanel title="LAB_PATCHES" tag="UPGRADES" variant="low" className="mobile-card mobile-upgrades" bleedHeader={true}>
          <div class="mobile-upgrade-list">
            {#each upgradeDefinitions as upgrade}
              {#if isUpgradeAvailable(upgrade)}
              <div class="mobile-upgrade-row">
                <div class="mobile-upgrade-row__body">
                  <h3>{upgrade.name}</h3>
                  <p>{upgrade.description}</p>
                </div>
                <button
                  class="mobile-upgrade-row__buy"
                  class:mobile-upgrade-row__buy--done={$game.upgrades[upgrade.id]}
                  disabled={$game.upgrades[upgrade.id] || !canAffordUpgrade.get(upgrade.id)}
                  type="button"
                  on:click={() => game.buyUpgrade(upgrade.id)}
                >
                  {$game.upgrades[upgrade.id] ? '[ DONE ]' : `[PATCH: ${formatBiomass(upgrade.cost, useScientificNotation)} Ψ]`}
                </button>
              </div>
              {/if}
            {/each}
          </div>
        </TerminalPanel>
        {/if}

      </div>
    {:else if activeView === 'evolution'}
      <div class="desktop-evolution workspace-grid workspace-grid--single">
        <section class="workspace-main workspace-main--full">
          <div class="screen-stack">
            <TerminalPanel title="EVOLUTION" tag="SYS" bleedHeader={true} resizable={true} resizeAxis="vertical">
              <div class="overview-grid">
                <div class="overview-stat">
                  <span class="overview-stat__label">HOSTS CONSUMED</span>
                  <strong>{getCompletedHosts($game).toString().padStart(2, '0')}</strong>
                  <span class="overview-stat__sublabel">this run</span>
                </div>
                <div class="overview-stat">
                  <span class="overview-stat__label">LIFETIME BIOMASS</span>
                  <strong>{formatDecimal($game.lifetimeBiomass)}</strong>
                  <span class="overview-stat__sublabel">all runs</span>
                </div>
                <div class="overview-stat">
                  <span class="overview-stat__label">GENERATORS OWNED</span>
                  <strong>{getTotalOwnedGenerators().toString().padStart(2, '0')}</strong>
                  <span class="overview-stat__sublabel">current</span>
                </div>
                <div class="overview-stat">
                  <span class="overview-stat__label">UPGRADES APPLIED</span>
                  <strong>{getPurchasedUpgradeCount().toString().padStart(2, '0')}</strong>
                  <span class="overview-stat__sublabel">this run</span>
                </div>
                <div class="overview-stat">
                  <span class="overview-stat__label">MUTATION POINTS</span>
                  <strong>{$game.mutationPoints.toString().padStart(2, '0')}</strong>
                  <span class="overview-stat__sublabel">available now</span>
                </div>
                <div class="overview-stat">
                  <span class="overview-stat__label">CURRENT STRAIN</span>
                  <strong>{getCurrentStrainName()}</strong>
                  <span class="overview-stat__sublabel">locked until release</span>
                </div>
              </div>
            </TerminalPanel>

            <div class="dual-panel-grid">
              {#if $game.visibility.statsPanel}
              {@const virulenceSynergy = getStrainSynergyLabel($game.strain, 'virulence')}
              {@const resilienceSynergy = getStrainSynergyLabel($game.strain, 'resilience')}
              {@const complexitySynergy = getStrainSynergyLabel($game.strain, 'complexity')}
              <TerminalPanel title="CORE ATTRIBUTES" tag="STATS" variant="low" bleedHeader={true} resizable={true} resizeAxis="both">
                <div class="desktop-attribute-list">
                  <div class="attribute-legend">
                    <span>STANCE: How this attribute interacts with host defenses.</span>
                    <span>ARCH: The evolutionary pathway this attribute reinforces.</span>
                  </div>
                  <div class="desktop-attribute-card">
                    <div class="desktop-attribute-card__header">
                      <span>VIRULENCE [V: {$game.stats.virulence}]</span>
                      <div class="desktop-attribute-card__header-side">
                        {#if virulenceSynergy}<span class="synergy-tag synergy-tag--{virulenceSynergy}" title={virulenceSynergy === 'synergy' ? 'Amplified by current strain' : virulenceSynergy === 'opposition' ? 'Penalized by current strain' : 'Balanced interaction with current strain'}>{virulenceSynergy === 'synergy' ? '⚡' : virulenceSynergy === 'opposition' ? '△' : '○'} [STANCE: {virulenceSynergy.toUpperCase()}]</span>{/if}
                        <span>[ARCH: EXPANSION ENGINE]</span>
                        <button class="desktop-attribute-card__button" disabled={$game.mutationPoints <= 0} type="button" on:click={() => game.allocateStat('virulence')} title={$game.mutationPoints <= 0 ? 'No mutation points available. Consume more hosts to earn points.' : 'Spend 1 mutation point'}>[+] 1MP</button>
                      </div>
                    </div>
                    <p>Aggressive spread protocol. Increases click-power efficiency by 15% per rank.</p>
                    {#if $game.mutationPoints > 0}
                      {@const currentBonus = getEffectiveStatBonus($game.stats.virulence, BALANCE.VIRULENCE_CLICK_BONUS_PER_POINT, $game.strain, 'virulence', $game.geneticMemoryStats)}
                      {@const nextBonus = getEffectiveStatBonus($game.stats.virulence + 1, BALANCE.VIRULENCE_CLICK_BONUS_PER_POINT, $game.strain, 'virulence', $game.geneticMemoryStats)}
                      {@const increase = ((nextBonus - currentBonus) / currentBonus * 100) || (nextBonus * 100)}
                      <p class="stat-preview">Next: Click power +{isFinite(increase) ? increase.toFixed(1) + '%' : '—'}</p>
                    {/if}
                  </div>

                  <div class="desktop-attribute-card">
                    <div class="desktop-attribute-card__header">
                      <span>RESILIENCE [R: {$game.stats.resilience}]</span>
                      <div class="desktop-attribute-card__header-side">
                        {#if resilienceSynergy}<span class="synergy-tag synergy-tag--{resilienceSynergy}" title={resilienceSynergy === 'synergy' ? 'Amplified by current strain' : resilienceSynergy === 'opposition' ? 'Penalized by current strain' : 'Balanced interaction with current strain'}>{resilienceSynergy === 'synergy' ? '⚡' : resilienceSynergy === 'opposition' ? '△' : '○'} [STANCE: {resilienceSynergy.toUpperCase()}]</span>{/if}
                        <span>[ARCH: SURVIVAL MESH]</span>
                        <button class="desktop-attribute-card__button" disabled={$game.mutationPoints <= 0} type="button" on:click={() => game.allocateStat('resilience')} title={$game.mutationPoints <= 0 ? 'No mutation points available. Consume more hosts to earn points.' : 'Spend 1 mutation point'}>[+] 1MP</button>
                      </div>
                    </div>
                    <p>Cellular wall density. Reduces system defense resistance by 8% per rank.</p>
                    {#if $game.mutationPoints > 0}
                      {@const currentBonus = getEffectiveStatBonus($game.stats.resilience, BALANCE.RESILIENCE_DEFENSE_PER_POINT, $game.strain, 'resilience', $game.geneticMemoryStats)}
                      {@const nextBonus = getEffectiveStatBonus($game.stats.resilience + 1, BALANCE.RESILIENCE_DEFENSE_PER_POINT, $game.strain, 'resilience', $game.geneticMemoryStats)}
                      {@const increase = ((nextBonus - currentBonus) * 100) || (nextBonus * 100)}
                      <p class="stat-preview">Next: Defense mitigation +{isFinite(increase) ? increase.toFixed(1) + '%' : '—'}</p>
                    {/if}
                  </div>

                  <div class="desktop-attribute-card">
                    <div class="desktop-attribute-card__header">
                      <span>COMPLEXITY [C: {$game.stats.complexity}]</span>
                      <div class="desktop-attribute-card__header-side">
                        {#if complexitySynergy}<span class="synergy-tag synergy-tag--{complexitySynergy}" title={complexitySynergy === 'synergy' ? 'Amplified by current strain' : complexitySynergy === 'opposition' ? 'Penalized by current strain' : 'Balanced interaction with current strain'}>{complexitySynergy === 'synergy' ? '⚡' : complexitySynergy === 'opposition' ? '△' : '○'} [STANCE: {complexitySynergy.toUpperCase()}]</span>{/if}
                        <span>[ARCH: COGNITIVE ARCH]</span>
                        <button class="desktop-attribute-card__button" disabled={$game.mutationPoints <= 0} type="button" on:click={() => game.allocateStat('complexity')} title={$game.mutationPoints <= 0 ? 'No mutation points available. Consume more hosts to earn points.' : 'Spend 1 mutation point'}>[+] 1MP</button>
                      </div>
                    </div>
                    <p>Synaptic mapping. Improves passive output and upgrade efficiency.</p>
                    {#if $game.mutationPoints > 0}
                      {@const currentBonus = getEffectiveStatBonus($game.stats.complexity, BALANCE.COMPLEXITY_PASSIVE_BONUS_PER_POINT, $game.strain, 'complexity', $game.geneticMemoryStats)}
                      {@const nextBonus = getEffectiveStatBonus($game.stats.complexity + 1, BALANCE.COMPLEXITY_PASSIVE_BONUS_PER_POINT, $game.strain, 'complexity', $game.geneticMemoryStats)}
                      {@const increase = ((nextBonus - currentBonus) * 100) || (nextBonus * 100)}
                      <p class="stat-preview">Next: Passive BPS +{isFinite(increase) ? increase.toFixed(1) + '%' : '—'}</p>
                    {/if}
                  </div>

                  <div class="readiness-banner">STATUS :: {getReadinessStatus()}</div>
                </div>
              </TerminalPanel>
              {/if}

              {#if $game.visibility.strainPrompt || $game.visibility.statsPanel}
              <TerminalPanel title="STRAIN STATUS" tag="NEXT" variant="low" bleedHeader={true} resizable={true} resizeAxis="both">
                <div class="strain-status-fields">
                  <div class="strain-status-field">
                    <span class="strain-status-field__label">STRAIN</span>
                    <span class="strain-status-field__value" title={!canChooseStrain() && $game.strain !== null ? 'Strain is locked for this run. A new strain can be selected after Spore Release.' : ''}>{getCurrentStrainName()} {#if $game.strain}<span class="strain-active-badge">[ACTIVE]</span>{/if}</span>
                  </div>
                  <div class="strain-status-field">
                    <span class="strain-status-field__label">MUTATION PTS</span>
                    <span class="strain-status-field__value" class:mutation-glow={$game.mutationPoints > 0}>{$game.mutationPoints} available</span>
                  </div>
                  <div class="strain-status-field">
                    <span class="strain-status-field__label">DEFENSE MODE</span>
                    <span class="strain-status-field__value">{#if $game.strain === 'parasite'}Counterburst windows spike click output after host defenses trigger.{:else if $game.strain === 'symbiote'}Symbiote mesh absorbs a larger share of active defense penalties.{:else if $game.strain === 'saprophyte'}Expiring host defenses leave salvageable biomass behind.{:else}No strain selected{/if}</span>
                  </div>
                  <div class="strain-status-field">
                    <span class="strain-status-field__label">STATUS</span>
                    <span class="strain-status-field__value">{#if canChooseStrain()}SELECTION PROTOCOL UNLOCKED — Choose a dominant phenotype{:else if getCompletedHosts($game) < 1}Awaiting first host consumption{:else}LOCKED IN — build-specific systems now layered{/if}</span>
                  </div>
                </div>
                {#if canChooseStrain()}
                  <div class="strain-grid">
                    {#each strainDefinitions as strain}
                      <button
                        class="strain-card"
                        class:strain-card--locked={!$game.unlockedStrains[strain.id]}
                        disabled={!$game.unlockedStrains[strain.id]}
                        type="button"
                        on:click={() => game.chooseStrain(strain.id)}
                      >
                        <strong>{strain.name}</strong>
                        <span>{strain.summary}</span>
                        <small>{strain.signature}</small>
                      </button>
                    {/each}
                  </div>
                {/if}
              </TerminalPanel>
              {/if}
            </div>

            {#if $game.visibility.statsPanel}
            <TerminalPanel title="EVOLUTIONARY ECHOES" tag="ECHO" variant="low" bleedHeader={true} resizable={true} resizeAxis="vertical">
              <div class="preview-copy">
                <p class="echo-subtitle">Each host leaves a permanent mark on your strain.</p>
                {#if Object.keys($game.hostEchoes).length === 0}
                  <p class="echo-empty">Clear your first host to begin accumulating evolutionary memory.</p>
                {:else}
                  <div class="echo-grid">
                    {#each Object.entries($game.hostEchoes) as [stageNum, echoType]}
                      {@const echoDef = getHostEchoDefinition(echoType)}
                      {@const hostDef = hostDefinitions[Number(stageNum) - 1]}
                      <div class:overview-stat={true} class:echo-card={true} class:echo-card--aggressive={echoType === 'aggressive'} class:echo-card--efficient={echoType === 'efficient'} class:echo-card--resilient={echoType === 'resilient'} class:echo-card--patient={echoType === 'patient'}>
                        <span class="overview-stat__label">{hostDef?.name || `Stage ${stageNum}`}</span>
                        <strong>{echoDef?.name}</strong>
                        <span class="echo-card__bonus">{formatEchoBonus(echoDef?.bonus)}</span>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            </TerminalPanel>
            {/if}

            {#if $game.visibility.skillTree}
            <TerminalPanel title="NEURAL MUTATIONS" tag="SKILL TREE" variant="low" bleedHeader={true} resizable={true} resizeAxis="vertical">
              <div class="skill-panel-header">
                <div class="skill-panel-header__labels">
                  <span class="skill-panel-header__tag">SKILL TREE</span>
                  <span class="skill-panel-header__sep">·</span>
                  <span class="skill-panel-header__title">NEURAL MUTATIONS</span>
                </div>
                <p class="skill-panel-header__desc">Active mutation purchases. Require attribute rank + Biomass cost.</p>
              </div>
              <div class="desktop-skill-tree">
                {#each [1, 3, 5] as tierRank}
                  <div class="skill-tier">
                    <div class="skill-tier__label">
                      <span>TIER {tierRank === 1 ? '1' : tierRank === 3 ? '2' : '3'} — {tierRank === 1 ? 'EARLY ADAPTATION' : tierRank === 3 ? 'DEEP INTEGRATION' : 'APEX MUTATION'}</span>
                    </div>
                    <div class="skill-tier__columns">
                      {#each statBranches as branch}
                        {@const tierSkills = getSkillsForBranch(branch).filter(s => s.requiredStat === tierRank)}
                        {#each tierSkills as skill}
                          <button
                            class="desktop-skill-row"
                            class:desktop-skill-row--purchased={hasSkill(skill.id)}
                            class:desktop-skill-row--locked={!hasSkill(skill.id) && !canBuySkillMap.get(skill.id)}
                            class:desktop-skill-row--within-reach={isWithinReach(skill)}
                            class:desktop-skill-row--tier1={tierRank === 1}
                            disabled={!canBuySkillMap.get(skill.id)}
                            type="button"
                            on:click={() => game.purchaseSkill(skill.id)}
                          >
                            {#if tierRank === 1 && !hasSkill(skill.id)}
                              <span class="desktop-skill-row__start-here">START HERE</span>
                            {/if}
                            <div>
                              <h4>{skill.name}</h4>
                              <p>{skill.description}</p>
                              {#if !hasSkill(skill.id)}
                                <div class="desktop-skill-row__meta">
                                  <span class="desktop-skill-row__req" title={`Your current ${skill.branch} rank is ${$game.stats[skill.branch]}. Spend Mutation Points in the Evolution tab to increase it.`}>
                                    REQ: {skill.branch[0].toUpperCase()}:{skill.requiredStat}
                                  </span>
                                  <span class="desktop-skill-row__cost">
                                    COST: {formatSkillCost(skill.cost)}
                                  </span>
                                </div>
                              {/if}
                            </div>
                            <span class="desktop-skill-row__badge" class:desktop-skill-row__badge--integrated={hasSkill(skill.id)} class:desktop-skill-row__badge--can-buy={canBuySkillMap.get(skill.id) && !hasSkill(skill.id)}>{getSkillBadgeText(skill)}</span>
                            {#if isWithinReach(skill)}
                              <span class="desktop-skill-row__within-reach">WITHIN REACH</span>
                            {/if}
                          </button>
                        {/each}
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
            </TerminalPanel>
            {/if}
          </div>
        </section>
      </div>

      <div class="mobile-evolution">
        <header class="mobile-topbar">
          <span class="mobile-topbar__icon mobile-topbar__icon--hidden" aria-hidden="true"></span>
          <div class="mobile-topbar__title">PROTOCOL_1.0</div>
          {#if $game.visibility.stageDisplay}
            <div class="mobile-topbar__stage">STAGE {$game.stageLabel.toUpperCase()}</div>
          {/if}
        </header>

        <section class="mobile-evolution__hero">
          <div class="mobile-evolution__hero-main">
            <h1>EVOLUTION <span>HOSTS {getCompletedHosts($game).toString().padStart(2, '0')}</span></h1>
            <p>MORPHOGENESIS IN PROGRESS...</p>
          </div>
          <div class="mobile-evolution__points">
            <span>AVAILABLE MUTATION POINTS</span>
            <strong>μ {$game.mutationPoints} AVAILABLE</strong>
          </div>
        </section>

        <section class="mobile-evolution__overview-grid">
          <div class="mobile-evolution__overview-stat">
            <span class="mobile-evolution__overview-stat__label">HOSTS CONSUMED</span>
            <strong>{getCompletedHosts($game).toString().padStart(2, '0')}</strong>
            <span class="mobile-evolution__overview-stat__sublabel">this run</span>
          </div>
          <div class="mobile-evolution__overview-stat">
            <span class="mobile-evolution__overview-stat__label">LIFETIME BIOMASS</span>
            <strong>{formatDecimal($game.lifetimeBiomass)}</strong>
            <span class="mobile-evolution__overview-stat__sublabel">all runs</span>
          </div>
          <div class="mobile-evolution__overview-stat">
            <span class="mobile-evolution__overview-stat__label">GENERATORS OWNED</span>
            <strong>{getTotalOwnedGenerators().toString().padStart(2, '0')}</strong>
            <span class="mobile-evolution__overview-stat__sublabel">current</span>
          </div>
          <div class="mobile-evolution__overview-stat">
            <span class="mobile-evolution__overview-stat__label">UPGRADES APPLIED</span>
            <strong>{getPurchasedUpgradeCount().toString().padStart(2, '0')}</strong>
            <span class="mobile-evolution__overview-stat__sublabel">this run</span>
          </div>
          <div class="mobile-evolution__overview-stat">
            <span class="mobile-evolution__overview-stat__label">MUTATION POINTS</span>
            <strong>{$game.mutationPoints.toString().padStart(2, '0')}</strong>
            <span class="mobile-evolution__overview-stat__sublabel">available now</span>
          </div>
          <div class="mobile-evolution__overview-stat">
            <span class="mobile-evolution__overview-stat__label">CURRENT STRAIN</span>
            <strong>{getCurrentStrainName()}</strong>
            <span class="mobile-evolution__overview-stat__sublabel">locked until release</span>
          </div>
        </section>

        {#if $game.visibility.statsPanel}
        {@const virulenceSynergy = getStrainSynergyLabel($game.strain, 'virulence')}
        {@const resilienceSynergy = getStrainSynergyLabel($game.strain, 'resilience')}
        {@const complexitySynergy = getStrainSynergyLabel($game.strain, 'complexity')}
        <section class="mobile-evolution__section-label">CORE_ATTRIBUTES</section>

        <section class="mobile-attribute-card">
          <div class="mobile-attribute-card__header">
            <span>VIRULENCE [V: {$game.stats.virulence}]</span>
            <div class="mobile-attribute-card__header-side">
              {#if virulenceSynergy}<span class="synergy-tag synergy-tag--{virulenceSynergy}" title={virulenceSynergy === 'synergy' ? 'Amplified by current strain' : virulenceSynergy === 'opposition' ? 'Penalized by current strain' : 'Balanced interaction with current strain'}>{virulenceSynergy === 'synergy' ? '⚡' : virulenceSynergy === 'opposition' ? '△' : '○'} [{virulenceSynergy.toUpperCase()}]</span>{/if}
              <span>EXPANSION ENGINE</span>
              <button class="mobile-attribute-card__button" disabled={$game.mutationPoints <= 0} type="button" on:click={() => game.allocateStat('virulence')}>+</button>
            </div>
          </div>
          <p>Aggressive spread protocol. Increases click-power efficiency by 15% per rank.</p>
          {#if $game.mutationPoints > 0}
            {@const currentBonus = getEffectiveStatBonus($game.stats.virulence, BALANCE.VIRULENCE_CLICK_BONUS_PER_POINT, $game.strain, 'virulence', $game.geneticMemoryStats)}
            {@const nextBonus = getEffectiveStatBonus($game.stats.virulence + 1, BALANCE.VIRULENCE_CLICK_BONUS_PER_POINT, $game.strain, 'virulence', $game.geneticMemoryStats)}
            {@const increase = ((nextBonus - currentBonus) / currentBonus * 100) || (nextBonus * 100)}
            <p class="stat-preview">Next: Click power +{isFinite(increase) ? increase.toFixed(1) + '%' : '—'}</p>
          {/if}
        </section>

        <section class="mobile-attribute-card">
          <div class="mobile-attribute-card__header">
            <span>RESILIENCE [R: {$game.stats.resilience}]</span>
            <div class="mobile-attribute-card__header-side">
              {#if resilienceSynergy}<span class="synergy-tag synergy-tag--{resilienceSynergy}" title={resilienceSynergy === 'synergy' ? 'Amplified by current strain' : resilienceSynergy === 'opposition' ? 'Penalized by current strain' : 'Balanced interaction with current strain'}>{resilienceSynergy === 'synergy' ? '⚡' : resilienceSynergy === 'opposition' ? '△' : '○'} [{resilienceSynergy.toUpperCase()}]</span>{/if}
              <span>SURVIVAL MESH</span>
              <button class="mobile-attribute-card__button" disabled={$game.mutationPoints <= 0} type="button" on:click={() => game.allocateStat('resilience')}>+</button>
            </div>
          </div>
          <p>Cellular wall density. Reduces system defense resistance by 8% per rank.</p>
          {#if $game.mutationPoints > 0}
            {@const currentBonus = getEffectiveStatBonus($game.stats.resilience, BALANCE.RESILIENCE_DEFENSE_PER_POINT, $game.strain, 'resilience', $game.geneticMemoryStats)}
            {@const nextBonus = getEffectiveStatBonus($game.stats.resilience + 1, BALANCE.RESILIENCE_DEFENSE_PER_POINT, $game.strain, 'resilience', $game.geneticMemoryStats)}
            {@const increase = ((nextBonus - currentBonus) * 100) || (nextBonus * 100)}
            <p class="stat-preview">Next: Defense mitigation +{isFinite(increase) ? increase.toFixed(1) + '%' : '—'}</p>
          {/if}
        </section>

        <section class="mobile-attribute-card">
          <div class="mobile-attribute-card__header">
            <span>COMPLEXITY [C: {$game.stats.complexity}]</span>
            <div class="mobile-attribute-card__header-side">
              {#if complexitySynergy}<span class="synergy-tag synergy-tag--{complexitySynergy}" title={complexitySynergy === 'synergy' ? 'Amplified by current strain' : complexitySynergy === 'opposition' ? 'Penalized by current strain' : 'Balanced interaction with current strain'}>{complexitySynergy === 'synergy' ? '⚡' : complexitySynergy === 'opposition' ? '△' : '○'} [{complexitySynergy.toUpperCase()}]</span>{/if}
              <span>COGNITIVE ARCH</span>
              <button class="mobile-attribute-card__button" disabled={$game.mutationPoints <= 0} type="button" on:click={() => game.allocateStat('complexity')}>+</button>
            </div>
          </div>
          <p>Synaptic mapping. Unlocks advanced synergy pathways and multi-spore logic.</p>
          {#if $game.mutationPoints > 0}
            {@const currentBonus = getEffectiveStatBonus($game.stats.complexity, BALANCE.COMPLEXITY_PASSIVE_BONUS_PER_POINT, $game.strain, 'complexity', $game.geneticMemoryStats)}
            {@const nextBonus = getEffectiveStatBonus($game.stats.complexity + 1, BALANCE.COMPLEXITY_PASSIVE_BONUS_PER_POINT, $game.strain, 'complexity', $game.geneticMemoryStats)}
            {@const increase = ((nextBonus - currentBonus) * 100) || (nextBonus * 100)}
            <p class="stat-preview">Next: Passive BPS +{isFinite(increase) ? increase.toFixed(1) + '%' : '—'}</p>
          {/if}
        </section>

        <div class="mobile-evolution__readiness-banner">STATUS :: {getReadinessStatus()}</div>
        {/if}

        {#if $game.visibility.strainPrompt || $game.visibility.statsPanel}
        <TerminalPanel title="STRAIN STATUS" tag="⌘" variant="low" className="mobile-card mobile-evolution__strain" bleedHeader={true}>
          <div class="mobile-evolution__strain-inner">
            <div class="mobile-evolution__strain-fields">
              <div class="mobile-evolution__strain-field">
                <span class="mobile-evolution__strain-field__label">STRAIN</span>
                <span class="mobile-evolution__strain-field__value" title={!canChooseStrain() && $game.strain !== null ? 'Strain is locked for this run. A new strain can be selected after Spore Release.' : ''}>{getCurrentStrainName()} {#if $game.strain}<span class="strain-active-badge">[ACTIVE]</span>{/if}</span>
              </div>
              <div class="mobile-evolution__strain-field">
                <span class="mobile-evolution__strain-field__label">MUTATION PTS</span>
                <span class="mobile-evolution__strain-field__value" class:mutation-glow={$game.mutationPoints > 0}>{$game.mutationPoints} available</span>
              </div>
              <div class="mobile-evolution__strain-field">
                <span class="mobile-evolution__strain-field__label">DEFENSE MODE</span>
                <span class="mobile-evolution__strain-field__value">{#if $game.strain === 'parasite'}Counterburst windows spike click output after host defenses trigger.{:else if $game.strain === 'symbiote'}Symbiote mesh absorbs a larger share of active defense penalties.{:else if $game.strain === 'saprophyte'}Expiring host defenses leave salvageable biomass behind.{:else}No strain selected{/if}</span>
              </div>
              <div class="mobile-evolution__strain-field">
                <span class="mobile-evolution__strain-field__label">STATUS</span>
                <span class="mobile-evolution__strain-field__value">{#if canChooseStrain()}SELECTION PROTOCOL UNLOCKED — Choose a dominant phenotype{:else if getCompletedHosts($game) < 1}Awaiting first host consumption{:else}LOCKED IN — build-specific systems now layered{/if}</span>
              </div>
            </div>

            {#if canChooseStrain()}
              <div class="mobile-strain-list">
                {#each strainDefinitions as strain}
                  <button
                    class="mobile-strain-button"
                    class:mobile-strain-button--locked={!$game.unlockedStrains[strain.id]}
                    disabled={!$game.unlockedStrains[strain.id]}
                    type="button"
                    on:click={() => game.chooseStrain(strain.id)}
                  >
                    <strong>{strain.name.toUpperCase()}</strong>
                    <span>{strain.summary}</span>
                    <small>{strain.signature}</small>
                  </button>
                {/each}
              </div>
            {/if}

          </div>
        </TerminalPanel>
        {/if}

        {#if $game.visibility.statsPanel}
        <TerminalPanel title="EVOLUTIONARY ECHOES" tag="ECHO" variant="low" className="mobile-card" bleedHeader={true}>
          <div class="mobile-evolution__echoes">
            <p class="echo-subtitle">Each host leaves a permanent mark on your strain.</p>
            {#if Object.keys($game.hostEchoes).length === 0}
              <p class="echo-empty">Clear your first host to begin accumulating evolutionary memory.</p>
            {:else}
              <div class="echo-grid echo-grid--mobile">
                {#each Object.entries($game.hostEchoes) as [stageNum, echoType]}
                  {@const echoDef = getHostEchoDefinition(echoType)}
                  {@const hostDef = hostDefinitions[Number(stageNum) - 1]}
                  <div class:echo-card={true} class:echo-card--aggressive={echoType === 'aggressive'} class:echo-card--efficient={echoType === 'efficient'} class:echo-card--resilient={echoType === 'resilient'} class:echo-card--patient={echoType === 'patient'}>
                    <span class="overview-stat__label">{hostDef?.name || `Stage ${stageNum}`}</span>
                    <strong>{echoDef?.name}</strong>
                    <span class="echo-card__bonus">{formatEchoBonus(echoDef?.bonus)}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </TerminalPanel>
        {/if}

        {#if $game.visibility.skillTree}
        <TerminalPanel title="NEURAL_MUTATIONS" tag="✜" variant="low" className="mobile-card mobile-evolution__mutations" bleedHeader={true}>
          <div class="skill-panel-header">
            <div class="skill-panel-header__labels">
              <span class="skill-panel-header__tag">SKILL TREE</span>
              <span class="skill-panel-header__sep">·</span>
              <span class="skill-panel-header__title">NEURAL MUTATIONS</span>
            </div>
            <p class="skill-panel-header__desc">Active mutation purchases. Require attribute rank + Biomass cost.</p>
          </div>
          <div class="mobile-mutation-list">
            {#each [1, 3, 5] as tierRank}
              <div class="mobile-skill-tier">
                <div class="mobile-skill-tier__label">
                  <span>TIER {tierRank === 1 ? '1' : tierRank === 3 ? '2' : '3'} — {tierRank === 1 ? 'EARLY ADAPTATION' : tierRank === 3 ? 'DEEP INTEGRATION' : 'APEX MUTATION'}</span>
                </div>
                {#each statBranches as branch}
                  {@const tierSkills = getSkillsForBranch(branch).filter(s => s.requiredStat === tierRank)}
                  {#each tierSkills as skill}
                    <button
                      class="mobile-mutation-row"
                      class:mobile-mutation-row--purchased={hasSkill(skill.id)}
                      class:mobile-mutation-row--locked={!hasSkill(skill.id) && !canBuySkillMap.get(skill.id)}
                      class:mobile-mutation-row--within-reach={isWithinReach(skill)}
                      class:mobile-mutation-row--tier1={tierRank === 1}
                      disabled={!canBuySkillMap.get(skill.id)}
                      type="button"
                      on:click={() => game.purchaseSkill(skill.id)}
                    >
                      {#if tierRank === 1 && !hasSkill(skill.id)}
                        <span class="mobile-mutation-row__start-here">START HERE</span>
                      {/if}
                      <div class="mobile-mutation-row__icon">{skill.branch === 'virulence' ? '◼' : skill.branch === 'resilience' ? '⬢' : '◌'}</div>
                      <div>
                        <div class="mobile-mutation-row__title-wrap">
                          <h3>{skill.name}</h3>
                          <span class="mobile-mutation-row__badge" class:mobile-mutation-row__badge--integrated={hasSkill(skill.id)} class:mobile-mutation-row__badge--can-buy={canBuySkillMap.get(skill.id) && !hasSkill(skill.id)}>{getSkillBadgeText(skill)}</span>
                        </div>
                        <p>{skill.description}</p>
                        {#if !hasSkill(skill.id)}
                          <div class="mobile-mutation-row__meta">
                            <span class="mobile-mutation-row__req" title={`Your current ${skill.branch} rank is ${$game.stats[skill.branch]}. Spend Mutation Points in the Evolution tab to increase it.`}>
                              REQ: {skill.branch[0].toUpperCase()}:{skill.requiredStat}
                            </span>
                            <span class="mobile-mutation-row__cost">
                              COST: {formatSkillCost(skill.cost)}
                            </span>
                          </div>
                          {#if isWithinReach(skill)}
                            <span class="mobile-mutation-row__within-reach-label">WITHIN REACH</span>
                          {/if}
                        {/if}
                      </div>
                    </button>
                  {/each}
                {/each}
              </div>
            {/each}
          </div>
        </TerminalPanel>
        {/if}
      </div>
    {:else if activeView === 'spore'}
      <div class="desktop-spore workspace-grid workspace-grid--single">
        <section class="workspace-main workspace-main--full">
          <div class="screen-stack">
            <TerminalPanel title="SPORE NETWORK" tag="META" bleedHeader={true} resizable={true} resizeAxis="vertical">
              <div class="overview-grid">
                <div class="overview-stat">
                  <span class="overview-stat__label">RUN STATUS</span>
                  <strong>{$game.hostCompleted ? 'READY TO ADVANCE' : 'ROOTED'}</strong>
                </div>
                <div class="overview-stat">
                  <span class="overview-stat__label">CURRENT STAGE</span>
                  <strong>{$game.currentStage.toString().padStart(2, '0')} / {hostDefinitions.length.toString().padStart(2, '0')}</strong>
                  {#if hasNextStage($game)}
                    <span class="overview-stat__sublabel">next: Stage {($game.currentStage + 1).toString().padStart(2, '0')}</span>
                  {/if}
                </div>
                <div class="overview-stat">
                  <span class="overview-stat__label">HOST THREAT</span>
                  <strong class="threat-level threat-level--{$game.currentStage <= 2 ? 'low' : $game.currentStage <= 4 ? 'medium' : $game.currentStage <= 8 ? 'high' : 'extreme'}">{getCurrentHostThreatLevel()}</strong>
                </div>
                <div class="overview-stat">
                  <span class="overview-stat__label">LIFETIME BIOMASS</span>
                  <strong>{formatBiomass($game.lifetimeBiomass, useScientificNotation)}</strong>
                </div>
                <div class="overview-stat">
                  <span class="overview-stat__label">PRESTIGE SYSTEM</span>
                  <strong>{formatDecimal($game.geneticMemory)} Γ / +{formatDecimal(getGeneticMemoryBonusPercent($game))}%</strong>
                  {#if $game.geneticMemory.eq(0)}
                    <span class="overview-stat__sublabel">earn Γ by completing your first full run</span>
                  {/if}
                </div>
                <div class="overview-stat">
                  <span class="overview-stat__label">HIGHEST STAGE</span>
                  <strong>{$game.highestStageReached.toString().padStart(2, '0')}</strong>
                  <!-- {#if $game.highestStageReached === $game.currentStage && $game.highestStageReached > 1}
                    <span class="overview-stat__badge">PERSONAL BEST</span>
                  {/if} -->
                </div>
              </div>
            </TerminalPanel>

            <div class="dual-panel-grid">
              <TerminalPanel title="RELEASE STATUS" tag="META LOOP" variant="low" bleedHeader={true} resizable={true} resizeAxis="both">
                <div class="preview-copy spore-release-panel">
                  <div class="spore-progress-bar">
                    <div class="spore-progress-bar__labels">
                      <span>ROOTED</span>
                      <span>{hostDefinitions.length - $game.currentStage} STAGES REMAINING</span>
                      <span>RELEASE</span>
                    </div>
                    <div class="spore-progress-bar__track">
                      <div class="spore-progress-bar__fill" style={`width: ${($game.currentStage / hostDefinitions.length) * 100}%`}></div>
                    </div>
                    <div class="spore-progress-bar__markers">
                      <span>{$game.currentStage.toString().padStart(2, '0')} / {hostDefinitions.length.toString().padStart(2, '0')}</span>
                    </div>
                  </div>

                  <div class="transmission-block">
                    <span class="transmission-block__label">TRANSMISSION INTERCEPTED</span>
                    <p class="transmission-block__text">"{getCurrentHostTransitionSignal()}"</p>
                  </div>

                  <p>Run status :: {getRunStatusLabel()} — {getReleaseRequirementText()}</p>
                  <p>Current host defense signature :: {getCurrentHostDefenseSignature()}</p>

                  <div class="spore-hero-bonus">
                    <span class="spore-hero-bonus__label">RELEASING NOW WOULD GRANT</span>
                    <strong class="spore-hero-bonus__value">+{formatDecimal(getProjectedGeneticMemoryBonusPercent($game))}%</strong>
                    <span class="spore-hero-bonus__sublabel">PERMANENT BONUS</span>
                  </div>

                  <div class="spore-memory-summary">
                    <div class="spore-memory-summary__row">
                      <span class="spore-memory-summary__label" title="Genetic Memory (Γ) is earned by completing runs. More hosts consumed and higher stages reached yield more Γ per release.">GENETIC MEMORY</span>
                      <span class="spore-memory-summary__value">{formatDecimal($game.geneticMemory)} current</span>
                      <span class="spore-memory-summary__arrow">→</span>
                      <span class="spore-memory-summary__value spore-memory-summary__value--gain">+{formatDecimal(getProjectedGeneticMemoryGain($game))} Γ projected</span>
                      <span class="spore-memory-summary__equals">=</span>
                      <span class="spore-memory-summary__value spore-memory-summary__value--total" title="This permanent multiplier applies to all future runs and compounds with each Spore Release.">{formatDecimal(getProjectedGeneticMemoryTotal($game))} Γ total</span>
                    </div>
                  </div>

                  <div class="reset-persist-grid">
                    <div class="reset-persist-grid__column reset-persist-grid__column--resets">
                      <span class="reset-persist-grid__header">✗ RESETS</span>
                      <ul>
                        <li>Current biomass</li>
                        <li>Owned generators</li>
                        <li>Upgrades applied</li>
                        <li>Strain selection</li>
                      </ul>
                    </div>
                    <div class="reset-persist-grid__column reset-persist-grid__column--persists">
                      <span class="reset-persist-grid__header">✓ PERSISTS</span>
                      <ul>
                        <li>Genetic Memory (Γ)</li>
                        <li>Permanent bonus %</li>
                        <li>Highest stage reached</li>
                        <li>Saprophyte strain (after 1st)</li>
                      </ul>
                    </div>
                  </div>

                   {#if $game.visibility.prestigeButton && isConfirmingSporeRelease}
                    <div class="spore-confirmation">
                      <p>Confirm release? Current biomass, stage progress, upgrades, stats, and skills will be converted into permanent Genetic Memory.</p>
                      <div class="spore-confirmation__actions">
                        <TerminalButton variant="secondary" on:click={cancelSporeRelease}>[ CANCEL ]</TerminalButton>
                        <TerminalButton on:click={confirmSporeRelease}>[ CONFIRM RELEASE ]</TerminalButton>
                      </div>
                    </div>
                   {:else if $game.visibility.prestigeButton}
                     <div class="spore-confirmation__actions">
                       <TerminalButton variant="secondary" disabled={!canReleaseSpores($game)} on:click={beginSporeRelease}>
                         [ RELEASE SPORES ]
                       </TerminalButton>
                     </div>
                   {/if}
                </div>
              </TerminalPanel>

              <TerminalPanel title="SUBSTRATE MEMORY" tag="LOG" variant="low" bleedHeader={true} resizable={true} resizeAxis="both">
                <p class="panel-descriptor">A record of mycelial activity and host interactions this run.</p>
                <ObservationFeed entries={$game.structuredLog} maxVisible={8} fade={false} />
              </TerminalPanel>
            </div>
          </div>
        </section>
      </div>

      <div class="mobile-spore">
        <header class="mobile-topbar">
          <span class="mobile-topbar__icon mobile-topbar__icon--hidden" aria-hidden="true"></span>
          <div class="mobile-topbar__title">PROTOCOL_1.0</div>
          {#if $game.visibility.stageDisplay}
            <div class="mobile-topbar__stage">STAGE {$game.stageLabel.toUpperCase()}</div>
          {/if}
        </header>

        <section class="mobile-spore__hero">
          <h1>{canReleaseSpores($game) ? 'SPORE RELEASE READY' : 'SPORE RELEASE PROTOCOL'}</h1>
          <div class="mobile-spore__progress-shell">
            <div class="mobile-spore__progress-fill" style={`width: ${getReleaseProgressPercent()}%`}></div>
          </div>
        </section>

        <TerminalPanel title="CURRENT RUN METRICS" tag="" variant="low" className="mobile-card mobile-spore__metrics" bleedHeader={true}>
          <div class="mobile-spore__metrics-list">
            <div>
              <p>LIFETIME BIOMASS PRODUCED</p>
              <strong>{formatDecimal($game.lifetimeBiomass)} <span>KG</span></strong>
            </div>
            <div>
              <p>STAGES ASSIMILATED</p>
              <strong>{$game.highestStageReached.toString().padStart(2, '0')} / {hostDefinitions.length.toString().padStart(2, '0')}</strong>
            </div>
            <div>
              <p>MUTATION POINTS SPENT</p>
              <strong>{getSpentMutationPoints().toString().padStart(3, '0')} <span>POINTS</span></strong>
            </div>
            <div>
              <p>GENETIC MEMORY</p>
              <strong>{formatDecimal($game.geneticMemory)} <span>GAMMA</span></strong>
            </div>
          </div>
        </TerminalPanel>

        <section class="mobile-spore__analysis-feed">
          <p>&gt; ANALYSIS: {getRunStatusLabel()}</p>
          <p>&gt; {getReleaseRequirementText().toUpperCase()}</p>
          <p>&gt; HOST THREAT: {getCurrentHostThreatLevel()} / {getCurrentHostDefenseSignature().toUpperCase()}</p>
          <p>&gt; CURRENT BONUS: +{formatDecimal(getGeneticMemoryBonusPercent($game))}% BIOMASS OUTPUT.</p>
          <p>&gt; PROJECTED TOTAL MEMORY: {formatDecimal(getProjectedGeneticMemoryTotal($game))} GAMMA.</p>
        </section>

        <section class="mobile-spore__transmission-block">
          <span class="mobile-spore__transmission-block__label">TRANSMISSION INTERCEPTED</span>
          <p class="mobile-spore__transmission-block__text">"{getCurrentHostTransitionSignal()}"</p>
        </section>

        <TerminalPanel title="GENETIC MEMORY" tag="Γ" variant="low" className="mobile-card" bleedHeader={true}>
          <div class="mobile-spore__memory-summary">
            <div class="mobile-spore__memory-summary__row">
              <span class="mobile-spore__memory-summary__label" title="Genetic Memory (Γ) is earned by completing runs. More hosts consumed and higher stages reached yield more Γ per release.">GENETIC MEMORY</span>
            </div>
            <div class="mobile-spore__memory-summary__row">
              <span class="mobile-spore__memory-summary__value">{formatDecimal($game.geneticMemory)} current</span>
              <span class="mobile-spore__memory-summary__arrow">→</span>
              <span class="mobile-spore__memory-summary__value mobile-spore__memory-summary__value--gain">+{formatDecimal(getProjectedGeneticMemoryGain($game))} Γ projected</span>
              <span class="mobile-spore__memory-summary__equals">=</span>
              <span class="mobile-spore__memory-summary__value mobile-spore__memory-summary__value--total" title="This permanent multiplier applies to all future runs and compounds with each Spore Release.">{formatDecimal(getProjectedGeneticMemoryTotal($game))} Γ total</span>
            </div>
          </div>
        </TerminalPanel>

        <TerminalPanel title="RELEASE STATUS" tag="?" variant="low" className="mobile-card" bleedHeader={true}>
          <div class="mobile-spore__reset-persist">
            <div class="mobile-spore__reset-persist__column mobile-spore__reset-persist__column--resets">
              <span class="mobile-spore__reset-persist__header">✗ RESETS</span>
              <ul>
                <li>Current biomass</li>
                <li>Owned generators</li>
                <li>Upgrades applied</li>
                <li>Strain selection</li>
              </ul>
            </div>
            <div class="mobile-spore__reset-persist__column mobile-spore__reset-persist__column--persists">
              <span class="mobile-spore__reset-persist__header">✓ PERSISTS</span>
              <ul>
                <li>Genetic Memory (Γ)</li>
                <li>Permanent bonus %</li>
                <li>Highest stage reached</li>
                <li>Saprophyte strain (after 1st)</li>
              </ul>
            </div>
          </div>
        </TerminalPanel>

        <section class="mobile-spore__reward">
          <div class="mobile-spore__reward-main">
            <h2>GENETIC MEMORY (Γ) GAIN: +{formatDecimal(getProjectedGeneticMemoryGain($game))}</h2>
            <div class="mobile-spore__reward-bonus">
              <p>+{formatDecimal(getProjectedGeneticMemoryBonusPercent($game))}% PERMANENT</p>
              <p>BIOMASS PRODUCTION</p>
              <p>MULTIPLIER</p>
            </div>
          </div>
        </section>

        <section class="mobile-spore__visual"></section>

        <section class="mobile-spore__quote">
          <p>"The memory endures. A new iteration begins."</p>
          <div class="mobile-spore__awaiting">
            <span></span>
            <span>{isConfirmingSporeRelease ? 'AWAITING FINAL CONFIRMATION' : canReleaseSpores($game) ? 'RELEASE STANDING BY' : 'RELEASE LOCKED'}</span>
          </div>
        </section>

        <section class="mobile-spore__action">
          {#if $game.visibility.prestigeButton && isConfirmingSporeRelease}
            <div class="mobile-spore__confirm-box">
              <p>Confirm Spore Release? Current run progress will be reset into permanent Genetic Memory and Saprophyte will unlock.</p>
              <div class="mobile-spore__confirm-actions">
                <button class="mobile-spore__secondary" type="button" on:click={cancelSporeRelease}>[ CANCEL ]</button>
                <button class="mobile-spore__release" type="button" on:click={confirmSporeRelease}>[ CONFIRM RELEASE ]</button>
              </div>
            </div>
          {:else if $game.visibility.prestigeButton}
            <button class="mobile-spore__release" disabled={!canReleaseSpores($game)} type="button" on:click={beginSporeRelease}>[ RELEASE SPORES ]</button>
          {/if}
          <p>WARNING: ALL CURRENT RUN PROGRESS WILL RESET. ONLY GENETIC MEMORY, STAGE RECORDS, AND STRAIN UNLOCKS PERSIST.</p>
        </section>
      </div>
    {:else}
      <div class="desktop-wiki workspace-grid workspace-grid--single">
        <section class="workspace-main workspace-main--full">
          <div class="wiki-layout">
            <aside class="wiki-sidebar">
              <TerminalPanel title="WIKI INDEX" tag="ARCHIVE" variant="low" bleedHeader={true}>
                <div class="wiki-search-shell">
                  <input bind:value={wikiQuery} class="wiki-search" placeholder="Search topics" type="search" />
                </div>

                <div class="wiki-section-list">
                  <button class:wiki-filter={true} class:wiki-filter--active={selectedWikiSection === 'all'} type="button" on:click={() => setWikiSection('all')}>
                    ALL TOPICS
                  </button>
                  {#each wikiSections as section}
                    <button class:wiki-filter={true} class:wiki-filter--active={selectedWikiSection === section.id} type="button" on:click={() => setWikiSection(section.id)}>
                      {section.title.toUpperCase()}
                    </button>
                  {/each}
                </div>
              </TerminalPanel>
            </aside>

            <section class="wiki-content">
              {#if filteredWikiEntries.length > 0}
                <TerminalPanel title={getSelectedWikiSectionInfo().title.toUpperCase()} tag={selectedWikiSection === 'all' ? 'ARCHIVE' : 'SECTION'} bleedHeader={true}>
                  <div class="wiki-section-view">
                    <div class="wiki-section-entry-list">
                      {#each filteredWikiEntries as entry}
                        <article class:wiki-section-entry={true} class:wiki-section-entry--active={selectedWikiEntryId === entry.id}>
                          <div class="wiki-section-entry__header">
                            <div>
                              <p class="wiki-section-entry__type">{entry.type.toUpperCase()}</p>
                              <h3>{entry.title}</h3>
                            </div>
                            <button class="wiki-entry-button" type="button" on:click={() => selectWikiEntry(entry.id)}>
                              {selectedWikiEntryId === entry.id ? 'SELECTED' : 'FOCUS'}
                            </button>
                          </div>
                          <p class="wiki-section-entry__summary">{entry.summary}</p>
                          <div class="wiki-section-entry__body">
                            {#each entry.content as paragraph}
                              <p>{paragraph}</p>
                            {/each}
                          </div>
                        </article>
                      {/each}
                    </div>
                  </div>
                </TerminalPanel>
              {:else}
                <TerminalPanel title="NO_RESULTS" tag="ARCHIVE" bleedHeader={true}>
                  <div class="wiki-article">
                    <p class="wiki-article__summary">No wiki entries match the current search and section filters.</p>
                  </div>
                </TerminalPanel>
              {/if}
            </section>
          </div>
        </section>
      </div>
    {/if}

  </main>

  <div class="ascii-decoration" aria-hidden="true">
    <pre>{`     _..._
   .'     '.
  /  \\   /  \\
  |   | |   |
  \\  /   \\  /
   '._____.'
MYCELIUM_ROOT_v1`}</pre>
  </div>

  <nav class="mobile-tabbar">
    {#each visibleNavItems as item}
      <button
        class="mobile-tabbar__item"
        class:mobile-tabbar__item--active={activeView === item.id}
        class:mobile-tabbar__item--blink={item.id === 'evolution' && $game.mutationPoints > 0}
        type="button"
        on:click={() => (activeView = item.id)}
      >
        <span>{item.symbol}</span>
        <span>{item.label}</span>
      </button>
    {/each}
    <button class="mobile-tabbar__item mobile-tabbar__item--danger" type="button" on:click={resetGameForDebug}>
      <span>[!]</span>
      <span>RESET</span>
    </button>
  </nav>

  {#if $game.visibility.strainPrompt && $game.strain === null}
    <div class="strain-overlay">
      <div class="strain-overlay__panel reveal-enter">
        <p class="strain-overlay__eyebrow">DOMINANT PHENOTYPE REQUIRED</p>
        <h2>STRAIN SELECTION</h2>
        <p>First host consumed. The colony must choose an irreversible growth pattern before higher mutation systems can stabilize.</p>
        <div class="strain-grid">
          {#each strainDefinitions as strain}
            <button
              class="strain-card"
              class:strain-card--locked={!$game.unlockedStrains[strain.id]}
              disabled={!$game.unlockedStrains[strain.id]}
              type="button"
              on:click={() => game.chooseStrain(strain.id)}
            >
              <strong>{strain.name}</strong>
              <span>{strain.summary}</span>
              {#if $game.unlockedStrains[strain.id]}
                <div class="strain-stat-block">
                  <div class="strain-stat-row">
                    <span class="strain-stat-label">Click Multiplier</span>
                    <span class="strain-stat-value">{strain.clickModifier.toFixed(1)}×</span>
                  </div>
                  <div class="strain-stat-row">
                    <span class="strain-stat-label">Passive BPS</span>
                    <span class="strain-stat-value">{strain.passiveModifier.toFixed(1)}×</span>
                  </div>
                  <div class="strain-stat-row strain-stat-row--mechanic">
                    <span class="strain-stat-label">{strain.signature}</span>
                    {#if strain.id === 'parasite'}
                      <span class="strain-stat-value strain-stat-value--trigger">{BALANCE.HEMORRHAGIC_BURST_BASE_INTERVAL} clicks → {BALANCE.HEMORRHAGIC_BURST_BASE_MULTIPLIER.toFixed(1)}×</span>
                    {:else if strain.id === 'symbiote'}
                      <span class="strain-stat-value strain-stat-value--trigger">{BALANCE.MYCORRHIZAL_BASE_INTERVAL_SECONDS}s → {BALANCE.MYCORRHIZAL_BASE_PULSE_MULTIPLIER.toFixed(1)}×</span>
                    {:else if strain.id === 'saprophyte'}
                      <span class="strain-stat-value strain-stat-value--trigger">{(BALANCE.DECOMPOSITION_BASE_CONVERSION_RATE * 100).toFixed(0)}% conversion</span>
                    {/if}
                  </div>
                </div>
              {:else}
                <div class="strain-locked-block">
                  <span>[ LOCKED — Unlocks after first Spore Release ]</span>
                </div>
              {/if}
              <small>{strain.signature}</small>
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  {#if showCurrencyModal}
    <div class="currency-modal-overlay" role="dialog" aria-modal="true" on:keydown={handleCurrencyModalKeydown} tabindex="-1">
      <button class="currency-modal-backdrop" type="button" aria-label="Dismiss currency information" on:click={closeCurrencyModal}></button>
      <div class="currency-modal-panel" role="dialog" aria-modal="true" aria-labelledby="currency-modal-title">
        <p class="currency-modal-panel__eyebrow">CURRENCY NOTATION</p>
        <h2 id="currency-modal-title">RESOURCE SYMBOLS</h2>
        
        <div class="currency-modal-content">
          <div class="currency-section">
            <div class="currency-symbol">
              <span class="currency-symbol__mark">Ψ</span>
              <span class="currency-symbol__name">BIOMASS</span>
            </div>
            <p class="currency-description">Primary resource. Generated passively by your network and manually via absorption clicks.</p>
          </div>

          <div class="currency-section">
            <div class="currency-symbol">
              <span class="currency-symbol__mark">Γ</span>
              <span class="currency-symbol__name">GENETIC MEMORY (GAMMA)</span>
            </div>
            <p class="currency-description">Prestige currency. Accumulated across Spore Release cycles. Scales future run multipliers.</p>
          </div>

          <div class="currency-section currency-section--notation">
            <h3>SCALE NOTATION</h3>
            <p class="currency-description">Values above 1,000 display in scientific or suffixed notation. Full precision available in the SPORE tab.</p>
            <div class="notation-tiers">
              {#each BALANCE.CURRENCY_TIERS as tier}
                <div class="notation-tier">
                  <span class="notation-tier__label">{tier.label}</span>
                  <span class="notation-tier__threshold">≥ {formatBiomass(tier.threshold, true)}</span>
                </div>
              {/each}
            </div>
          </div>
        </div>

        <div class="currency-modal-footer">
          <button class="currency-modal-close" type="button" on:click={closeCurrencyModal}>CLOSE</button>
        </div>
      </div>
    </div>
  {/if}

  {#if showDegradationModal}
    <div class="degradation-modal-overlay" role="dialog" aria-modal="true" on:keydown={handleDegradationModalKeydown} tabindex="-1">
      <button class="degradation-modal-backdrop" type="button" aria-label="Dismiss degradation information" on:click={closeDegradationModal}></button>
      <div class="degradation-modal-panel" role="dialog" aria-modal="true" aria-labelledby="degradation-modal-title">
        <p class="degradation-modal-panel__eyebrow">DEGRADATION STATUS</p>
        <h2 id="degradation-modal-title">HOST INTEGRITY</h2>
        
        <div class="degradation-modal-content">
          <p class="degradation-intro">Host degradation represents how deeply the mycelium has compromised this host. At 100%, the host is consumed and you advance to the next stage.</p>

          <div class="degradation-status-list">
            <div class="degradation-status-item">
              <div class="degradation-status-header">
                <span class="degradation-status-badge degradation-status-badge--stable">STABLE</span>
              </div>
              <p class="degradation-status-description">{BALANCE.DEGRADATION_STATUS_LABELS.stable}</p>
            </div>

            <div class="degradation-status-item">
              <div class="degradation-status-header">
                <span class="degradation-status-badge degradation-status-badge--accelerating">ACCELERATING</span>
              </div>
              <p class="degradation-status-description">{BALANCE.DEGRADATION_STATUS_LABELS.accelerating}</p>
            </div>

            <div class="degradation-status-item">
              <div class="degradation-status-header">
                <span class="degradation-status-badge degradation-status-badge--critical">CRITICAL</span>
              </div>
              <p class="degradation-status-description">{BALANCE.DEGRADATION_STATUS_LABELS.critical}</p>
            </div>
          </div>

          <p class="degradation-note">{BALANCE.DEGRADATION_STATUS_LABELS.note}</p>
        </div>

        <div class="degradation-modal-footer">
          <button class="degradation-modal-close" type="button" on:click={closeDegradationModal}>CLOSE</button>
        </div>
      </div>
    </div>
  {/if}

  {#if showOfflineNarrative && offlineNarrative}
    <div class="offline-narrative-overlay" transition:fade>
      <button class="offline-narrative-backdrop" type="button" aria-label="Dismiss offline recap" on:click={dismissOfflineNarrative}></button>
      <div class="offline-narrative-panel" role="dialog" aria-modal="true" aria-labelledby="offline-narrative-title" transition:fly={{ y: 20, duration: 250 }}>
        <p class="offline-narrative-panel__eyebrow">OFFLINE RECAP</p>
        <h2 id="offline-narrative-title">THE NETWORK GREW</h2>
        <p class="offline-narrative-panel__summary">{offlineNarrative.summary}</p>

        <div class="offline-narrative-timeline">
          {#each offlineNarrative.events as event, index}
            <div class:offline-narrative-event={true} class:offline-narrative-event--visible={index <= currentOfflineEventIndex}>
              <span class="offline-narrative-event__icon">{getOfflineEventIcon(event.type)}</span>
              <div class="offline-narrative-event__body">
                <div class="offline-narrative-event__header">
                  <strong>{event.name}</strong>
                  <span>{formatOfflineEventOutcome(event.outcome)}</span>
                </div>

                {#if event.biomassDelta}
                  <span class="offline-narrative-event__gain">+{formatDecimal(event.biomassDelta)} biomass</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        <div class="offline-narrative-total">
          <span class="offline-narrative-total__value">+{formatDecimal(offlineNarrative.gains)}</span>
          <span class="offline-narrative-total__label">biomass accumulated</span>
        </div>

        <div class="offline-narrative-panel__actions">
          <TerminalButton on:click={dismissOfflineNarrative}>[ RESUME INFILTRATION ]</TerminalButton>
        </div>
      </div>
    </div>
  {/if}

  {#if activeView === 'wiki'}
    <div class="mobile-wiki-overlay">
      <div class="mobile-wiki-sheet">
        <div class="mobile-wiki-sheet__header">
          <button class="mobile-topbar__icon" type="button" on:click={() => (activeView = 'terminal')}>[X]</button>
          <div class="mobile-topbar__title">FIELD_WIKI</div>
          <div class="mobile-topbar__stage">REFERENCE</div>
        </div>

        <div class="mobile-wiki-sheet__body">
          <input bind:value={wikiQuery} class="wiki-search" placeholder="Search topics" type="search" />

          <div class="mobile-wiki-section-list">
            <button class:wiki-filter={true} class:wiki-filter--active={selectedWikiSection === 'all'} type="button" on:click={() => setWikiSection('all')}>
              ALL
            </button>
            {#each wikiSections as section}
              <button class:wiki-filter={true} class:wiki-filter--active={selectedWikiSection === section.id} type="button" on:click={() => setWikiSection(section.id)}>
                {section.title.toUpperCase()}
              </button>
            {/each}
          </div>

          <div class="mobile-wiki-entry-list">
            {#each filteredWikiEntries as entry}
              <button class:wiki-entry-button={true} class:wiki-entry-button--active={selectedWikiEntryId === entry.id} type="button" on:click={() => selectWikiEntry(entry.id)}>
                <strong>{entry.title}</strong>
              </button>
            {/each}
          </div>

          {#if true}
            {@const visibleEntry = getVisibleWikiEntry()}
            <div class="mobile-wiki-article">
              {#if visibleEntry}
                <h2>{visibleEntry.title}</h2>
                <p class="wiki-article__summary">{visibleEntry.summary}</p>
                {#each visibleEntry.content as paragraph}
                  <p>{paragraph}</p>
                {/each}
              {:else}
                <h2>No Results</h2>
                <p class="wiki-article__summary">No wiki entries match the current search and section filters.</p>
              {/if}
             </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
  {/if}

  <DefenseToast state={$game} />

  <HostBackground
    hostId={getHostConfigId($game)}
    degradation={$game.hostCorruptionPercent / 100}
    integrationProgress={$game.currentStage === 11 ? $game.integrationMeter / BALANCE.HOSTS['11'].integrationMeter.maxValue : 0}
    glitching={bgGlitching}
  />
