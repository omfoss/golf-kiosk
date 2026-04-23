/**
 * Enkel JSON-basert datalagring.
 * Ingen native-kompilering nødvendig – fungerer på Windows, Mac og Pi.
 * Data lagres i golf-kiosk-data.json ved siden av server/.
 */

const fs   = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../golf-kiosk-data.json');

// ── Standard-data ──────────────────────────────────────────────────────
const DEFAULTS = {
  courses: [
    {
      id: 'sim1',
      name: 'Golfern Sim 1',
      guid: '87372BC7-60F7-4573-8BCD-F2386EA351EB',
      interval: 60,
      isDemo: false,
      active: true,
    },
    {
      id: 'sim2',
      name: 'Golfern Sim 2',
      guid: '',
      interval: 60,
      isDemo: false,
      active: false,
    },
    {
      id: 'utebane',
      name: 'Utebane (18 hull)',
      guid: 'AD716485-249A-4C67-863E-354C5F492140',
      openFrom: '2026-05-01',
      interval: 10,
      isDemo: false,
      active: false,
    },
    {
      id: 'demo',
      name: 'Demo / Test',
      guid: null,
      interval: 10,
      isDemo: true,
      active: true,
    },
  ],
  screens: [
    {
      id: 'lobby',
      name: 'Tee off',
      courseId: 'sim1',
      layout: 'standard',
      modules: ['tee-times', 'weather', 'course-status', 'announcements'],
    },
    {
      id: 'restaurant',
      name: 'Restaurant / bar',
      courseId: 'sim1',
      layout: 'sidebar',
      modules: ['weather', 'announcements', 'cafe-menu', 'tee-times'],
    },
    {
      id: 'proshop',
      name: 'Pro shop',
      courseId: 'sim1',
      layout: 'standard',
      modules: ['tee-times', 'course-status', 'announcements'],
    },
    {
      id: 'utendors',
      name: 'Utendørsskjerm (totem)',
      courseId: 'utebane',
      orientation: 'portrait',
      layout: 'standard',
      columns: [
        ['announcements'],
        ['course-status'],
        ['tee-times'],
        ['weather'],
      ],
    },
  ],
  content: {
    course_status: {
      lastMow: '',
      stimp: '',
      greens: '',
      bunkers: '',
      notes: '',
      openStatus: 'open',
    },
    announcements: [
      { id: 1, text: 'Velkommen til Kongsvingers Golfklubb!', active: true },
    ],
    cafe_menu: {
      specials: '',
      items: [],
      openHours: '',
    },
    contact_info: {
      text: 'Ring oss i Pro-shopen hvis det er noe vi kan hjelpe deg med.',
      phone: '99 999 999',
    },
    crew: {
      members: [
        { name: 'Banemannskap', image: '/bilder/Banemannskap/IMG_6349.jpeg' },
      ],
      message: 'Vi legger sjelen vår i å holde banen i best mulig stand – dette er vår stolthet. Ta godt vare på den når du er ute: fiks nedslagsmerker, raker bunkere og hold tempo. Møter du oss på banen, kan du regne med et smil og et stille «lykke til». God runde!',
    },
    club_info: {
      slope: '137',
      rating: '73.2',
      holes: 18,
      par: 72,
    },
  },
};

// ── Les/skriv til disk ─────────────────────────────────────────────────
function load() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const saved = JSON.parse(raw);
    // Fyll inn manglende nøkler fra defaults (deep merge på content)
    saved.content = { ...DEFAULTS.content, ...saved.content };
    // Migrer: legg til courses hvis mangler
    if (!saved.courses) {
      saved.courses = JSON.parse(JSON.stringify(DEFAULTS.courses));
    }
    // Migrer: legg til manglende forhåndsdefinerte baner
    for (const def of DEFAULTS.courses) {
      if (!saved.courses.find(c => c.id === def.id)) {
        saved.courses.push(JSON.parse(JSON.stringify(def)));
      }
    }
    // Migrer: legg til courseId på skjermer som mangler det
    if (saved.screens) {
      saved.screens = saved.screens.map(s =>
        s.courseId !== undefined ? s : { ...s, courseId: 'sim1' }
      );
    }
    return saved;
  } catch {
    return JSON.parse(JSON.stringify(DEFAULTS)); // deep clone
  }
}

function persist(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// In-memory state
let store = load();

// ── Innhold ────────────────────────────────────────────────────────────
function getContent(key) {
  return store.content[key] ?? null;
}

function setContent(key, value) {
  store.content[key] = value;
  persist(store);
}

// ── Skjermer ───────────────────────────────────────────────────────────
function getScreen(id) {
  return store.screens.find(s => s.id === id) ?? null;
}

function getAllScreens() {
  return store.screens;
}

function upsertScreen(screen) {
  const idx = store.screens.findIndex(s => s.id === screen.id);
  if (idx >= 0) {
    store.screens[idx] = screen;
  } else {
    store.screens.push(screen);
  }
  persist(store);
}

function deleteScreen(id) {
  store.screens = store.screens.filter(s => s.id !== id);
  persist(store);
}

// ── Baner ──────────────────────────────────────────────────────────────
function getAllCourses() {
  return store.courses;
}

function getCourse(id) {
  return store.courses.find(c => c.id === id) ?? null;
}

function upsertCourse(course) {
  const idx = store.courses.findIndex(c => c.id === course.id);
  if (idx >= 0) {
    store.courses[idx] = course;
  } else {
    store.courses.push(course);
  }
  persist(store);
}

function deleteCourse(id) {
  store.courses = store.courses.filter(c => c.id !== id);
  persist(store);
}

module.exports = {
  getContent, setContent,
  getScreen, getAllScreens, upsertScreen, deleteScreen,
  getAllCourses, getCourse, upsertCourse, deleteCourse,
};
