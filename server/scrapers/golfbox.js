const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const CLUB_GUID   = process.env.CLUB_GUID   || '24E3CA88-C232-44AC-AB4C-004271DBE0FF';
const COOKIE_FILE = path.resolve(process.env.COOKIE_FILE || './cookies.json');

// ── Per-bane cache ──────────────────────────────────────────────────────
const caches = new Map(); // courseId → { data, fetchedAt }
const CACHE_TTL = 30_000; // 30 sekunder

function getCache(courseId) {
  if (!caches.has(courseId)) caches.set(courseId, { data: null, fetchedAt: 0 });
  return caches.get(courseId);
}

// ── Cookie ──────────────────────────────────────────────────────────────
function loadCookie() {
  try {
    const raw = fs.readFileSync(COOKIE_FILE, 'utf8');
    return JSON.parse(raw).cookie || '';
  } catch {
    return '';
  }
}

// ── Demo-data (fulle baller 08:00–19:00, fast seed per dag) ───────────
const DEMO_NAMES = [
  'Ole Martin H.', 'Kari Nordmann', 'Per Hansen',   'Bjørn Eriksen',
  'Anna Larsen',   'Gunnar Moen',   'Lise Berg',    'Tor Andersen',
  'Eva Dahl',      'Finn Olsen',    'Maja K.',       'Lars Bakken',
  'Siri Haugen',   'Rune Strand',   'Pål Viken',    'Ingrid Bakke',
  'Tore Johansen', 'Hilde Solberg', 'Morten Dahl',  'Kristin Olsen',
  'Erik Christensen', 'Anne M. Berg', 'Svein A. Haugen', 'Wenche Strand',
  'Jan Erik Lund', 'Berit Holm',    'Stein Nilsen',  'Monica Aasen',
  'Trond Johansen','Marit Solheim', 'Anders Berge',  'Camilla Foss',
  'Thomas Vold',   'Linda Haug',    'Geir Svendsen', 'Silje Myhre',
  'Oddvar Brekke', 'Nina Strøm',    'Håkon Lie',     'Grete Paulsen',
  'Roar Dybdahl',  'Vibeke Elstad', 'Helge Aas',     'Turid Kolstad',
  'Dag Hovland',   'Astrid Knutsen','Vidar Ruud',    'Solveig Hammer',
];

function getDemoData(interval = 10) {
  // Seed fra dato → lik data hele dagen, men med bedre spredning
  const dateStr = new Date().toISOString().slice(0, 10);
  let seed = 0;
  for (let i = 0; i < dateStr.length; i++) {
    seed = ((seed << 5) - seed + dateStr.charCodeAt(i)) | 0;
  }
  seed = Math.abs(seed) || 12345;
  function rnd(max) {
    seed ^= seed << 13;
    seed ^= seed >> 17;
    seed ^= seed << 5;
    return Math.abs(seed) % max;
  }

  const times = [];
  for (let mins = 8 * 60; mins < 19 * 60; mins += interval) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    // Ca 20% sjanse for ledig tid
    const isEmpty = rnd(10) < 2;
    if (isEmpty) {
      times.push({ time, players: [], status: 'free', isMock: true });
    } else {
      const count = 1 + rnd(4); // 1–4 spillere
      const players = [];
      const used = new Set();
      for (let i = 0; i < count; i++) {
        let ni; let attempts = 0;
        do { ni = rnd(DEMO_NAMES.length); attempts++; } while (used.has(ni) && attempts < 20);
        used.add(ni);
        const hcp = parseFloat((rnd(400) / 10 - 2).toFixed(1)); // -2.0 til 37.9
        players.push({ name: DEMO_NAMES[ni], hcp });
      }
      times.push({ time, players, status: 'full', isMock: true });
    }
  }
  return times;
}

// ── Mock-fallback (ved ingen Golfbox-tilkobling) ───────────────────────
function getMockData() {
  const now = new Date();
  const base = new Date(now);
  base.setMinutes(0, 0, 0);
  if (now.getMinutes() >= 30) base.setHours(base.getHours() + 1);

  const mockPlayers = [
    [{ name: 'Ole Martin H.', hcp: 12.3 }, { name: 'Kari Nordmann', hcp: 18.5 }, { name: 'Per Hansen', hcp: 8.1 }],
    [],
    [{ name: 'Bjørn Eriksen', hcp: 22.0 }, { name: 'Anna Larsen', hcp: 15.4 }],
    [{ name: 'Gunnar Moen', hcp: 5.2 }, { name: 'Lise Berg', hcp: 28.3 }, { name: 'Tor Andersen', hcp: 11.7 }, { name: 'Eva Dahl', hcp: 19.8 }],
    [],
    [{ name: 'Finn Olsen', hcp: 3.1 }],
    [{ name: 'Maja K.', hcp: 25.6 }, { name: 'Lars Bakken', hcp: 14.2 }],
    [{ name: 'Siri Haugen', hcp: 9.4 }, { name: 'Rune Strand', hcp: 16.8 }, { name: 'Pål Viken', hcp: 21.1 }],
  ];

  return Array.from({ length: 8 }, (_, i) => {
    const t = new Date(base.getTime() + i * 60 * 60_000);
    return {
      time: `${String(t.getHours()).padStart(2, '0')}:00`,
      players: mockPlayers[i] || [],
      status: mockPlayers[i]?.length ? 'full' : 'free',
      isMock: true,
    };
  });
}

// ── Hoved-fetch ────────────────────────────────────────────────────────
async function fetchTeeTimes(course) {
  const courseId   = course?.id   || 'sim1';
  const courseGuid = course?.guid || process.env.RESSOURCE_GUID || '87372BC7-60F7-4573-8BCD-F2386EA351EB';
  const isDemo     = course?.isDemo || false;
  const interval   = course?.interval || 60;

  const now = Date.now();
  const c = getCache(courseId);
  if (c.data && now - c.fetchedAt < CACHE_TTL) return c.data;

  // Sesongstengt: før åpningsdato — forhåndsvis starttider FOR åpningsdagen
  let previewDate = null;
  if (course?.openFrom) {
    const opens = new Date(course.openFrom + 'T00:00:00');
    if (Date.now() < opens.getTime()) {
      previewDate = course.openFrom; // YYYY-MM-DD
    }
  }

  // Demo-bane: generer syntetisk data
  if (isDemo) {
    const result = {
      courseId,
      times: getDemoData(interval),
      sessionExpired: false,
      isMock: true,
      isDemo: true,
      fetchedAt: new Date().toISOString(),
    };
    caches.set(courseId, { data: result, fetchedAt: now });
    return result;
  }

  // Golfbox live-fetch
  let cookie = loadCookie();

  if (!cookie) {
    console.warn(`[golfbox] Ingen cookie (${courseId}) – prøver auto-login...`);
    try {
      const { autoLogin } = require('./golfbox-login');
      await autoLogin();
      cookie = loadCookie();
    } catch (err) {
      console.warn('[golfbox] Auto-login feilet:', err.message);
    }
  }

  if (!cookie) {
    console.warn(`[golfbox] Ingen cookie tilgjengelig (${courseId}) – bruker mock-data`);
    const result = { courseId, times: getMockData(), sessionExpired: false, isMock: true, noCredentials: true, ...(previewDate ? { isPreview: true, previewDate } : {}), fetchedAt: new Date().toISOString() };
    caches.set(courseId, { data: result, fetchedAt: now });
    return result;
  }

  // Golfbox SelectedDate-param: YYYYMMDDTHHMMSS (f.eks. 20260501T070000)
  const dateParam = previewDate ? `&SelectedDate=${previewDate.replace(/-/g, '')}T070000` : '';
  const url = `https://www.golfbox.no/site/my_golfbox/ressources/booking/grid.asp`
    + `?Ressource_GUID=${courseGuid}&Club_GUID=${CLUB_GUID}${dateParam}`;

  try {
    const response = await axios.get(url, {
      timeout: 10_000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'nb,no;q=0.9,en-GB;q=0.8',
        'Cookie': cookie,
      },
    });

    const $ = cheerio.load(response.data);

    if ($('body').text().includes('Logg inn') && !$('.list-row').length) {
      console.warn(`[golfbox] Session utløpt (${courseId}) – prøver auto-login...`);
      try {
        const { autoLogin } = require('./golfbox-login');
        const loginResult = await autoLogin();
        if (loginResult?.success) {
          invalidateCache(courseId);
          return fetchTeeTimes(course);
        }
      } catch (loginErr) {
        console.warn('[golfbox] Auto-login feilet:', loginErr.message);
      }
      const result = { courseId, times: getMockData(), sessionExpired: true, isMock: true, ...(previewDate ? { isPreview: true, previewDate } : {}), fetchedAt: new Date().toISOString() };
      caches.set(courseId, { data: result, fetchedAt: now });
      return result;
    }

    const times = [];

    $('.list-row').each((_, row) => {
      const $row = $(row);
      const classes = ($row.attr('class') || '').split(' ');

      // Blokker (ingen .hour, men har egne tidspunkt)
      if (classes.includes('blocking')) {
        const blockText = $row.find('b').first().text().trim();
        const blockedTimes = $row.text().match(/\b(\d{2}:\d{2})\b/g) || [];
        blockedTimes.forEach(t => times.push({ time: t, players: [], status: 'blocked', blockLabel: blockText || 'Blokkert', isMock: false }));
        return;
      }

      if (!classes.includes('hour')) return;

      const timecell = $row.find('.timecell').text().trim();
      const m = timecell.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return;

      const time = `${String(parseInt(m[1])).padStart(2, '0')}:${String(parseInt(m[2])).padStart(2, '0')}`;
      const isExpired = classes.includes('expired');

      if (classes.includes('full')) {
        const players = [];
        // Hent spillere med HCP fra booking-raden
        $row.find('.d-flex.align-items-center.row').each((_, playerRow) => {
          const $p = $(playerRow);
          const name = $p.find('.fw-bold').first().text().trim();
          if (!name || name.length <= 1) return;

          // Hent HCP fra "Hcp:XX,X" div
          let hcp = null;
          $p.find('.col-auto').each((_, col) => {
            const txt = $(col).text().trim();
            const hcpMatch = txt.match(/^Hcp[:\s]*([0-9]+[,.]?[0-9]*)$/i);
            if (hcpMatch) hcp = hcpMatch[1].replace(',', '.');
          });

          players.push({ name, hcp: hcp ? parseFloat(hcp) : null });
        });

        // Fallback: hvis ny parser ikke fant spillere, bruk gammel metode
        if (players.length === 0) {
          $row.find('.fw-bold').each((_, el) => {
            const name = $(el).text().trim();
            if (name && name.length > 1) players.push({ name, hcp: null });
          });
        }

        // Inkluder expired slots – brukes for "forrige" display
        times.push({ time, players, status: 'full', isMock: false, isExpired });
      } else {
        // Expired ledige slots: ikke vis som "ledig" (de er fortid)
        if (!isExpired) {
          times.push({ time, players: [], status: 'free', isMock: false });
        }
      }
    });

    if (times.length === 0) {
      console.warn(`[golfbox] Ingen rader funnet (${courseId}) – bruker mock-data`);
      const result = { courseId, times: getMockData(), sessionExpired: false, isMock: true, ...(previewDate ? { isPreview: true, previewDate } : {}), fetchedAt: new Date().toISOString() };
      caches.set(courseId, { data: result, fetchedAt: now });
      return result;
    }

    times.sort((a, b) => a.time.localeCompare(b.time));

    const result = {
      courseId,
      times,
      sessionExpired: false,
      isMock: false,
      ...(previewDate ? { isPreview: true, previewDate } : {}),
      fetchedAt: new Date().toISOString(),
    };
    caches.set(courseId, { data: result, fetchedAt: now });
    return result;

  } catch (err) {
    console.error(`[golfbox] Feil (${courseId}):`, err.message);
    const result = { courseId, times: getMockData(), sessionExpired: false, isMock: true, ...(previewDate ? { isPreview: true, previewDate } : {}), fetchedAt: new Date().toISOString() };
    caches.set(courseId, { data: result, fetchedAt: now });
    return result;
  }
}

function invalidateCache(courseId) {
  if (courseId) {
    caches.set(courseId, { data: null, fetchedAt: 0 });
  } else {
    caches.clear(); // Invalider alle
  }
}

module.exports = { fetchTeeTimes, invalidateCache };
