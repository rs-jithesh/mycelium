<script lang="ts">
  export let title = ''
  export let tag = ''
  export let variant: 'high' | 'low' | 'lowest' = 'high'
  export let bleedHeader = false
  export let className = ''
  export let resizable = false
  export let resizeAxis: 'both' | 'horizontal' | 'vertical' = 'both'
</script>

<section
  class={`terminal-panel terminal-panel--${variant} ${resizable ? `terminal-panel--resizable terminal-panel--resize-${resizeAxis}` : ''} ${className}`.trim()}
>
  {#if title || tag}
    <header class:terminal-panel__header={true} class:terminal-panel__header--bleed={bleedHeader}>
      {#if tag}
        <p class="terminal-panel__tag">{tag}</p>
      {/if}
      {#if title}
        <h2 class="terminal-panel__title">{title}</h2>
      {/if}
      <slot name="header"></slot>
    </header>
  {/if}

  <div class="terminal-panel__body">
    <slot></slot>
  </div>
</section>
