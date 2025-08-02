const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = 5000;
const DATA_DIR = path.join(__dirname, 'data');
const IMAGE_DIR = path.join(DATA_DIR, 'images');
const DATA_FILE = path.join(DATA_DIR, 'patients.json');

app.use(bodyParser.json({ limit: '20mb' }));
app.use(express.static('public'));
app.use('/data/images', express.static(path.join(DATA_DIR, 'images')));

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
ensureDir(DATA_DIR);
ensureDir(IMAGE_DIR);

function loadPatients() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]');
  } catch {
    return [];
  }
}

function savePatients(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET all patients
app.get('/api/patients', (req, res) => res.json(loadPatients()));

// GET single patient
app.get('/api/patients/:id', (req, res) => {
  const p = loadPatients().find(x => x.id == req.params.id);
  if (!p) return res.sendStatus(404);
  res.json(p);
});

// ADD patient
app.post('/api/patients', (req, res) => {
  const all = loadPatients();
  const patient = { ...req.body, id: Date.now(), visits: [] };
  all.push(patient);
  savePatients(all);
  res.json(patient);
});

// DELETE patient
app.delete('/api/patients/:id', (req, res) => {
  const all = loadPatients().filter(x => x.id != req.params.id);
  savePatients(all);
  res.sendStatus(204);
});

// UPDATE patient (name or metrics)
app.put('/api/patients/:id', (req, res) => {
  const all = loadPatients();
  const idx = all.findIndex(x => x.id == req.params.id);
  if (idx < 0) return res.sendStatus(404);
  all[idx] = req.body;
  savePatients(all);
  res.json(all[idx]);
});

// ADD visit
app.post('/api/patients/:id/visit', (req, res) => {
  const all = loadPatients();
  const p = all.find(x => x.id == req.params.id);
  if (!p) return res.sendStatus(404);

  const visitTime = Date.now();
  const visit = {
    ts: new Date().toISOString(),
    dandruff: req.body.dandruff,
    inflammation: req.body.inflammation || 'none',
    position: req.body.position,
    imageFile: null
  };

  if (req.body.imageData) {
    const base64 = req.body.imageData.split(',')[1];
    const dir = path.join(IMAGE_DIR, String(p.id));
    ensureDir(dir);
    const fname = `visit-${visitTime}-${visit.position}.jpg`;
    fs.writeFileSync(path.join(dir, fname), Buffer.from(base64, 'base64'));
    visit.imageFile = `data/images/${p.id}/${fname}`;
  }

  p.visits.push(visit);
  savePatients(all);
  res.json(p);
});

// DELETE a visit
app.delete('/api/patients/:id/visit/:index', (req, res) => {
  const all = loadPatients();
  const p = all.find(x => x.id == req.params.id);
  if (!p) return res.sendStatus(404);
  p.visits.splice(req.params.index, 1);
  savePatients(all);
  res.json(p);
});

// PDF export
app.get('/api/patients/:id/pdf', (req, res) => {
  const all = loadPatients();
  const p = all.find(x => x.id == req.params.id);
  if (!p) return res.sendStatus(404);
  const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf');
  doc.pipe(res);
  doc.fontSize(20).text(`Patient Report: ${p.name}`, { underline: true }).moveDown();
  p.visits.forEach((v, idx) => {
    doc.fontSize(14).text(`Visit ${idx+1} - ${v.ts}`);
    doc.text(`Position: ${v.position}, Dandruff: ${v.dandruff}, Inflammation: ${v.inflammation}`);
    if (v.imageFile) try { doc.image(path.join(__dirname, v.imageFile), { width: 150 }).moveDown(); } catch {}
  });
  doc.end();
});

app.listen(PORT, () => console.log(`Server at http://localhost:${PORT}`));

