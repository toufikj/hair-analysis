const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');

const app = express(), PORT = 5000;
const DATA_DIR = path.join(__dirname, 'data');
const IMG_DIR = path.join(DATA_DIR, 'images');
const DATA_FILE = path.join(DATA_DIR, 'patients.json');

app.use(bodyParser.json({ limit: '30mb' }));
app.use(express.static('public'));
app.use('/data/images', express.static(path.join(DATA_DIR, 'images')));

function ensureDir(d){ if(!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
ensureDir(DATA_DIR); ensureDir(IMG_DIR);

function loadPatients(){
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]'); }
  catch { return []; }
}
function savePatients(p){ fs.writeFileSync(DATA_FILE, JSON.stringify(p, null, 2)); }

app.get('/api/patients', (req,res) => res.json(loadPatients()));
app.get('/api/patients/:id', (req,res) => {
  const p = loadPatients().find(x => x.id == req.params.id);
  p ? res.json(p) : res.sendStatus(404);
});
app.post('/api/patients', (req,res) => {
  const { name, age, gender } = req.body;
  if (!name || !age || !gender) return res.status(400).json({ error: 'All fields required' });
  const p = { ...req.body, id: Date.now(), visits: [] };
  const all = loadPatients(); all.push(p); savePatients(all);
  res.json(p);
});
app.put('/api/patients/:id', (req,res) => {
  const all = loadPatients(), idx = all.findIndex(x => x.id == req.params.id);
  if (idx < 0) return res.sendStatus(404);
  all[idx] = req.body; savePatients(all);
  res.json(all[idx]);
});
app.delete('/api/patients/:id', (req,res) => {
  const all = loadPatients().filter(x => x.id != req.params.id);
  savePatients(all);
  res.sendStatus(204);
});
app.post('/api/patients/:id/visit', (req,res) => {
  const all = loadPatients(), p = all.find(x => x.id == req.params.id);
  if (!p) return res.sendStatus(404);
  const { dandruff, inflammation, position, imageData } = req.body;
  if (!dandruff || !inflammation || !position) {
    return res.status(400).json({ error: 'All visit fields required' });
  }
  const ts = Date.now();
  const visit = { ts: new Date().toISOString(), dandruff, inflammation, position, imageFile: null };
  if (imageData) {
    const buf = Buffer.from(imageData.split(',')[1], 'base64');
    const d = path.join(IMG_DIR, String(p.id)); ensureDir(d);
    const fname = `visit-${ts}-${position}.jpg`;
    fs.writeFileSync(path.join(d, fname), buf);
    visit.imageFile = `data/images/${p.id}/${fname}`;
  }
  p.visits.push(visit); savePatients(all);
  res.json(p);
});
app.delete('/api/patients/:id/visit/:i', (req,res) => {
  const all = loadPatients(), p = all.find(x => x.id == req.params.id);
  if (!p) return res.sendStatus(404);
  p.visits.splice(req.params.i, 1); savePatients(all);
  res.json(p);
});
app.get('/api/patients/:id/pdf', (req,res) => {
  const all = loadPatients(), p = all.find(x => x.id == req.params.id);
  if (!p) return res.sendStatus(404);
  const doc = new PDFDocument({ margin: 30 });
  res.setHeader('Content-Type', 'application/pdf');
  doc.pipe(res);
  doc.fontSize(18).text(`Patient: ${p.name}`, { underline: true }).moveDown();

  p.visits.forEach((v, idx) => {
    doc.fontSize(12).text(`Visit ${idx+1}: ${new Date(v.ts).toLocaleString()}`);
    doc.text(`Position: ${v.position}, Dandruff: ${v.dandruff}, Inflammation: ${v.inflammation}`);
    if (v.imageFile) {
      const ip = path.join(__dirname, v.imageFile);
      if (fs.existsSync(ip)) try { doc.image(ip, { width: 120 }).moveDown(); } catch {}
    }
    doc.moveDown();
  });

  doc.end();
});
app.listen(PORT, () => console.log(`Server at http://localhost:${PORT}`));

