const express = require('express');
const router = express.Router();

const { requireAuth, loginHandler, changePasswordHandler, loginLimiter } = require('../auth');
const {
  getContent, setContent,
  getAllScreens, getScreen, upsertScreen, deleteScreen,
  getAllCourses, getCourse, upsertCourse, deleteCourse,
} = require('../db');
const { invalidateCache } = require('../scrapers/golfbox');
const fs = require('fs');
const path = require('path');

// ── Auth ───────────────────────────────────────────────────────────────
router.post('/login', loginLimiter, loginHandler);

// Alle ruter under /api/admin/* krever autentisering (JWT)
router.use(requireAuth);

// Endre passord (krever innlogging)
router.post('/change-password', changePasswordHandler);

// ── Skjermadministrasjon ───────────────────────────────────────────────
router.get('/screens', (req, res) => {
  res.json(getAllScreens());
});

router.get('/screens/:id', (req, res) => {
  const screen = getScreen(req.params.id);
  if (!screen) return res.status(404).json({ error: 'Skjerm ikke funnet' });
  res.json(screen);
});

router.put('/screens/:id', (req, res) => {
  const { name, layout, modules, columns, courseId } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Mangler felt: name' });
  }
  const screenData = {
    id: req.params.id,
    name,
    layout: layout || 'standard',
    courseId: courseId || null,
  };
  if (Array.isArray(modules))  screenData.modules  = modules;
  if (Array.isArray(columns))  screenData.columns  = columns;

  upsertScreen(screenData);
  const updated = getScreen(req.params.id);

  // Push til alle tilkoblede skjermer
  req.io.emit('screen:update', { screenId: req.params.id, screen: updated });

  res.json(updated);
});

router.post('/screens', (req, res) => {
  const { id, name, layout, modules, columns, courseId } = req.body;
  if (!id || !name) {
    return res.status(400).json({ error: 'Mangler felt: id, name' });
  }
  const screenData = { id, name, layout: layout || 'standard', courseId: courseId || null };
  if (Array.isArray(modules)) screenData.modules = modules;
  if (Array.isArray(columns)) screenData.columns = columns;
  upsertScreen(screenData);
  res.status(201).json(getScreen(id));
});

router.delete('/screens/:id', (req, res) => {
  deleteScreen(req.params.id);
  res.json({ ok: true });
});

// ── Baneadministrasjon ─────────────────────────────────────────────────
router.get('/courses', (req, res) => {
  res.json(getAllCourses());
});

router.post('/courses', (req, res) => {
  const { id, name, guid, interval, isDemo, active } = req.body;
  if (!id || !name) {
    return res.status(400).json({ error: 'Mangler felt: id, name' });
  }
  upsertCourse({
    id,
    name,
    guid: guid || null,
    interval: interval || 60,
    isDemo: isDemo || false,
    active: active !== false,
  });
  res.status(201).json(getCourse(id));
});

router.put('/courses/:id', (req, res) => {
  const existing = getCourse(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Bane ikke funnet' });
  const { name, guid, interval, isDemo, active } = req.body;
  const updated = {
    ...existing,
    name:     name     !== undefined ? name     : existing.name,
    guid:     guid     !== undefined ? guid     : existing.guid,
    interval: interval !== undefined ? interval : existing.interval,
    isDemo:   isDemo   !== undefined ? isDemo   : existing.isDemo,
    active:   active   !== undefined ? active   : existing.active,
  };
  upsertCourse(updated);
  // Invalider cache for banen
  invalidateCache(req.params.id);
  res.json(getCourse(req.params.id));
});

router.delete('/courses/:id', (req, res) => {
  deleteCourse(req.params.id);
  invalidateCache(req.params.id);
  res.json({ ok: true });
});

// ── Innholdsadministrasjon ─────────────────────────────────────────────
router.get('/content', (req, res) => {
  const keys = ['course_status', 'announcements', 'cafe_menu', 'club_info'];
  const result = {};
  keys.forEach(k => { result[k] = getContent(k); });
  res.json(result);
});

router.put('/content/:key', (req, res) => {
  const { key } = req.params;
  const allowed = ['course_status', 'announcements', 'cafe_menu', 'club_info', 'contact_info', 'crew'];
  if (!allowed.includes(key)) {
    return res.status(400).json({ error: 'Ugyldig nøkkel' });
  }
  setContent(key, req.body);

  // Push oppdatert innhold til alle tilkoblede skjermer
  req.io.emit('content:update', { key, value: req.body });

  res.json({ ok: true, key, value: req.body });
});

// ── Golfbox refresh ────────────────────────────────────────────────────
router.post('/refresh-teetimes', async (req, res) => {
  const { fetchTeeTimes } = require('../scrapers/golfbox');
  const { courseId } = req.body || {};

  try {
    if (courseId) {
      // Refresh én bestemt bane
      invalidateCache(courseId);
      const course = getCourse(courseId);
      const data = await fetchTeeTimes(course || null);
      req.io.emit('teetimes:update', { courseId, ...data });
      res.json({ ok: true, courseId, fetchedAt: data.fetchedAt });
    } else {
      // Refresh alle aktive baner
      invalidateCache();
      const courses = getAllCourses().filter(c => c.active);
      let lastFetchedAt = null;
      for (const course of courses) {
        const data = await fetchTeeTimes(course);
        req.io.emit('teetimes:update', { courseId: course.id, ...data });
        lastFetchedAt = data.fetchedAt;
      }
      res.json({ ok: true, fetchedAt: lastFetchedAt });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Golfbox login via HTTP ────────────────────────────────────────────
router.post('/golfbox/login', async (req, res) => {
  try {
    const { performLogin, getCredentials } = require('../scrapers/golfbox-login');
    const creds = getCredentials();
    if (!creds || !creds.username || !creds.password) {
      return res.status(400).json({ error: 'Ingen Golfbox-innlogging lagret. Gå til Golfbox-fanen og legg inn brukernavn og passord.' });
    }
    const result = await performLogin(creds.username, creds.password);
    // Refresh alle aktive live-baner med ny cookie
    invalidateCache();
    const { fetchTeeTimes } = require('../scrapers/golfbox');
    const courses = getAllCourses().filter(c => c.active && !c.isDemo);
    for (const course of courses) {
      const data = await fetchTeeTimes(course);
      req.io.emit('teetimes:update', { courseId: course.id, ...data });
    }
    res.json({ ...result, teeTimesUpdated: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test Golfbox-credentials uten å lagre
router.post('/golfbox/test-login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Brukernavn og passord er påkrevd' });
  }
  try {
    const { performLogin } = require('../scrapers/golfbox-login');
    const result = await performLogin(username, password);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Golfbox-innstillinger ────────────────────────────────────────────────
const COOKIE_FILE = path.resolve(__dirname, '../../cookies.json');

// Hent status (bruker første aktive live-bane)
router.get('/golfbox/status', async (req, res) => {
  const { fetchTeeTimes } = require('../scrapers/golfbox');
  try {
    let hasCookie = false;
    let cookiePreview = '';
    try {
      const raw = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8'));
      hasCookie = !!raw.cookie;
      cookiePreview = raw.cookie ? raw.cookie.substring(0, 60) + '…' : '';
    } catch {}

    // Test med første aktive live-bane
    const course = getAllCourses().find(c => c.active && !c.isDemo);
    if (course) invalidateCache(course.id);
    const data = await fetchTeeTimes(course || null);

    res.json({
      hasCookie,
      cookiePreview,
      sessionExpired: data.sessionExpired || false,
      isMock: data.isMock || false,
      teeTimes: data.times?.length || 0,
      fetchedAt: data.fetchedAt,
      courseId: data.courseId,
      golfboxUrl: course
        ? `https://www.golfbox.no/site/my_golfbox/ressources/booking/grid.asp?Ressource_GUID=${course.guid}&Club_GUID=${process.env.CLUB_GUID || '24E3CA88-C232-44AC-AB4C-004271DBE0FF'}`
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Oppdater cookie
router.put('/golfbox/cookie', (req, res) => {
  const { cookie } = req.body;
  if (!cookie || typeof cookie !== 'string') {
    return res.status(400).json({ error: 'Mangler cookie-streng' });
  }
  try {
    fs.writeFileSync(COOKIE_FILE, JSON.stringify({ cookie }, null, 2), 'utf8');
    invalidateCache();
    res.json({ ok: true, message: 'Cookie oppdatert' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Slett cookie
router.delete('/golfbox/cookie', (req, res) => {
  try {
    if (fs.existsSync(COOKIE_FILE)) {
      fs.writeFileSync(COOKIE_FILE, JSON.stringify({ cookie: '' }, null, 2), 'utf8');
    }
    invalidateCache();
    res.json({ ok: true, message: 'Cookie slettet' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Golfbox-credentials (kryptert) ──────────────────────────────────────
const crypto = require('crypto');
const CRED_FILE = path.resolve(__dirname, '../../golfbox-credentials.enc');
const ENC_KEY = (process.env.JWT_SECRET || 'golf-kiosk-secret-change-me').padEnd(32, '0').slice(0, 32);

function encryptCredentials(data) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENC_KEY, iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { iv: iv.toString('hex'), data: encrypted };
}

function decryptCredentials() {
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

router.get('/golfbox/credentials', (req, res) => {
  const creds = decryptCredentials();
  if (!creds) return res.json({ hasCredentials: false });
  res.json({
    hasCredentials: true,
    username: creds.username,
    hasPassword: !!creds.password,
  });
});

router.put('/golfbox/credentials', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Brukernavn og passord er påkrevd' });
  }
  try {
    const encrypted = encryptCredentials({ username, password });
    fs.writeFileSync(CRED_FILE, JSON.stringify(encrypted, null, 2), 'utf8');
    res.json({ ok: true, message: 'Golfbox-innlogging lagret' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/golfbox/credentials', (req, res) => {
  try {
    if (fs.existsSync(CRED_FILE)) fs.unlinkSync(CRED_FILE);
    res.json({ ok: true, message: 'Golfbox-innlogging slettet' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
