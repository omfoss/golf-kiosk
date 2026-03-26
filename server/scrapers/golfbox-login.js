/**
 * Golfbox auto-login via HTTP POST.
 * Logger inn med brukernavn/passord og lagrer sesjonscookies.
 * Ingen Puppeteer nødvendig – ren HTTP-request.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const COOKIE_FILE = path.resolve(__dirname, '../../cookies.json');
const CRED_FILE = path.resolve(__dirname, '../../golfbox-credentials.enc');
const ENC_KEY = (process.env.JWT_SECRET || 'golf-kiosk-secret-change-me').padEnd(32, '0').slice(0, 32);

const LOGIN_URL = 'https://www.golfbox.no/login.asp';

// ── Credentials-håndtering ──────────────────────────────────────────────
function getCredentials() {
  try {
    const raw = JSON.parse(fs.readFileSync(CRED_FILE, 'utf8'));
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENC_KEY, Buffer.from(raw.iv, 'hex'));
    let decrypted = decipher.update(raw.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

// ── Cookie-lagring ──────────────────────────────────────────────────────
function saveCookie(cookieString) {
  fs.writeFileSync(COOKIE_FILE, JSON.stringify({ cookie: cookieString }, null, 2), 'utf8');
  console.log('[golfbox-login] Cookie lagret');
}

// ── HTTP POST login ─────────────────────────────────────────────────────
let loginInProgress = false;
let lastLoginAttempt = 0;
const LOGIN_COOLDOWN = 30_000; // 30 sek mellom forsøk

async function performLogin(username, password) {
  const now = Date.now();
  if (now - lastLoginAttempt < LOGIN_COOLDOWN) {
    const wait = Math.ceil((LOGIN_COOLDOWN - (now - lastLoginAttempt)) / 1000);
    throw new Error(`Vent ${wait} sekunder før neste innloggingsforsøk`);
  }

  if (loginInProgress) {
    throw new Error('Innlogging pågår allerede');
  }

  loginInProgress = true;
  lastLoginAttempt = now;

  console.log('[golfbox-login] Logger inn via HTTP POST...');

  try {
    // POST til Golfbox login
    const params = new URLSearchParams({
      'loginform.submitted': 'true',
      'command': 'login',
      'loginform.username': username,
      'loginform.password': password,
      'redirect': '//www.norskgolf.no',
    });

    const response = await axios.post(LOGIN_URL, params.toString(), {
      timeout: 15_000,
      maxRedirects: 0, // Ikke følg redirects – vi vil ha cookiene
      validateStatus: s => s < 400 || s === 302,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Origin': 'https://www.norskgolf.no',
        'Referer': 'https://www.norskgolf.no/',
      },
    });

    // Hent Set-Cookie headers
    const setCookies = response.headers['set-cookie'] || [];
    if (setCookies.length === 0) {
      // Sjekk om vi ble redirectet (innlogging fungerte)
      const location = response.headers['location'] || '';
      console.log(`[golfbox-login] Status: ${response.status}, Location: ${location}`);
      console.log(`[golfbox-login] Set-Cookie headers: ${setCookies.length}`);

      // Prøv å hente cookies fra response uansett
      if (response.status === 200) {
        // Sjekk body for feilmelding
        const body = typeof response.data === 'string' ? response.data : '';
        if (body.includes('feil') || body.includes('Feil') || body.includes('error')) {
          throw new Error('Feil brukernavn eller passord');
        }
      }
    }

    // Parse cookies fra Set-Cookie headers
    const cookies = setCookies.map(c => c.split(';')[0]).filter(Boolean);
    const cookieString = cookies.join('; ');

    if (!cookieString || !cookieString.includes('ASPSESSION')) {
      // Noen Golfbox-instanser bruker redirect-basert login
      // Prøv å følge redirect og hente cookies derfra
      console.log('[golfbox-login] Ingen ASPSESSION cookie – prøver redirect-flow...');

      const response2 = await axios.post(LOGIN_URL, params.toString(), {
        timeout: 15_000,
        maxRedirects: 5,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
          'Origin': 'https://www.norskgolf.no',
          'Referer': 'https://www.norskgolf.no/',
        },
      });

      // Samle alle cookies fra hele redirect-kjeden
      const allSetCookies = response2.headers['set-cookie'] || [];
      const allCookies = allSetCookies.map(c => c.split(';')[0]).filter(Boolean);
      const fullCookieString = allCookies.join('; ');

      if (fullCookieString && fullCookieString.includes('ASPSESSION')) {
        saveCookie(fullCookieString);
        console.log(`[golfbox-login] Innlogget via redirect! ${allCookies.length} cookies`);
        return { success: true, cookieCount: allCookies.length, message: 'Innlogget i Golfbox' };
      }

      // Siste sjanse – sjekk om body inneholder booking-data
      const body2 = typeof response2.data === 'string' ? response2.data : '';
      if (body2.includes('list-row') || body2.includes('timecell')) {
        console.log('[golfbox-login] Innlogget! (fant booking-data i response)');
        // Hent cookies fra response
        saveCookie(fullCookieString || cookieString);
        return { success: true, cookieCount: allCookies.length || cookies.length, message: 'Innlogget i Golfbox' };
      }

      throw new Error('Innlogging feilet – fikk ikke sesjonscookies fra Golfbox. Sjekk brukernavn og passord.');
    }

    saveCookie(cookieString);
    console.log(`[golfbox-login] Innlogget! ${cookies.length} cookies`);

    return {
      success: true,
      cookieCount: cookies.length,
      message: 'Innlogget i Golfbox',
    };

  } catch (err) {
    if (err.response?.status === 403 || err.response?.status === 401) {
      throw new Error('Feil brukernavn eller passord');
    }
    console.error('[golfbox-login] Feil:', err.message);
    throw err;
  } finally {
    loginInProgress = false;
  }
}

// ── Auto-login (bruker lagrede credentials) ─────────────────────────────
async function autoLogin() {
  const creds = getCredentials();
  if (!creds || !creds.username || !creds.password) {
    console.log('[golfbox-login] Ingen lagrede credentials – hopper over auto-login');
    return null;
  }

  try {
    return await performLogin(creds.username, creds.password);
  } catch (err) {
    console.error('[golfbox-login] Auto-login feilet:', err.message);
    return null;
  }
}

module.exports = {
  performLogin,
  autoLogin,
  getCredentials,
};
