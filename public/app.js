let current=null, currentPos='', chartObj=null;
async function fetchAll(){return fetch('/api/patients').then(r=>r.json());}
async function refreshList(){
  const ps=await fetchAll();
  document.getElementById('patient-list').innerHTML=ps.map(p=>`<div onclick="choose(${p.id})">${p.name} (${p.age},${p.gender})</div>`).join('');
}

document.getElementById('add-patient-btn').onclick=()=>document.getElementById('form-section').classList.remove('hidden');
document.getElementById('save-patient-btn').onclick=async()=>{
  if(!confirm('Save new patient?')) return;
  const p={name:document.getElementById('name').value,age:document.getElementById('age').value,gender:document.getElementById('gender').value};
  await fetch('/api/patients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});
  document.getElementById('form-section').classList.add('hidden'); refreshList();
};

window.choose=async id=>{
  current=await fetch(`/api/patients/${id}`).then(r=>r.json());
  document.getElementById('current-name').innerText=`${current.name} (${current.age},${current.gender})`;
  document.getElementById('visit-section').classList.remove('hidden');
  await loadDevices(); showVisits(); drawChart();
};

document.getElementById('delete-patient-btn').onclick=async()=>{
  if(!confirm('Delete patient permanently?')) return;
  await fetch(`/api/patients/${current.id}`,{method:'DELETE'});
  current=null; document.getElementById('visit-section').classList.add('hidden'); refreshList();
};

document.querySelectorAll('.positions button').forEach(b=>b.onclick=()=>currentPos=b.getAttribute('data-pos'));

async function loadDevices(){
  const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
  document.getElementById('device-select').innerHTML=devices.map(d=>`<option value="${d.deviceId}">${d.label||'Cam'}</option>`).join('');
}

document.getElementById('start-camera-btn').onclick=async()=>{
  const id=document.getElementById('device-select').value;
  const stream=await navigator.mediaDevices.getUserMedia({video:{deviceId:{exact:id}}});
  document.getElementById('video').srcObject=stream;
  document.getElementById('capture-btn').classList.remove('disabled');
};

document.getElementById('capture-btn').onclick=()=>{
  if(!currentPos)return alert('Select position'); 
  const v=document.getElementById('video'),c=document.getElementById('canvas');
  c.width=v.videoWidth; c.height=v.videoHeight;
  c.getContext('2d').drawImage(v,0,0);
  document.getElementById('photo').src=c.toDataURL('image/jpeg');
  document.getElementById('photo').setAttribute('data-pos',currentPos);
};

document.getElementById('add-visit-btn').onclick=async()=>{
  if(!confirm('Add this visit?'))return;
  const dand=document.getElementById('dandruff-select').value;
  const infl=document.getElementById('inflammation-select').value;
  const pos=document.getElementById('photo').getAttribute('data-pos');
  const img=document.getElementById('photo').src;
  await fetch(`/api/patients/${current.id}/visit`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dandruff:dand,inflammation:infl,position:pos,imageData:img})
  });
  current=await fetch(`/api/patients/${current.id}`).then(r=>r.json());
  showVisits(); drawChart();
};

async function removeVisit(i){
  if(!confirm('Delete this visit?'))return;
  current=await fetch(`/api/patients/${current.id}/visit/${i}`,{method:'DELETE'})
    .then(()=>fetch(`/api/patients/${current.id}`)).then(r=>r.json());
  showVisits(); drawChart();
}

function showVisits(){
  document.getElementById('visits').innerHTML=current.visits.map((v,i)=>`
    <div class="visit-card">
      <strong>Visit ${i+1}</strong>${new Date(v.ts).toLocaleString()}<br/>
      Pos: ${v.position} | Dandruff: ${v.dandruff} | Inflammation: ${v.inflammation}<br/>
      ${v.imageFile?`<img src="${v.imageFile}" class="thumb"><br/>`:''}
      <button onclick="removeVisit(${i})">Delete Visit</button>
    </div>`).join('');
}

function drawChart(){
  if(chartObj)chartObj.destroy();
  const labels=current.visits.map(v=>new Date(v.ts).toLocaleDateString());
  const dand=current.visits.map(v=>({low:1,medium:2,high:3}[v.dandruff]||1));
  const infl=current.visits.map(v=>({none:0,mild:1,moderate:2,severe:3}[v.inflammation]||0));
  const ctx=document.getElementById('chart').getContext('2d');
  chartObj=new Chart(ctx,{type:'bar',data:{
    labels,
    datasets:[
      {label:'Dandruff',data:dand,backgroundColor:'#e67e22'},
      {label:'Inflammation',data:infl,backgroundColor:'#c0392b'}
    ]
  },options:{scales:{y:{beginAtZero:true,ticks:{stepSize:1,callback:v=>['','Low','Medium','High'][v]}}}}});
}

document.getElementById('pdf-btn').onclick=()=>window.open(`/api/patients/${current.id}/pdf`);
refreshList();

