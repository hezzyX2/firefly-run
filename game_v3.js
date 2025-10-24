// Firefly Run — Pro Edition (v3) — patched button wiring & robust init
(function () {
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function init(){
    const $ = (s)=>document.querySelector(s);
    const on = (sel, ev, fn)=>{
      const el = typeof sel==='string' ? $(sel) : sel;
      if(!el) return;
      el.addEventListener(ev, function(e){
        if(e && e.preventDefault) e.preventDefault();
        try { fn(e); } catch(err){ console.error('Handler error for', sel, err); }
      });
    };
    // Panel
    let panel = $('#panel');
    if(!panel){ panel = document.createElement('section'); panel.id='panel'; panel.className='panel hidden'; document.body.appendChild(panel); }
    const show=(html)=>{ panel.innerHTML=html; panel.classList.remove('hidden'); };
    const hide=()=>panel.classList.add('hidden');
    // Background
    const bg = $('#bg');
    if(bg && bg.getContext){
      const b = bg.getContext('2d');
      (function loop(ts){
        const w=bg.width,h=bg.height;
        b.clearRect(0,0,w,h);
        const g=b.createLinearGradient(0,0,0,h); g.addColorStop(0,'#0b2c1b'); g.addColorStop(1,'#06180d');
        b.fillStyle=g; b.fillRect(0,0,w,h);
        b.globalAlpha=.15; b.fillStyle='#0f3a20';
        for(let i=0;i<8;i++){ const y=40+i*44+Math.sin(ts*0.0005+i)*6; const x=((ts*0.03+i*140)%(w+240))-240;
          b.beginPath(); b.ellipse(x,y,200,36,0,0,Math.PI*2); b.fill(); }
        b.globalAlpha=1; for(let y=0;y<h;y+=24){ for(let x=0;x<w;x+=24){ b.fillStyle=((x/24+y/24)%2==0)?'#135a24':'#0c3b17'; b.fillRect(x,y,24,24);}}
        requestAnimationFrame(loop);
      })(performance.now());
    }
    // Core
    const W=960,H=520, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const rectI=(a,b)=>!(a.x+a.w<b.x||b.x+b.w<a.x||a.y+a.h<b.y||b.y+b.h<a.y);
    const R=(x,y,w,h)=>({x,y,w,h});
    function cRect(px,py,pr,r){const cx=clamp(px,r.x,r.x+r.w),cy=clamp(py,r.y,r.y+r.h); const dx=px-cx,dy=py-cy; return dx*dx+dy*dy<=pr*pr; }
    const AudioK = (function(){
      let ac, master, vol = parseFloat(localStorage.getItem('ffp_vol')||'0.6'), mut = localStorage.getItem('ffp_mute')==='1';
      function ensure(){ if(mut) return null; try{ if(!ac){ ac=new (window.AudioContext||window.webkitAudioContext)(); master=ac.createGain(); master.gain.value=vol; master.connect(ac.destination);} if(ac.state==='suspended') ac.resume(); return {ac,master,vol}; }catch(e){ console.warn('Audio init failed',e); return null; } }
      function bip(f=660,d=.07){ const ctx=ensure(); if(!ctx) return; const n=ac.currentTime,o=ac.createOscillator(),g=ac.createGain(); o.type='sine'; o.frequency.value=f; g.gain.setValueAtTime(.0001,n); g.gain.exponentialRampToValueAtTime(Math.max(.001,vol),n+.01); g.gain.exponentialRampToValueAtTime(.0001,n+d+.05); o.connect(g); g.connect(master); o.start(n); o.stop(n+d+.05); }
      return {bip, set:(v)=>{vol=v;localStorage.setItem('ffp_vol',v); if(master) master.gain.value=v;}};
    })();
    const save={best: JSON.parse(localStorage.getItem('ffp_best')||'{}'), unlocked: parseInt(localStorage.getItem('ffp_unlocked')||'1',10)};
    const DIFF={NORMAL:{pR:10,pS:3.6,eM:1.0},HARD:{pR:11,pS:3.2,eM:1.25},INSANE:{pR:12,pS:3.0,eM:1.55}};
    let diff=localStorage.getItem('ffp_diff')||'HARD';
    const LV=[]; function addL(start,goal,walls,tok,enm){ LV.push({start,goal,walls,tok,enm}); }
    function line(y,n,s){ const a=[]; const step=(W-160)/(Math.max(1,n)-1||1); for(let i=0;i<n;i++) a.push({r:R(120+i*step-8,y-8,16,16), path=[[120+i*step,y],[W-120-i*step,y]], speed:s, bounce:true}); return a; }
    addL([80,260],R(W-120,240,40,60),[R(0,0,W,20),R(0,H-20,W,20),R(0,0,20,H),R(W-20,0,20,H),R(220,120,20,280),R(420,120,20,280),R(620,120,20,280)],[R(300,90,20,20),R(520,430,20,20),R(740,90,20,20)],
     [{r:R(140,260,16,16),path:[[140,100],[140,420]],speed:3,bounce:true},{r:R(340,260,16,16),path:[[340,100],[340,420]],speed:3,bounce:true},{r:R(540,260,16,16),path:[[540,100],[540,420]],speed:3,bounce:true},{r:R(740,260,16,16),path:[[740,100],[740,420]],speed:3,bounce:true}]);
    for(let i=2;i<=20;i++){ const y1=100+((i*37)%280), y2=H-100-((i*53)%280);
      const walls=[R(0,0,W,20),R(0,H-20,W,20),R(0,0,20,H),R(W-20,0,20,H), R(160,y1,W-320,20), R(160,y2,W-320,20)];
      const tok=[R(240,60,20,20),R(W-260,H-80,20,20),R(W/2-10,H/2-10,20,20)];
      const enm=line(y1-40,3+((i%3)),4+(i%4)).concat(line(y2+40,3+((i+1)%3),4+((i+2)%4)));
      addL([80,(i%2)?80:H-80], R(W-120,(i%2)?H-120:80,40,60), walls, tok, enm);
    }
    let __ctx=null;
    function mountCtx(){ if(__ctx) return __ctx; let wrap=document.querySelector('.canvasWrap'); if(!wrap){ wrap=document.createElement('div'); wrap.className='canvasWrap'; document.body.appendChild(wrap); } let c=document.getElementById('game'); if(!c){ c=document.createElement('canvas'); c.id='game'; c.width=960; c.height=520; wrap.appendChild(c); } __ctx=c.getContext('2d'); return __ctx; }
    function hedge(r){ const c=mountCtx(); c.fillStyle='#2a8d4e'; c.fillRect(r.x,r.y,r.w,r.h); c.strokeStyle='#0d411e'; c.lineWidth=2; c.strokeRect(r.x,r.y,r.w,r.h); }
    function glade(g){ const c=mountCtx(); c.fillStyle='#b5ec7f'; c.fillRect(g.x,g.y,g.w,g.h); c.strokeStyle='#2b5a2a'; c.lineWidth=2; c.strokeRect(g.x,g.y,g.w,g.h); }
    function firefly(t,ts){ const c=mountCtx(); const cx=t.x+t.w/2,cy=t.y+t.h/2,r=6+2*(.5+.5*Math.sin(ts*0.01+(cx+cy)*.02)); const grd=c.createRadialGradient(cx,cy,0,cx,cy,r*3); grd.addColorStop(0,'rgba(255,220,0,.9)'); grd.addColorStop(1,'rgba(255,220,0,0)'); c.fillStyle=grd; c.beginPath(); c.arc(cx,cy,r*3,0,Math.PI*2); c.fill(); c.fillStyle='#ffdc00'; c.beginPath(); c.arc(cx,cy,r,0,Math.PI*2); c.fill(); }
    function tx(s,x,y,sz=18,c='#f3ffe9'){ const ctx=mountCtx(); ctx.font=`bold ${sz}px ui-rounded, ui-sans-serif`; ctx.lineWidth=4; ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.strokeText(s,x,y); ctx.fillStyle=c; ctx.fillText(s,x,y); }
    let keys={};
    function boot(i){ runLevel(Math.max(0, Math.min(i, LV.length-1))); }
    function runLevel(i){
      const L=LV[i], tset=DIFF[diff]; let t=0, tokens=L.tok.map(o=>({ ...o }));
      const walls=L.walls.map(o=>({...o})), goal={...L.goal};
      const enemies=L.enm.map(e=>({r:{...e.r}, path:e.path.map(p=>({x:p[0],y:p[1]})), speed:e.speed, bounce:!!e.bounce, idx:0, dir:1}));
      const p={x:L.start[0], y:L.start[1], r:tset.pR, s:tset.pS};
      let run=true, lf=performance.now();
      function step(dt){
        t+=dt; let vx=(keys['ArrowRight']||keys['d']||keys['D']?1:0)-(keys['ArrowLeft']||keys['a']||keys['A']?1:0);
        let vy=(keys['ArrowDown']||keys['s']||keys['S']?1:0)-(keys['ArrowUp']||keys['w']||keys['W']?1:0);
        const sp=p.s*((vx&&vy)?1.414:1); p.x=clamp(p.x+(vx? (vx>0?1:-1):0)*sp, p.r, 960-p.r); p.y=clamp(p.y+(vy? (vy>0?1:-1):0)*sp, p.r, 520-p.r);
        const pr={x:p.x-p.r,y:p.y-p.r,w:p.r*2,h:p.r*2}; for(const w of walls){ if(rectI(pr,w)){ die(); return; } }
        const mul=DIFF[diff].eM; for(const e of enemies){ const tgt=e.path[e.idx+e.dir]||e.path[e.idx]; let dx=tgt.x-(e.r.x+e.r.w/2), dy=tgt.y-(e.r.y+e.r.h/2); const dist=Math.hypot(dx,dy)||1; const s=e.speed*mul; if(dist<=s){ e.r.x=tgt.x-e.r.w/2; e.r.y=tgt.y-e.r.h/2; if(e.bounce){ if(e.idx+e.dir>=e.path.length-1 || e.idx+e.dir<0) e.dir*=-1; else e.idx+=e.dir; } else { e.idx=(e.idx+1)%e.path.length; } } else { e.r.x+=Math.round(s*dx/dist); e.r.y+=Math.round(s*dy/dist); } if(cRect(p.x,p.y,p.r,e.r)){ die(); return; } }
        const before=tokens.length; tokens=tokens.filter(o=>!cRect(p.x,p.y,p.r,o)); if(tokens.length<before) AudioK.bip(1200,.05);
        if(tokens.length===0 && cRect(p.x,p.y,p.r,goal)){ win(t); return; }
      }
      function draw(ts){
        const c=mountCtx(); c.clearRect(0,0,960,520); for(const w of walls) hedge(w); glade(goal); for(const to of tokens) firefly(to,ts);
        for(const e of enemies){ c.fillStyle='#e14d4d'; c.fillRect(e.r.x,e.r.y,e.r.w,e.r.h); c.strokeStyle='#5a1010'; c.lineWidth=2; c.strokeRect(e.r.x,e.r.y,e.r.w,e.r.h); }
        c.fillStyle='#fff'; c.beginPath(); c.arc(p.x,p.y,p.r,0,Math.PI*2); c.fill(); c.lineWidth=2; c.strokeStyle='#8dcf7a'; c.beginPath(); c.arc(p.x,p.y,p.r,0,Math.PI*2); c.stroke();
        tx(`Level ${i+1}/${LV.length}`,12,24); tx(`Fireflies ${tokens.length}`,12,48); tx(`Time ${t.toFixed(2)}s`,12,72);
      }
      function frame(ts){ const dt=Math.min(.05,(ts-lf)/1000); lf=ts; if(run){ step(dt); draw(ts); requestAnimationFrame(frame); } }
      function die(){ AudioK.bip(200,.12); run=false; setTimeout(()=>runLevel(i),120); }
      function win(time){ AudioK.bip(880,.08); AudioK.bip(1320,.08); save.unlocked=Math.max(save.unlocked,i+2); localStorage.setItem('ffp_unlocked',String(save.unlocked));
        save.best[i]=Math.min(save.best[i]??Infinity,time); localStorage.setItem('ffp_best',JSON.stringify(save.best));
        show(`<h2>Glade Reached!</h2><div>Time: ${time.toFixed(2)}s</div><div style="text-align:right;margin-top:8px"><a class="btn" id="n">Next</a></div>`);
        const n=panel.querySelector('#n'); if(n) on(n,'click',()=>{ hide(); if(i+1<LV.length) runLevel(i+1); });
      }
      window.onkeydown=(e)=>{ keys[e.key]=true; if(e.key && e.key.toLowerCase()==='r'){ die(); } if(e.key==='Escape'){ show('<h2>Paused</h2><div style="text-align:right"><a class="btn" id="r">Resume</a></div>'); const r=panel.querySelector('#r'); if(r) on(r,'click',()=>hide()); } };
      window.onkeyup=(e)=>{ keys[e.key]=false; };
      requestAnimationFrame(frame);
    }
    // Wire buttons with preventDefault
    on('#btn-play','click',()=>boot(save.unlocked-1));
    on('#btn-levels','click',()=>levelSelect());
    on('#btn-stats','click',()=>stats());
    on('#btn-options','click',()=>options());
    on('#cta-play','click',()=>boot(save.unlocked-1));
    // Expose
    window.levelSelect=levelSelect; window.options=options; window.stats=stats;
  });
})();