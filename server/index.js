require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const apiRoutes    = require('./routes/api');
const adminRoutes  = require('./routes/admin');
const uploadRoutes = require('./routes/upload');
const { fetchTeeTimes } = require('./scrapers/golfbox');
const { fetchWeather }  = require('./scrapers/weather');
const { getAllCourses }  = require('./db');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

const PORT = parseInt(process.env.PORT || '3001', 10);
const DIST = path.resolve(__dirname, '..', 'client', 'dist');

// ── Middleware ─────────────────────────────────────────────────────────
app.use(express.json());

// Gjør io tilgjengelig i route-handlers via req.io
app.use((req, _, next) => { req.io = io; next(); });

// ── API-ruter ──────────────────────────────────────────────────────────
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/upload', uploadRoutes);

// ── Statiske filer ─────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
app.use('/bilder',  express.static(path.join(__dirname, '../Bilder')));
app.use('/images',  express.static(path.join(__dirname, '../public/images')));
app.use(express.static(DIST));

// SPA-fallback: alle ikke-API ruter server index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/bilder') || req.path.startsWith('/uploads')) return next();
  if (req.path.includes('.') && !req.path.endsWith('.html')) return next();

  const index = path.resolve(DIST, 'index.html');
  res.sendFile(index, err => {
    if (err) res.status(404).send('Klient ikke bygget. Kjør: npm run build');
  });
});

// ── Socket.io ──────────────────────────────────────────────────────────
io.on('connection', socket => {
  const screenId = socket.handshake.query.screenId || 'unknown';
  console.log(`[socket] Tilkoblet: ${socket.id} (skjerm: ${screenId})`);

  socket.on('disconnect', () => {
    console.log(`[socket] Frakoblet: ${socket.id}`);
  });
});

// ── Bakgrunnsoppdateringer ─────────────────────────────────────────────
const TEE_INTERVAL     = 60_000;       // 60 sek
const WEATHER_INTERVAL = 30 * 60_000;  // 30 min

async function refreshTeetimes() {
  const courses = getAllCourses().filter(c => c.active);
  for (const course of courses) {
    try {
      const data = await fetchTeeTimes(course);
      io.emit('teetimes:update', { courseId: course.id, ...data });
    } catch (err) {
      console.error(`[server] Feil ved refresh av starttider (${course.id}):`, err.message);
    }
  }
}

async function refreshWeather() {
  try {
    const data = await fetchWeather();
    io.emit('weather:update', data);
  } catch (err) {
    console.error('[server] Feil ved refresh av vær:', err.message);
  }
}

// Start umiddelbart, deretter på intervall
refreshTeetimes();
refreshWeather();
setInterval(refreshTeetimes, TEE_INTERVAL);
setInterval(refreshWeather, WEATHER_INTERVAL);

// ── Start server ───────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n⛳  Golf Kiosk v2 kjører på http://localhost:${PORT}`);
  console.log(`   Display:  http://localhost:${PORT}/display/lobby`);
  console.log(`   Admin:    http://localhost:${PORT}/admin`);
  console.log(`   API:      http://localhost:${PORT}/api/teetimes\n`);
});
