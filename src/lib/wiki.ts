export type WikiSectionId = 'basics' | 'resources' | 'growth' | 'evolution' | 'hosts' | 'prestige' | 'faq'

export interface WikiSection {
  id: WikiSectionId
  title: string
  summary: string
}

export interface WikiEntry {
  id: string
  type: 'article' | 'faq'
  section: WikiSectionId
  title: string
  summary: string
  keywords: string[]
  content: string[]
}

export const wikiSections: WikiSection[] = [
  { id: 'basics', title: 'Basics', summary: 'Core rules, screen roles, and the main loop that drives each run.' },
  { id: 'resources', title: 'Resources', summary: 'What the game tracks, what each abbreviation means, and how progression currencies differ.' },
  { id: 'growth', title: 'Growth', summary: 'Passive income, generator scaling, upgrades, and the host defenses that interrupt them.' },
  { id: 'evolution', title: 'Evolution', summary: 'Strains, core attributes, and skill unlocks that shape the organism build.' },
  { id: 'hosts', title: 'Hosts', summary: 'How stage progression works and what completing each host does for the run.' },
  { id: 'prestige', title: 'Prestige', summary: 'Spore Release, Genetic Memory, and what persists after a reset.' },
  { id: 'faq', title: 'FAQ', summary: 'Quick answers to common progression, locking, and interface questions.' },
]

export const wikiEntries: WikiEntry[] = [
  {
    id: 'how-the-game-works',
    type: 'article',
    section: 'basics',
    title: 'How The Game Works',
    summary: 'Gather biomass, grow passive income, evolve your organism, consume hosts, and eventually reset for permanent power.',
    keywords: ['loop', 'biomass', 'progression', 'host', 'prestige'],
    content: [
      'Click ABSORB to gather biomass manually at the start of a run.',
      'Spend biomass on generator modules and upgrades to increase passive production.',
      'Clearing hosts advances the run. Host clears unlock strains, mutation points, and later skills.',
      'Each host is a stage. When you fully consume the current host, you can advance to the next one.',
      'Later, Spore Release will let you reset the run in exchange for permanent Genetic Memory.',
    ],
  },
  {
    id: 'main-screens',
    type: 'article',
    section: 'basics',
    title: 'What Each Screen Does',
    summary: 'Terminal is moment-to-moment growth, Evolution is build crafting, and Spore is meta progression.',
    keywords: ['terminal', 'evolution', 'spore', 'screens'],
    content: [
      'Terminal is the active run screen. You gather biomass, buy generators, fight host defenses, and advance stages here.',
      'Evolution is where you spend mutation points, select a strain, and buy stat-gated skills.',
      'Spore is the prestige and meta-progression area. It will be the place to release spores and gain Genetic Memory.',
      'System Logs toggles the observation log panel. On desktop it appears as a footer row below the terminal. On mobile it opens a collapsible card showing the last 12 log entries.',
    ],
  },
  {
    id: 'resource-abbreviations',
    type: 'article',
    section: 'resources',
    title: 'Resource Abbreviations',
    summary: 'The command center uses short labels for common resources and rates.',
    keywords: ['bpc', 'bps', 'ep', 'ltb', 'abbreviations'],
    content: [
      'BPC means Biomass Per Click.',
      'BPS means Biomass Per Second.',
      'STAGE marks your current host in the campaign sequence.',
      'LTB means Lifetime Biomass produced in the current run.',
      'Mutation Points are earned by clearing hosts and are spent on core stats.',
    ],
  },
  {
    id: 'biomass-and-memory',
    type: 'article',
    section: 'resources',
    title: 'Biomass And Genetic Memory',
    summary: 'Biomass powers your current run. Genetic Memory will be the permanent reward from prestige.',
    keywords: ['biomass', 'genetic memory', 'prestige', 'gamma'],
    content: [
      'Biomass is your main currency. You use it to buy generators, upgrades, and later skills.',
      'Lifetime Biomass is tracked separately from your current biomass. It drives prestige rewards and run analytics.',
      'Genetic Memory is the future prestige currency. It will persist across runs and permanently increase production.',
    ],
  },
  {
    id: 'generators-and-upgrades',
    type: 'article',
    section: 'growth',
    title: 'Generators And Upgrades',
    summary: 'Generators create passive biomass over time. Upgrades are one-time purchases that permanently improve a run.',
    keywords: ['generator', 'upgrade', 'cost scaling', 'passive'],
    content: [
      'Each generator module produces biomass automatically every tick.',
      'Generator costs scale upward based on how many of that generator you already own.',
      'Upgrades are bought once per run. They permanently change click power, production, or efficiency until reset.',
      'Some generators are locked behind stage progression and host degradation milestones.',
    ],
  },
  {
    id: 'host-defense-events',
    type: 'article',
    section: 'growth',
    title: 'Host Defense Events',
    summary: 'Hosts fight back with temporary penalties that disrupt your production.',
    keywords: ['drought', 'beetle', 'defense', 'penalty'],
    content: [
      'Defense events are temporary penalties triggered by the current host.',
      'Drought reduces generator output for a period of time.',
      'Beetle Disruption temporarily disables a random owned generator.',
      'From Stage 2 onward, the colony can forecast the next likely defense event before it hits.',
      'You may equip one countermeasure per run to blunt a matching defense pattern.',
      'Resilience reduces the severity of these penalties, and some resilience skills improve that further.',
    ],
  },
  {
    id: 'strains-and-stats',
    type: 'article',
    section: 'evolution',
    title: 'Strains And Stats',
    summary: 'After clearing the first host you choose a strain, then shape the run further with Virulence, Resilience, and Complexity.',
    keywords: ['strain', 'parasite', 'symbiote', 'saprophyte', 'virulence', 'resilience', 'complexity'],
    content: [
      'Parasite favors clicking and burst pressure. It sacrifices passive efficiency for aggressive manual growth.',
      'Symbiote removes click income and turns the run into a strong passive engine.',
      'Saprophyte is prestige-locked and will become available after your first Spore Release.',
      'Virulence improves click power, Resilience helps survive defenses, and Complexity improves passive systems and upgrade effectiveness.',
    ],
  },
  {
    id: 'skills',
    type: 'article',
    section: 'evolution',
    title: 'Skills',
    summary: 'Skills are biomass-purchased perks unlocked by stage and stat thresholds.',
    keywords: ['skills', 'skill tree', 'requirements', 'purchase'],
    content: [
      'Skills unlock once you reach Stage 3.',
      'Each skill belongs to one stat branch and requires a minimum rank in that stat.',
      'Skills cost biomass, not mutation points.',
      'Purchased skills permanently affect the current run until prestige resets the run.',
    ],
  },
  {
    id: 'hosts-and-stages',
    type: 'article',
    section: 'hosts',
    title: 'Hosts And Stages',
    summary: 'Each stage represents a larger host. Completing one host lets you advance to the next.',
    keywords: ['host', 'stage', 'advance', 'dead leaf', 'rotting log'],
    content: [
      'Every stage has one host with its own health total.',
      'When host health reaches zero, the stage is complete.',
      'After completion, use the stage advance control to move to the next host.',
      'Higher stages have larger health pools and will eventually use more dangerous defense events.',
    ],
  },
  {
    id: 'prestige-overview',
    type: 'article',
    section: 'prestige',
    title: 'Spore Release',
    summary: 'Spore Release is the prestige system. It will reset the run in exchange for permanent Genetic Memory.',
    keywords: ['prestige', 'spore release', 'reset', 'genetic memory'],
    content: [
      'Prestige resets current-run growth systems like biomass, generators, upgrades, strain choice, and stats.',
      'In exchange, you gain Genetic Memory, a permanent multiplier that speeds up future runs.',
      'Prestige also unlocks new strategic options, including the Saprophyte strain.',
      'The current Spore screen is the place where that flow will be surfaced and explained.',
    ],
  },
  {
    id: 'faq-bpc',
    type: 'faq',
    section: 'faq',
    title: 'What do BPC, BPS, STAGE, and LTB mean?',
    summary: 'These are the main shorthand labels used in the interface.',
    keywords: ['bpc', 'bps', 'stage', 'ltb'],
    content: [
      'BPC = Biomass Per Click, BPS = Biomass Per Second, STAGE = your current host tier, and LTB = Lifetime Biomass.',
    ],
  },
  {
    id: 'faq-strain',
    type: 'faq',
    section: 'faq',
    title: 'Why can’t I choose a strain yet?',
    summary: 'Strain selection is locked until the first host is cleared.',
    keywords: ['strain', 'locked', 'first host'],
    content: ['Strain selection becomes available after you consume the first host. Until then, the run stays in its base growth state.'],
  },
  {
    id: 'faq-saprophyte',
    type: 'faq',
    section: 'faq',
    title: 'Why is Saprophyte locked?',
    summary: 'Saprophyte is a prestige-locked strain.',
    keywords: ['saprophyte', 'locked', 'prestige'],
    content: ['Saprophyte is intended to unlock after your first Spore Release. It is not available on a fresh file.'],
  },
  {
    id: 'faq-skills',
    type: 'faq',
    section: 'faq',
    title: 'Why are some skills locked?',
    summary: 'Skills require both stage and stat thresholds.',
    keywords: ['skills', 'locked', 'requirements'],
    content: ['Skills unlock at Stage 3 and also require a minimum rank in one of the three core stats.'],
  },
  {
    id: 'faq-generators',
    type: 'faq',
    section: 'faq',
    title: 'Why are some generator modules locked?',
    summary: 'Higher-tier generators unlock through stage progress.',
    keywords: ['generators', 'locked', 'stage'],
    content: ['Some generator modules require host progression or stage-specific degradation milestones before they can be purchased, even if you can afford them.'],
  },
  {
    id: 'faq-production-drop',
    type: 'faq',
    section: 'faq',
    title: 'Why did my production suddenly drop?',
    summary: 'A host defense event probably triggered.',
    keywords: ['production', 'drop', 'drought', 'beetle'],
    content: ['The most common cause is a host defense event like Drought or Beetle Disruption. Check the host analysis panel and the log.'],
  },
  {
    id: 'faq-host-complete',
    type: 'faq',
    section: 'faq',
    title: 'What happens when I complete a host?',
    summary: 'You can advance to the next stage.',
    keywords: ['host complete', 'advance stage'],
    content: ['When a host reaches zero health, that stage is complete. Use the stage advance control to move to the next host.'],
  },
  {
    id: 'faq-system-logs',
    type: 'faq',
    section: 'faq',
    title: 'What does SYSTEM LOGS do?',
    summary: 'It toggles the observation log footer.',
    keywords: ['system logs', 'observation log'],
    content: ['SYSTEM LOGS shows or hides the observation log panel. On desktop it appears as a footer row at the bottom of the terminal view. On mobile it opens a collapsible card below the hero section. Both display the last 12 log entries with a typewriter effect.'],
  },
  {
    id: 'faq-mutation-points',
    type: 'faq',
    section: 'faq',
    title: 'Why do I have no mutation points left?',
    summary: 'Mutation points are spent permanently for the current run.',
    keywords: ['mutation points', 'spent'],
    content: ['Mutation points are consumed when you raise Virulence, Resilience, or Complexity. They are not refunded until a future prestige reset.'],
  },
]
