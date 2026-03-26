<script>
  import { onMount } from 'svelte';
  import Display from './routes/Display.svelte';
  import Admin from './routes/Admin.svelte';

  // Enkel path-basert ruting
  let path = window.location.pathname;

  $: isAdmin    = path === '/admin' || path.startsWith('/admin/');
  $: displayMatch = path.match(/^\/display\/([^/]+)/);
  $: screenId   = displayMatch ? displayMatch[1] : null;

  // Omdiriger rotruta til default skjerm
  onMount(() => {
    if (path === '/' || path === '') {
      window.location.replace('/display/lobby');
    }
  });
</script>

{#if isAdmin}
  <Admin />
{:else if screenId}
  <Display {screenId} />
{:else}
  <div class="redirect">
    <p>Videresender…</p>
  </div>
{/if}

<style>
  .redirect {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: #080f09;
    color: #3d5c40;
    font-family: 'DM Mono', monospace;
    font-size: 1rem;
  }
</style>
