<script>
  import { onMount } from 'svelte';
  import { adminApi, api, getToken, clearToken } from '../lib/api.js';

  // ── Auth ─────────────────────────────────────────────────────────────
  let password = '';
  let isLoggedIn = false;
  let loginError = '';
  let loginLoading = false;

  async function login() {
    loginLoading = true;
    loginError = '';
    try {
      await adminApi.login(password);
      isLoggedIn = true;
      password = ''; // Ikke lagre passordet
      await loadAll();
    } catch (err) {
      loginError = err.message === 'SESSION_EXPIRED' ? 'Sesjonen utløp. Prøv igjen.' : 'Feil passord. Prøv igjen.';
    } finally {
      loginLoading = false;
    }
  }

  function logout() {
    isLoggedIn = false;
    clearToken();
  }

  // ── Tab-navigasjon ────────────────────────────────────────────────────
  let activeTab = 'course';
  const tabs = [
    { id: 'course',        label: 'Banestatus' },
    { id: 'announcements', label: 'Informasjon' },
    { id: 'cafe',          label: 'Restaurant' },
    { id: 'golfbox',       label: 'Golfbox' },
    { id: 'images',        label: 'Bilder' },
    { id: 'screens',       label: 'Skjermer' },
  ];

  // ── Data ──────────────────────────────────────────────────────────────
  let courseStatus = { lastMow: '', stimp: '', greens: '', bunkers: '', notes: '', openStatus: 'open' };
  let announcements = [];
  let contactInfo = { text: '', phone: '' };
  let crewData = { members: [], message: '' };
  let cafeMenu = { specials: '', items: [], openHours: '' };
  let screens = [];
  let courses = [];

  let saving = false;
  let saveMsg = '';

  async function loadAll() {
    try {
      const [cs, ann, ci, cr, cafe, sc, co] = await Promise.allSettled([
        api.getContent('course_status'),
        api.getContent('announcements'),
        api.getContent('contact_info'),
        api.getContent('crew'),
        api.getContent('cafe_menu'),
        api.getAllScreens(),
        adminApi.getCourses(),
      ]);
      if (cs.status === 'fulfilled')   courseStatus  = { ...courseStatus, ...cs.value };
      if (ann.status === 'fulfilled')  announcements = ann.value || [];
      if (ci.status === 'fulfilled')   contactInfo   = { ...contactInfo, ...ci.value };
      if (cr.status === 'fulfilled')   crewData      = { ...crewData, ...cr.value };
      if (cafe.status === 'fulfilled') cafeMenu      = { ...cafeMenu, ...cafe.value };
      if (sc.status === 'fulfilled')   screens       = sc.value;
      if (co.status === 'fulfilled')   courses       = co.value;
    } catch (err) {
      console.error('Feil ved lasting:', err);
    }
    // Last Golfbox-status og credentials
    loadGolfboxCredentials();
    loadGolfboxStatus();
  }

  // Prøv gjenbruk av JWT-token fra session + last bildebibliotek
  onMount(async () => {
    loadImageLibrary();
    const token = getToken();
    if (token) {
      // Test om token fortsatt er gyldig
      try {
        await api.getAllScreens(); // Offentlig endepunkt, men vi sjekker også admin
        isLoggedIn = true;
        await loadAll();
      } catch {
        clearToken();
      }
    }
  });

  async function save(key, data) {
    saving = true;
    saveMsg = '';
    try {
      await adminApi.updateContent(key, data);
      saveMsg = '✓ Lagret';
      setTimeout(() => saveMsg = '', 3000);
    } catch (err) {
      saveMsg = `Feil: ${err.message}`;
    } finally {
      saving = false;
    }
  }

  // ── Kunngjøringer ─────────────────────────────────────────────────────
  function addAnnouncement() {
    const id = Date.now();
    announcements = [...announcements, {
      id, text: '', active: true,
      type: 'info', personName: '', personRole: '', personImage: '',
    }];
  }

  function removeAnnouncement(id) {
    announcements = announcements.filter(a => a.id !== id);
  }

  async function saveAnnouncements() {
    await save('announcements', announcements);
  }

  // ── Bildebibliotek (delt på tvers av alle faner) ────────────────────────
  let imageCategories = [];
  let imagesLoading = false;

  async function loadImageLibrary() {
    imagesLoading = true;
    try {
      const res = await fetch('/api/bilder');
      const data = await res.json();
      imageCategories = data.categories || [];
    } catch (err) {
      console.error('Feil ved henting av bilder:', err);
      imageCategories = [];
    } finally {
      imagesLoading = false;
    }
  }

  // ── Bildeopplasting (til server) ───────────────────────────────────────
  let uploading = false;

  async function uploadImageFile(file) {
    if (!file) return null;
    uploading = true;
    try {
      const { url } = await adminApi.uploadImage(file);
      await loadImageLibrary();
      return url;
    } catch (err) {
      alert(`Bildeopplasting feilet: ${err.message}`);
      return null;
    } finally {
      uploading = false;
    }
  }

  // ── Bildevelger-modal (gjenbrukbar) ────────────────────────────────────
  let imagePickerOpen = false;
  let imagePickerCallback = null;

  function openImagePicker(callback) {
    imagePickerCallback = callback;
    imagePickerOpen = true;
    loadImageLibrary(); // Refresh i tilfelle nye bilder
  }

  function selectImage(url) {
    if (imagePickerCallback) imagePickerCallback(url);
    imagePickerOpen = false;
    imagePickerCallback = null;
  }

  function closeImagePicker() {
    imagePickerOpen = false;
    imagePickerCallback = null;
  }

  // Hjelpefunksjon for å sette bilde på en announcement
  function pickImageForAnnouncement(annId) {
    openImagePicker(url => {
      announcements = announcements.map(a =>
        a.id === annId ? { ...a, personImage: url } : a
      );
    });
  }

  // Hjelpefunksjon for å sette bilde på et crew-medlem
  function pickImageForCrewMember(index) {
    openImagePicker(url => {
      crewData.members[index].image = url;
      crewData = { ...crewData };
    });
  }

  // ── Kantine-meny ──────────────────────────────────────────────────────
  function addCafeItem() {
    cafeMenu.items = [...(cafeMenu.items || []), { name: '', price: '' }];
  }

  function removeCafeItem(i) {
    cafeMenu.items = cafeMenu.items.filter((_, idx) => idx !== i);
  }

  // ── Golfbox ──────────────────────────────────────────────────────────
  let refreshing = false;
  let refreshMsg = '';
  let golfboxStatus = null;
  let golfboxLoading = false;
  let newCookie = '';
  let cookieSaving = false;
  let cookieMsg = '';

  async function refreshTeetimes() {
    refreshing = true;
    refreshMsg = '';
    try {
      const res = await adminApi.refreshTeetimes();
      refreshMsg = `✓ Oppdatert kl. ${new Date(res.fetchedAt).toLocaleTimeString('nb')}`;
      setTimeout(() => refreshMsg = '', 4000);
      await loadGolfboxStatus();
    } catch (err) {
      refreshMsg = `Feil: ${err.message}`;
    } finally {
      refreshing = false;
    }
  }

  async function loadGolfboxStatus() {
    golfboxLoading = true;
    try {
      golfboxStatus = await adminApi.getGolfboxStatus();
    } catch (err) {
      console.error('Golfbox status feilet:', err);
    } finally {
      golfboxLoading = false;
    }
  }

  async function saveCookie() {
    if (!newCookie.trim()) return;
    cookieSaving = true;
    cookieMsg = '';
    try {
      await adminApi.updateGolfboxCookie(newCookie.trim());
      cookieMsg = '✓ Cookie lagret';
      newCookie = '';
      setTimeout(() => cookieMsg = '', 4000);
      await loadGolfboxStatus();
    } catch (err) {
      cookieMsg = `Feil: ${err.message}`;
    } finally {
      cookieSaving = false;
    }
  }

  async function deleteCookie() {
    try {
      await adminApi.deleteGolfboxCookie();
      cookieMsg = '✓ Cookie slettet';
      setTimeout(() => cookieMsg = '', 4000);
      await loadGolfboxStatus();
    } catch (err) {
      cookieMsg = `Feil: ${err.message}`;
    }
  }

  // ── Golfbox credentials ─────────────────────────────────────────────────
  let gbUsername = '';
  let gbPassword = '';
  let gbCredentials = null;
  let gbSaving = false;
  let gbMsg = '';

  async function loadGolfboxCredentials() {
    try {
      gbCredentials = await adminApi.getGolfboxCredentials();
    } catch {}
  }

  async function saveGolfboxCredentials() {
    if (!gbUsername.trim() || !gbPassword.trim()) return;
    gbSaving = true;
    gbMsg = '';
    try {
      // Lagre credentials
      await adminApi.updateGolfboxCredentials(gbUsername.trim(), gbPassword.trim());
      gbMsg = '✓ Innlogging lagret. Logger inn…';

      // Prøv auto-login med nye credentials
      try {
        const res = await fetch('/api/admin/golfbox/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeadersFromToken() },
        });
        const data = await res.json();
        if (res.ok) {
          gbMsg = '✓ Innlogget i Golfbox! Starttider oppdatert.';
        } else {
          gbMsg = `⚠ Credentials lagret, men innlogging feilet: ${data.error}`;
        }
      } catch (loginErr) {
        gbMsg = `⚠ Credentials lagret, men innlogging feilet: ${loginErr.message}`;
      }

      gbPassword = '';
      setTimeout(() => gbMsg = '', 6000);
      await loadGolfboxCredentials();
      await loadGolfboxStatus();
    } catch (err) {
      gbMsg = `Feil: ${err.message}`;
    } finally {
      gbSaving = false;
    }
  }

  async function deleteGolfboxCredentials() {
    try {
      await fetch('/api/admin/golfbox/credentials', {
        method: 'DELETE',
        headers: authHeadersFromToken(),
      });
      gbCredentials = null;
      gbMsg = '✓ Innlogging fjernet';
      setTimeout(() => gbMsg = '', 4000);
    } catch (err) {
      gbMsg = `Feil: ${err.message}`;
    }
  }

  // Hjelper for auth-header fra token
  function authHeadersFromToken() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // ── Baner ─────────────────────────────────────────────────────────────
  let coursesSaving = false;
  let coursesMsg = '';

  // Forhåndsdefinerte baner i fast rekkefølge (vises alltid)
  const PREDEFINED_COURSE_IDS = ['sim1', 'sim2', 'utebane', 'demo'];

  $: predefinedCourses = PREDEFINED_COURSE_IDS
    .map(id => courses.find(c => c.id === id))
    .filter(Boolean);

  async function saveCourses() {
    coursesSaving = true;
    coursesMsg = '';
    try {
      for (const c of courses) {
        await adminApi.updateCourse(c.id, c);
      }
      coursesMsg = '✓ Baner lagret';
      setTimeout(() => coursesMsg = '', 3000);
    } catch (err) {
      coursesMsg = `Feil: ${err.message}`;
    } finally {
      coursesSaving = false;
    }
  }
</script>

<!-- ── Innlogging ───────────────────────────────────────────────────── -->
{#if !isLoggedIn}
  <div class="login-wrap">
    <div class="login-card">
      <img class="login-logo" src="https://kongsvingergolf.no/wp-content/uploads/2022/05/Konsvinger-Golfklubb_logo.png" alt="Logo" />
      <h1>Skjerm Admin</h1>
      <p class="login-sub">Kongsvingers Golfklubb</p>
      <form on:submit|preventDefault={login}>
        <label>
          Passord
          <input type="password" bind:value={password} placeholder="Skriv inn passord" autofocus />
        </label>
        {#if loginError}
          <p class="error">{loginError}</p>
        {/if}
        <button type="submit" disabled={loginLoading || !password}>
          {loginLoading ? 'Logger inn…' : 'Logg inn'}
        </button>
      </form>
    </div>
  </div>

<!-- ── Admin-panel ──────────────────────────────────────────────────── -->
{:else}
  <div class="admin">
    <header class="admin-header">
      <div class="admin-logo">
        <img src="https://kongsvingergolf.no/wp-content/uploads/2022/05/Konsvinger-Golfklubb_logo.png" alt="Logo" height="40" />
        <span>Skjerm Admin</span>
      </div>
      <div class="header-right">
        <div class="display-links">
          <a href="/display/lobby"      target="_blank" rel="noopener noreferrer">Tee off →</a>
          <a href="/display/restaurant" target="_blank" rel="noopener noreferrer">Restaurant →</a>
          <a href="/display/proshop"    target="_blank" rel="noopener noreferrer">Pro shop →</a>
        </div>
        <button class="btn-ghost" on:click={logout}>
          Logg ut
        </button>
      </div>
    </header>

    <div class="admin-body">
      <!-- Tabs -->
      <nav class="tabs">
        {#each tabs as tab}
          <button class="tab" class:tab-active={activeTab === tab.id} on:click={() => activeTab = tab.id}>
            {tab.label}
          </button>
        {/each}
      </nav>

      <div class="tab-content">

        <!-- ── Banestatus ── -->
        {#if activeTab === 'course'}
          <div class="section">
            <h2>Banestatus</h2>
            <div class="form-grid">
              <label>
                Banestatus
                <select bind:value={courseStatus.openStatus}>
                  <option value="open">Åpen</option>
                  <option value="limited">Begrenset</option>
                  <option value="closed">Stengt</option>
                </select>
              </label>
              <label>
                Siste klipp
                <input type="text" bind:value={courseStatus.lastMow} placeholder="f.eks. i går" />
              </label>
              <label>
                Stimpmeter
                <input type="text" bind:value={courseStatus.stimp} placeholder="f.eks. 10" />
              </label>
              <label>
                Greener
                <input type="text" bind:value={courseStatus.greens} placeholder="f.eks. Gode kondisjon" />
              </label>
              <label>
                Bunkere
                <input type="text" bind:value={courseStatus.bunkers} placeholder="f.eks. Tørre og fine" />
              </label>
            </div>
            <label class="full-width">
              Notater (vises på skjermen)
              <textarea bind:value={courseStatus.notes} rows="3" placeholder="Ekstra info til spillerne…"></textarea>
            </label>
            <div class="action-row">
              <button class="btn-primary" on:click={() => save('course_status', courseStatus)} disabled={saving}>
                {saving ? 'Lagrer…' : 'Lagre banestatus'}
              </button>
              {#if saveMsg}<span class="save-msg">{saveMsg}</span>{/if}
            </div>
          </div>

          <div class="section">
            <h2>Banemannskap</h2>
            <p class="help-text">Vises nederst i banestatus-boksen på skjermen. Legg til bilder og navn på banemannskapet.</p>

            <div class="crew-admin-list">
              {#each (crewData.members || []) as member, i}
                <div class="crew-admin-item">
                  {#if member.image}
                    <img class="crew-admin-photo" src={member.image} alt={member.name} />
                  {:else}
                    <div class="crew-admin-placeholder">📷</div>
                  {/if}
                  <input type="text" bind:value={member.name} placeholder="Navn" />
                  <button class="btn-upload" on:click={() => pickImageForCrewMember(i)}>📁 Velg bilde</button>
                  <button class="btn-remove" on:click={() => { crewData.members = crewData.members.filter((_, idx) => idx !== i); }}>✕</button>
                </div>
              {/each}
            </div>
            <button class="btn-ghost" on:click={() => { crewData.members = [...(crewData.members || []), { name: '', image: '' }]; }}>
              + Legg til person
            </button>

            <label class="full-width">
              Hilsen fra banemannskapet
              <textarea bind:value={crewData.message} rows="3" placeholder="Tekst som vises under bildene…"></textarea>
            </label>
            <div class="action-row">
              <button class="btn-primary" on:click={() => save('crew', crewData)} disabled={saving}>
                {saving ? 'Lagrer…' : 'Lagre banemannskap'}
              </button>
              {#if saveMsg}<span class="save-msg">{saveMsg}</span>{/if}
            </div>
          </div>

        <!-- ── Kunngjøringer ── -->
        {:else if activeTab === 'announcements'}
          <div class="section">
            <h2>Informasjon</h2>
            <p class="help-text">Roterer automatisk hvert 8. sekund på skjermen. Velg «Person» for å vise portrettbilde og hilsen fra en ansatt.</p>
            <div class="announcement-list">
              {#each announcements as ann}
                <div class="ann-card">

                  <!-- Topplinje: type-velger, aktiv-toggle, slett -->
                  <div class="ann-header">
                    <select bind:value={ann.type} class="ann-type-select">
                      <option value="info">📋 Informasjon</option>
                      <option value="person">👤 Person</option>
                    </select>
                    <label class="toggle">
                      <input type="checkbox" bind:checked={ann.active} />
                      Aktiv
                    </label>
                    <button class="btn-remove" on:click={() => removeAnnouncement(ann.id)}>✕</button>
                  </div>

                  <!-- Person-felt (kun synlig når type === 'person') -->
                  {#if ann.type === 'person'}
                    <div class="ann-person-fields">
                      <div class="ann-portrait-row">
                        <!-- Forhåndsvisning -->
                        {#if ann.personImage}
                          <img class="ann-portrait-preview" src={ann.personImage} alt="Portrett" />
                        {:else}
                          <div class="ann-portrait-placeholder">📷</div>
                        {/if}
                        <!-- Velg fra lokale bilder -->
                        <button class="btn-upload" on:click={() => pickImageForAnnouncement(ann.id)}>
                          📁 Velg bilde
                        </button>
                        <!-- Eller last opp ny -->
                        <label class="btn-upload btn-upload-alt">
                          {uploading ? 'Laster opp…' : '⬆ Last opp'}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            style="display:none"
                            on:change={async e => {
                              const url = await uploadImageFile(e.target.files[0]);
                              if (url) announcements = announcements.map(a => a.id === ann.id ? { ...a, personImage: url } : a);
                            }}
                            disabled={uploading}
                          />
                        </label>
                        {#if ann.personImage}
                          <button class="btn-ghost" style="font-size:0.8rem" on:click={() => { ann.personImage = ''; announcements = [...announcements]; }}>
                            Fjern
                          </button>
                        {/if}
                      </div>
                      <div class="ann-person-inputs">
                        <input type="text" bind:value={ann.personName} placeholder="Navn  (f.eks. Kari Nordmann)" />
                        <input type="text" bind:value={ann.personRole} placeholder="Rolle  (f.eks. Daglig leder)" />
                      </div>
                    </div>
                  {/if}

                  <!-- Tekstfelt -->
                  <textarea
                    bind:value={ann.text}
                    rows="2"
                    placeholder={ann.type === 'person' ? 'Personlig hilsen  (f.eks. Ha en fin runde!)' : 'Skriv melding…'}
                  ></textarea>

                </div>
              {/each}
            </div>
            <div class="action-row">
              <button class="btn-ghost" on:click={addAnnouncement}>+ Legg til melding</button>
              <button class="btn-primary" on:click={saveAnnouncements} disabled={saving}>
                {saving ? 'Lagrer…' : 'Lagre informasjon'}
              </button>
              {#if saveMsg}<span class="save-msg">{saveMsg}</span>{/if}
            </div>
          </div>

          <div class="section">
            <h2>Kontaktinfo</h2>
            <p class="help-text">Vises fast nederst i informasjonsboksen på alle skjermer.</p>
            <label class="full-width">
              Tekst
              <input type="text" bind:value={contactInfo.text} placeholder="f.eks. Ring oss i Pro-shopen hvis det er noe vi kan hjelpe deg med." />
            </label>
            <label class="full-width">
              Telefonnummer
              <input type="text" bind:value={contactInfo.phone} placeholder="f.eks. 99 999 999" />
            </label>
            <div class="action-row">
              <button class="btn-primary" on:click={() => save('contact_info', contactInfo)} disabled={saving}>
                {saving ? 'Lagrer…' : 'Lagre kontaktinfo'}
              </button>
              {#if saveMsg}<span class="save-msg">{saveMsg}</span>{/if}
            </div>
          </div>

        <!-- ── Kantine ── -->
        {:else if activeTab === 'cafe'}
          <div class="section">
            <h2>Restaurant</h2>
            <label class="full-width">
              Åpningstider
              <input type="text" bind:value={cafeMenu.openHours} placeholder="f.eks. 10:00 – 18:00" />
            </label>
            <label class="full-width">
              Dagens / ukens spesial
              <textarea bind:value={cafeMenu.specials} rows="2" placeholder="f.eks. Lunsjbuffet kr 149,-"></textarea>
            </label>
            <h3>Meny</h3>
            <div class="cafe-list">
              {#each (cafeMenu.items || []) as item, i}
                <div class="cafe-item">
                  <input type="text" bind:value={item.name}  placeholder="Matvare" />
                  <input type="text" bind:value={item.price} placeholder="Pris" style="max-width:100px" />
                  <button class="btn-remove" on:click={() => removeCafeItem(i)}>✕</button>
                </div>
              {/each}
            </div>
            <div class="action-row">
              <button class="btn-ghost" on:click={addCafeItem}>+ Legg til matvare</button>
              <button class="btn-primary" on:click={() => save('cafe_menu', cafeMenu)} disabled={saving}>
                {saving ? 'Lagrer…' : 'Lagre restaurantmenyen'}
              </button>
              {#if saveMsg}<span class="save-msg">{saveMsg}</span>{/if}
            </div>
          </div>

        <!-- ── Golfbox ── -->
        {:else if activeTab === 'golfbox'}

          <!-- Baner -->
          <div class="section">
            <h2>Baner</h2>
            <p class="help-text">Slå på banene du vil bruke. Legg inn Utebane-GUID når sesongen starter.</p>

            <div class="course-list">
              {#each predefinedCourses as course}
                <div class="course-card" class:course-active={course.active}>
                  <div class="course-card-main">
                    <span class="course-dot" class:dot-on={course.active}></span>
                    <span class="course-name">{course.name}</span>
                    {#if course.isDemo}
                      <span class="demo-tag">Demo-data</span>
                    {/if}
                    <div class="course-card-spacer"></div>
                    <label class="toggle-switch">
                      <input type="checkbox" bind:checked={course.active} />
                      <span class="toggle-track"></span>
                      <span class="toggle-label">{course.active ? 'Aktiv' : 'Inaktiv'}</span>
                    </label>
                  </div>
                  {#if !course.isDemo}
                    <div class="course-guid-row">
                      <label class="course-guid-label">Golfbox GUID</label>
                      <input
                        type="text"
                        bind:value={course.guid}
                        placeholder={course.id === 'utebane' ? 'Sett inn ved sesongstart' : 'Ressource GUID'}
                        class="course-guid-input"
                      />
                    </div>
                  {/if}
                </div>
              {/each}
            </div>

            <div class="action-row">
              <button class="btn-primary" on:click={saveCourses} disabled={coursesSaving}>
                {coursesSaving ? 'Lagrer…' : 'Lagre baner'}
              </button>
              {#if coursesMsg}<span class="save-msg">{coursesMsg}</span>{/if}
            </div>
          </div>

          <!-- Status -->
          <div class="section">
            <h2>Tilkoblingsstatus</h2>
            {#if !golfboxStatus && !golfboxLoading}
              <button class="btn-secondary" on:click={loadGolfboxStatus}>Sjekk tilkobling</button>
            {:else if golfboxLoading}
              <p class="help-text">Sjekker tilkobling…</p>
            {:else if golfboxStatus}
              <div class="gb-status-card" class:gb-ok={!golfboxStatus.isMock && !golfboxStatus.sessionExpired} class:gb-warn={golfboxStatus.sessionExpired} class:gb-mock={golfboxStatus.isMock && !golfboxStatus.sessionExpired}>
                <div class="gb-status-header">
                  {#if !golfboxStatus.isMock && !golfboxStatus.sessionExpired}
                    <span class="gb-indicator gb-green"></span>
                    <strong>Tilkoblet – live data</strong>
                  {:else if golfboxStatus.sessionExpired}
                    <span class="gb-indicator gb-red"></span>
                    <strong>Sesjon utløpt</strong>
                  {:else}
                    <span class="gb-indicator gb-yellow"></span>
                    <strong>Bruker eksempeldata</strong>
                  {/if}
                </div>
                <div class="gb-status-details">
                  <span>Innlogging lagret: {gbCredentials?.hasCredentials ? 'Ja' : 'Nei'}</span>
                  <span>Sesjon aktiv: {golfboxStatus.hasCookie ? 'Ja' : 'Nei'}</span>
                  <span>Starttider: {golfboxStatus.teeTimes}</span>
                  {#if golfboxStatus.fetchedAt}
                    <span>Sist hentet: {new Date(golfboxStatus.fetchedAt).toLocaleTimeString('nb')}</span>
                  {/if}
                </div>
              </div>
              <div class="action-row">
                <button class="btn-secondary" on:click={loadGolfboxStatus} disabled={golfboxLoading}>
                  ↻ Sjekk på nytt
                </button>
                <button class="btn-secondary" on:click={refreshTeetimes} disabled={refreshing}>
                  {refreshing ? 'Henter…' : '↻ Oppdater starttider'}
                </button>
                {#if refreshMsg}<span class="save-msg">{refreshMsg}</span>{/if}
              </div>
            {/if}
          </div>

          <!-- Golfbox-innlogging -->
          <div class="section">
            <h2>Golfbox-innlogging</h2>
            <p class="help-text">
              Skriv inn klubbens Golfbox brukernavn og passord. Systemet logger inn automatisk og holder sesjonen aktiv.
              Innloggingen er kryptert og lagres sikkert på serveren.
            </p>

            {#if gbCredentials?.hasCredentials}
              <div class="gb-status-card gb-ok">
                <div class="gb-status-header">
                  <span class="gb-indicator gb-green"></span>
                  <strong>Innlogging lagret</strong>
                </div>
                <div class="gb-status-details">
                  <span>Bruker: {gbCredentials.username}</span>
                </div>
              </div>
            {/if}

            <div class="form-grid">
              <label>
                Brukernavn / medlemsnummer
                <input type="text" bind:value={gbUsername} placeholder="f.eks. 364-456" />
              </label>
              <label>
                Passord
                <input type="password" bind:value={gbPassword} placeholder="••••••••" />
              </label>
            </div>

            <div class="action-row">
              <button class="btn-primary" on:click={saveGolfboxCredentials} disabled={gbSaving || !gbUsername.trim() || !gbPassword.trim()}>
                {gbSaving ? 'Lagrer og tester…' : 'Lagre og koble til'}
              </button>
              {#if gbCredentials?.hasCredentials}
                <button class="btn-ghost" on:click={deleteGolfboxCredentials}>Fjern innlogging</button>
              {/if}
              {#if gbMsg}<span class="save-msg">{gbMsg}</span>{/if}
            </div>
          </div>

          <!-- Manuell cookie (avansert, sammenfoldet) -->
          <details class="section">
            <summary class="details-summary">Avansert: Manuell cookie</summary>
            <p class="help-text" style="margin-top:12px">
              Hvis automatisk innlogging ikke fungerer, kan du lime inn en cookie-streng manuelt.
            </p>
            <label class="full-width">
              Cookie-streng
              <textarea bind:value={newCookie} rows="2" placeholder="ASPSESSIONID...=...; ASPUniqueID=..."></textarea>
            </label>
            <div class="action-row">
              <button class="btn-secondary" on:click={saveCookie} disabled={cookieSaving || !newCookie.trim()}>
                {cookieSaving ? 'Lagrer…' : 'Lagre cookie'}
              </button>
              {#if cookieMsg}<span class="save-msg">{cookieMsg}</span>{/if}
            </div>
          </details>

        <!-- ── Bilder ── -->
        {:else if activeTab === 'images'}
          <div class="section">
            <h2>Bildebibliotek</h2>
            <p class="help-text">Her ser du alle bilder i <code>Bilder/</code>-mappen. Last opp nye bilder, og velg dem i de andre fanene.</p>

            <!-- Opplasting -->
            <div class="upload-area">
              <label class="btn-primary" style="cursor:pointer">
                {uploading ? 'Laster opp…' : '⬆ Last opp nytt bilde'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style="display:none"
                  on:change={async e => {
                    await uploadImageFile(e.target.files[0]);
                    e.target.value = '';
                  }}
                  disabled={uploading}
                />
              </label>
            </div>

            <!-- Bildebibliotek -->
            {#if imagesLoading}
              <p class="help-text">Laster bilder…</p>
            {:else if imageCategories.length === 0}
              <p class="help-text">Ingen bilder funnet. Legg bilder i <code>Bilder/</code>-mappene i prosjektet.</p>
            {:else}
              {#each imageCategories as cat}
                <div class="img-lib-category">
                  <h3>{cat.name} <span class="img-count">({cat.files.length})</span></h3>
                  <div class="img-lib-grid">
                    {#each cat.files as file}
                      <div class="img-lib-item">
                        <img src={file.url} alt={file.name} class="img-lib-thumb" />
                        <span class="img-lib-name">{file.name}</span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/each}
            {/if}
          </div>

        <!-- ── Skjermer ── -->
        {:else if activeTab === 'screens'}
          <div class="section">
            <h2>Skjermkonfigurasjon</h2>
            <p class="help-text">Definer kolonner for hver skjerm. Dra moduler mellom kolonner, eller legg til/fjern kolonner.</p>
            {#each screens as screen, si}
              <div class="screen-card">
                <div class="screen-card-header">
                  <strong>{screen.name}</strong>
                  <code>/display/{screen.id}</code>
                </div>

                <!-- Banevalg for denne skjermen -->
                <div class="screen-course-row">
                  <label class="screen-course-label">
                    Bane (starttider)
                    <select bind:value={screen.courseId} class="screen-course-select">
                      <option value="">— Ingen —</option>
                      {#each courses as c}
                        <option value={c.id}>{c.name}{c.isDemo ? ' (demo)' : ''}</option>
                      {/each}
                    </select>
                  </label>
                </div>

                <!-- Kolonne-editor -->
                <div class="columns-editor">
                  {#each (screen.columns || [screen.modules || []]) as col, ci}
                    <div class="column-box">
                      <div class="column-header">
                        <span class="column-label">Kolonne {ci + 1}</span>
                        {#if (screen.columns || []).length > 1}
                          <button class="btn-icon" title="Fjern kolonne" on:click={() => {
                            screen.columns = screen.columns.filter((_, i) => i !== ci);
                          }}>✕</button>
                        {/if}
                      </div>
                      <div class="column-modules">
                        {#each col as mod, mi}
                          <div class="column-mod">
                            <span class="mod-name">{mod}</span>
                            <div class="mod-actions">
                              {#if mi > 0}
                                <button class="btn-icon" title="Flytt opp" on:click={() => {
                                  const a = [...screen.columns[ci]];
                                  const tmp = a[mi-1]; a[mi-1] = a[mi]; a[mi] = tmp;
                                  screen.columns[ci] = a;
                                  screen.columns = [...screen.columns];
                                }}>↑</button>
                              {/if}
                              {#if mi < col.length - 1}
                                <button class="btn-icon" title="Flytt ned" on:click={() => {
                                  const b = [...screen.columns[ci]];
                                  const tmp2 = b[mi]; b[mi] = b[mi+1]; b[mi+1] = tmp2;
                                  screen.columns[ci] = b;
                                  screen.columns = [...screen.columns];
                                }}>↓</button>
                              {/if}
                              <button class="btn-icon btn-icon-danger" title="Fjern" on:click={() => {
                                screen.columns[ci] = screen.columns[ci].filter((_, i) => i !== mi);
                                screen.columns = [...screen.columns];
                              }}>✕</button>
                            </div>
                          </div>
                        {/each}
                        <!-- Legg til modul i denne kolonnen -->
                        <select class="add-mod-select" on:change={e => {
                          if (e.target.value) {
                            screen.columns[ci] = [...screen.columns[ci], e.target.value];
                            screen.columns = [...screen.columns];
                            e.target.value = '';
                          }
                        }}>
                          <option value="">+ Legg til modul…</option>
                          {#each ['tee-times','weather','course-status','announcements','cafe-menu','slope-table'] as mod}
                            <option value={mod}>{mod}</option>
                          {/each}
                        </select>
                      </div>
                    </div>
                  {/each}
                  <!-- Legg til kolonne -->
                  {#if (screen.columns || []).length < 4}
                    <button class="btn-add-col" on:click={() => {
                      if (!screen.columns) screen.columns = [screen.modules || []];
                      screen.columns = [...screen.columns, []];
                    }}>+ Legg til kolonne</button>
                  {/if}
                </div>

                <div class="action-row">
                  <button class="btn-secondary" on:click={async () => {
                    await adminApi.updateScreen(screen.id, screen);
                    saveMsg = `✓ ${screen.name} oppdatert`;
                    setTimeout(() => saveMsg = '', 3000);
                  }}>
                    Lagre {screen.name}
                  </button>
                </div>
              </div>
            {/each}
            {#if saveMsg}<span class="save-msg">{saveMsg}</span>{/if}
          </div>
        {/if}

      </div>
    </div>
  </div>

  <!-- ── Bildevelger-modal ── -->
  {#if imagePickerOpen}
    <div class="modal-overlay" on:click|self={closeImagePicker}>
      <div class="modal">
        <div class="modal-header">
          <h2>Velg bilde</h2>
          <button class="btn-remove" on:click={closeImagePicker}>✕</button>
        </div>
        {#if imagesLoading}
          <p class="help-text" style="padding:20px;text-align:center">Laster bilder…</p>
        {:else if imageCategories.length === 0}
          <p class="help-text" style="padding:20px;text-align:center">
            Ingen bilder funnet. Legg bilder i <code>Bilder/</code>-mappen i prosjektet.
          </p>
        {:else}
          {#each imageCategories as cat}
            <div class="img-category">
              <h3>{cat.name}</h3>
              <div class="img-grid">
                {#each cat.files as file}
                  <button class="img-thumb-btn" on:click={() => selectImage(file.url)}>
                    <img src={file.url} alt={file.name} class="img-thumb" />
                    <span class="img-name">{file.name}</span>
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
{/if}

<style>
  /* ── Reset & variabler ── */
  :global(body) {
    font-family: 'DM Sans', sans-serif;
    background: #f5f5f5;
    color: #1a1a1a;
  }

  /* ── Login ── */
  .login-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: #f5f5f5;
  }

  .login-card {
    background: white;
    border-radius: 16px;
    padding: 48px 40px;
    width: 360px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.12);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .login-logo {
    height: 80px;
    width: auto;
    object-fit: contain;
  }

  .login-card h1 {
    font-family: 'EB Garamond', serif;
    font-size: 1.8rem;
    color: #2a4727;
    text-align: center;
    margin: 0;
  }

  .login-sub {
    font-size: 0.85rem;
    color: #6b8f6e;
    margin: 0;
  }

  .login-card form {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .error {
    color: #c0392b;
    font-size: 0.85rem;
    margin: 0;
  }

  /* ── Admin layout ── */
  .admin {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: #f5f5f5;
  }

  .admin-header {
    background: #2a4727;
    color: white;
    padding: 16px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }

  .admin-logo {
    display: flex;
    align-items: center;
    gap: 14px;
    font-family: 'EB Garamond', serif;
    font-size: 1.3rem;
  }

  .admin-logo img {
    filter: brightness(0) invert(1);
    height: 40px;
    width: auto;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .display-links {
    display: flex;
    gap: 12px;
  }

  .display-links a {
    color: #a8d5a8;
    font-size: 0.85rem;
    text-decoration: none;
  }
  .display-links a:hover { text-decoration: underline; }

  .admin-body {
    flex: 1;
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
    padding: 32px 24px;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* ── Tabs ── */
  .tabs {
    display: flex;
    gap: 4px;
    border-bottom: 2px solid #e5e5e5;
    margin-bottom: 24px;
  }

  .tab {
    padding: 10px 20px;
    border: none;
    background: none;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.95rem;
    color: #6b6b6b;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    transition: all 0.15s;
  }

  .tab:hover { color: #2a4727; }

  .tab-active {
    color: #2a4727;
    font-weight: 600;
    border-bottom-color: #486747;
  }

  /* ── Seksjoner ── */
  .section {
    background: white;
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 20px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .section h2 {
    font-family: 'EB Garamond', serif;
    font-size: 1.4rem;
    color: #2a4727;
    margin: 0;
  }

  .section h3 {
    font-size: 0.95rem;
    font-weight: 600;
    color: #486747;
    margin: 0;
  }

  .help-text {
    font-size: 0.85rem;
    color: #9b9b9b;
    margin: 0;
  }

  /* ── Skjema ── */
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    color: #4a4a4a;
  }

  input[type="text"], input[type="password"], select, textarea {
    padding: 9px 12px;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.95rem;
    color: #1a1a1a;
    background: #fafafa;
    transition: border-color 0.15s;
    width: 100%;
  }

  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: #486747;
    background: white;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .full-width { grid-column: 1 / -1; }

  /* ── Knapper ── */
  button {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.9rem;
    cursor: pointer;
    border-radius: 8px;
    padding: 9px 18px;
    border: none;
    transition: all 0.15s;
  }

  .btn-primary {
    background: #486747;
    color: white;
    font-weight: 500;
  }
  .btn-primary:hover:not(:disabled) { background: #2a4727; }
  .btn-primary:disabled { opacity: 0.5; cursor: default; }

  .btn-secondary {
    background: #f0f5f0;
    color: #2a4727;
    border: 1px solid #c8d8c8;
    font-weight: 500;
  }
  .btn-secondary:hover:not(:disabled) { background: #e0ede0; }

  .btn-ghost {
    background: transparent;
    color: #486747;
    border: 1px solid #c8d8c8;
  }
  .btn-ghost:hover { background: #f0f5f0; }

  .btn-remove {
    background: transparent;
    color: #c0392b;
    border: none;
    padding: 6px 10px;
    font-size: 0.85rem;
  }
  .btn-remove:hover { background: #fee; border-radius: 6px; }

  .action-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .save-msg {
    font-size: 0.85rem;
    color: #486747;
    font-weight: 500;
  }

  /* ── Kunngjøringer ── */
  .announcement-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Nytt kortdesign per kunngjøring */
  .ann-card {
    border: 1px solid #e5e5e5;
    border-radius: 10px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: #fafafa;
  }

  .ann-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .ann-type-select {
    flex: 0 0 auto;
    width: auto;
    padding: 6px 10px;
    font-size: 0.875rem;
    font-weight: 500;
    background: white;
    border: 1px solid #c8d8c8;
    color: #2a4727;
    border-radius: 6px;
    cursor: pointer;
  }

  /* Person-felt */
  .ann-person-fields {
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: #f0f5f0;
    border-radius: 8px;
    padding: 12px;
    border: 1px solid #dce8dc;
  }

  .ann-portrait-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .ann-portrait-preview {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #486747;
    flex-shrink: 0;
  }

  .ann-portrait-placeholder {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: #dce8dc;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    flex-shrink: 0;
    border: 2px dashed #a8c8a8;
  }

  .btn-upload {
    display: inline-flex;
    align-items: center;
    padding: 7px 14px;
    background: white;
    border: 1px solid #c8d8c8;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 500;
    color: #2a4727;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }
  .btn-upload:hover { background: #e8f0e8; }

  .ann-person-inputs {
    display: flex;
    gap: 10px;
  }
  .ann-person-inputs input { flex: 1; }

  .toggle {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    white-space: nowrap;
    cursor: pointer;
    margin-left: auto;
  }

  .toggle input { width: auto; }

  /* ── Banemannskap (admin) ── */
  .crew-admin-list { display: flex; flex-direction: column; gap: 8px; }

  .crew-admin-item {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .crew-admin-photo {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .crew-admin-placeholder {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #e5e5e5;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .crew-admin-item input { flex: 1; }

  /* ── Kantine ── */
  .cafe-list { display: flex; flex-direction: column; gap: 8px; }

  .cafe-item {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .cafe-item input { flex: 1; }

  /* ── Skjermkonfig ── */
  .screen-card {
    border: 1px solid #e5e5e5;
    border-radius: 10px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .screen-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .screen-card-header code {
    font-size: 0.8rem;
    background: #f0f5f0;
    color: #486747;
    padding: 3px 8px;
    border-radius: 4px;
  }

  /* ── Kolonne-editor ── */
  .columns-editor {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .column-box {
    flex: 1;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 10px;
    background: #fafafa;
    min-width: 140px;
  }

  .column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .column-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b6b6b;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .column-modules {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .column-mod {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    background: #fff;
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    font-size: 0.8rem;
  }

  .mod-name {
    font-weight: 500;
  }

  .mod-actions {
    display: flex;
    gap: 2px;
  }

  .btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.75rem;
    padding: 2px 5px;
    border-radius: 4px;
    color: #888;
  }
  .btn-icon:hover { background: #eee; color: #333; }
  .btn-icon-danger:hover { background: #fee; color: #c00; }

  .add-mod-select {
    width: 100%;
    padding: 4px 6px;
    font-size: 0.8rem;
    border: 1px dashed #ccc;
    border-radius: 6px;
    background: #fff;
    color: #888;
    margin-top: 4px;
  }

  .btn-add-col {
    align-self: stretch;
    border: 2px dashed #ccc;
    border-radius: 8px;
    background: none;
    color: #888;
    font-size: 0.85rem;
    cursor: pointer;
    padding: 10px 16px;
    min-width: 120px;
    white-space: nowrap;
  }
  .btn-add-col:hover { border-color: #999; color: #555; }

  .field-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #6b6b6b;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  /* ── Bildevelger-modal ── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 24px;
  }

  .modal {
    background: white;
    border-radius: 16px;
    width: 100%;
    max-width: 700px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px 12px;
    border-bottom: 1px solid #eee;
    position: sticky;
    top: 0;
    background: white;
    border-radius: 16px 16px 0 0;
    z-index: 1;
  }

  .modal-header h2 {
    font-family: 'EB Garamond', serif;
    font-size: 1.3rem;
    color: #2a4727;
    margin: 0;
  }

  .img-category {
    padding: 16px 24px;
  }

  .img-category h3 {
    font-size: 0.85rem;
    font-weight: 600;
    color: #6b6b6b;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 12px;
  }

  .img-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 10px;
  }

  .img-thumb-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px;
    background: #fafafa;
    border: 2px solid transparent;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .img-thumb-btn:hover {
    border-color: #486747;
    background: #f0f5f0;
  }

  .img-thumb {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: 8px;
  }

  .img-name {
    font-size: 0.7rem;
    color: #6b6b6b;
    text-align: center;
    word-break: break-all;
    line-height: 1.2;
  }

  .btn-upload-alt {
    background: #f5f5f5;
    color: #6b6b6b;
    border-color: #ddd;
  }
  .btn-upload-alt:hover { background: #eee; }

  /* ── Baner ── */
  .course-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .course-card {
    border: 1px solid #e5e5e5;
    border-radius: 10px;
    padding: 12px 16px;
    background: #fafafa;
    transition: border-color 0.15s, background 0.15s;
  }

  .course-active {
    border-color: #b8debb;
    background: #f4fbf5;
  }

  .course-card-main {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .course-card-spacer { flex: 1; }

  .course-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ccc;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  .dot-on { background: #4caf50; }

  .course-name {
    font-size: 0.95rem;
    font-weight: 600;
    color: #222;
  }

  .demo-tag {
    font-size: 0.75rem;
    color: #7ab4e8;
    background: #eaf3fb;
    border: 1px solid #b8d8f0;
    border-radius: 20px;
    padding: 2px 10px;
    font-style: italic;
  }

  .toggle-switch {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
  }
  .toggle-switch input { display: none; }
  .toggle-track {
    width: 38px;
    height: 22px;
    border-radius: 11px;
    background: #ccc;
    position: relative;
    flex-shrink: 0;
    transition: background 0.2s;
  }
  .toggle-track::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.2s;
  }
  .toggle-switch input:checked + .toggle-track { background: #4caf50; }
  .toggle-switch input:checked + .toggle-track::after { transform: translateX(16px); }
  .toggle-label {
    font-size: 0.82rem;
    color: #555;
    white-space: nowrap;
  }

  .course-guid-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid #ebebeb;
  }

  .course-guid-label {
    font-size: 0.78rem;
    font-weight: 500;
    color: #888;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .course-guid-input {
    flex: 1;
    font-family: 'DM Mono', monospace;
    font-size: 0.8rem;
  }

  /* ── Skjerm-banevalg ── */
  .screen-course-row {
    padding: 4px 0 8px;
    border-bottom: 1px solid #f0f0f0;
  }

  .screen-course-label {
    font-size: 0.82rem;
    font-weight: 500;
    color: #4a4a4a;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .screen-course-select {
    width: auto;
    flex: 0 0 auto;
    min-width: 160px;
  }

  /* ── Golfbox ── */
  .gb-status-card {
    border-radius: 10px;
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .gb-ok   { background: #f0faf0; border: 1px solid #b8e0b8; }
  .gb-warn { background: #fef8f0; border: 1px solid #e0c8a0; }
  .gb-mock { background: #f5f5f0; border: 1px solid #ddd; }

  .gb-status-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.95rem;
  }

  .gb-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .gb-green  { background: #3ddc57; }
  .gb-red    { background: #e05252; }
  .gb-yellow { background: #c9a84c; }

  .gb-status-details {
    display: flex;
    gap: 16px;
    font-size: 0.8rem;
    color: #6b6b6b;
    flex-wrap: wrap;
  }

  .gb-instructions {
    font-size: 0.85rem;
    color: #4a4a4a;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    line-height: 1.5;
  }

  .gb-instructions kbd {
    background: #f0f0f0;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 1px 6px;
    font-family: 'DM Mono', monospace;
    font-size: 0.8rem;
  }

  .gb-instructions code {
    background: #f0f5f0;
    color: #2a4727;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 0.8rem;
  }

  .details-summary {
    font-family: 'EB Garamond', serif;
    font-size: 1.1rem;
    color: #6b6b6b;
    cursor: pointer;
    padding: 4px 0;
  }
  .details-summary:hover { color: #2a4727; }

  details.section {
    padding: 16px 24px;
  }

  /* ── Bildebibliotek-fane ── */
  .upload-area {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .img-lib-category {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .img-lib-category h3 {
    font-size: 0.9rem;
    font-weight: 600;
    color: #2a4727;
    margin: 0;
  }

  .img-count {
    font-weight: 400;
    color: #9b9b9b;
    font-size: 0.85rem;
  }

  .img-lib-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 12px;
  }

  .img-lib-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px;
    background: #f5f5f5;
    border-radius: 10px;
  }

  .img-lib-thumb {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: 8px;
  }

  .img-lib-name {
    font-size: 0.7rem;
    color: #6b6b6b;
    text-align: center;
    word-break: break-all;
    line-height: 1.2;
  }
</style>
