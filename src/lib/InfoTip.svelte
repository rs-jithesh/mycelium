<script lang="ts">
  export let text: string
  export let label = 'Show info'

  let open = false

  function toggle() {
    open = !open
  }

  function close() {
    open = false
  }
</script>

<div class="info-tip" role="group" on:mouseleave={close}>
  <button
    class="info-tip__button"
    type="button"
    aria-label={label}
    aria-expanded={open}
    on:click={toggle}
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
