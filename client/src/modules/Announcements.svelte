<script>
  import { announcements, contactInfo, courseStatus } from '../store.js';

  $: active = ($announcements || []).filter(a => a.active);
  $: personProfile = active.find(a => a.type === 'person' && (a.personName || a.personImage)) || null;
  $: infoEntries = active.filter(a => a.type !== 'person' || a !== personProfile);
  $: contact = $contactInfo || {};
  $: isOpen = $courseStatus?.openStatus === 'open';
</script>

<section class="announcements">
  <div class="section-top">
    <span class="section-label">Informasjon</span>
    <span class="open-badge" class:is-closed={!isOpen}>
      {isOpen ? '⛳ BANEN ER ÅPEN' : '🚫 BANEN ER STENGT'}
    </span>
  </div>

  <div class="card">
    {#if active.length === 0}
      <p class="empty">Ingen kunngjøringer</p>
    {:else}
      <!-- ── Profil øverst ── -->
      {#if personProfile}
        <div class="profile-header">
          {#if personProfile.personImage}
            <div class="portrait-wrap">
              <img
                class="portrait"
                src={personProfile.personImage}
                alt={personProfile.personName || 'Ansatt'}
              />
            </div>
          {/if}
          <div class="profile-meta">
            <div class="profile-top">
              {#if personProfile.personName}
                <span class="person-name">{personProfile.personName}</span>
              {/if}
              {#if personProfile.personRole}
                <span class="person-role">{personProfile.personRole}</span>
              {/if}
            </div>
            {#if personProfile.text}
              <span class="person-quote">{personProfile.text}</span>
            {/if}
          </div>
        </div>
      {/if}

      <!-- ── Info-tekster under ── -->
      {#each infoEntries as entry}
        <div class="info-banner">
          <span class="info-icon">📢</span>
          <p class="info-text">{entry.text}</p>
        </div>
      {/each}
    {/if}

    <!-- ── Kontaktinfo (fast nederst) ── -->
    {#if contact.text || contact.phone}
      <div class="contact-bar">
        {#if contact.text}<span class="contact-text">{contact.text}</span>{/if}
        {#if contact.phone}<span class="contact-phone">📞 {contact.phone}</span>{/if}
      </div>
    {/if}
  </div>
</section>

<style>
  .announcements {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .section-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .section-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #6a9a6e;
  }

  .open-badge {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.8rem;
    font-weight: 700;
    color: #3ddc57;
    background: #1a3d1e;
    border: 2px solid #3ddc57;
    padding: 4px 14px;
    border-radius: 20px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    animation: glow-pulse 2s ease-in-out infinite;
  }

  .open-badge.is-closed {
    color: #e05252;
    background: #3d1a1a;
    border-color: #e05252;
    animation: none;
  }

  @keyframes glow-pulse {
    0%, 100% { box-shadow: 0 0 8px 0 #3ddc5740; }
    50%      { box-shadow: 0 0 16px 2px #3ddc5760; }
  }

  .card {
    background: #243828;
    border: 1px solid #355a3a;
    border-radius: 8px;
    padding: 14px 16px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow: hidden;
  }

  .empty {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.9rem;
    color: #6a9a6e;
    font-style: italic;
    margin: auto 0;
  }

  /* ── Profil-header (fast øverst) ── */
  .profile-header {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
  }

  .portrait-wrap {
    flex-shrink: 0;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid #2d7a3a;
    box-shadow: 0 0 20px 0 #3ddc5720;
  }

  .portrait {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
  }

  .profile-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .profile-top {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }

  .person-name {
    font-family: 'DM Sans', sans-serif;
    font-size: 1.05rem;
    font-weight: 600;
    color: #f0f5f1;
    line-height: 1.2;
  }

  .person-role {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.7rem;
    font-weight: 500;
    color: #8fb892;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  /* ── Tekst ── */
  .person-quote {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.9rem;
    color: #b8d0ba;
    line-height: 1.4;
  }

  .info-banner {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    background: #2a4a30;
    border: 1px solid #4a9a54;
    border-radius: 6px;
    padding: 12px 14px;
    border-left: 4px solid #4ae064;
  }

  .info-icon {
    font-size: 1.2rem;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .info-text {
    font-family: 'DM Sans', sans-serif;
    font-size: 1.05rem;
    font-weight: 500;
    color: #f0f5f1;
    line-height: 1.5;
  }

  /* ── Kontaktinfo (fast nederst) ── */
  .contact-bar {
    margin-top: auto;
    padding-top: 6px;
    border-top: 1px solid #355a3a;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .contact-text {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.85rem;
    color: #8fb892;
    line-height: 1.4;
  }

  .contact-phone {
    font-family: 'DM Mono', monospace;
    font-size: 0.9rem;
    color: #a8d5a8;
    font-weight: 500;
  }
</style>
