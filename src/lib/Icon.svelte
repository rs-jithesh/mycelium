<script lang="ts">
  export let name:
    | 'hyphae-strand'
    | 'mycelial-mat'
    | 'rhizomorph-cord'
    | 'sporocarp-cluster'
    | 'fruiting-canopy'
    | 'decomposer-bloom'
    | 'subterranean-nexus'
    | 'planetary-membrane'
    | 'chitinous-reinforcement'
    | 'exoenzyme-secretion'
    | 'lateral-transfer'

  export let label = ''

  const paths = {
    'hyphae-strand': [
      'M6 18C9 13 10 11 12 6',
      'M12 6C13 10 15 13 18 18',
      'M10 11H14',
    ],
    'mycelial-mat': [
      'M5 8H19',
      'M7 12H17',
      'M5 16H19',
      'M8 6V18',
      'M12 5V19',
      'M16 6V18',
    ],
    'rhizomorph-cord': [
      'M7 19C8 14 9 10 12 5',
      'M12 5C15 10 16 14 17 19',
      'M9 15C10.5 13.5 13.5 13.5 15 15',
    ],
    'sporocarp-cluster': [
      'M6 11C6.5 8.5 9 7 11 7C13 7 15.5 8.5 16 11Z',
      'M13 9C13.5 6.8 15.2 5.5 17 5.5C18.8 5.5 20.5 6.8 21 9Z',
      'M9 11V18',
      'M13.5 11V18',
      'M17 9V18',
    ],
    'fruiting-canopy': [
      'M4 10C6 6 9 4 12 4C15 4 18 6 20 10',
      'M6 10C7 8 9 6.5 12 6.5C15 6.5 17 8 18 10',
      'M8 10V19',
      'M12 7V19',
      'M16 10V19',
      'M5 15H19',
    ],
    'decomposer-bloom': [
      'M12 4C8 4 5 7 5 11C5 15 8 18 12 20C16 18 19 15 19 11C19 7 16 4 12 4Z',
      'M12 8V14',
      'M9 10L12 8L15 10',
      'M9 14L12 16L15 14',
      'M7 12H17',
    ],
    'subterranean-nexus': [
      'M4 14C6 10 9 8 12 6C15 8 18 10 20 14',
      'M4 14C7 17 9.5 19 12 20C14.5 19 17 17 20 14',
      'M8 11V17',
      'M12 8V18',
      'M16 11V17',
      'M6 13H18',
    ],
    'planetary-membrane': [
      'M12 3C7 3 3 7.5 3 12C3 16.5 7 21 12 21C17 21 21 16.5 21 12C21 7.5 17 3 12 3Z',
      'M3 12H21',
      'M12 3C9.5 6 8 9 8 12C8 15 9.5 18 12 21',
      'M12 3C14.5 6 16 9 16 12C16 15 14.5 18 12 21',
      'M5 7H19',
      'M5 17H19',
    ],
    'chitinous-reinforcement': [
      'M12 4L18 7V11C18 15 15.5 18 12 20C8.5 18 6 15 6 11V7Z',
      'M9 11L11 13L15 9',
    ],
    'exoenzyme-secretion': [
      'M12 4C15.5 8 17 10 17 13C17 16.5 14.5 19 12 20C9.5 19 7 16.5 7 13C7 10 8.5 8 12 4Z',
      'M10 13C10 11.5 11 10 12 9C13 10 14 11.5 14 13C14 14.5 13 16 12 17C11 16 10 14.5 10 13Z',
    ],
    'lateral-transfer': [
      'M5 12H19',
      'M15 8L19 12L15 16',
      'M9 8L5 12L9 16',
    ],
  } as const
</script>

<svg
  class="terminal-icon"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.5"
  stroke-linecap="round"
  stroke-linejoin="round"
  role="img"
  aria-label={label || name}
>
  {#each paths[name] as path}
    <path d={path}></path>
  {/each}
</svg>
