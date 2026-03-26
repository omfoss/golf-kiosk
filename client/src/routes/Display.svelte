<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { connectSocket, setActiveCourseId } from '../lib/socket.js';
  import {
    teetimes, weather, courseStatus, announcements, contactInfo, crew,
    cafeMenu, clubInfo, screenConfig, connectionStatus, courseName
  } from '../store.js';

  import TeeTimes      from '../modules/TeeTimes.svelte';
  import Weather       from '../modules/Weather.svelte';
  import CourseStatus  from '../modules/CourseStatus.svelte';
  import Announcements from '../modules/Announcements.svelte';
  import SlopeTable    from '../modules/SlopeTable.svelte';

  export let screenId = 'lobby';

  // Automatisk skalering – designet for 1920x1080, skalerer opp/ned
  let scale = 1;
  function updateScale() {
    const scaleX = window.innerWidth / 1920;
    const scaleY = window.innerHeight / 1080;
    scale = Math.min(scaleX, scaleY);
  }
  onMount(() => {
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  });

  // Klokke
  let now = new Date();
  setInterval(() => { now = new Date(); }, 1000);

  const DAYS   = ['søndag','mandag','tirsdag','onsdag','torsdag','fredag','lørdag'];
  const MONTHS = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des'];
  $: clockTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  $: clockDate = `${DAYS[now.getDay()]} ${now.getDate()}. ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  // Logo
  const LOGO_URL = 'https://kongsvingergolf.no/wp-content/uploads/2022/05/Konsvinger-Golfklubb_logo.png';

  // Modul-komponent-kart
  const MODULE_COMPONENTS = {
    'tee-times':      TeeTimes,
    'weather':        Weather,
    'course-status':  CourseStatus,
    'announcements':  Announcements,
    'slope-table':    SlopeTable,
  };

  // Dynamisk kolonne-layout fra skjermkonfig
  // Fallback: legacy flat modules-liste → én kolonne per modul
  $: columns = $screenConfig?.columns
    || ($screenConfig?.modules
      ? [$screenConfig.modules]
      : [['tee-times'], ['announcements'], ['weather', 'course-status', 'slope-table']]
    );

  onMount(async () => {
    // Koble til Socket.io
    connectSocket(screenId);

    // Hent skjermkonfig + sett aktiv bane for socket-filtrering
    let courseId = null;
    try {
      const cfg = await api.getScreen(screenId);
      screenConfig.set(cfg);
      courseId = cfg.courseId || null;
      if (courseId) setActiveCourseId(courseId);

      // Hent bane-navn for display
      try {
        const courses = await api.getCourses();
        const course = courses.find(c => c.id === courseId);
        if (course) courseName.set(course.name);
      } catch {}
    } catch {
      // Bruk default
    }

    // Initial datahenting parallelt
    const [tt, wx, cs, ann, cafe, club, ci] = await Promise.allSettled([
      api.getTeetimes(courseId),
      api.getWeather(),
      api.getContent('course_status'),
      api.getContent('announcements'),
      api.getContent('cafe_menu'),
      api.getContent('club_info'),
      api.getContent('contact_info'),
    ]);

    if (tt.status === 'fulfilled')   teetimes.set(tt.value);
    if (wx.status === 'fulfilled')   weather.set(wx.value);
    if (cs.status === 'fulfilled')   courseStatus.set(cs.value);
    if (ann.status === 'fulfilled')  announcements.set(ann.value);
    if (cafe.status === 'fulfilled') cafeMenu.set(cafe.value);
    if (club.status === 'fulfilled') clubInfo.set(club.value);
    if (ci.status === 'fulfilled')   contactInfo.set(ci.value);

    // Hent crew-data
    try {
      const crewData = await api.getContent('crew');
      if (crewData) crew.set(crewData);
    } catch {}

  });
</script>

<div class="screen-wrapper" style="background:#1c2e20">
<div class="screen" style="transform:scale({scale});transform-origin:top left;width:1920px;height:1080px">
  <!-- ── Header ─────────────────────────────────────────────────────── -->
  <header>
    <div class="club-info">
      <img class="logo" src={LOGO_URL} alt="Kongsvingers Golfklubb logo" />
      <div class="club-text">
        <div class="club-name">Kongsvingers Golfklubb</div>
        <div class="club-sub">
          Par {$clubInfo.par} · {$clubInfo.holes} hull · Slope {$clubInfo.slope} · CR {$clubInfo.rating}
        </div>
      </div>
    </div>

    <div class="header-right">
      <div class="clock">{clockTime}</div>
      <div class="date">{clockDate}</div>
      <div class="conn-status" class:conn-ok={$connectionStatus === 'connected'} class:conn-err={$connectionStatus === 'disconnected'}>
        {#if $connectionStatus === 'connected'}
          ● Live
        {:else if $connectionStatus === 'disconnected'}
          ○ Frakoblet
        {:else}
          ○ Kobler til…
        {/if}
      </div>
    </div>
  </header>

  <!-- ── Innhold (dynamisk antall kolonner) ─────────────────────── -->
  <main class="cols-{columns.length}">
    {#each columns as colModules, i}
      <div class="col" class:col-first={i === 0}>
        {#each colModules as modId}
          {#if MODULE_COMPONENTS[modId]}
            <div class="col-module">
              <svelte:component this={MODULE_COMPONENTS[modId]} />
            </div>
          {/if}
        {/each}
      </div>
    {/each}
  </main>
</div>
</div>

<style>
  .screen-wrapper {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }

  .screen {
    display: flex;
    flex-direction: column;
    width: 1920px;
    height: 1080px;
    background: #1c2e20;
    color: #f0f5f1;
    padding: 20px 36px 12px;
    gap: 12px;
    overflow: hidden;
    box-sizing: border-box;
  }

  /* ── Header ── */
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    gap: 20px;
  }

  .club-info {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .logo {
    height: 56px;
    width: auto;
    object-fit: contain;
    /* Vis logoen naturlig – ingen filter */
  }

  .club-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .club-name {
    font-family: 'EB Garamond', serif;
    font-size: 2rem;
    line-height: 1;
    color: #ffffff;
    letter-spacing: -0.01em;
  }

  .club-sub {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.8rem;
    font-weight: 400;
    color: #a0c4a4;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .header-right {
    text-align: right;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }

  .clock {
    font-family: 'DM Sans', sans-serif;
    font-size: 3rem;
    font-weight: 600;
    color: #ffffff;
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .date {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.85rem;
    color: #a0c4a4;
  }

  .conn-status {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.7rem;
    color: #5a8a5e;
    letter-spacing: 0.05em;
  }
  .conn-ok  { color: #4ae064; }
  .conn-err { color: #e05252; }

  /* ── Innhold (dynamisk kolonner) ── */
  main {
    display: flex;
    gap: 20px;
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  .col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    overflow: hidden;
  }

  /* Første kolonne får litt mer plass når det er 2+ kolonner */
  .cols-2 .col-first { flex: 3; }
  .cols-2 .col:not(.col-first) { flex: 2; }

  /* 3 kolonner: tee-times (bred) | info+vær+bane (medium) | slope (smal) */
  .cols-3 .col:nth-child(1) { flex: 4; }
  .cols-3 .col:nth-child(2) { flex: 3; }
  .cols-3 .col:nth-child(3) { flex: 2; }

  .col-module {
    flex-shrink: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* Gjør ALLE section-labels større og tydeligere */
  .screen :global(.section-label) {
    font-size: 0.85rem !important;
    color: #8fb892 !important;
    font-weight: 700 !important;
  }
</style>
