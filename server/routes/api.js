const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const { fetchTeeTimes } = require('../scrapers/golfbox');
const { fetchWeather } = require('../scrapers/weather');
const { getContent, getScreen, getAllScreens, getAllCourses, getCourse } = require('../db');

const BILDER_DIR = path.join(__dirname, '../../Bilder');

// GET /api/teetimes?courseId=sim1
router.get('/teetimes', async (req, res) => {
  try {
    const courseId = req.query.courseId;
    let course = courseId
      ? getCourse(courseId)
      : getAllCourses().find(c => c.active);
    const data = await fetchTeeTimes(course || null);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/courses – aktive baner (for Display)
router.get('/courses', (req, res) => {
  res.json(getAllCourses().filter(c => c.active));
});

// GET /api/weather
router.get('/weather', async (req, res) => {
  try {
    const data = await fetchWeather();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/content/:key
router.get('/content/:key', (req, res) => {
  const data = getContent(req.params.key);
  if (!data) return res.status(404).json({ error: 'Innhold ikke funnet' });
  res.json(data);
});

// GET /api/screens – alle skjermer
router.get('/screens', (req, res) => {
  res.json(getAllScreens());
});

// GET /api/screens/:id – én skjerm
router.get('/screens/:id', (req, res) => {
  const screen = getScreen(req.params.id);
  if (!screen) return res.status(404).json({ error: 'Skjerm ikke funnet' });
  res.json(screen);
});

// GET /api/bilder – list alle bildemapper og filer
router.get('/bilder', (req, res) => {
  try {
    if (!fs.existsSync(BILDER_DIR)) {
      return res.json({ categories: [] });
    }
    const categories = fs.readdirSync(BILDER_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(dir => {
        const dirPath = path.join(BILDER_DIR, dir.name);
        const files = fs.readdirSync(dirPath)
          .filter(f => /\.(jpe?g|png|webp|gif|svg)$/i.test(f))
          .map(f => ({
            name: f,
            url: `/bilder/${encodeURIComponent(dir.name)}/${encodeURIComponent(f)}`
          }));
        return { name: dir.name, files };
      })
      .filter(c => c.files.length > 0);
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bilder/:category – bilder i en spesifikk kategori
router.get('/bilder/:category', (req, res) => {
  try {
    const dirPath = path.join(BILDER_DIR, req.params.category);
    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: 'Kategori ikke funnet' });
    }
    const files = fs.readdirSync(dirPath)
      .filter(f => /\.(jpe?g|png|webp|gif|svg)$/i.test(f))
      .map(f => ({
        name: f,
        url: `/bilder/${encodeURIComponent(req.params.category)}/${encodeURIComponent(f)}`
      }));
    res.json({ category: req.params.category, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
