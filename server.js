const express = require('express')
const fs = require('fs')
const path = require('path')
const bodyParser = require('body-parser')
const puppeteer = require('puppeteer') // or pdfkit

const DATA = path.join(__dirname, 'data', 'patients.json')
const app = express()
app.use(bodyParser.json())
app.use(express.static('public'))

function load(){ return JSON.parse(fs.readFileSync(DATA)||'[]') }
function save(pats){ fs.writeFileSync(DATA, JSON.stringify(pats,null,2)) }

app.get('/api/patients', (req,res)=>res.json(load()))
app.post('/api/patients', (req,res)=>{
  const all = load()
  const p = {...req.body, id: Date.now(), visits: []}
  all.push(p); save(all); res.json(p)
})
app.put('/api/patients/:id', (req,res)=>{
  const all = load()
  const idx=all.findIndex(p=>p.id==req.params.id)
  if(idx<0)return res.sendStatus(404)
  all[idx]=req.body; save(all); res.json(all[idx])
})
app.delete('/api/patients/:id',(req,res)=>{
  const all = load().filter(p=>p.id!=req.params.id)
  save(all); res.sendStatus(204)
})

// add visit (with dandruff level and timestamp, plus captured image data URI)
app.post('/api/patients/:id/visit', (req,res)=>{
  const all=load(); const p=all.find(p=>p.id==req.params.id)
  if(!p) return res.sendStatus(404)
  p.visits.push({...req.body, ts: new Date().toISOString()})
  save(all); res.json(p)
})

// generate PDF via Puppeteer
app.get('/api/patients/:id/pdf', async(req,res)=>{
  const pats = load(), p = pats.find(p=>p.id==req.params.id)
  if(!p) return res.sendStatus(404)
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  const html = `<html><body>
    <h1>Patient ${p.name}</h1>
    ${p.visits.map(v=>`<div><b>${v.ts}</b>: dandruff ${v.dandruff}</div>`).join('')}
  </body></html>`
  await page.setContent(html)
  const pdf = await page.pdf({format:'A4'})
  await browser.close()
  res.set('Content-Type','application/pdf')
  res.send(pdf)
})

app.listen(5000,()=>console.log('Server at http://localhost:5000'))