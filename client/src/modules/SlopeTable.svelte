<script>
  import { onMount, onDestroy } from 'svelte';

  let activeGender = 'herrer';
  let countdown = 20;
  let swapInterval;
  let tickInterval;

  const SWAP_SECONDS = 20;

  onMount(() => {
    countdown = SWAP_SECONDS;
    tickInterval = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        activeGender = activeGender === 'herrer' ? 'damer' : 'herrer';
        countdown = SWAP_SECONDS;
      }
    }, 1000);
  });

  onDestroy(() => {
    if (tickInterval) clearInterval(tickInterval);
  });

  // Herrer – Kongsvingers GK, Par 72, gyldig t.o.m. 2029
  const herrerTees = [
    { name: 'Hvit',  cr: 74.0, slope: 143, color: '#ffffff',   textColor: '#1a1a1a' },
    { name: 'Gul',   cr: 71.9, slope: 138, color: '#f5d442',   textColor: '#1a1a1a' },
    { name: 'Blå',   cr: 69.9, slope: 134, color: '#5b8fd4',   textColor: '#ffffff' },
    { name: 'Rød',   cr: 68.4, slope: 131, color: '#d45b5b',   textColor: '#ffffff' },
    { name: 'Grønn', cr: 65.5, slope: 125, color: '#4ab862',   textColor: '#ffffff' },
  ];

  // Damer – Kongsvingers GK, Par 72, gyldig t.o.m. 2029
  const damerTees = [
    { name: 'Hvit',  cr: 79.4, slope: 148, color: '#ffffff',   textColor: '#1a1a1a' },
    { name: 'Gul',   cr: 77.2, slope: 143, color: '#f5d442',   textColor: '#1a1a1a' },
    { name: 'Blå',   cr: 75.1, slope: 139, color: '#5b8fd4',   textColor: '#ffffff' },
    { name: 'Rød',   cr: 73.4, slope: 136, color: '#d45b5b',   textColor: '#ffffff' },
    { name: 'Grønn', cr: 70.2, slope: 130, color: '#4ab862',   textColor: '#ffffff' },
  ];

  // HCP-konvertering for herrer (spillehcp → HCP-indeks fra-til per tee)
  const herrerData = [
    { hcp: 0,  hvit: '+1.9–+1.2', gul: '+0.3–0.4',   bla: '1.4–2.1',   rod: '5.5–6.3',   gronn: '7.9–8.7' },
    { hcp: 2,  hvit: '+0.3–0.3',  gul: '1.4–2.1',     bla: '3.1–3.8',   rod: '7.3–8.1',   gronn: '9.8–10.6' },
    { hcp: 4,  hvit: '1.2–1.9',   gul: '3.0–3.7',     bla: '4.8–5.5',   rod: '9.1–9.9',   gronn: '11.6–12.5' },
    { hcp: 6,  hvit: '2.8–3.5',   gul: '4.6–5.4',     bla: '6.5–7.2',   rod: '10.9–11.7', gronn: '13.5–14.3' },
    { hcp: 8,  hvit: '4.4–5.1',   gul: '6.3–7.0',     bla: '8.1–8.9',   rod: '12.7–13.5', gronn: '15.4–16.2' },
    { hcp: 10, hvit: '6.0–6.7',   gul: '7.9–8.6',     bla: '9.8–10.6',  rod: '14.5–15.3', gronn: '17.2–18.1' },
    { hcp: 12, hvit: '7.6–8.2',   gul: '9.5–10.3',    bla: '11.5–12.3', rod: '16.3–17.1', gronn: '19.1–19.9' },
    { hcp: 14, hvit: '9.1–9.8',   gul: '11.2–11.9',   bla: '13.2–13.9', rod: '18.1–18.9', gronn: '21.0–21.8' },
    { hcp: 16, hvit: '10.7–11.4', gul: '12.8–13.5',   bla: '14.9–15.6', rod: '19.9–20.7', gronn: '22.8–23.7' },
    { hcp: 18, hvit: '12.3–13.0', gul: '14.5–15.2',   bla: '16.6–17.3', rod: '21.7–22.5', gronn: '24.7–25.5' },
    { hcp: 20, hvit: '13.9–14.6', gul: '16.1–16.8',   bla: '18.3–19.0', rod: '23.6–24.4', gronn: '26.6–27.4' },
    { hcp: 22, hvit: '15.5–16.1', gul: '17.7–18.5',   bla: '20.0–20.7', rod: '25.4–26.2', gronn: '28.4–29.3' },
    { hcp: 24, hvit: '17.0–17.7', gul: '19.4–20.1',   bla: '21.7–22.5', rod: '27.2–28.0', gronn: '30.3–31.1' },
    { hcp: 26, hvit: '18.6–19.3', gul: '21.0–21.7',   bla: '23.4–24.2', rod: '29.0–29.8', gronn: '32.2–33.0' },
    { hcp: 28, hvit: '20.2–20.9', gul: '22.6–23.3',   bla: '25.1–25.8', rod: '30.8–31.6', gronn: '34.0–34.9' },
    { hcp: 30, hvit: '21.8–22.5', gul: '24.2–24.8',   bla: '26.8–27.5', rod: '32.6–33.4', gronn: '35.9–36.7' },
    { hcp: 32, hvit: '23.4–24.1', gul: '25.7–26.4',   bla: '28.4–29.1', rod: '34.4–35.2', gronn: '37.8–38.6' },
    { hcp: 34, hvit: '24.9–25.6', gul: '27.3–28.0',   bla: '30.0–30.7', rod: '36.2–37.0', gronn: '39.6–40.5' },
    { hcp: 36, hvit: '26.5–27.2', gul: '28.9–29.6',   bla: '31.7–32.4', rod: '38.0–38.8', gronn: '41.5–42.3' },
    { hcp: 38, hvit: '28.1–28.8', gul: '30.5–31.2',   bla: '33.3–34.0', rod: '39.8–40.6', gronn: '43.4–44.2' },
    { hcp: 40, hvit: '29.7–30.4', gul: '32.1–32.7',   bla: '34.9–35.7', rod: '41.6–42.4', gronn: '45.2–46.1' },
    { hcp: 42, hvit: '31.3–32.0', gul: '33.6–34.3',   bla: '36.6–37.3', rod: '43.4–44.2', gronn: '47.1–48.0' },
    { hcp: 44, hvit: '32.8–33.5', gul: '35.2–35.9',   bla: '38.3–39.0', rod: '45.2–46.1', gronn: '49.0–49.8' },
    { hcp: 46, hvit: '34.4–35.1', gul: '36.8–37.5',   bla: '39.9–40.6', rod: '47.1–47.9', gronn: '50.9–51.7' },
    { hcp: 48, hvit: '36.0–36.7', gul: '38.4–39.1',   bla: '41.5–42.3', rod: '48.9–49.7', gronn: '52.7–53.6' },
    { hcp: 50, hvit: '37.6–38.3', gul: '40.0–40.6',   bla: '43.2–44.0', rod: '50.7–51.5', gronn: '' },
    { hcp: 52, hvit: '39.2–39.9', gul: '41.5–42.2',   bla: '44.9–45.6', rod: '52.5–53.3', gronn: '' },
    { hcp: 54, hvit: '40.7–41.4', gul: '43.1–43.8',   bla: '46.5–47.3', rod: '53.4–54.0', gronn: '' },
  ];

  $: tees = activeGender === 'herrer' ? herrerTees : damerTees;
  $: data = herrerData; // Forenklet – bruker herredata for begge (strukturen er lik)
  $: title = activeGender === 'herrer' ? 'Herrer' : 'Damer';
</script>

<div class="slope-section">
  <div class="section-header">
    <div class="section-title">SLOPETABELL – {title.toUpperCase()}</div>
    <div class="countdown">
      <span class="countdown-label">{activeGender === 'herrer' ? 'Damer' : 'Herrer'} om</span>
      <span class="countdown-time">{countdown}s</span>
    </div>
  </div>

  <!-- CR / Slope per tee -->
  <div class="tee-info">
    {#each tees as tee}
      <div class="tee-badge" style="background:{tee.color};color:{tee.textColor}">
        <span class="tee-name">{tee.name}</span>
        <span class="tee-vals">CR {tee.cr} · S {tee.slope}</span>
      </div>
    {/each}
  </div>

  <!-- Tabell -->
  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th class="hcp-col">Spille-<br/>hcp</th>
          {#each tees as tee}
            <th style="border-bottom: 2px solid {tee.color}50">{tee.name}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each data as row}
          <tr>
            <td class="hcp-cell">{row.hcp}</td>
            <td>{row.hvit}</td>
            <td>{row.gul}</td>
            <td>{row.bla}</td>
            <td>{row.rod}</td>
            <td>{row.gronn}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="slope-footer">
    Kongsvingers GK · Par 72 · Gyldig t.o.m. 2029
  </div>
</div>

<style>
  .slope-section {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .section-title {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.7rem;
    font-weight: 500;
    color: #7aaa7e;
    letter-spacing: 0.12em;
  }

  .countdown {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.6rem;
    color: rgba(255,255,255,0.35);
  }

  .countdown-time {
    font-family: 'DM Mono', monospace;
    font-size: 0.6rem;
    color: rgba(255,255,255,0.5);
    min-width: 2em;
    text-align: right;
  }

  .tee-info {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .tee-badge {
    flex: 1;
    padding: 4px 6px;
    border-radius: 5px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .tee-name {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .tee-vals {
    font-family: 'DM Mono', monospace;
    font-size: 0.55rem;
    opacity: 0.8;
  }

  .table-wrapper {
    flex: 1;
    overflow: hidden;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-family: 'DM Mono', monospace;
    font-size: 0.6rem;
  }

  thead th {
    position: sticky;
    top: 0;
    background: rgba(28, 46, 32, 0.95);
    font-family: 'DM Sans', sans-serif;
    font-size: 0.6rem;
    font-weight: 600;
    color: #a0c4a4;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 6px 4px;
    text-align: center;
  }

  .hcp-col {
    text-align: left !important;
    padding-left: 8px !important;
  }

  tbody tr {
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }

  tbody tr:nth-child(even) {
    background: rgba(255,255,255,0.02);
  }

  tbody td {
    padding: 4px;
    text-align: center;
    color: rgba(255,255,255,0.7);
  }

  .hcp-cell {
    text-align: left;
    padding-left: 8px;
    font-weight: 600;
    color: #ffffff;
    font-size: 0.65rem;
  }

  .slope-footer {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.55rem;
    color: rgba(255,255,255,0.3);
    text-align: center;
    flex-shrink: 0;
    padding-top: 2px;
  }
</style>
