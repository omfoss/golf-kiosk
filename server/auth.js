require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

// ── Konfig ──────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'golf-kiosk-secret-change-me';
const JWT_EXPIRES = '24h';
const DATA_FILE = path.join(__dirname, '../golf-kiosk-data.json');

// ── Passord-håndtering ──────────────────────────────────────────────────
function getStoredHash() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return data.adminPasswordHash || null;
  } catch {
    return null;
  }
}

function setStoredHash(hash) {
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {}
  data.adminPasswordHash = hash;
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Ved første oppstart: hash passordet fra .env og lagre det
function ensurePasswordHashed() {
  const existing = getStoredHash();
  if (existing) return; // Allerede hashet

  const plainPassword = process.env.ADMIN_PASSWORD || 'golfklubb2025';
  const hash = bcrypt.hashSync(plainPassword, 12);
  setStoredHash(hash);
  console.log('[auth] Admin-passord hashet og lagret');
}

// Kjør ved import
ensurePasswordHashed();

// ── Rate-limiting ───────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutter
  max: 10, // maks 10 forsøk per IP
  message: { error: 'For mange innloggingsforsøk. Prøv igjen om 15 minutter.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── JWT-middleware ───────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  // Sjekk Authorization: Bearer <token>
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Autentisering påkrevd' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sesjonen har utløpt. Logg inn på nytt.' });
    }
    return res.status(401).json({ error: 'Ugyldig token' });
  }
}

// ── Login-handler ───────────────────────────────────────────────────────
async function loginHandler(req, res) {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Passord mangler' });
  }

  const hash = getStoredHash();
  if (!hash) {
    return res.status(500).json({ error: 'Ingen passordhash funnet. Sjekk serveroppsett.' });
  }

  const match = await bcrypt.compare(password, hash);
  if (!match) {
    return res.status(403).json({ error: 'Feil passord' });
  }

  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ ok: true, token });
}

// ── Endre passord ───────────────────────────────────────────────────────
async function changePasswordHandler(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Mangler nåværende og nytt passord' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Nytt passord må være minst 6 tegn' });
  }

  const hash = getStoredHash();
  const match = await bcrypt.compare(currentPassword, hash);
  if (!match) {
    return res.status(403).json({ error: 'Feil nåværende passord' });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  setStoredHash(newHash);
  res.json({ ok: true, message: 'Passord endret' });
}

module.exports = {
  requireAuth,
  loginHandler,
  changePasswordHandler,
  loginLimiter,
};
