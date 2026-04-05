<script lang="ts">
  export let value = ''
  export let prompt = '>'
  export let label = ''
</script>

<div class="prompt-field">
  {#if label}
    <span class="prompt-field__label">{label}</span>
  {/if}
  <div class="prompt-field__shell">
    <span class="prompt-field__prompt">{prompt}</span>
    <span class="prompt-field__value">{value}</span>
    <span class="prompt-field__cursor" aria-hidden="true">█</span>
  </div>
</div>
