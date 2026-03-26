import { io } from 'socket.io-client';
import { teetimes, weather, courseStatus, announcements, contactInfo, crew, cafeMenu, clubInfo, screenConfig, connectionStatus } from '../store.js';

let socket = null;
let activeCourseId = null;

export function setActiveCourseId(id) {
  activeCourseId = id;
}

export function connectSocket(screenId = 'unknown') {
  if (socket) return socket;

  socket = io('/', {
    query: { screenId },
    reconnectionDelay: 2000,
    reconnectionAttempts: Infinity,
  });

  socket.on('connect', () => {
    connectionStatus.set('connected');
    console.log('[socket] Tilkoblet');
  });

  socket.on('disconnect', () => {
    connectionStatus.set('disconnected');
    console.log('[socket] Frakoblet');
  });

  socket.on('connect_error', () => {
    connectionStatus.set('disconnected');
  });

  // ── Data-events fra server ─────────────────────────────────────────
  socket.on('teetimes:update', data => {
    // Filtrer på courseId – ta imot hvis ingen filter er satt, eller courseId matcher
    if (!activeCourseId || !data.courseId || data.courseId === activeCourseId) {
      teetimes.set(data);
    }
  });

  socket.on('weather:update', data => {
    weather.set(data);
  });

  socket.on('content:update', ({ key, value }) => {
    if (key === 'course_status')  courseStatus.set(value);
    if (key === 'announcements')  announcements.set(value);
    if (key === 'cafe_menu')      cafeMenu.set(value);
    if (key === 'club_info')      clubInfo.set(value);
    if (key === 'contact_info')   contactInfo.set(value);
    if (key === 'crew')           crew.set(value);
  });

  socket.on('screen:update', ({ screenId: id, screen }) => {
    screenConfig.update(current => {
      if (current?.id === id) return screen;
      return current;
    });
  });

  return socket;
}

export function getSocket() {
  return socket;
}
