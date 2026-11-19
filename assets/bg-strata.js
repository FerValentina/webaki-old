// ───────── AKI Collector — Strata Background ─────────
// Multi-layer editorial background: aurora mesh + topo lines + data glyphs + noise
// Replaces particle-connect bg. Exposed as window.__initStrata()

(function(){
  let canvas, ctx, W, H, DPR=1;
  let rafId=null, running=false;
  let rawY=0, smoothY=0;
  let mx=-9999, my=-9999, mxSmooth=-9999, mySmooth=-9999;
  let t=0;

  // ─── Theme palette (recomputed on theme change) ───
  let PAL = makePalette('dark');
  function makePalette(theme){
    if (theme === 'light') return {
      base: '#FAFBFD',
      vignette: '5,10,20',
      vignetteMax: .06,
      topoStroke: 'rgba(11,30,60,.10)',
      glyphColor: '3,105,161',
      dotColor: '8,145,178',
      cursorLine: '8,145,178',
      blobs: [
        {x:.18,y:.22,r:.42,s:.000020,col:[8,145,178],  a:.09,phase:0},
        {x:.82,y:.30,r:.38,s:-.000024,col:[3,105,161], a:.09,phase:1.7},
        {x:.48,y:.70,r:.52,s:.000016,col:[14,165,233],a:.07,phase:3.1},
        {x:.78,y:.86,r:.30,s:-.000028,col:[59,130,246],a:.06,phase:2.2},
        {x:.14,y:.82,r:.28,s:.000032,col:[8,145,178], a:.06,phase:4.4},
      ],
      composite: 'multiply',
      glyphAlphaMul: .55,
    };
    return {
      base: '#05080E',
      vignette: '5,8,14',
      vignetteMax: .55,
      topoStroke: 'rgba(104,197,237,.07)',
      glyphColor: '104,197,237',
      dotColor: '1,229,241',
      cursorLine: '1,229,241',
      blobs: [
        {x:.18,y:.22,r:.42,s:.000020,col:[1,229,241],  a:.22,phase:0},
        {x:.82,y:.30,r:.38,s:-.000024,col:[13,157,245], a:.22,phase:1.7},
        {x:.48,y:.70,r:.52,s:.000016,col:[41,171,226], a:.18,phase:3.1},
        {x:.78,y:.86,r:.30,s:-.000028,col:[104,197,237],a:.16,phase:2.2},
        {x:.14,y:.82,r:.28,s:.000032,col:[1,229,241],  a:.14,phase:4.4},
      ],
      composite: 'lighter',
      glyphAlphaMul: 1,
    };
  }
  function refreshPalette(){
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    PAL = makePalette(theme);
    blobs.length = 0;
    PAL.blobs.forEach(b => blobs.push({...b}));
  }

  // ─── Aurora blobs (base layer) — populated from palette ───
  const blobs = PAL.blobs.map(b => ({...b}));

  // ─── Topo contour lines ───
  // Procedural "topographic" using sin/cos composition, rendered as isolines
  const TOPO_STEP=7;      // sample every N px
  const TOPO_LEVELS=6;    // number of isoline levels
  let topoCache=null, topoCacheKey='';

  function topoField(x,y,scroll){
    const ox=x*0.0042, oy=(y+scroll*.15)*0.0042;
    return (
      Math.sin(ox*2.1 + oy*1.3)*0.5 +
      Math.cos(ox*1.1 - oy*2.7)*0.35 +
      Math.sin((ox+oy)*3.2)*0.2
    );
  }

  // ─── Data glyphs (cursor-reactive stream) ───
  const GLYPHS=['0xA3','0xF1','[MN:04]','Cu:1.2%','Au:.82','ppm','tpd','SAG-02','DDH','P3/Q4','1.24%','ton','g/t','id:047','Rajo N','P‖Q','Δt','∑','⌬'];
  const particles=[];
  const NPART=38;

  function seedParticles(){
    particles.length=0;
    for(let i=0;i<NPART;i++){
      particles.push({
        x:Math.random(), y:Math.random(),
        vx:(Math.random()-.5)*.00045,
        vy:(Math.random()-.5)*.00045,
        g:GLYPHS[Math.floor(Math.random()*GLYPHS.length)],
        size:Math.random()*.35+.55,
        a:Math.random()*.35+.15,
        phase:Math.random()*Math.PI*2,
        kind:Math.random()<.65?'glyph':'dot'
      });
    }
  }

  function resize(){
    DPR=Math.min(window.devicePixelRatio||1, 2);
    W=window.innerWidth; H=window.innerHeight;
    canvas.width=W*DPR; canvas.height=H*DPR;
    canvas.style.width=W+'px'; canvas.style.height=H+'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
    topoCache=null;
  }

  // ─── Draw aurora ───
  function drawAurora(){
    ctx.save();
    ctx.globalCompositeOperation=PAL.composite;
    for(const b of blobs){
      const bx=b.x*W + Math.cos(t*b.s*60 + b.phase)*W*.025;
      const by=b.y*H + Math.sin(t*b.s*50 + b.phase)*H*.022 + smoothY*.03;
      const sz=b.r*Math.max(W,H);
      const pulse=.85 + Math.sin(t*.00012 + b.phase)*.15;
      const grd=ctx.createRadialGradient(bx,by,0,bx,by,sz);
      const [r,g,bl]=b.col;
      grd.addColorStop(0, `rgba(${r},${g},${bl},${b.a*pulse})`);
      grd.addColorStop(.5,`rgba(${r},${g},${bl},${b.a*pulse*.3})`);
      grd.addColorStop(1, `rgba(${r},${g},${bl},0)`);
      ctx.fillStyle=grd;
      ctx.fillRect(0,0,W,H);
    }
    ctx.restore();
  }

  // ─── Draw topo isolines (cached per scroll bucket) ───
  function drawTopo(){
    // compute contours with marching-squares lite
    // We rebuild only when scroll-bucket changes to keep cost down
    const scrollBucket=Math.floor(smoothY/10);
    const key=`${W}x${H}x${scrollBucket}`;
    if(key!==topoCacheKey){
      topoCacheKey=key;
      const cols=Math.ceil(W/TOPO_STEP)+2;
      const rows=Math.ceil(H/TOPO_STEP)+2;
      const field=new Float32Array(cols*rows);
      for(let j=0;j<rows;j++){
        for(let i=0;i<cols;i++){
          field[j*cols+i]=topoField(i*TOPO_STEP, j*TOPO_STEP, smoothY);
        }
      }
      topoCache={cols,rows,field};
    }
    const {cols,rows,field}=topoCache;
    ctx.strokeStyle=PAL.topoStroke;
    ctx.lineWidth=.6;
    for(let lv=0; lv<TOPO_LEVELS; lv++){
      const level=-.9 + lv*(1.8/(TOPO_LEVELS-1));
      ctx.beginPath();
      for(let j=0;j<rows-1;j++){
        for(let i=0;i<cols-1;i++){
          const a=field[j*cols+i];
          const b=field[j*cols+i+1];
          const c=field[(j+1)*cols+i+1];
          const d=field[(j+1)*cols+i];
          const x0=i*TOPO_STEP, y0=j*TOPO_STEP, x1=x0+TOPO_STEP, y1=y0+TOPO_STEP;
          // determine which edges cross `level`
          const idx=(a>level?1:0)|((b>level?1:0)<<1)|((c>level?1:0)<<2)|((d>level?1:0)<<3);
          if(idx===0||idx===15) continue;
          const lerp=(v1,v2,p1,p2)=>{
            const t=(level-v1)/(v2-v1);
            return [p1[0]+(p2[0]-p1[0])*t, p1[1]+(p2[1]-p1[1])*t];
          };
          const pTop   =()=>lerp(a,b,[x0,y0],[x1,y0]);
          const pRight =()=>lerp(b,c,[x1,y0],[x1,y1]);
          const pBot   =()=>lerp(d,c,[x0,y1],[x1,y1]);
          const pLeft  =()=>lerp(a,d,[x0,y0],[x0,y1]);
          let p1,p2;
          switch(idx){
            case 1: case 14: p1=pTop();   p2=pLeft();  break;
            case 2: case 13: p1=pTop();   p2=pRight(); break;
            case 3: case 12: p1=pLeft();  p2=pRight(); break;
            case 4: case 11: p1=pRight(); p2=pBot();   break;
            case 5:          p1=pTop();   p2=pRight(); ctx.moveTo(p1[0],p1[1]);ctx.lineTo(p2[0],p2[1]);
                             p1=pLeft();  p2=pBot();   break;
            case 6: case 9:  p1=pTop();   p2=pBot();   break;
            case 7: case 8:  p1=pLeft();  p2=pBot();   break;
            case 10:         p1=pTop();   p2=pLeft();  ctx.moveTo(p1[0],p1[1]);ctx.lineTo(p2[0],p2[1]);
                             p1=pRight(); p2=pBot();   break;
          }
          if(p1&&p2){ ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); }
        }
      }
      ctx.stroke();
    }
  }

  // ─── Draw data glyphs ───
  function drawGlyphs(){
    // smooth mouse
    if(mx>-1000){
      mxSmooth += (mx-mxSmooth)*.12;
      mySmooth += (my-mySmooth)*.12;
    }
    const GRAB=180, GRAB_SQ=GRAB*GRAB;
    ctx.font='500 10px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline='middle';
    for(const p of particles){
      p.x += p.vx; p.y += p.vy;
      if(p.x<-.05) p.x=1.05; if(p.x>1.05) p.x=-.05;
      if(p.y<-.05) p.y=1.05; if(p.y>1.05) p.y=-.05;

      let px=p.x*W, py=p.y*H + smoothY*.015;
      // cursor attraction: drift toward cursor when within GRAB
      if(mx>-1000){
        const dx=px-mxSmooth, dy=py-mySmooth;
        const d2=dx*dx+dy*dy;
        if(d2<GRAB_SQ && d2>1){
          const d=Math.sqrt(d2);
          const pull=(1-d/GRAB)*.22;
          px -= (dx/d)*pull*14;
          py -= (dy/d)*pull*14;
          // highlight line
          ctx.strokeStyle=`rgba(${PAL.cursorLine},${(1-d/GRAB)*.35})`;
          ctx.lineWidth=.5;
          ctx.beginPath(); ctx.moveTo(mxSmooth,mySmooth); ctx.lineTo(px,py); ctx.stroke();
        }
      }
      // twinkle
      const tw = .7 + Math.sin(t*.002 + p.phase)*.3;
      const alpha = p.a * tw * PAL.glyphAlphaMul;
      if(p.kind==='glyph'){
        ctx.fillStyle=`rgba(${PAL.glyphColor},${alpha*.9})`;
        ctx.save();
        ctx.translate(px,py);
        ctx.scale(p.size,p.size);
        ctx.fillText(p.g, 0, 0);
        ctx.restore();
      } else {
        // small accent dot
        ctx.fillStyle=`rgba(${PAL.dotColor},${alpha*.8})`;
        ctx.beginPath();
        ctx.arc(px,py, p.size*1.1, 0, Math.PI*2);
        ctx.fill();
      }
    }
  }

  // ─── Draw vignette + noise ───
  let noisePattern=null;
  function buildNoise(){
    const nc=document.createElement('canvas');
    nc.width=160; nc.height=160;
    const nctx=nc.getContext('2d');
    const img=nctx.createImageData(160,160);
    for(let i=0;i<img.data.length;i+=4){
      const v=Math.random()*255|0;
      img.data[i]=v; img.data[i+1]=v; img.data[i+2]=v;
      img.data[i+3]=18;
    }
    nctx.putImageData(img,0,0);
    noisePattern=ctx.createPattern(nc,'repeat');
  }

  function drawVignetteAndNoise(){
    // vignette (radial, pulsing)
    const pulse=.9 + Math.sin(t*.0001)*.1;
    const grd=ctx.createRadialGradient(W/2,H/2, Math.min(W,H)*.3, W/2,H/2, Math.max(W,H)*.75);
    grd.addColorStop(0,`rgba(${PAL.vignette},0)`);
    grd.addColorStop(1,`rgba(${PAL.vignette},${PAL.vignetteMax*pulse})`);
    ctx.fillStyle=grd;
    ctx.fillRect(0,0,W,H);
    // noise
    if(noisePattern){
      ctx.save();
      ctx.globalAlpha=.35;
      ctx.fillStyle=noisePattern;
      ctx.fillRect(0,0,W,H);
      ctx.restore();
    }
  }

  // ─── Loop ───
  const FPS=1000/40, STEP=1000/40;
  let last=0;
  function loop(now){
    if(!running) return;
    rafId=requestAnimationFrame(loop);
    if(now-last<FPS) return;
    const dt=now-last; last=now-(dt%FPS);
    t += dt;
    smoothY += (rawY-smoothY)*.08;

    // base fill
    ctx.fillStyle=PAL.base;
    ctx.fillRect(0,0,W,H);

    drawAurora();
    drawTopo();
    drawGlyphs();
    drawVignetteAndNoise();
  }

  function start(){
    if(running) return;
    running=true; last=0;
    rafId=requestAnimationFrame(loop);
  }
  function stop(){
    running=false;
    if(rafId){ cancelAnimationFrame(rafId); rafId=null; }
  }

  window.__initStrata = function(canvasEl){
    canvas=canvasEl;
    ctx=canvas.getContext('2d');
    refreshPalette();
    resize(); seedParticles(); buildNoise();
    window.addEventListener('resize', ()=>{ resize(); buildNoise(); });
    window.addEventListener('scroll', ()=>{ rawY=window.scrollY; }, {passive:true});
    window.addEventListener('akicollector:themechange', refreshPalette);
    document.addEventListener('mousemove', e=>{
      mx=e.clientX; my=e.clientY;
      if(mxSmooth<-1000){ mxSmooth=mx; mySmooth=my; }
    });
    document.addEventListener('mouseleave', ()=>{ mx=-9999; my=-9999; });
    document.addEventListener('visibilitychange', ()=>{
      if(document.hidden) stop(); else start();
    });
    start();
    return { start, stop };
  };
})();
