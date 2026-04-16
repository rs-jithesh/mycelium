<script lang="ts">
  export let text: string
  export let label = 'Show info'
  export let mode: 'click' | 'hover' = 'click'

  let open = false

  function toggle() {
    open = !open
  }

  function close() {
    open = false
  }

  function onMouseEnter() {
    if (mode === 'hover') open = true
  }

  function onMouseLeave() {
    if (mode === 'hover') open = false
  }
</script>

<div
  class="info-tip"
  role="group"
  on:mouseleave={mode === 'hover' ? close : undefined}
  on:mouseenter={onMouseEnter}
>
  <button
    class="info-tip__button"
    type="button"
    aria-label={label}
    aria-expanded={open}
    on:click={mode === 'click' ? toggle : undefined}
    on:blur={close}
  >
    i
  </button>

  {#if open}
    <div class="info-tip__popup" role="tooltip">
      {text}
    </div>
  {/if}
</div>