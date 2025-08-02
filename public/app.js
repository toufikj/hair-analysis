let current = null, currentPosition = '', currentChart = null;

async function fetchAll() { return fetch('/api/patients').then(r => r.json()); }
async function refreshList() {
  const list = await fetchAll();
  document.getElementById('patient-list').innerHTML = list.map(p =>
    `<div onclick="selectPatient(${p.id})">${p.name} (${p.age}, ${p.gender})</div>`).join('');
}

document.getElementById('add-patient-btn').onclick = () => {
  document.getElementById('form-section').classList.remove('hidden');
};

document.getElementById('save-patient-btn').onclick = async () => {
  const p = {
    name: document.getElementById('name').value,
    age: document.getElementById('age').value,
    gender: document.getElementById('gender').value
  };
  await fetch('/api/patients', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(p) });
  document.getElementById('form-section').classList.add('hidden');
  refreshList();
};

window.selectPatient = async (id) => {
  current = await fetch(`/api/patients/${id}`).then(r => r.json());
  document.getElementById('current-name').innerText = `${current.name} (${current.age}, ${current.gender})`;
  document.getElementById('visit-section').classList.remove('hidden');
  await populateDevices();
  renderVisits();
  renderChart();
};

document.getElementById('delete-patient-btn').onclick = async () => {
  if (!confirm('Delete this patient?')) return;
  await fetch(`/api/patients/${current.id}`, { method:'DELETE' });
  current = null;
  document.getElementById('visit-section').classList.add('hidden');
  refreshList();
};

document.querySelectorAll('.positions button').forEach(b => {
  b.onclick = () => currentPosition = b.getAttribute('data-pos');
});

async function populateDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const vd = devices.filter(d => d.kind === 'videoinput');
  document.getElementById('device-select').innerHTML = vd.map(d =>
    `<option value="${d.deviceId}">${d.label || 'Camera'}</option>`).join('');
}

document.getElementById('start-camera-btn').onclick = async () => {
  const id = document.getElementById('device-select').value;
  const stream = await navigator.mediaDevices.getUserMedia({ video:{ deviceId:{ exact:id } } });
  document.getElementById('video').srcObject = stream;
  document.getElementById('capture-btn').classList.remove('disabled');
};

document.getElementById('capture-btn').onclick = () => {
  if (!currentPosition) return alert('Select a position');
  const v = document.getElementById('video'), c = document.getElementById('canvas'), p = document.getElementById('photo');
  c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v,0,0);
  p.src = c.toDataURL('image/jpeg');
  p.setAttribute('data-pos', currentPosition);
};

document.getElementById('add-visit-btn').onclick = async () => {
  const dandruff = document.getElementById('dandruff-select').value;
  const inflammation = document.getElementById('inflammation-select').value;
  const position = document.getElementById('photo').getAttribute('data-pos');
  const img = document.getElementById('photo').src;
  await fetch(`/api/patients/${current.id}/visit`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ dandruff, inflammation, position, imageData: img })
  });
  current = await fetch(`/api/patients/${current.id}`).then(r => r.json());
  renderVisits();
  renderChart();
};

async function deleteVisit(index) {
  if (!confirm('Delete this visit?')) return;
  current = await fetch(`/api/patients/${current.id}/visit/${index}`, { method:'DELETE' }).then(r => fetch(`/api/patients/${current.id}`)).then(r => r.json());
  renderVisits(); renderChart();
}

function renderVisits() {
  document.getElementById('visits').innerHTML = current.visits.map((v,i) => `
    <div class="visit-card">
      <div><strong>Visit ${i+1}</strong> ${new Date(v.ts).toLocaleString()}</div>
      <div>Pos: ${v.position} | Dandruff: ${v.dandruff} | Inflammation: ${v.inflammation}</div>
      ${v.imageFile ? `<img src="${v.imageFile}" class="thumb"><br/>
       <button onclick="deleteVisit(${i})">Delete Visit</button>` : ''}
    </div>`).join('');
}

function renderChart() {
  const labels = current.visits.map(v => new Date(v.ts).toLocaleString());
  const data = current.visits.map(v => ({ low:1, medium:2, high:3 })[v.dandruff] || 0);
  const ctx = document.getElementById('chart').getContext('2d');
  if (currentChart) currentChart.destroy();
  currentChart = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ label:'Dandruff', data, backgroundColor:'#27ae60' }] },
    options:{ scales:{ y:{ beginAtZero:true, ticks:{ stepSize:1, callback: val => ['','Low','Medium','High'][val] } } } }
  });
}

document.getElementById('pdf-btn').onclick = () => window.open(`/api/patients/${current.id}/pdf`);
refreshList();

