import { writable } from 'svelte/store';

// ── Tee times ──────────────────────────────────────────────────────────
export const teetimes = writable({
  times: [],
  isMock: false,
  sessionExpired: false,
  fetchedAt: null,
});

// ── Vær ────────────────────────────────────────────────────────────────
export const weather = writable({
  location: 'Kongsvinger',
  hours: [],
  isMock: false,
  fetchedAt: null,
});

// ── Innhold (admin-styrt) ──────────────────────────────────────────────
export const courseStatus = writable({
  lastMow: '',
  stimp: '',
  greens: '',
  bunkers: '',
  notes: '',
  openStatus: 'open',
});

export const announcements = writable([]);

export const contactInfo = writable({
  text: '',
  phone: '',
});

export const crew = writable({
  members: [],
  message: '',
});

export const cafeMenu = writable({
  specials: '',
  items: [],
  openHours: '',
});

export const clubInfo = writable({
  slope: '137',
  rating: '73.2',
  holes: 18,
  par: 72,
});

// ── Skjermkonfig ───────────────────────────────────────────────────────
export const screenConfig = writable(null);

// ── Tilkoblingsstatus ──────────────────────────────────────────────────
export const connectionStatus = writable('connecting'); // 'connecting' | 'connected' | 'disconnected'

// Aktiv bane
export const courseName = writable('');
