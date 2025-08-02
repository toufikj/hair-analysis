let current = null

async function load(){ return fetch('/api/patients').then(r=>r.json()) }
async function showList(){
  const list = await load()
  document.getElementById('patient-list').innerHTML = list.map(p=>
    `<div onclick="select(${p.id})">${p.name}</div>`).join('')
}
function showAdd(){ document.getElementById('form').style.display='block' }
async function add(){
  const name = document.getElementById('name').value
  await fetch('/api/patients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})})
  await showList()
  document.getElementById('form').style.display='none'
}

async function select(id){
  current = (await load()).find(p=>p.id==id)
  renderVisits()
  renderChart()
}

function renderVisits(){
  const html = current.visits.map((v,i)=>
    `<div>Visit ${i+1} - ${v.ts} - dandruff: ${v.dandruff}</div>`).join('')
  document.getElementById('visits').innerHTML = html + `<button onclick="addVisit()">Add Visit</button>`
}

async function addVisit(){
  // simulate capture: prompt dandruff level
  const dandruff = prompt('Level low/medium/high')
  // simulate USB camera by using file input
  const imageData = ''
  await fetch(`/api/patients/${current.id}/visit`,{
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({dandruff,imageData})
  })
  current = (await load()).find(p=>p.id==current.id)
  renderVisits()
  renderChart()
}

function renderChart(){
  const ctx = document.getElementById('chart').getContext('2d')
  const labels = current.visits.map(v=>new Date(v.ts).toLocaleString())
  const data = current.visits.map(v=>{
    return {low:1, medium:2, high:3}[v.dandruff]||0
  })
  new Chart(ctx,{type:'bar',data:{labels, datasets:[{label:'Dandruff level',data} ] } })
}

function generatePdf(){
  window.open(`/api/patients/${current.id}/pdf`)
}

showList()
