<script>
  import { teetimes, clubInfo, courseName } from '../store.js';

  function toMins(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  let nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  setInterval(() => {
    nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  }, 10_000);

  // ── Beregn prev / current / upcoming ──────────────────────────────
  let prev     = [];
  let current  = null;
  let upcoming = [];

  $: {
    const all = $teetimes.times || [];
    // Non-blocked slots for prev/current-beregning
    const slots = all.filter(t => t.status !== 'blocked');

    // Finn siste slot med tid <= nowMins (= "nåværende")
    let currentIdx = -1;
    for (let i = 0; i < slots.length; i++) {
      if (toMins(slots[i].time) <= nowMins) currentIdx = i;
      else break;
    }

    if (currentIdx < 0) {
      // Ingen har startet ennå – vis bare kommende
      prev    = [];
      current = null;
      upcoming = all.filter(t => t.status !== 'blocked').slice(0, 20);
    } else {
      prev    = slots.slice(Math.max(0, currentIdx - 3), currentIdx);
      current = slots[currentIdx];
      // Kommende: alle slots (inkl. blocked) etter nåværende tid
      const afterTime = toMins(current.time);
      upcoming = all
        .filter(t => toMins(t.time) > afterTime)
        .slice(0, 18);
    }
  }
</script>

<section class="teetimes">
  <div class="section-header">
    <span class="section-label">{$courseName ? `Starttider – ${$courseName}` : 'Starttider'}</span>
    {#if $teetimes.sessionExpired}
      <span class="badge badge-warn">Session utløpt</span>
    {:else if $teetimes.isDemo}
      <span class="badge badge-demo">● Demo</span>
    {:else if $teetimes.isMock}
      <span class="badge badge-mock">Eksempeldata</span>
    {:else}
      <span class="badge badge-live">● Live</span>
    {/if}
  </div>

  <div class="rows">
    {#if prev.length === 0 && !current && upcoming.length === 0}
      <div class="empty">Ingen starttider</div>

    {:else}
      <!-- ── Forrige baller (dempet) ── -->
      {#each prev as entry, i}
        {@const opacity = 0.22 + (i / prev.length) * 0.28}
        <div class="row row-past" style="opacity:{opacity}">
          <div class="col-time">
            <span class="dot-spacer"></span>
            <span class="time">{entry.time}</span>
          </div>
          <div class="col-players">
            {#if !entry.players?.length}
              <span class="label-free">Ledig</span>
            {:else}
              {#each entry.players as p}
                <span class="player">{typeof p === 'string' ? p : p.name}{#if p?.hcp != null}<span class="hcp">({p.hcp})</span>{/if}</span>
              {/each}
            {/if}
          </div>
          <div class="col-count">
            {#if entry.players?.length > 1}
              <span class="flight-count">{entry.players.length}</span>
            {/if}
          </div>
          <div class="col-status">
            {#if entry.players?.length}
              <span class="status-badge status-past">Ute ✓</span>
            {/if}
          </div>
        </div>
      {/each}

      <!-- Skillelinje mellom forrige og nåværende -->
      {#if prev.length > 0 && current}
        <div class="divider"></div>
      {/if}

      <!-- ── Nåværende ball (highlight) ── -->
      {#if current}
        <div class="row row-now">
          <div class="col-time">
            <span class="now-dot"></span>
            <span class="time">{current.time}</span>
          </div>
          <div class="col-players">
            {#if !current.players?.length}
              <span class="label-free">Ledig</span>
            {:else}
              {#each current.players as p}
                <span class="player">{typeof p === 'string' ? p : p.name}{#if p?.hcp != null}<span class="hcp">({p.hcp})</span>{/if}</span>
              {/each}
            {/if}
          </div>
          <div class="col-count">
            {#if current.players?.length > 1}
              <span class="flight-count">{current.players.length}</span>
            {/if}
          </div>
          <div class="col-status">
            {#if current.players?.length}
              <span class="status-badge">Ute nå</span>
            {:else}
              <span class="status-badge status-free">Ledig</span>
            {/if}
          </div>
        </div>

        <!-- Skillelinje mellom nåværende og kommende -->
        {#if upcoming.length > 0}
          <div class="divider"></div>
        {/if}
      {/if}

      <!-- ── Kommende baller ── -->
      {#each upcoming as entry, idx}
        {@const isBlocked = entry.status === 'blocked'}
        {@const isFree    = entry.status === 'free'}
        <div class="row"
          class:row-blocked={isBlocked}
          class:row-free={isFree}
          style="animation-delay:{idx * 0.04}s"
        >
          <div class="col-time">
            <span class="dot-spacer"></span>
            <span class="time">{isBlocked ? '—' : entry.time}</span>
          </div>

          <div class="col-players">
            {#if isBlocked}
              <span class="label-blocked">{entry.blockLabel || 'Blokkert'}</span>
            {:else if !entry.players?.length}
              <span class="label-free">Ledig</span>
            {:else}
              {#each entry.players as p}
                <span class="player">{typeof p === 'string' ? p : p.name}{#if p?.hcp != null}<span class="hcp">({p.hcp})</span>{/if}</span>
              {/each}
            {/if}
          </div>

          <div class="col-count">
            {#if !isBlocked && entry.players?.length > 1}
              <span class="flight-count">{entry.players.length}</span>
            {/if}
          </div>

          <div class="col-status">
            {#if !isBlocked && entry.status === 'full'}
              <span class="status-badge">Booket</span>
            {:else if isFree}
              <span class="status-badge status-free">Ledig</span>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</section>

<style>
  .teetimes {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 10px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .section-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #6a9a6e;
  }

  .badge {
    font-size: 0.7rem;
    padding: 2px 8px;
    border-radius: 20px;
    font-family: 'DM Mono', monospace;
    letter-spacing: 0.05em;
  }
  .badge-live  { background: #1a3d1e; color: #3ddc57; border: 1px solid #2d7a3a; }
  .badge-mock  { background: #3d2e0a; color: #c9a84c; border: 1px solid #c9a84c60; }
  .badge-demo  { background: #1a2a3d; color: #7ab4e8; border: 1px solid #3a6a9a60; }
  .badge-warn  { background: #3d0a0a; color: #e05252; border: 1px solid #e0525260; }

  /* ── Rows ── */
  .rows {
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex: 1;
    overflow: hidden;
  }

  .empty {
    color: #6a9a6e;
    font-family: 'DM Sans', sans-serif;
    font-size: 1rem;
    font-style: italic;
    margin-top: 40px;
    text-align: center;
  }

  /* ── Skillelinje ── */
  .divider {
    height: 1px;
    background: linear-gradient(to right, transparent, #4a9a5460, transparent);
    margin: 3px 0;
    flex-shrink: 0;
  }

  /* ── Rad-base ── */
  .row {
    display: grid;
    grid-template-columns: 90px 1fr 35px auto;
    align-items: center;
    gap: 10px;
    padding: 6px 14px;
    border-radius: 8px;
    background: #243828;
    border: 1px solid #355a3a;
    animation: slidein 0.35s ease both;
    flex-shrink: 0;
  }

  /* Forrige baller – ingen border, transparent bg */
  .row-past {
    background: transparent;
    border-color: transparent;
    padding: 5px 18px;
    animation: none;
  }

  /* Nåværende ball – grønn highlight */
  .row-now {
    background: #243e2a;
    border-color: #4a9a54;
    box-shadow: 0 0 18px 0 #3ddc5718;
  }

  .row-blocked {
    opacity: 0.4;
    background: transparent;
    border-color: transparent;
    padding: 5px 18px;
  }

  .row-free {
    background: #1e3424;
    border-color: #2d4a32;
  }

  @keyframes slidein {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Tid ── */
  .col-time {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .now-dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: #3ddc57;
    box-shadow: 0 0 8px 2px #3ddc57;
    flex-shrink: 0;
    animation: pulse 1.6s ease-in-out infinite;
  }

  .dot-spacer {
    width: 11px;
    flex-shrink: 0;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.5; transform: scale(0.8); }
  }

  .time {
    font-family: 'DM Sans', sans-serif;
    font-size: 1.45rem;
    font-weight: 600;
    color: #f0f5f1;
    letter-spacing: -0.01em;
  }

  .row-now .time { color: #3ddc57; }
  .row-past .time { font-size: 1.2rem; color: #d8e8db; font-weight: 400; }

  /* ── Spillere ── */
  .col-players {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px 14px;
  }

  .player {
    font-family: 'DM Sans', sans-serif;
    font-size: 1.15rem;
    font-weight: 400;
    color: #f0f5f1;
    white-space: nowrap;
  }

  .row-past .player { font-size: 1rem; color: #d8e8db; }

  .hcp {
    font-size: 0.75em;
    color: #7ab4a0;
    margin-left: 3px;
    font-weight: 300;
  }

  .col-count {
    text-align: center;
  }

  .flight-count {
    font-family: 'DM Sans', sans-serif;
    font-size: 1.4rem;
    font-weight: 600;
    color: #a0c4a4;
  }

  .row-now .flight-count { color: #3ddc57; }
  .row-past .flight-count { font-size: 1.1rem; color: #c8dccb; }

  /* player-count fjernet – erstattet av flight-count i egen kolonne */

  .label-free {
    font-family: 'DM Sans', sans-serif;
    font-size: 1.05rem;
    font-weight: 300;
    color: #6a9a6e;
    font-style: italic;
  }

  .label-blocked {
    font-family: 'DM Sans', sans-serif;
    font-size: 1rem;
    color: #6a9a6e;
    font-style: italic;
  }

  /* ── Status ── */
  .status-badge {
    font-family: 'DM Mono', monospace;
    font-size: 0.72rem;
    font-weight: 500;
    color: #c9a84c;
    background: #c9a84c12;
    border: 1px solid #c9a84c30;
    padding: 3px 10px;
    border-radius: 20px;
    white-space: nowrap;
  }

  .row-now .status-badge {
    color: #3ddc57;
    background: #3ddc5712;
    border-color: #3ddc5730;
  }

  .status-free {
    color: #486747;
    background: #48674712;
    border-color: #48674730;
  }

  .status-past {
    color: #6a9a6e;
    background: transparent;
    border-color: #6a9a6e30;
    font-size: 0.65rem;
  }
</style>
