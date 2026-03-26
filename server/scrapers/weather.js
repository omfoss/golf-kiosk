const axios = require('axios');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Strengelsrudvegen / Kongsvinger Golfklubb
const LAT      = process.env.WEATHER_LAT      || '60.1834';
const LON      = process.env.WEATHER_LON      || '12.0283';
const LOCATION = process.env.WEATHER_LOCATION || 'Kongsvinger';

// Bruk "complete" for UV, vindkast, nedbørssannsynlighet
const YR_URL = `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${LAT}&lon=${LON}`;

const YR_USER_AGENT = 'GolfKiosk/2.0 github.com/kongsvingergolf/kiosk';

// ── Cache (30 min) ──────────────────────────────────────────────────────
let cache = { data: null, fetchedAt: 0 };
const CACHE_TTL = 30 * 60_000;

// ── Symbolkart ──────────────────────────────────────────────────────────
const SYMBOL_MAP = {
  clearsky: '☀️', fair: '🌤️', partlycloudy: '⛅', cloudy: '☁️',
  fog: '🌫️', lightrain: '🌦️', rain: '🌧️', heavyrain: '🌧️',
  lightrainshowers: '🌦️', rainshowers: '🌧️', heavyrainshowers: '🌧️',
  lightsleet: '🌨️', sleet: '🌨️', heavysleet: '🌨️',
  lightsnow: '🌨️', snow: '❄️', heavysnow: '❄️', snowshowers: '🌨️',
  thunder: '⛈️', lightrainandthunder: '⛈️', rainandthunder: '⛈️', snowandthunder: '⛈️',
};

function symbolToEmoji(symbolCode) {
  if (!symbolCode) return '🌡️';
  const base = symbolCode.replace(/_day$|_night$|_polartwilight$/, '');
  return SYMBOL_MAP[base] || '🌡️';
}

const SYMBOL_TEXTS = {
  clearsky: 'Klart', fair: 'Lettskyet', partlycloudy: 'Delvis skyet',
  cloudy: 'Overskyet', fog: 'Tåke', lightrain: 'Lett regn',
  rain: 'Regn', heavyrain: 'Kraftig regn', lightrainshowers: 'Lette regnbyger',
  rainshowers: 'Regnbyger', heavyrainshowers: 'Kraftige byger',
  lightsleet: 'Lett sludd', sleet: 'Sludd', heavysleet: 'Kraftig sludd',
  lightsnow: 'Lett snø', snow: 'Snø', heavysnow: 'Kraftig snø',
  snowshowers: 'Snøbyger', thunder: 'Torden',
  lightrainandthunder: 'Regn og torden', rainandthunder: 'Regn og torden',
  snowandthunder: 'Snø og torden',
};

function symbolToText(symbolCode) {
  if (!symbolCode) return '';
  const base = symbolCode.replace(/_day$|_night$|_polartwilight$/, '');
  return SYMBOL_TEXTS[base] || base;
}

// ── Vindretning → kompas ────────────────────────────────────────────────
function degreesToCompass(deg) {
  if (deg == null) return '';
  const dirs = ['N', 'NNØ', 'NØ', 'ØNØ', 'Ø', 'ØSØ', 'SØ', 'SSØ', 'S', 'SSV', 'SV', 'VSV', 'V', 'VNV', 'NV', 'NNV'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ── Følt temperatur (windchill) ─────────────────────────────────────────
function feelsLike(temp, wind) {
  if (temp == null || wind == null) return temp;
  // Kanadisk windchill-formel (gyldig for temp <= 10°C og vind >= 4.8 km/h)
  const windKmh = wind * 3.6;
  if (temp > 10 || windKmh < 4.8) return Math.round(temp);
  const wc = 13.12 + 0.6215 * temp - 11.37 * Math.pow(windKmh, 0.16) + 0.3965 * temp * Math.pow(windKmh, 0.16);
  return Math.round(wc);
}

// ── Mock-data ───────────────────────────────────────────────────────────
function getMockWeather() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const t = new Date(now);
    t.setHours(t.getHours() + i, 0, 0, 0);
    return {
      time: `${String(t.getHours()).padStart(2, '0')}:00`,
      temp: 12 + Math.round(Math.sin(i * 0.5) * 5),
      feelsLike: 10 + Math.round(Math.sin(i * 0.5) * 5),
      symbol: '🌤️',
      symbolText: 'Lettskyet',
      precip: 0,
      precipProb: 0,
      wind: 3.2,
      windGust: 6.1,
      windDir: 'SV',
      humidity: 55,
      uvIndex: 1.2,
      isMock: true,
    };
  });
}

// ── Henting ─────────────────────────────────────────────────────────────
async function fetchWeather() {
  const now = Date.now();
  if (cache.data && now - cache.fetchedAt < CACHE_TTL) {
    return cache.data;
  }

  try {
    const res = await axios.get(YR_URL, {
      timeout: 8_000,
      headers: { 'User-Agent': YR_USER_AGENT },
    });

    const timeseries = res.data?.properties?.timeseries || [];
    const nowDate = new Date();
    const currentHour = nowDate.getHours();

    // Hent fra nåværende time og fremover (ikke bare dagens dato)
    const hours = timeseries
      .filter(ts => new Date(ts.time) >= new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), currentHour))
      .slice(0, 24)
      .map(ts => {
        const hour = new Date(ts.time);
        const inst = ts.data?.instant?.details || {};
        const n1h = ts.data?.next_1_hours;
        const n6h = ts.data?.next_6_hours;
        const symbolCode = n1h?.summary?.symbol_code || n6h?.summary?.symbol_code;

        const temp = Math.round(inst.air_temperature ?? 0);
        const wind = Math.round((inst.wind_speed ?? 0) * 10) / 10;

        return {
          time: `${String(hour.getHours()).padStart(2, '0')}:00`,
          temp,
          feelsLike: feelsLike(inst.air_temperature, inst.wind_speed),
          symbol: symbolToEmoji(symbolCode),
          symbolText: symbolToText(symbolCode),
          precip: n1h?.details?.precipitation_amount ?? n6h?.details?.precipitation_amount ?? 0,
          precipProb: Math.round(n1h?.details?.probability_of_precipitation ?? 0),
          wind,
          windGust: Math.round((inst.wind_speed_of_gust ?? 0) * 10) / 10,
          windDir: degreesToCompass(inst.wind_from_direction),
          humidity: Math.round(inst.relative_humidity ?? 0),
          uvIndex: Math.round((inst.ultraviolet_index_clear_sky ?? 0) * 10) / 10,
          isMock: false,
        };
      });

    // Soloppgang/solnedgang fra Sunrise API
    let sunrise = null;
    let sunset = null;
    try {
      const sunDate = nowDate.toISOString().slice(0, 10);
      const sunRes = await axios.get(
        `https://api.met.no/weatherapi/sunrise/3.0/sun?lat=${LAT}&lon=${LON}&date=${sunDate}&offset=+02:00`,
        { timeout: 5_000, headers: { 'User-Agent': YR_USER_AGENT } }
      );
      const sunData = sunRes.data?.properties?.sunrise;
      const sunSet = sunRes.data?.properties?.sunset;
      if (sunData?.time) sunrise = new Date(sunData.time).toLocaleTimeString('nb', { hour: '2-digit', minute: '2-digit' });
      if (sunSet?.time) sunset = new Date(sunSet.time).toLocaleTimeString('nb', { hour: '2-digit', minute: '2-digit' });
    } catch {}

    const result = {
      location: LOCATION,
      hours: hours.length ? hours : getMockWeather(),
      sunrise,
      sunset,
      isMock: hours.length === 0,
      fetchedAt: new Date().toISOString(),
    };

    cache = { data: result, fetchedAt: now };
    return result;

  } catch (err) {
    console.error('[weather] Feil ved henting fra yr.no:', err.message);
    const result = {
      location: LOCATION,
      hours: getMockWeather(),
      sunrise: null,
      sunset: null,
      isMock: true,
      fetchedAt: new Date().toISOString(),
    };
    cache = { data: result, fetchedAt: now };
    return result;
  }
}

module.exports = { fetchWeather };
