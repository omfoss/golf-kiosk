<script>
  import { courseStatus, crew } from '../store.js';

  const STATUS_LABELS = {
    open:    { text: 'Åpen',     color: '#3ddc57', bg: '#1a3d1e', border: '#2d7a3a' },
    limited: { text: 'Begrenset', color: '#c9a84c', bg: '#3d2e0a', border: '#c9a84c60' },
    closed:  { text: 'Stengt',   color: '#e05252', bg: '#3d0a0a', border: '#e0525260' },
  };

  $: status = STATUS_LABELS[$courseStatus.openStatus] || STATUS_LABELS.open;
</script>

<section class="course-status">
  <div class="section-label">Banestatus</div>
  <div class="status-card">
    <div class="fields">
      {#if $courseStatus.lastMow}
        <div class="field">
          <span class="field-label">Siste klipp</span>
          <span class="field-value">{$courseStatus.lastMow}</span>
        </div>
      {/if}
      {#if $courseStatus.stimp}
        <div class="field">
          <span class="field-label">Stimpmeter</span>
          <span class="field-value">{$courseStatus.stimp}</span>
        </div>
      {/if}
      {#if $courseStatus.greens}
        <div class="field">
          <span class="field-label">Greener</span>
          <span class="field-value">{$courseStatus.greens}</span>
        </div>
      {/if}
      {#if $courseStatus.bunkers}
        <div class="field">
          <span class="field-label">Bunkere</span>
          <span class="field-value">{$courseStatus.bunkers}</span>
        </div>
      {/if}
    </div>

    <!-- notes fjernet – vises i Informasjon-banneret i stedet -->

    <!-- ── Banemannskap ── -->
    {#if $crew.members?.length > 0 || $crew.message}
      <div class="crew-section">
        {#if $crew.members?.length > 0}
          <div class="crew-portraits">
            {#each $crew.members as member}
              <div class="crew-member">
                {#if member.image}
                  <img class="crew-photo" src={member.image} alt={member.name} />
                {/if}
                {#if member.name}
                  <span class="crew-name">{member.name}</span>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
        {#if $crew.message}
          <p class="crew-message">{$crew.message}</p>
        {/if}
      </div>
    {/if}
  </div>
</section>

<style>
  .course-status {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .section-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #6a9a6e;
    flex-shrink: 0;
  }

  .status-card {
    background: #243828;
    border: 1px solid #355a3a;
    border-radius: 8px;
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .open-status {
    display: inline-block;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.85rem;
    font-weight: 600;
    padding: 4px 14px;
    border-radius: 20px;
    border: 1px solid;
    align-self: flex-start;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .field-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #6a9a6e;
  }

  .field-value {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.85rem;
    color: #f0f5f1;
  }

  .notes {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.8rem;
    color: #a0c4a4;
    line-height: 1.4;
    border-top: 1px solid #355a3a;
    padding-top: 8px;
  }

  /* ── Banemannskap ── */
  .crew-section {
    border-top: 1px solid #355a3a;
    padding-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .crew-portraits {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
  }

  .crew-member {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .crew-photo {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
    object-position: center top;
    border: 2px solid #355a3a;
  }

  .crew-name {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.85rem;
    font-weight: 500;
    color: #d8ead9;
  }

  .crew-message {
    font-family: 'EB Garamond', serif;
    font-size: 0.85rem;
    color: #a0c4a4;
    line-height: 1.55;
    font-style: italic;
  }
</style>
