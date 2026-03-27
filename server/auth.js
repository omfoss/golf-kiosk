require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

// ── Konfig ──────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'golf-kiosk-secret-change-me';
const JWT_EXPIRES = '30d'; // 30 dager – slipper å logge inn ofte
const DATA_FILE = path.join(__dirname, '../golf-kiosk-data.json');

// ── Bruker-håndtering ───────────────────────────────────────────────────
function getUsers() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return data.users || [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {}
  data.users = users;
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Opprett standardbruker ved første oppstart
function ensureDefaultUser() {
  const users = getUsers();
  if (users.length > 0) return;

  const defaultPin = process.env.ADMIN_PIN || '1234';
  const hash = bcrypt.hashSync(defaultPin, 10);
  saveUsers([
    {
      id: 'admin',
      name: 'Administrator',
      role: 'admin',
      pinHash: hash,
      createdAt: new Date().toISOString(),
    },
  ]);
  console.log('[auth] Standardbruker opprettet (PIN: ' + defaultPin + ')');
}

ensureDefaultUser();

// ── Rate-limiting ───────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'For mange innloggingsforsøk. Prøv igjen om 15 minutter.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── JWT-middleware ───────────────────────────────────────────────────────
function requireAuth(req, res, next) {
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
  const { username, pin } = req.body;
  if (!username || !pin) {
    return res.status(400).json({ error: 'Brukernavn og PIN mangler' });
  }

  const users = getUsers();
  const user = users.find(u => u.name.toLowerCase() === username.toLowerCase() || u.id === username.toLowerCase());

  if (!user) {
    return res.status(403).json({ error: 'Feil brukernavn eller PIN' });
  }

  const match = await bcrypt.compare(pin, user.pinHash);
  if (!match) {
    return res.status(403).json({ error: 'Feil brukernavn eller PIN' });
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  res.json({ ok: true, token, user: { id: user.id, name: user.name, role: user.role } });
}

// ── Bruker-CRUD (kun admin) ─────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Kun administratorer kan gjøre dette' });
  }
  next();
}

function listUsersHandler(req, res) {
  const users = getUsers().map(u => ({
    id: u.id,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt,
  }));
  res.json(users);
}

async function createUserHandler(req, res) {
  const { name, pin, role } = req.body;
  if (!name || !pin) {
    return res.status(400).json({ error: 'Navn og PIN mangler' });
  }
  if (pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin)) {
    return res.status(400).json({ error: 'PIN må være 4-8 siffer' });
  }

  const users = getUsers();
  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

  if (users.find(u => u.id === id)) {
    return res.status(409).json({ error: 'Brukernavn finnes allerede' });
  }

  const hash = bcrypt.hashSync(pin, 10);
  users.push({
    id,
    name,
    role: role || 'editor',
    pinHash: hash,
    createdAt: new Date().toISOString(),
  });

  saveUsers(users);
  res.json({ ok: true, user: { id, name, role: role || 'editor' } });
}

async function changePinHandler(req, res) {
  const { userId, currentPin, newPin } = req.body;

  if (!newPin || newPin.length < 4 || newPin.length > 8 || !/^\d+$/.test(newPin)) {
    return res.status(400).json({ error: 'Ny PIN må være 4-8 siffer' });
  }

  const users = getUsers();
  const targetId = userId || req.user.id;
  const user = users.find(u => u.id === targetId);

  if (!user) {
    return res.status(404).json({ error: 'Bruker ikke funnet' });
  }

  // Admin kan endre andres PIN uten gammelt passord
  if (targetId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Ikke tilgang' });
  }

  // Hvis du endrer din egen PIN, krev gammelt
  if (targetId === req.user.id && currentPin) {
    const match = await bcrypt.compare(currentPin, user.pinHash);
    if (!match) {
      return res.status(403).json({ error: 'Feil nåværende PIN' });
    }
  }

  user.pinHash = bcrypt.hashSync(newPin, 10);
  saveUsers(users);
  res.json({ ok: true });
}

function deleteUserHandler(req, res) {
  const { userId } = req.params;

  if (userId === req.user.id) {
    return res.status(400).json({ error: 'Du kan ikke slette deg selv' });
  }

  const users = getUsers().filter(u => u.id !== userId);
  saveUsers(users);
  res.json({ ok: true });
}

module.exports = {
  requireAuth,
  requireAdmin,
  loginHandler,
  loginLimiter,
  listUsersHandler,
  createUserHandler,
  changePinHandler,
  deleteUserHandler,
};
