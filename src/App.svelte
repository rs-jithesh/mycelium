<script lang="ts">
  import { onMount } from 'svelte'
  import TerminalButton from './lib/ui/TerminalButton.svelte'
  import TerminalPanel from './lib/ui/TerminalPanel.svelte'
  import TerminalProgressBar from './lib/ui/TerminalProgressBar.svelte'
  import TypewriterLog from './lib/ui/TypewriterLog.svelte'
  import SignalPanel from './lib/SignalPanel.svelte'
  import { wikiEntries, wikiSections } from './lib/wiki'
  import { game } from './stores/gameStore'
  import {
    canReleaseSpores,
    getGeneticMemoryBonusPercent,
    getCompletedHosts,
    getCurrentHostDefinition,
    getGeneratorCost,
    getGeneratorEfficiencyByOwned,
    getGeneratorProduction,
    getHostProgress,
    getProjectedGeneticMemoryBonusPercent,
    getProjectedGeneticMemoryGain,
    getProjectedGeneticMemoryTotal,
    getThreatLevelLabel,
    hasNextStage,
    formatDecimal,
    formatDuration,
  } from './engine/formulas'
  import { BALANCE } from './engine/balance.config'
  import {
    countermeasureDefinitions,
    generatorDefinitions,
    hostDefinitions,
    skillDefinitions,
    strainDefinitions,
    upgradeDefinitions,
  } from './lib/game'
  import type { CountermeasureId, DefenseEventId, GeneratorId } from './lib/game'
  import { formatBiomass, formatBPS } from './utils/formatNumber'

  type ViewId = 'terminal' | 'evolution' | 'spore' | 'wiki'

  const navItems: Array<{ label: string; symbol: string; id: ViewId }> = [
    { label: 'TERMINAL', symbol: '[#]', id: 'terminal' },
    { label: 'EVOLUTION', symbol: '[+]', id: 'evolution' },
    { label: 'SPORE', symbol: '[*]', id: 'spore' },
  ]

  const statBranches = ['virulence', 'resilience', 'complexity'] as const
  const HOLD_DELAY_MS = 300
  const HOLD_INTERVAL_MS = 90

  let activeView: ViewId = 'terminal'
  let sidebarTab: 'modules' | 'logs' = 'modules'
  let selectedWikiSection: string = 'basics'
  let selectedWikiEntryId = 'how-the-game-works'
  let wikiQuery = ''
  let isConfirmingSporeRelease = false
  let generatorHoldDelayTimer: number | undefined
  let generatorHoldIntervalTimer: number | undefined
  let absorbProgress = 0
  let absorbIntervalTimer: number | undefined
  let filteredWikiEntries = wikiEntries.filter((entry) => entry.section === selectedWikiSection)
  let visibleWikiEntry = filteredWikiEntries[0] ?? null

  const allTopicsSummary = 'Browse the archive by section or search across every topic. The right pane summarizes the current section and includes all matching entries.'

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

  function clearAbsorbProgress() {
    if (absorbIntervalTimer) {
      window.clearInterval(absorbIntervalTimer)
      absorbIntervalTimer = undefined
    }
  }

  function absorbWithProgress() {
    if (absorbIntervalTimer) {
      return
    }

    absorbProgress = 0
    game.absorb()

    const progressDuration = 1000
    const updateInterval = 16
    const steps = progressDuration / updateInterval
    const progressIncrement = 100 / steps
    let currentStep = 0

    absorbIntervalTimer = window.setInterval(() => {
      currentStep += 1
      absorbProgress = Math.min(100, currentStep * progressIncrement)

      if (currentStep >= steps) {
        clearAbsorbProgress()
        absorbProgress = 0
      }
    }, updateInterval)
  }

  function getModuleVersion(index: number): string {
    return `v4.0.${index + 2}`
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
    if (id === 'terminal') return $game.visibility.generatorPanel
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

    if (index === 2) {
      return `Own ${BALANCE.GENERATOR_UNLOCK_THRESHOLDS[index]}x ${previousGenerator.name} and reach Stage 2`
    }

    if (index === 3) {
      return `Own ${BALANCE.GENERATOR_UNLOCK_THRESHOLDS[index]}x ${previousGenerator.name} and consume ${BALANCE.TIER4_STAGE2_HOST_PROGRESS_GATE}% of the Stage 2 host`
    }

    return `Own ${BALANCE.GENERATOR_UNLOCK_THRESHOLDS[index]}x ${previousGenerator.name} to unlock`
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

  function startGeneratorBuyHold(generatorId: (typeof generatorDefinitions)[number]['id'], event: PointerEvent) {
    if (event.button !== 0 || !canAffordGenerator.get(generatorId)) {
      return
    }

    clearGeneratorBuyHold()
    game.buyGenerator(generatorId)
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

    return `${formatDecimal(skill.cost)} Ψ`
  }

  function getSkillRequirementText(skill: (typeof skillDefinitions)[number]): string {
    if (hasSkill(skill.id)) {
      return 'Mutation integrated into the colony.'
    }

    const missing: string[] = []

    if ($game.currentStage < 3) {
      missing.push('STAGE 3')
    }

    if ($game.stats[skill.branch] < skill.requiredStat) {
      missing.push(`${skill.branch[0].toUpperCase()}:${skill.requiredStat}`)
    }

    if ($game.biomass.lt(skill.cost)) {
      missing.push(`${formatDecimal(skill.cost)} Ψ`)
    }

    if (missing.length > 0) {
      return missing.join(' / ')
    }

    return 'Ready to integrate.'
  }

  function getHostProgressLabel() {
    const progress = getHostProgress($game)

    if (progress === 0 || progress === 100) {
      return `${progress.toFixed(0)}%`
    }

    if (progress < 1) {
      return `${progress.toFixed(2)}%`
    }

    if (progress < 10) {
      return `${progress.toFixed(1)}%`
    }

    return `${progress.toFixed(0)}%`
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
    const msUntilCheck = $game.nextDefenseCheckAt - Date.now()
    if (msUntilCheck > BALANCE.DEFENSE_FORECAST_WARNING_MS) return null
    const secs = Math.max(0, Math.ceil(msUntilCheck / 1000))
    const eventLabel = getDefenseEventLabel($game.nextDefenseEventId)
    if (secs <= 0) {
      return `Incoming pattern — ${eventLabel} — imminent`
    }
    return `Threat signal detected — ${eventLabel} — window closes ~${secs}s`
  }

  function getLikelyThreatForecast(): string {
    if ($game.currentStage < BALANCE.DEFENSE_FORECAST_UNLOCK_STAGE) {
      return 'NO FORECAST'
    }

    if ($game.currentStage <= 2) {
      return 'DROUGHT / BEETLE DISRUPTION / DESICCATION PULSE / UV SURGE / MICROBIAL RIVALRY'
    }

    if ($game.currentStage <= 4) {
      return 'COLD SNAP / BEETLE DISRUPTION / ANTIFUNGAL EXUDATES / LIGNIN FORTIFICATION / INSECT VECTOR SWARM'
    }

    if ($game.currentStage <= 6) {
      return 'SPORE COMPETITION / IMMUNE RESPONSE / VIRAL HIJACK / NUTRIENT SEQUESTRATION / THERMAL STRATIFICATION'
    }

    return 'IMMUNE RESPONSE / SPORE COMPETITION / ECOSYSTEM FEEDBACK / SPORE PREDATION / THERMAL STRATIFICATION'
  }

  function getEquippedCountermeasure() {
    return countermeasureDefinitions.find((entry: (typeof countermeasureDefinitions)[number]) => entry.id === $game.equippedCountermeasure) ?? null
  }

  function getCountermeasureCoverage(countermeasureId: CountermeasureId): string {
    const definition = countermeasureDefinitions.find((entry: (typeof countermeasureDefinitions)[number]) => entry.id === countermeasureId)
    if (!definition) return ''
    return definition.targetEventIds.map((eventId: DefenseEventId) => getDefenseEventLabel(eventId)).join(' / ')
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
    game.start()

    return () => {
      clearGeneratorBuyHold()
      clearAbsorbProgress()
      game.stop()
      game.saveNow()
    }
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
        <div class="intro-biomass reveal-enter" class:intro-biomass--expanded={!$game.visibility.observationLog}>
          <p>BIOMASS</p>
          <h2>{formatBiomass($game.biomass, useScientificNotation)} <span>Ψ</span></h2>
          {#if $game.visibility.bpsDisplay}
            <strong>+{formatBPS($game.biomassPerSecond, useScientificNotation)} Ψ</strong>
          {/if}
        </div>
      {/if}

      <div class="intro-shell__action reveal-enter">
        <TerminalButton
          disabled={absorbProgress > 0}
          on:click={() => absorbWithProgress()}
          active={!$game.visibility.observationLog}
          progress={absorbProgress}
        >
          INITIATE ABSORPTION
        </TerminalButton>
      </div>

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
          <span>BIOMASS: {formatBiomass($game.biomass, useScientificNotation)} Ψ</span>
        {/if}
        {#if $game.visibility.bpsDisplay}
          <span>BPS: +{formatBPS($game.biomassPerSecond, useScientificNotation)}</span>
        {/if}
        {#if $game.visibility.stageDisplay}
          <span>STAGE: {$game.currentStage} — {$game.stageLabel.toUpperCase()}</span>
        {/if}
      </div>
    </header>

    {#if activeView === 'terminal'}
      <div class="desktop-terminal workspace-grid">
        <section class="workspace-main">
            <div class="workspace-main__center">
              <div class="terminal-focus">
                <div class="biomass-chamber">
                  <p class="biomass-chamber__label">CURRENT TOTAL BIOMASS</p>
                  <h2 class="biomass-chamber__value">{formatBiomass($game.biomass, useScientificNotation)}<span> Ψ</span></h2>
                  {#if latestLogEntry}
                    <p class="biomass-chamber__event">{latestLogEntry}</p>
                  {/if}
                  {#if $game.visibility.bpsDisplay}
                    <p class="biomass-chamber__label">PASSIVE ABSORPTION :: +{formatBPS($game.biomassPerSecond, useScientificNotation)}</p>
                    <p class="biomass-chamber__label">CLICK :: +{formatBiomass($game.biomassPerClick, useScientificNotation)} Ψ</p>
                  {/if}
                </div>

                <!-- Signal economy temporarily disabled. -->
                <!-- <SignalPanel /> -->

                <div class:terminal-absorb-button={true} class:terminal-absorb-button--alone={!$game.visibility.generatorPanel}>
                  <TerminalButton disabled={absorbProgress > 0} on:click={() => absorbWithProgress()} progress={absorbProgress}>[ INITIATE ABSORPTION ]</TerminalButton>
                </div>
              </div>

              {#if $game.visibility.hostHealthBar || ($game.hostCompleted && hasNextStage($game))}
              <div class:reveal-enter={isNewReveal('hostHealthBar') || isNewReveal('stageDisplay')} on:animationend={() => {
                finishReveal('hostHealthBar')
                finishReveal('stageDisplay')
              }}>
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

                {#if $game.activeDefenseEvents.length > 0}
                  <div class="analysis-alerts">
                    {#each $game.activeDefenseEvents as event}
                      <div class="analysis-alert">
                        {event.name.toUpperCase()}: {formatDuration(event.endsAt - Date.now())}
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>

                <div class="analysis-panel__progress">
                  <div class="analysis-panel__row">
                    <span>DEGRADATION PROGRESS</span>
                    <span>{getHostProgressLabel()}</span>
                  </div>
                </div>

              <div class="analysis-panel__meta">
                {#if $game.activeDefenseEvents.length > 0}
                  {#each $game.activeDefenseEvents as event}
                    <p>Defense :: {event.name.toUpperCase()} / {formatDuration(event.endsAt - Date.now())}</p>
                  {/each}
                {/if}
              </div>

              <p class="analysis-panel__flavor">{getCurrentHostFlavor()}</p>
              {#if $game.activeDefenseEvents.length > 0}
                <p class="analysis-panel__flavor analysis-panel__flavor--muted">Defense Pattern :: {getDynamicDefensePattern()}</p>
                <p class="analysis-panel__flavor analysis-panel__flavor--muted">Transition Signal :: {getDynamicTransitionSignal()}</p>
              {/if}

              {#if $game.hostCompleted && hasNextStage($game)}
                <div class="analysis-panel__advance">
                  <TerminalButton variant="secondary" on:click={() => game.advanceStage()}>[ ADVANCE TO STAGE {$game.currentStage + 1} ]</TerminalButton>
                </div>
              {/if}
              </TerminalPanel>
              </div>
              {/if}

              {#if $game.currentStage >= BALANCE.DEFENSE_FORECAST_UNLOCK_STAGE}
              <TerminalPanel
                title="DEFENSE CONTROL"
                tag="TACTICS"
                variant="low"
                className="analysis-panel"
              >
                  {#if getForecastCountdownLabel() !== null}
                    <p class="analysis-panel__flavor analysis-panel__flavor--alert">{getForecastCountdownLabel()}</p>
                  {/if}
                  <div class="analysis-panel__meta">
                    <p>Likely Threat :: {getLikelyThreatForecast()}</p>
                    <p>Equipped Countermeasure :: {getEquippedCountermeasure()?.name.toUpperCase() ?? 'UNASSIGNED'}</p>
                  </div>
                  {#if $game.equippedCountermeasure === null}
                    <p class="analysis-panel__flavor">Choose one countermeasure for this run. Once selected, it locks until Spore Release.</p>
                  {/if}
                  <div class="strain-grid defense-control__grid">
                    {#each countermeasureDefinitions as countermeasure}
                      <button
                        class="strain-card"
                        class:strain-card--locked={$game.equippedCountermeasure !== null && $game.equippedCountermeasure !== countermeasure.id}
                        disabled={$game.equippedCountermeasure !== null}
                        type="button"
                        on:click={() => game.equipCountermeasure(countermeasure.id)}
                      >
                        <strong>{countermeasure.name}</strong>
                        <span>{countermeasure.description}</span>
                        <small>Covers {getCountermeasureCoverage(countermeasure.id)}</small>
                      </button>
                    {/each}
                  </div>
              </TerminalPanel>
              {/if}
            </div>
          </section>

          <aside class="workspace-sidebar">
          {#if $game.visibility.observationLog}
            <div class="sidebar-tabs">
              <button class:sidebar-tab={true} class:sidebar-tab--active={sidebarTab === 'modules'} type="button" on:click={() => sidebarTab = 'modules'}>[+] MODULES</button>
              <button class:sidebar-tab={true} class:sidebar-tab--active={sidebarTab === 'logs'} type="button" on:click={() => sidebarTab = 'logs'}>[=] LOGS</button>
            </div>
          {/if}

          {#if sidebarTab === 'modules' || !$game.visibility.observationLog}
          <div class="sidebar-modules">
          {#if $game.visibility.generatorPanel}
          <div class:reveal-enter={isNewReveal('generatorPanel')} on:animationend={() => finishReveal('generatorPanel')}>
          <TerminalPanel
            title="GENERATOR_MODULES"
            tag="v4.0.2"
            bleedHeader={true}
            className="modules-shell"
          >
            <div class="modules-list">
              {#each generatorDefinitions as generator, index}
                {#if $game.visibility.generatorTiers[index]}
                <div
                  class:module-card={true}
                  class:reveal-enter={isNewReveal(`generatorTier-${index}`)}
                  on:animationend={() => finishReveal(`generatorTier-${index}`)}
                >
                  <div class="module-card__header">
                    <div>
                      <h3>{generator.name}</h3>
                      <p>{generator.flavor}</p>
                    </div>
                    <span class="module-card__count">
                      {$game.generators[generator.id].owned.toString().padStart(2, '0')}
                    </span>
                  </div>

                  <div class="module-card__footer">
                    <span>
                      {#if getGeneratorDisruption(generator.id)}
                        OUTPUT: DISRUPTED [{formatDuration(getGeneratorDisruption(generator.id)!.endsAt - Date.now())}]
                      {:else}
                        OUTPUT: +{formatBiomass(getGeneratorProduction($game, generator.id), useScientificNotation)} Ψ/sec
                      {/if}
                    </span>
                    <span>COST: {formatBiomass(getGeneratorCost($game, generator.id), useScientificNotation)} Ψ</span>
                  </div>
                  <div class="module-card__actions">
                    <span>{getModuleVersion(index)}</span>
                    <span
                      class:efficiency-badge={true}
                      class:efficiency-badge--high={getGeneratorRelativeEfficiency(generator.id) > 100}
                      class:efficiency-badge--very-high={getGeneratorRelativeEfficiency(generator.id) > 10_000}
                    >
                      {formatEfficiencyLabel(getGeneratorRelativeEfficiency(generator.id))}
                    </span>
                    <button
                      class="terminal-button terminal-button--secondary"
                      class:terminal-button--disabled={!canAffordGenerator.get(generator.id)}
                      disabled={!canAffordGenerator.get(generator.id)}
                      type="button"
                      on:pointerdown={(event) => startGeneratorBuyHold(generator.id, event)}
                      on:pointerup={clearGeneratorBuyHold}
                      on:pointerleave={clearGeneratorBuyHold}
                      on:pointercancel={clearGeneratorBuyHold}
                    >
                      [ BUY ]
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
          {/if}

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
          </div>
          {:else}
            <div class="sidebar-log">
              <TypewriterLog entries={$game.log.slice(-12)} />
            </div>
          {/if}
          </aside>
      </div>

      <div class="mobile-terminal">
        <header class="mobile-topbar">
          <span class="mobile-topbar__icon mobile-topbar__icon--hidden" aria-hidden="true"></span>
          <div class="mobile-topbar__title">PROTOCOL_1.0</div>
          {#if $game.visibility.stageDisplay}
            <div class="mobile-topbar__stage">STAGE: {$game.stageLabel.toUpperCase()}</div>
          {/if}
          {#if $game.visibility.observationLog}
            <button class="mobile-log-toggle" type="button" on:click={() => game.toggleLogPanel()}>[=]</button>
          {/if}
        </header>

        <section class="mobile-hero">
          <p class="mobile-hero__label">AVAILABLE BIOMASS</p>
          <div class="mobile-hero__value-row">
            <span class="mobile-hero__glyph">Ψ</span>
            <h2 class="mobile-hero__value">{formatBiomass($game.biomass, useScientificNotation)}</h2>
          </div>
          {#if latestLogEntry}
            <p class="mobile-hero__event">{latestLogEntry}</p>
          {/if}
          {#if $game.visibility.bpsDisplay}
            <p class="mobile-hero__label">PASSIVE :: +{formatBPS($game.biomassPerSecond, useScientificNotation)}</p>
            <p class="mobile-hero__label">TAP :: +{formatBiomass($game.biomassPerClick, useScientificNotation)} Ψ</p>
          {/if}
          <TerminalButton disabled={absorbProgress > 0} on:click={() => absorbWithProgress()} progress={absorbProgress}>[ INITIATE ABSORPTION ]</TerminalButton>

          {#if $game.activeDefenseEvents.length > 0}
            <div class="mobile-defense-strip reveal-enter" aria-label="Active defense events">
              {#each $game.activeDefenseEvents as event}
                <div class="mobile-defense-strip__event">
                  <strong>{event.name.toUpperCase()}</strong>
                  <span>{formatDuration(event.endsAt - Date.now())}</span>
                </div>
              {/each}
            </div>
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
            <p class="mobile-analysis__scan">AUTO_SCAN: ENABLED</p>
          </div>

          <div class="mobile-analysis__progress-row">
            <span></span>
            <span>{getHostProgressLabel()}</span>
          </div>

          <div class="mobile-alert-card">
            <span class="mobile-alert-card__icon">▲</span>
            <div>
              {#if $game.activeDefenseEvents.length > 0}
                {#each $game.activeDefenseEvents as event, index}
                  <p>HOST DEFENSE {index + 1}</p>
                  <strong>{event.name.toUpperCase()} [{formatDuration(event.endsAt - Date.now())}]</strong>
                {/each}
              {:else}
                <p>HOST DEFENSES</p>
                <strong>NONE DETECTED</strong>
              {/if}
            </div>
          </div>

          <p class="mobile-analysis__flavor">{getCurrentHostFlavor()}</p>
          <p class="mobile-analysis__flavor">Threat :: {getCurrentHostThreatLevel()}</p>
          {#if $game.activeDefenseEvents.length > 0}
            <p class="mobile-analysis__flavor">Defense Pattern :: {getDynamicDefensePattern()}</p>
            <p class="mobile-analysis__flavor">Transition Signal :: {getDynamicTransitionSignal()}</p>
          {/if}

          {#if $game.hostCompleted && hasNextStage($game)}
            <button class="mobile-generator-row__buy mobile-analysis__advance" type="button" on:click={() => game.advanceStage()}>
              [ ADVANCE TO STAGE {$game.currentStage + 1} ]
            </button>
          {/if}
        </TerminalPanel>
        {/if}

        {#if $game.currentStage >= BALANCE.DEFENSE_FORECAST_UNLOCK_STAGE}
        <TerminalPanel title="DEFENSE CONTROL" tag="▲" variant="low" bleedHeader={true} className="mobile-card">
            {#if getForecastCountdownLabel() !== null}
              <p class="mobile-analysis__flavor mobile-analysis__flavor--alert">{getForecastCountdownLabel()}</p>
            {/if}
            <p class="mobile-analysis__flavor">Likely Threat :: {getLikelyThreatForecast()}</p>
            <p class="mobile-analysis__flavor">Countermeasure :: {getEquippedCountermeasure()?.name.toUpperCase() ?? 'UNASSIGNED'}</p>
            {#if $game.equippedCountermeasure === null}
              <p class="mobile-analysis__flavor">Choose one countermeasure for this run. Once selected, it locks until Spore Release.</p>
            {/if}
            <div class="mobile-strain-list defense-control__list">
              {#each countermeasureDefinitions as countermeasure}
                <button
                  class="mobile-strain-button"
                  class:mobile-strain-button--locked={$game.equippedCountermeasure !== null && $game.equippedCountermeasure !== countermeasure.id}
                  disabled={$game.equippedCountermeasure !== null}
                  type="button"
                  on:click={() => game.equipCountermeasure(countermeasure.id)}
                >
                  <strong>{countermeasure.name.toUpperCase()}</strong>
                  <span>{countermeasure.description}</span>
                </button>
              {/each}
            </div>
        </TerminalPanel>
        {/if}

        {#if $game.visibility.bpsDisplay}
        <TerminalPanel title="PROPAGATION EFFICIENCY" tag="" variant="low" className="mobile-card mobile-metrics">
          <div class="mobile-metrics__grid">
            <div>
              <p>GROWTH RATE</p>
              <strong>+{formatDecimal($game.biomassPerSecond)} Ψ/s</strong>
            </div>
            <div>
              <p>METABOLISM</p>
              <strong>{$game.hostCompleted ? '100.0%' : '94.2%'}</strong>
            </div>
          </div>
          <div class="mobile-metrics__image"></div>
        </TerminalPanel>
        {/if}

        {#if $game.visibility.generatorPanel}
        <TerminalPanel title="GENERATOR MODULES" tag="" variant="low" className="mobile-card mobile-generators" bleedHeader={true}>
          <div slot="header" class="mobile-generators__header-extra">TOTAL EFFICIENCY: {formatBPS($game.biomassPerSecond, useScientificNotation)}</div>
          <div class="mobile-generator-list">
            {#each generatorDefinitions as generator, index}
              {#if $game.visibility.generatorTiers[index]}
              <div class="mobile-generator-row">
                <div class="mobile-generator-row__body">
                  <h3>{generator.name.toUpperCase()} ({$game.generators[generator.id].owned})</h3>
                  <p>{generator.flavor.toUpperCase()}</p>
                  <p class="mobile-generator-row__meta">
                    {#if getGeneratorDisruption(generator.id)}
                      OUTPUT: DISRUPTED [{formatDuration(getGeneratorDisruption(generator.id)!.endsAt - Date.now())}]
                    {:else}
                      OUTPUT: +{formatBiomass(getGeneratorProduction($game, generator.id), useScientificNotation)} Ψ/SEC
                    {/if}
                  </p>
                  <p
                    class:efficiency-badge={true}
                    class:efficiency-badge--high={getGeneratorRelativeEfficiency(generator.id) > 100}
                    class:efficiency-badge--very-high={getGeneratorRelativeEfficiency(generator.id) > 10_000}
                  >
                    {formatEfficiencyLabel(getGeneratorRelativeEfficiency(generator.id))}
                  </p>
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
                </div>
                <div class="overview-stat">
                  <span class="overview-stat__label">LIFETIME BIOMASS</span>
                  <strong>{formatDecimal($game.lifetimeBiomass)}</strong>
                </div>
                <div class="overview-stat">
                  <span class="overview-stat__label">GENERATORS OWNED</span>
                  <strong>{getTotalOwnedGenerators().toString().padStart(2, '0')}</strong>
                </div>
                <div class="overview-stat">
                  <span class="overview-stat__label">UPGRADES APPLIED</span>
                  <strong>{getPurchasedUpgradeCount().toString().padStart(2, '0')}</strong>
                </div>
                <div class="overview-stat">
                  <span class="overview-stat__label">MUTATION POINTS</span>
                  <strong>{$game.mutationPoints.toString().padStart(2, '0')}</strong>
                </div>
                <div class="overview-stat">
                  <span class="overview-stat__label">CURRENT STRAIN</span>
                  <strong>{getCurrentStrainName()}</strong>
                </div>
              </div>
            </TerminalPanel>

            <div class="dual-panel-grid">
              {#if $game.visibility.statsPanel}
              <TerminalPanel title="CORE ATTRIBUTES" tag="STATS" variant="low" bleedHeader={true} resizable={true} resizeAxis="both">
                <div class="desktop-attribute-list">
                  <div class="desktop-attribute-card">
                    <div class="desktop-attribute-card__header">
                      <span>VIRULENCE [V: {$game.stats.virulence}]</span>
                      <div class="desktop-attribute-card__header-side">
                        <span>EXPANSION ENGINE</span>
                        <button class="desktop-attribute-card__button" disabled={$game.mutationPoints <= 0} type="button" on:click={() => game.allocateStat('virulence')}>+</button>
                      </div>
                    </div>
                    <p>Aggressive spread protocol. Increases click-power efficiency by 15% per rank.</p>
                  </div>

                  <div class="desktop-attribute-card">
                    <div class="desktop-attribute-card__header">
                      <span>RESILIENCE [R: {$game.stats.resilience}]</span>
                      <div class="desktop-attribute-card__header-side">
                        <span>SURVIVAL MESH</span>
                        <button class="desktop-attribute-card__button" disabled={$game.mutationPoints <= 0} type="button" on:click={() => game.allocateStat('resilience')}>+</button>
                      </div>
                    </div>
                    <p>Cellular wall density. Reduces system defense resistance by 8% per rank.</p>
                  </div>

                  <div class="desktop-attribute-card">
                    <div class="desktop-attribute-card__header">
                      <span>COMPLEXITY [C: {$game.stats.complexity}]</span>
                      <div class="desktop-attribute-card__header-side">
                        <span>COGNITIVE ARCH</span>
                        <button class="desktop-attribute-card__button" disabled={$game.mutationPoints <= 0} type="button" on:click={() => game.allocateStat('complexity')}>+</button>
                      </div>
                    </div>
                    <p>Synaptic mapping. Improves passive output and upgrade efficiency.</p>
                  </div>

                  <div class="readiness-banner">STATUS :: {getReadinessStatus()}</div>
                </div>
              </TerminalPanel>
              {/if}

              {#if $game.visibility.strainPrompt || $game.visibility.statsPanel}
              <TerminalPanel title="STRAIN STATUS" tag="NEXT" variant="low" bleedHeader={true} resizable={true} resizeAxis="both">
                <div class="preview-copy">
                  <p>Current strain :: {getCurrentStrainName()}</p>
                  <p>Available mutation points :: {$game.mutationPoints}</p>
                  {#if $game.strain === 'parasite'}
                    <p>Defense response :: Counterburst windows spike click output after host defenses trigger.</p>
                  {:else if $game.strain === 'symbiote'}
                    <p>Defense response :: Symbiote mesh absorbs a larger share of active defense penalties.</p>
                  {:else if $game.strain === 'saprophyte'}
                    <p>Defense response :: Expiring host defenses leave salvageable biomass behind.</p>
                  {/if}
                  {#if canChooseStrain()}
                    <p>Selection protocol unlocked. Choose a dominant phenotype to continue evolution.</p>
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
                  {:else}
                    <p>
                      {#if getCompletedHosts($game) < 1}
                        Clear the first host to unlock strain selection.
                      {:else}
                        Strain locked in. Build-specific systems can now layer on top of {getCurrentStrainName()}.
                      {/if}
                    </p>
                  {/if}

                </div>
              </TerminalPanel>
              {/if}
            </div>

            {#if $game.visibility.skillTree}
            <TerminalPanel title="NEURAL MUTATIONS" tag="SKILL TREE" variant="low" bleedHeader={true} resizable={true} resizeAxis="vertical">
              <div class="desktop-skill-columns">
                {#each statBranches as branch}
                  <div class="desktop-skill-column">
                    <p class="desktop-skill-column__title">{branch.toUpperCase()}</p>
                    <div class="desktop-skill-list">
                      {#each getSkillsForBranch(branch) as skill}
                        <button
                          class="desktop-skill-row"
                          class:desktop-skill-row--purchased={hasSkill(skill.id)}
                          class:desktop-skill-row--locked={!hasSkill(skill.id) && !canBuySkillMap.get(skill.id)}
                          disabled={!canBuySkillMap.get(skill.id)}
                          type="button"
                          on:click={() => game.purchaseSkill(skill.id)}
                        >
                          <div>
                            <h4>{skill.name}</h4>
                            <p>{skill.description}</p>
                            {#if !hasSkill(skill.id)}
                              <p class="desktop-skill-row__requirement">{getSkillRequirementText(skill)}</p>
                            {/if}
                          </div>
                          <span>{getSkillStateLabel(skill)}</span>
                        </button>
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

        {#if $game.visibility.statsPanel}
        <section class="mobile-evolution__section-label">CORE_ATTRIBUTES</section>

        <section class="mobile-attribute-card">
          <div class="mobile-attribute-card__header">
            <span>VIRULENCE [V: {$game.stats.virulence}]</span>
            <div class="mobile-attribute-card__header-side">
              <span>EXPANSION ENGINE</span>
              <button class="mobile-attribute-card__button" disabled={$game.mutationPoints <= 0} type="button" on:click={() => game.allocateStat('virulence')}>+</button>
            </div>
          </div>
          <p>Aggressive spread protocol. Increases click-power efficiency by 15% per rank.</p>
        </section>

        <section class="mobile-attribute-card">
          <div class="mobile-attribute-card__header">
            <span>RESILIENCE [R: {$game.stats.resilience}]</span>
            <div class="mobile-attribute-card__header-side">
              <span>SURVIVAL MESH</span>
              <button class="mobile-attribute-card__button" disabled={$game.mutationPoints <= 0} type="button" on:click={() => game.allocateStat('resilience')}>+</button>
            </div>
          </div>
          <p>Cellular wall density. Reduces system defense resistance by 8% per rank.</p>
        </section>

        <section class="mobile-attribute-card">
          <div class="mobile-attribute-card__header">
            <span>COMPLEXITY [C: {$game.stats.complexity}]</span>
            <div class="mobile-attribute-card__header-side">
              <span>COGNITIVE ARCH</span>
              <button class="mobile-attribute-card__button" disabled={$game.mutationPoints <= 0} type="button" on:click={() => game.allocateStat('complexity')}>+</button>
            </div>
          </div>
          <p>Synaptic mapping. Unlocks advanced synergy pathways and multi-spore logic.</p>
        </section>
        {/if}

        {#if $game.visibility.strainPrompt || $game.visibility.statsPanel}
        <TerminalPanel title="STRAIN STATUS" tag="⌘" variant="low" className="mobile-card mobile-evolution__strain" bleedHeader={true}>
          <div class="mobile-evolution__strain-inner">
            <p class="mobile-evolution__strain-tag">
              {#if canChooseStrain()}
                [ FIRST HOST CONSUMED ]
              {:else}
                [ CURRENT STRAIN: {getCurrentStrainName()} ]
              {/if}
            </p>
            <p>
              {#if canChooseStrain()}
                Genetic threshold met. Core strain mutation ready for selection. Select a dominant phenotype to continue evolution.
              {:else if getCompletedHosts($game) < 1}
                Clear the first host to initialize strain selection.
              {:else}
                Dominant phenotype established. Mutation path is now being shaped by {getCurrentStrainName()}.
              {/if}
            </p>

            {#if $game.strain === 'parasite'}
              <p>Defense response :: Counterburst windows spike click output after host defenses trigger.</p>
            {:else if $game.strain === 'symbiote'}
              <p>Defense response :: Symbiote mesh absorbs a larger share of active defense penalties.</p>
            {:else if $game.strain === 'saprophyte'}
              <p>Defense response :: Expiring host defenses leave salvageable biomass behind.</p>
            {/if}

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
                  </button>
                {/each}
              </div>
            {/if}

          </div>
        </TerminalPanel>
        {/if}

        {#if $game.visibility.skillTree}
        <TerminalPanel title="NEURAL_MUTATIONS" tag="✜" variant="low" className="mobile-card mobile-evolution__mutations" bleedHeader={true}>
          <div class="mobile-mutation-list">
            {#each skillDefinitions as skill}
              <button
                class="mobile-mutation-row"
                class:mobile-mutation-row--purchased={hasSkill(skill.id)}
                class:mobile-mutation-row--locked={!hasSkill(skill.id) && !canBuySkillMap.get(skill.id)}
                disabled={!canBuySkillMap.get(skill.id)}
                type="button"
                on:click={() => game.purchaseSkill(skill.id)}
              >
                <div class="mobile-mutation-row__icon">{skill.branch === 'virulence' ? '◼' : skill.branch === 'resilience' ? '⬢' : '◌'}</div>
                <div>
                  <div class="mobile-mutation-row__title-wrap">
                    <h3>{skill.name}</h3>
                    <span>{getSkillStateLabel(skill)}</span>
                  </div>
                  <p>{skill.description}</p>
                  {#if !hasSkill(skill.id)}
                    <p class="mobile-mutation-row__requirement">{getSkillRequirementText(skill)}</p>
                  {/if}
                </div>
              </button>
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
                </div>
                <div class="overview-stat">
                  <span class="overview-stat__label">HOST THREAT</span>
                  <strong>{getCurrentHostThreatLevel()}</strong>
                </div>
                <div class="overview-stat">
                  <span class="overview-stat__label">LIFETIME BIOMASS</span>
                  <strong>{formatBiomass($game.lifetimeBiomass, useScientificNotation)}</strong>
                </div>
                <div class="overview-stat">
                  <span class="overview-stat__label">PRESTIGE SYSTEM</span>
                  <strong>{formatDecimal($game.geneticMemory)} Γ / +{formatDecimal(getGeneticMemoryBonusPercent($game))}%</strong>
                </div>
                <div class="overview-stat">
                  <span class="overview-stat__label">HIGHEST STAGE</span>
                  <strong>{$game.highestStageReached.toString().padStart(2, '0')}</strong>
                </div>
              </div>
            </TerminalPanel>

            <div class="dual-panel-grid">
              <TerminalPanel title="RELEASE STATUS" tag="META LOOP" variant="low" bleedHeader={true} resizable={true} resizeAxis="both">
                <div class="preview-copy spore-release-panel">
                  <p>Run status :: {getRunStatusLabel()}</p>
                  <p>{getReleaseRequirementText()}</p>
                  <p>Current host defense signature :: {getCurrentHostDefenseSignature()}</p>
                  <p>Transition signal :: {getCurrentHostTransitionSignal()}</p>

                  <div class="spore-stats-grid">
                    <div class="spore-stat-card">
                      <span>Current Genetic Memory</span>
                      <strong>{formatBiomass($game.geneticMemory)}</strong>
                    </div>
                    <div class="spore-stat-card">
                      <span>Projected Gain</span>
                      <strong>+{formatDecimal(getProjectedGeneticMemoryGain($game))} Γ</strong>
                    </div>
                    <div class="spore-stat-card">
                      <span>Total After Release</span>
                      <strong>{formatDecimal(getProjectedGeneticMemoryTotal($game))} Γ</strong>
                    </div>
                    <div class="spore-stat-card">
                      <span>Projected Bonus</span>
                      <strong>+{formatDecimal(getProjectedGeneticMemoryBonusPercent($game))}%</strong>
                    </div>
                  </div>

                  <p>Spore Release resets current run progress, clears owned generators and upgrades, and forces a fresh strain selection.</p>
                  <p>Saprophyte becomes permanently available after the first successful release.</p>

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
                <TypewriterLog entries={$game.log.slice(-8)} />
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
      <button class:mobile-tabbar__item={true} class:mobile-tabbar__item--active={activeView === item.id} type="button" on:click={() => (activeView = item.id)}>
        <span>{item.symbol}</span>
        <span>{item.label}</span>
      </button>
    {/each}
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
              <small>{strain.signature}</small>
            </button>
          {/each}
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

          <div class="mobile-wiki-article">
            {#if getVisibleWikiEntry()}
              <h2>{getVisibleWikiEntry()!.title}</h2>
              <p class="wiki-article__summary">{getVisibleWikiEntry()!.summary}</p>
              {#each getVisibleWikiEntry()!.content as paragraph}
                <p>{paragraph}</p>
              {/each}
            {:else}
              <h2>No Results</h2>
              <p class="wiki-article__summary">No wiki entries match the current search and section filters.</p>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
{/if}
