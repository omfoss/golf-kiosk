<script>
  import { weather } from '../store.js';

  $: currentHour = new Date().getHours();
  $: upcoming = ($weather.hours || [])
    .filter(h => parseInt(h.time) >= currentHour)
    .slice(0, 7);

  $: currentWeather = upcoming[0] || null;
</script>

<section class="weather">
  <div class="section-label">Vær – {$weather.location}</div>

  {#if currentWeather}
    <div class="current">
      <span class="current-icon">{currentWeather.symbol}</span>
      <div class="current-info">
        <span class="current-temp">{currentWeather.temp}°</span>
        <span class="current-desc">{currentWeather.symbolText}</span>
        <div class="current-details">
          <span>💨 {currentWeather.wind} ({currentWeather.windGust || currentWeather.wind}) m/s {currentWeather.windDir || ''}</span>
          {#if currentWeather.feelsLike != null && currentWeather.feelsLike !== currentWeather.temp}
            <span>Føles som {currentWeather.feelsLike}°</span>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <div class="hourly">
    <!-- Header -->
    <div class="hour-header">
      <span>Tid</span>
      <span></span>
      <span>Temp</span>
      <span>Nedbør</span>
      <span>Vind (kast)</span>
    </div>

    {#each upcoming.slice(1) as hour}
      <div class="hour-item" class:hour-rain={hour.precip > 0}>
        <span class="hour-time">{hour.time}</span>
        <span class="hour-icon">{hour.symbol}</span>
        <span class="hour-temp">{hour.temp}°</span>
        <span class="hour-precip">
          {#if hour.precip > 0}
            {hour.precip.toFixed(1)} mm
          {/if}
        </span>
        <span class="hour-wind">
          {hour.wind} ({hour.windGust || hour.wind}) {hour.windDir || ''}
        </span>
      </div>
    {/each}
  </div>

  <!-- Soloppgang / solnedgang -->
  {#if $weather.sunrise || $weather.sunset}
    <div class="sun-bar">
      {#if $weather.sunrise}<span>🌅 Sol opp {$weather.sunrise}</span>{/if}
      {#if $weather.sunset}<span>🌇 Sol ned {$weather.sunset}</span>{/if}
    </div>
  {/if}
</section>

<style>
  .weather {
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

  .current {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: #243828;
    border: 1px solid #355a3a;
    border-radius: 8px;
    flex-shrink: 0;
  }

  .current-icon {
    font-size: 2rem;
    line-height: 1;
  }

  .current-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .current-temp {
    font-family: 'DM Sans', sans-serif;
    font-size: 1.6rem;
    font-weight: 600;
    color: #f0f5f1;
    line-height: 1;
  }

  .current-desc {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.85rem;
    color: #a0c4a4;
  }

  .current-details {
    display: flex;
    gap: 12px;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.8rem;
    color: #a0c4a4;
  }

  /* ── Timeoversikt ── */
  .hourly {
    display: flex;
    flex-direction: column;
    gap: 0;
    flex: 1;
    overflow: hidden;
  }

  .hour-header {
    display: grid;
    grid-template-columns: 44px 24px 40px 50px 1fr;
    align-items: center;
    gap: 6px;
    padding: 2px 10px;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6a9a6e;
    border-bottom: 1px solid #355a3a;
    margin-bottom: 2px;
  }

  .hour-item {
    display: grid;
    grid-template-columns: 44px 24px 40px 50px 1fr;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 4px;
  }

  .hour-rain {
    background: #1a2430;
    border: 1px solid #2d3a4a;
    border-radius: 6px;
  }

  .hour-time {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.8rem;
    color: #a0c4a4;
  }

  .hour-icon {
    font-size: 0.95rem;
    text-align: center;
  }

  .hour-temp {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.85rem;
    color: #f0f5f1;
    font-weight: 500;
    text-align: right;
  }

  .hour-precip {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.75rem;
    color: #5b9fff;
  }

  .hour-wind {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.75rem;
    color: #a0c4a4;
  }

  /* ── Sol opp/ned ── */
  .sun-bar {
    display: flex;
    gap: 16px;
    justify-content: center;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.8rem;
    color: #a0c4a4;
    padding-top: 6px;
    border-top: 1px solid #355a3a;
    flex-shrink: 0;
  }
</style>
