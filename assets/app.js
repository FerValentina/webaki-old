// ───────── AKI Collector — UI scripts ─────────

// ─── CANVAS BACKGROUND ───
const canvas = document.getElementById('bg');
const ctx = canvas.getContext('2d');
let W, H;
function resize(){ W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
resize(); window.addEventListener('resize', resize);

let rawY = 0, smoothY = 0;
window.addEventListener('scroll', () => { rawY = window.scrollY; });

// Background mode: 'strata' (new layered) | 'legacy' (orbs+particles)
const __BG = { mode: (localStorage.getItem('aki_bg') || 'strata') };

// Orbs (brand blue + cyan)
class Orb{
  constructor(bx, by, rad, spd, col){
    this.bx=bx; this.by=by; this.rad=rad; this.spd=spd; this.col=col;
    this.ang=Math.random()*Math.PI*2;
  }
  update(p){
    this.ang+=this.spd;
    this.x = this.bx*W + Math.cos(this.ang)*this.rad*W;
    this.y = this.by*H + Math.sin(this.ang)*this.rad*H + smoothY*0.05;
  }
  draw(){
    const[r,g,b,a]=this.col;
    const sz=this.rad*Math.min(W,H)*1.3;
    const grd=ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,sz);
    grd.addColorStop(0,`rgba(${r},${g},${b},${a})`);
    grd.addColorStop(1,`rgba(${r},${g},${b},0)`);
    ctx.beginPath(); ctx.arc(this.x,this.y,sz,0,Math.PI*2);
    ctx.fillStyle=grd; ctx.fill();
  }
}
const orbs=[
  new Orb(0.15,0.22,0.22,0.0006,[1,229,241,0.12]),
  new Orb(0.82,0.18,0.20,-0.0007,[13,157,245,0.14]),
  new Orb(0.50,0.65,0.28,0.0005,[41,171,226,0.10]),
  new Orb(0.74,0.82,0.18,-0.0007,[104,197,237,0.10]),
  new Orb(0.26,0.80,0.17,0.0009,[1,229,241,0.08]),
];

// Particles + grabbers
const NPART=50, particles=[];
for(let i=0;i<NPART;i++){
  particles.push({
    x:Math.random(),y:Math.random(),
    vx:(Math.random()-0.5)*0.00065, vy:(Math.random()-0.5)*0.00065,
    r:Math.random()*1.6+0.5, a:Math.random()*0.55+0.12
  });
}
let mxN=-999, myN=-999;
document.addEventListener('mousemove', e => { mxN=e.clientX/W; myN=e.clientY/H; });

function drawGrid(){
  const size=48;
  const oy=(smoothY*0.06)%size;
  ctx.strokeStyle='rgba(104,197,237,.045)';
  ctx.lineWidth=0.5; ctx.beginPath();
  for(let x=0;x<W;x+=size){ctx.moveTo(x,0);ctx.lineTo(x,H);}
  for(let y=oy;y<H;y+=size){ctx.moveTo(0,y);ctx.lineTo(W,y);}
  ctx.stroke();
}

const LINK_SQ=85*85, LINK=85, GRAB_SQ=130*130, GRAB=130;
function drawParticles(){
  for(let idx=particles.length-1; idx>=0; idx--){
    const pt=particles[idx];
    pt.x+=pt.vx; pt.y+=pt.vy;
    if(pt.x<0)pt.x=1; if(pt.x>1)pt.x=0;
    if(pt.y<0)pt.y=1; if(pt.y>1)pt.y=0;
    const px=pt.x*W, py=pt.y*H+smoothY*0.02;
    ctx.beginPath(); ctx.arc(px,py,pt.r,0,Math.PI*2);
    ctx.fillStyle=`rgba(1,229,241,${pt.a*0.7})`; ctx.fill();
  }
  ctx.lineWidth=0.4;
  for(let i=0;i<particles.length;i++){
    const ax=particles[i].x*W, ay=particles[i].y*H+smoothY*0.02;
    for(let j=i+1;j<particles.length;j++){
      const dx=ax-particles[j].x*W;
      const dy=ay-(particles[j].y*H+smoothY*0.02);
      const d2=dx*dx+dy*dy;
      if(d2<LINK_SQ){
        const dist=Math.sqrt(d2);
        ctx.strokeStyle=`rgba(104,197,237,${(1-dist/LINK)*0.14})`;
        ctx.beginPath(); ctx.moveTo(ax,ay);
        ctx.lineTo(particles[j].x*W, particles[j].y*H+smoothY*0.02);
        ctx.stroke();
      }
    }
    if(mxN>-100){
      const dx=ax-mxN*W, dy=ay-myN*H;
      const d2=dx*dx+dy*dy;
      if(d2<GRAB_SQ){
        const dist=Math.sqrt(d2);
        ctx.strokeStyle=`rgba(1,229,241,${(1-dist/GRAB)*0.5})`;
        ctx.lineWidth=0.7;
        ctx.beginPath(); ctx.moveTo(mxN*W,myN*H); ctx.lineTo(ax,ay); ctx.stroke();
        ctx.lineWidth=0.4;
      }
    }
  }
}

let rafId=null, FPS=1000/30, last=0;
function loop(now){
  rafId=requestAnimationFrame(loop);
  if(now-last<FPS) return;
  last=now-((now-last)%FPS);
  smoothY += (rawY-smoothY)*0.08;
  ctx.fillStyle='#05080E';
  ctx.fillRect(0,0,W,H);
  drawGrid();
  ctx.save(); ctx.filter='blur(60px)';
  orbs.forEach(o=>{o.update(); o.draw();});
  ctx.restore();
  drawParticles();
}
document.addEventListener('visibilitychange', ()=>{
  if(__BG.mode!=='legacy') return;
  if(document.hidden){ if(rafId){cancelAnimationFrame(rafId); rafId=null;} }
  else{ if(!rafId){last=0; rafId=requestAnimationFrame(loop);} }
});

// Start either strata (new) or legacy bg
function __bgStart(){
  if(rafId){cancelAnimationFrame(rafId); rafId=null;}
  if(window.__strataCtl){ window.__strataCtl.stop(); }
  if(__BG.mode==='strata' && window.__initStrata){
    window.__strataCtl = window.__initStrata(canvas);
  } else {
    last=0;
    rafId=requestAnimationFrame(loop);
  }
}
__bgStart();
window.__setBgMode = function(m){
  __BG.mode = (m==='legacy') ? 'legacy' : 'strata';
  localStorage.setItem('aki_bg', __BG.mode);
  __bgStart();
};

// ─── HERO ANIMATION — From chaos to database ───
(function(){
  const anim=document.getElementById('heroAnim');
  if(!anim) return;
  const stage=anim.querySelector('.ha-stage');
  const cellsWrap=anim.querySelector('.ha-cells');
  const tableBody=document.getElementById('haTableBody');
  const tagText=document.getElementById('haTagText');
  const progFill=document.getElementById('haProg');
  const countEl=document.getElementById('haCount');
  const steps=anim.querySelectorAll('.ha-tl-step');

  const tagsES=['caos','parse','estructura','base de datos'];
  const tagsEN=['chaos','parse','schema','database'];
  const rows=[
    ['MN-01','Sondaje DDH-047','1.24% Cu','Rajo N'],
    ['MN-02','Plan prod. P3-Q4','18.420 tpd','Mina'],
    ['MN-03','Muestreo geoquím.','0.82 g/t Au','Sond. 112'],
    ['MN-04','Molino SAG-02','94.2% torque','Planta'],
    ['MN-05','Tronadura B-2870','2.148 ton','Rajo S'],
    ['MN-06','Ley concentrado','28.7% Cu','Flotación'],
    ['MN-07','Mantención CV-04','22/10','Planta'],
  ];

  let phase=0, tick=0, count=0, rafActive=true;

  function buildCells(){
    cellsWrap.innerHTML='';
    const N=24;
    for(let i=0;i<N;i++){
      const c=document.createElement('div');
      c.className='ha-cell';
      const ang=Math.random()*Math.PI*2;
      const dist=70+Math.random()*80;
      c.style.setProperty('--sx', Math.cos(ang)*dist+'px');
      c.style.setProperty('--sy', Math.sin(ang)*dist+'px');
      c.style.animationDelay=(Math.random()*0.5)+'s';
      cellsWrap.appendChild(c);
    }
  }

  function populateTable(){
    tableBody.innerHTML='';
    rows.forEach((r,i)=>{
      const row=document.createElement('div');
      row.className='ha-row';
      row.style.animationDelay=(i*.08)+'s';
      row.innerHTML=`<div>${r[0]}</div><div>${r[1]}</div><div>${r[2]}</div><div>${r[3]}</div>`;
      tableBody.appendChild(row);
    });
  }

  function setPhase(p){
    phase=p;
    stage.className='ha-stage phase-'+p;
    anim.className='hero-anim phase-'+p;
    const lang=document.documentElement.getAttribute('data-lang')||'es';
    const labels=lang==='es'?tagsES:tagsEN;
    tagText.textContent=labels[p];
    steps.forEach((s,i)=>s.classList.toggle('active', i===p));
    if(p===1) buildCells();
    if(p===3) populateTable();
  }

  // progress + count ticker
  function tickLoop(){
    if(!rafActive) return;
    tick++;
    count=(count+17)%10000;
    countEl.textContent=String(count).padStart(4,'0');
    // progress bar fills per cycle (~9s total)
    const cyc=(tick%180)/180; // 180 ticks ≈ 9s at 20fps
    progFill.style.right=(100-cyc*100)+'%';
    setTimeout(tickLoop, 50);
  }

  // phase scheduler — loop every 9s
  function schedule(){
    setPhase(0);
    setTimeout(()=>setPhase(1), 2200);
    setTimeout(()=>setPhase(2), 4000);
    setTimeout(()=>setPhase(3), 5500);
    setTimeout(schedule, 9000);
  }

  // init table structure class
  anim.classList.add('hero-anim','phase-0');
  schedule();
  tickLoop();

  // pause when off-screen
  const io=new IntersectionObserver(entries=>{
    entries.forEach(e=>{ rafActive=e.isIntersecting; if(rafActive) tickLoop(); });
  },{threshold:0.1});
  io.observe(anim);
})();

// ─── NAV scroll state ───
const navEl=document.getElementById('nav');
window.addEventListener('scroll', ()=>{ navEl.classList.toggle('scrolled', window.scrollY>60); });

// ─── REVEAL ───
const revObs=new IntersectionObserver((entries)=>{
  entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('visible'); revObs.unobserve(e.target); } });
},{threshold:0.12});
document.querySelectorAll('.rv,.rvl,.rvr').forEach(el=>revObs.observe(el));

// ─── LANGUAGE ───
const html=document.documentElement;
const lang=document.getElementById('langToggle');
function setLang(l){ html.setAttribute('data-lang', l); window.dispatchEvent(new CustomEvent('akicollector:langchange',{detail:{lang:l}})); }
lang.addEventListener('click', ()=>{ setLang(html.getAttribute('data-lang')==='es'?'en':'es'); });
lang.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' ') lang.click(); });

// ─── THEME ───
(function(){
  const mql = window.matchMedia('(prefers-color-scheme: light)');
  const btn = document.getElementById('themeToggle');
  function apply(theme, persist){
    html.setAttribute('data-theme', theme);
    if (persist) localStorage.setItem('aki_theme', theme);
    window.dispatchEvent(new CustomEvent('akicollector:themechange',{detail:{theme}}));
  }
  // Follow system changes ONLY if user hasn't manually overridden
  mql.addEventListener && mql.addEventListener('change', e=>{
    if (!localStorage.getItem('aki_theme')) apply(e.matches?'light':'dark', false);
  });
  if (btn){
    btn.addEventListener('click', ()=>{
      const current = html.getAttribute('data-theme') || 'dark';
      apply(current==='dark'?'light':'dark', true);
    });
  }
  // Swap logo src on theme change
  function updateLogos(){
    const t = html.getAttribute('data-theme');
    document.querySelectorAll('[data-logo-src]').forEach(el=>{
      const pair = el.getAttribute('data-logo-src').split('|'); // "darkSrc|lightSrc"
      el.src = t==='light' ? pair[1] : pair[0];
    });
  }
  window.addEventListener('akicollector:themechange', updateLogos);
  updateLogos();
})();

// ─── AUDIT LOG ───
(function(){
  const feed=document.getElementById('auditFeed');
  if(!feed) return;
  const esActions=[
    ['ana@empresa.com','subió','Ventas_Q4.xlsx'],
    ['carlos@corp.io','modificó','Inventario_nov.csv'],
    ['sistema','validó','3.241 registros'],
    ['luis@retail.com','exportó','Reporte_BI.json'],
    ['maria@salud.org','creó','Proyecto Farma'],
    ['sistema','sincronizó','App móvil → BD central'],
    ['jorge@logistica.cl','eliminó','Borrador_test.txt'],
    ['admin','asignó rol','Editor → carlos@corp.io'],
  ];
  const enActions=[
    ['ana@company.com','uploaded','Sales_Q4.xlsx'],
    ['carlos@corp.io','modified','Inventory_nov.csv'],
    ['system','validated','3,241 records'],
    ['luis@retail.com','exported','BI_Report.json'],
    ['maria@health.org','created','Pharma Project'],
    ['system','synced','Mobile app → Central DB'],
    ['jorge@logistics.cl','deleted','Draft_test.txt'],
    ['admin','assigned role','Editor → carlos@corp.io'],
  ];
  let i=0;
  function add(){
    const l=html.getAttribute('data-lang')||'es';
    const list=l==='es'?esActions:enActions;
    const[u,a,t]=list[i%list.length];
    const d=new Date();
    const ts=d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0')+':'+d.getSeconds().toString().padStart(2,'0');
    const row=document.createElement('div');
    row.className='log-entry';
    row.innerHTML=`<span class="log-time">${ts}</span><span class="log-user">${u}</span><span class="log-act">${a} ${t}</span>`;
    feed.insertBefore(row, feed.firstChild);
    if(feed.children.length>4) feed.removeChild(feed.lastChild);
    i++;
  }
  add(); add(); add();
  setInterval(add, 2800);
})();

// ─── PRICING TOGGLE ───
let isAnnual=false;
function togglePricing(){
  isAnnual=!isAnnual;
  document.getElementById('priceToggle').classList.toggle('on', isAnnual);
  document.querySelectorAll('.pa-num').forEach(el=>{
    el.textContent = isAnnual ? el.dataset.annual : el.dataset.monthly;
  });
  document.getElementById('ptLabelMes')?.classList.toggle('active', !isAnnual);
  document.getElementById('ptLabelMonth')?.classList.toggle('active', !isAnnual);
  document.getElementById('ptLabelAnual')?.classList.toggle('active', isAnnual);
  document.getElementById('ptLabelAnnual')?.classList.toggle('active', isAnnual);
}
document.getElementById('priceToggle').addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' ') togglePricing(); });
window.togglePricing=togglePricing;

// ─── TABS ───
function switchTab(name, btn){
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  btn.classList.add('active');
}
window.switchTab=switchTab;

// ─── FAQ ───
function measureFaq(item){
  const ans=item.querySelector('.faq-a');
  const lang=document.documentElement.getAttribute('data-lang')||'es';
  const inner=item.querySelector('.faq-a-inner.'+lang) || item.querySelector('.faq-a-inner');
  // Temporarily allow natural height to measure, then set max-height explicitly
  const prev=ans.style.maxHeight;
  ans.style.maxHeight='none';
  const h=ans.scrollHeight;
  ans.style.maxHeight=prev; // force restart of transition
  // force reflow then set target height
  void ans.offsetHeight;
  ans.style.maxHeight=h+'px';
}
function toggleFaq(btn){
  const item=btn.parentElement;
  const ans=item.querySelector('.faq-a');
  const isOpen=item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(i=>{ i.classList.remove('open'); i.querySelector('.faq-a').style.maxHeight='0'; });
  if(!isOpen){
    item.classList.add('open');
    measureFaq(item);
  }
}
// Re-measure the currently open FAQ when language toggles
window.addEventListener('akicollector:langchange',()=>{
  // wait for the display:none / display:block swap to reflow
  requestAnimationFrame(()=>{
    document.querySelectorAll('.faq-item.open').forEach(measureFaq);
  });
});
window.toggleFaq=toggleFaq;

// ─── MODAL ───
function openModal(){ document.getElementById('modal').classList.add('open'); document.body.style.overflow='hidden'; }
function closeModal(){ document.getElementById('modal').classList.remove('open'); document.body.style.overflow=''; }
function closeModalOutside(e){ if(e.target===document.getElementById('modal')) closeModal(); }


function submitForm(e) {
  // evitar que la  página se recargue o se vaya a Google
  e.preventDefault(); 
  
  const form = e.target;
  const submitButton = form.querySelector('.form-submit');
  const l = document.documentElement.getAttribute('data-lang') || 'es';
  
  // 
  const scriptURL = 'https://script.google.com/macros/s/AKfycbxhcNTz8ipnRBBZwodkSKKLX6rfcwjzXtsROYadPJb9A6BVPfTZPSEASD9Uyp5eP1t3eQ/exec'; 

  // Feedback visual: deshabilitar botón mientras envía
  const originalText = submitButton.innerHTML;
  submitButton.innerText = (l === 'es' ? 'Enviando...' : 'Sending...');
  submitButton.disabled = true;

  // enviar datos por detrás 
  fetch(scriptURL, { 
    method: 'POST', 
    body: new FormData(form),
    mode: 'no-cors' 
  })
  .then(() => {
    // mostrar mensaje
    alert(l === 'es' 
      ? '¡Gracias! Nos pondremos en contacto contigo pronto para agendar tu demo.' 
      : 'Thank you! We will contact you soon to schedule your demo.'
    );
    form.reset();
    closeModal();
  })
  .catch(error => {
    console.error('Error!', error);
    alert('Error al enviar. Revisa tu conexión.');
  })
  .finally(() => {
    // Restaurar el botón original
    submitButton.innerHTML = originalText;
    submitButton.disabled = false;
  });
}




// ─── SMOOTH SCROLL (no ScrollIntoView) ───
document.querySelectorAll('a[href^="#"]').forEach(a=>{
  a.addEventListener('click', e=>{
    const href=a.getAttribute('href');
    if(href.length<2) return;
    const target=document.querySelector(href);
    if(target){
      e.preventDefault();
      const y=target.getBoundingClientRect().top + window.pageYOffset - 70;
      window.scrollTo({top:y, behavior:'smooth'});
    }
  });
});
