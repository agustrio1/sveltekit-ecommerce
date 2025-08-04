<script lang="ts">
  import { AlertCircle, CheckCircle } from 'lucide-svelte';

  export let errorMessage = '';
  export let successMessage = '';
  export let onClearError = () => {};
  export let onClearSuccess = () => {};
</script>

{#if errorMessage}
  <div class="alert alert-error">
    <AlertCircle size={20} />
    <span>{errorMessage}</span>
    <button on:click={onClearError}>×</button>
  </div>
{/if}

{#if successMessage}
  <div class="alert alert-success">
    <CheckCircle size={20} />
    <span>{successMessage}</span>
    <button on:click={onClearSuccess}>×</button>
  </div>
{/if}