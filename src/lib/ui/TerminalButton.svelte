<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  export let variant: 'primary' | 'secondary' | 'tertiary' = 'primary'
  export let disabled = false
  export let type: 'button' | 'submit' | 'reset' = 'button'
  export let compact = false
  export let active = false
  export let progress = 0

  const dispatch = createEventDispatcher<{ click: MouseEvent }>()

  function handleClick(event: MouseEvent) {
    dispatch('click', event)
  }
</script>

<button
  class={`terminal-button terminal-button--${variant} ${compact ? 'terminal-chip' : ''} ${active ? 'terminal-chip--active' : ''}`.trim()}
  style={`--button-progress: ${Math.max(0, Math.min(100, progress))}%`}
  {disabled}
  {type}
  on:click={handleClick}
>
  <span class="terminal-button__progress" aria-hidden="true"></span>
  <span class="terminal-button__label"><slot></slot></span>
</button>
