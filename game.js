/* Firefly Run — Nature Ballet (WHG-style, no chase)
   - Redesigned visuals (paired with style.css) + atmospheric background
   - Fixed input (no stuck keys): uses Set, clears on blur/visibilitychange, ignores repeats
   - Fixed timestep engine for consistent movement
   - 20 handcrafted levels, deterministic enemy patterns (rows, columns, zigzags, rings, windows)
   - Difficulty presets + speed boost; faster defaults
   - Robust progression, pause, restart; best times per level
*/
(function(){
  'use strict';

  function main(){
    const $ = s => document.querySelector(s);
    const panel = $('#panel'), bg = $('#bg'), game = $('#game');
    if(!panel || !bg || !game){ console.error('game.js: missing required DOM elements'); return; }
    const ctx = game.getContext('2d');
    if(!ctx){ console.error('game.js: failed to get canvas context'); return; }

    // Settings and stats
    const defaults = { difficulty:'hard', speedBoost:1.15 };
    let settings = {...defaults};
    try { const raw = localStorage.getItem('ffr_settings'); if(raw) settings = {...settings, ...JSON.parse(raw)}; } catch(e){}
    let bestTimes = {};
    try { const raw = localStorage.getItem('ffr_best'); if(raw) bestTimes = JSON.parse(raw)||{}; } catch(e){}
    const saveSettings = ()=>{ try{ localStorage.setItem('ffr_settings', JSON.stringify(settings)); }catch(e){} };
    const saveBestTimes = ()=>{ try{ localStorage.setItem('ffr_best', JSON.stringify(bestTimes)); }catch(e){} };

    // Background rendering (nature layers)
    (function loop(ts){
      const w = bg.width, h = bg.height, b = bg.getContext('2d'); if(!b) return;
      b.clearRect(0,0,w,h);
      const g = b.createLinearGradient(0,0,0,h);
      g.addColorStop(0,'#07220f'); g.addColorStop(0.5,'#0e3a22'); g.addColorStop(1,'#041409');
      b.fillStyle = g; b.fillRect(0,0,w,h);

      // Light orbs
      b.globalCompositeOperation = 'lighter';
      for(let i=0;i<18;i++){
        const x = ((ts*0.014 + i*130) % (w+260)) - 130;
        const y = 50 + (i*37 % (h-100)) + Math.sin(ts*0.001 + i)*9;
        const r = 16 + Math.sin(ts*0.002 + i)*5;
        const gg = b.createRadialGradient(x,y,0,x,y,r);
        gg.addColorStop(0,'rgba(190,245,140,0.18)'); gg.addColorStop(1,'rgba(0,0,0,0)');
        b.fillStyle = gg; b.fillRect(x-r,y-r,r*2,r*2);
      }
      b.globalCompositeOperation = 'source-over';

      // Leaf wisps
      b.globalAlpha = 0.07; b.fillStyle = '#114b29';
      for(let yy=0; yy<h; yy+=30){
        for(let xx=0; xx<w; xx+=30){ b.beginPath(); b.ellipse(xx+10, yy+8, 20, 6, Math.PI*0.2, 0, Math.PI*2); b.fill(); }
      }
      b.globalAlpha = 1;
      requestAnimationFrame(loop);
    })(performance.now());

    // Utils
    const W = 960, H = 520;
    const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
    const R = (x,y,w,h)=>({x,y,w,h});
    const rectHit = (a,b)=>!(a.x+a.w<b.x || b.x+b.w<a.x || a.y+a.h<b.y || b.y+b.h<a.y);
    const d2 = (ax,ay,bx,by)=>{ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; };
    const circleRect = (cx,cy,cr,r)=>{ const px=clamp(cx,r.x,r.x+r.w), py=clamp(cy,r.y,r.y+r.h); return d2(cx,cy,px,py) <= cr*cr; };

    // Enemy types (no chase)
    function dot(x,y,r,ax,ay,bx,by,sp,loop=false){ return {kind:'dot',x,y,r,a:{x:ax,y:ay},b:{x:bx,y:by},speed:sp,dir:1,loop}; }
    function block(x,y,w,h,ax,ay,bx,by,sp,loop=false){ return {kind:'block',r:R(x,y,w,h),a:{x:ax,y:ay},b:{x:bx,y:by},speed:sp,dir:1,loop}; }
    function ring(cx,cy,radius,count,sp,phase=0){
      // Dots moving around a circle in opposite pairs (timed windows)
      const arr=[];
      for(let i=0;i<count;i++){
        const ang = (i/count)*Math.PI*2 + phase;
        const x = cx + Math.cos(ang)*radius;
        const y = cy + Math.sin(ang)*radius;
        // use two opposite points as A/B to create circular-ish chase-free movement by stepping A->B->A with rotated anchors
        const ax = cx + Math.cos(ang)*radius, ay = cy + Math.sin(ang)*radius;
        const bx = cx + Math.cos(ang+Math.PI)*radius, by = cy + Math.sin(ang+Math.PI)*radius;
        arr.push(dot(x,y,10, ax,ay, bx,by, sp, false));
      }
      return arr;
    }
    function stepEnemy(e, dt){
      const sp = e.speed * dt;
      if(e.kind==='dot'){
        const tx = e.dir>0? e.b.x : e.a.x, ty = e.dir>0? e.b.y : e.a.y;
        const d = Math.hypot(tx-e.x, ty-e.y) || 1;
        if(d <= sp){ e.x = tx; e.y = ty; e.dir *= -1; }
        else { e.x += (tx-e.x)/d * sp; e.y += (ty-e.y)/d * sp; }
      } else {
        const cx = e.r.x+e.r.w/2, cy = e.r.y+e.r.h/2;
        const tx = e.dir>0? e.b.x : e.a.x, ty = e.dir>0? e.b.y : e.a.y;
        const d = Math.hypot(tx-cx, ty-cy) || 1;
        if(d <= sp){ e.r.x = tx - e.r.w/2; e.r.y = ty - e.r.h/2; e.dir *= -1; }
        else { const nx = cx + (tx-cx)/d * sp, ny = cy + (ty-cy)/d * sp; e.r.x = nx - e.r.w/2; e.r.y = ny - e.r.h/2; }
      }
    }

    // Difficulty
    function diffMul(){
      const base = settings.difficulty==='easy' ? 1.0
                 : settings.difficulty==='normal' ? 1.25
                 : settings.difficulty==='hard' ? 1.55
                 : 1.85; // insane
      return base * (settings.speedBoost || 1.0);
    }

    // Drawing
    function drawWall(r){ ctx.fillStyle='#214a26'; ctx.fillRect(r.x,r.y,r.w,r.h); ctx.strokeStyle='#0a2a12'; ctx.lineWidth=2; ctx.strokeRect(r.x,r.y,r.w,r.h); }
    function drawGoal(g){
      const gg = ctx.createLinearGradient(g.x,g.y,g.x+g.w,g.y+g.h); gg.addColorStop(0,'#e8ffd9'); gg.addColorStop(1,'#bfeaa0');
      ctx.fillStyle=gg; ctx.fillRect(g.x,g.y,g.w,g.h); ctx.strokeStyle='#2a5e2d'; ctx.lineWidth=2; ctx.strokeRect(g.x,g.y,g.w,g.h);
    }
    function drawToken(t,ts){
      const cx=t.x+t.w/2, cy=t.y+t.h/2; const r = 5 + Math.sin(ts*0.012 + (cx+cy)*0.02)*2;
      const g = ctx.createRadialGradient(cx,cy,0,cx,cy,r*3); g.addColorStop(0,'rgba(255,232,120,0.98)'); g.addColorStop(0.25,'rgba(255,232,120,0.45)'); g.addColorStop(1,'rgba(255,232,120,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,r*1.8,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fffbe8'; ctx.beginPath(); ctx.arc(cx,cy,2,0,Math.PI*2); ctx.fill();
    }
    function drawEnemy(e){
      if(e.kind==='dot'){ const grd = ctx.createRadialGradient(e.x,e.y,0,e.x,e.y,e.r*1.8); grd.addColorStop(0,'#ff6668'); grd.addColorStop(1,'#bd1f24'); ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#640f12'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.stroke(); }
      else { ctx.fillStyle='#cc2d2f'; ctx.fillRect(e.r.x,e.r.y,e.r.w,e.r.h); ctx.strokeStyle='#6a0f0f'; ctx.lineWidth=2; ctx.strokeRect(e.r.x,e.r.y,e.r.w,e.r.h); }
    }

    // Level definitions
    const LV = [];
    function buildLevels(){
      LV.length = 0;

      // L1 — Intro lanes
      LV.push({
        start:[60,H/2], goal:R(W-130,H/2-40,70,80),
        walls:[ R(0,0,W,20), R(0,H-20,W,20), R(0,0,20,H), R(W-20,0,20,H), R(200,120,20,280) ],
        tokens:[ R(260,90,20,20), R(260,H-110,20,20) ],
        enemies:[ ...rowDots(120,240,W-160,5,10,2.8), ...rowDots(H-120,240,W-160,5,10,2.8,1) ]
      });

      // L2 — Cross corridors
      LV.push({
        start:[60,80], goal:R(W-130,H-120,70,80),
        walls:[ R(0,0,W,20), R(0,H-20,W,20), R(0,0,20,H), R(W-20,0,20,H), R(160,200,W-320,20), R(160,320,W-320,20) ],
        tokens:[ R(W/2-10,150,20,20), R(W/2-10,H-170,20,20) ],
        enemies:[ ...colDots(W/2,60,H-60,6,9,3.2), ...rowDots(260,120,W-120,6,9,3.0) ]
      });

      // L3 — Vertical gauntlet with pillars
      LV.push({
        start:[80,H-80], goal:R(W-130,60,70,80),
        walls:[ R(0,0,W,20), R(0,H-20,W,20), R(0,0,20,H), R(W-20,0,20,H), R(280,80,20,H-160), R(560,80,20,H-160) ],
        tokens:[ R(420,60,20,20), R(420,H-80,20,20) ],
        enemies:[ ...colDots(200,100,H-100,6,10,3.2), ...colDots(760,100,H-100,6,10,3.2,1) ]
      });

      // L4 — Zipper rows
      LV.push({
        start:[60,H/2], goal:R(W-130,H/2-40,70,80),
        walls:[ R(0,0,W,20), R(0,H-20,W,20), R(0,0,20,H), R(W-20,0,20,H), R(180,120,W-360,16), R(180,220,W-360,16), R(180,320,W-360,16) ],
        tokens:[ R(W/2-10,90,20,20), R(W/2-10,H-110,20,20) ],
        enemies:[ ...rowDots(120,200,W-200,7,9,3.4), ...rowDots(220,200,W-200,7,9,3.4,1), ...rowDots(320,200,W-200,7,9,3.6) ]
      });

      // L5 — Multi-lane pinwheel
      LV.push({
        start:[80,80], goal:R(W-130,H-120,70,80),
        walls:[ R(0,0,W,20), R(0,H-20,W,20), R(0,0,20,H), R(W-20,0,20,H), R(240,80,20,H-160), R(480,80,20,H-160), R(720,80,20,H-160) ],
        tokens:[ R(360,60,20,20), R(600,H-80,20,20) ],
        enemies:[ ...rowDots(140,80,W-80,8,9,3.8), ...rowDots(H-140,80,W-80,8,9,3.8,1) ]
      });

      // L6 — Ring with lanes
      LV.push({
        start:[60,H/2], goal:R(W-130,H/2-40,70,80),
        walls:[ R(0,0,W,20), R(0,H-20,W,20), R(0,0,20,H), R(W-20,0,20,H), R(160,120,W-320,16), R(160,H-136,W-320,16) ],
        tokens:[ R(W/2-10, H/2-10,20,20) ],
        enemies:[ ...ring(W/2,H/2,90,8,3.2), ...rowDots(160,200,W-200,6,9,3.2,1), ...rowDots(H-160,200,W-200,6,9,3.2) ]
      });

      // L7 — Zig-zag windows
      LV.push({
        start:[80,H-80], goal:R(W-130,60,70,80),
        walls:[ R(0,0,W,20), R(0,H-20,W,20), R(0,0,20,H), R(W-20,0,20,H), R(220,120,20,280), R(420,60,20,220), R(620,240,20,220) ],
        tokens:[ R(320,90,20,20), R(520,430,20,20), R(740,90,20,20) ],
        enemies:[ ...rowDots(100,160,W-160,6,9,3.8), ...rowDots(H-100,160,W-160,6,9,3.8,1) ]
      });

      // L8 — Dual columns + streams
      LV.push({
        start:[60,80], goal:R(W-130,H-120,70,80),
        walls:[ R(0,0,W,20), R(0,H-20,W,20), R(0,0,20,H), R(W-20,0,20,H), R(300,80,20,H-160), R(660,80,20,H-160) ],
        tokens:[ R(480,60,20,20), R(480,H-80,20,20) ],
        enemies:[ ...colDots(480, 100, H-100, 8, 9, 3.8), ...rowDots(H/2, 120, W-120, 8, 9, 3.4, 1) ]
      });

      // L9 — Ring corridor
      LV.push({
        start:[80,H/2], goal:R(W-130,H/2-40,70,80),
        walls:[ R(0,0,W,20), R(0,H-20,W,20), R(0,0,20,H), R(W-20,0,20,H), R(220,100,W-440,20), R(220,H-120,W-440,20) ],
        tokens:[ R(W/2-10,90,20,20), R(W/2-10,H-110,20,20) ],
        enemies:[ ...ring(W/2, H/2, 140, 10, 3.6, Math.PI/8) ]
      });

      // L10 — Crossfire
      LV.push({
        start:[60,80], goal:R(W-130,H-120,70,80),
        walls:[ R(0,0,W,20), R(0,H-20,W,20), R(0,0,20,H), R(W-20,0,20,H), R(200,H/2-10,W-400,20) ],
        tokens:[ R(260,120,20,20), R(W-300,H-140,20,20), R(W/2-10,H/2-10,20,20) ],
        enemies:[ ...rowDots(H/2-40, 120, W-120, 8, 9, 4.0), ...rowDots(H/2+40, 120, W-120, 8, 9, 4.0, 1), ...colDots(W/2, 80, H-80, 6, 10, 3.8) ]
      });

      // L11..L20 escalate density/speed and add extra pillars/windows
      for(let i=11;i<=20;i++){
        const walls=[ R(0,0,W,20), R(0,H-20,W,20), R(0,0,20,H), R(W-20,0,20,H) ];
        if(i>=13){ walls.push(R(360,100,20,H-200), R(600,100,20,H-200)); }
        if(i>=16){ walls.push(R(200,220,W-400,18)); }

        const enemies=[];
        const baseSpeed = 3.2 + (i-10)*0.22;
        const lanes = 3 + Math.min(5, Math.floor((i-8)/2));
        const gap = (H-180)/lanes;
        for(let r=0;r<lanes;r++){
          const y = 90 + r*gap;
          enemies.push(...rowDots(y-28, 140, W-140, 6 + (i%3), 9, baseSpeed+0.2, r%2));
          enemies.push(...rowDots(y+28, 140, W-140, 6 + ((i+1)%3), 9, baseSpeed+0.4, (r+1)%2));
        }
        if(i%2===0) enemies.push(...ring(W/2, H/2, 110, 8 + (i%4), baseSpeed-0.3, (i%3)*Math.PI/12));

        const toks = [ R(240 + (i*23)%200, 60 + (i*17)%80, 20,20), R(W-260 - (i*19)%220, H-100 - (i*13)%90, 20,20) ];
        if(i>=17) toks.push(R(W/2-10,H/2-10,20,20));

        LV.push({
          start:[80, (i%2)?80:H-80],
          goal: R(W-130, (i%2)?H-120:60, 70, 80),
          walls, tokens:toks, enemies
        });
      }
    }

    function rowDots(y, x1, x2, n, r, sp, offset=0){
      const list=[];
      for(let i=0;i<n;i++){
        const t=i/(n-1||1), sx=x1+(x2-x1)*t;
        const right=((i+offset)%2)===0; const ax = right? x1 : x2; const bx = right? x2 : x1;
        list.push(dot(sx, y, r, ax, y, bx, y, sp, false));
      }
      return list;
    }
    function colDots(x, y1, y2, n, r, sp, offset=0){
      const list=[];
      for(let i=0;i<n;i++){
        const t=i/(n-1||1), sy=y1+(y2-y1)*t;
        const down=((i+offset)%2)===0; const ay = down? y1 : y2; const by = down? y2 : y1;
        list.push(dot(x, sy, r, x, ay, x, by, sp, false));
      }
      return list;
    }

    buildLevels();

    // Game state and loop
    let currentLevel = 0;
    let keys = new Set();
    function clearKeys(){ keys.clear(); }

    function boot(i=0){ hide(); currentLevel = clamp(i|0, 0, LV.length-1); runLevel(currentLevel); }

    function show(html){ panel.innerHTML = html; panel.classList.remove('hidden'); }
    function hide(){ panel.classList.add('hidden'); }

    function runLevel(i){
      currentLevel = clamp(i|0, 0, LV.length-1);
      const L = LV[currentLevel];
      const player = { x:L.start[0], y:L.start[1], r:11, s:3.35 }; // slightly faster base
      const walls = L.walls.map(w=>({...w}));
      let tokens = L.tokens.map(t=>({...t}));
      const mul = diffMul();
      const enemies = L.enemies.map(e => e.kind==='dot'
        ? {...e, speed: e.speed*mul, x:e.x, y:e.y, dir:e.dir}
        : {...e, speed: e.speed*mul, r:{...e.r}, dir:e.dir}
      );

      let time=0, acc=0, last=performance.now(), running=true, raf=0;
      const fixed = 1/60;

      function step(dt){
        // accumulate fixed steps
        acc += dt;
        while(acc >= fixed){
          sim(fixed);
          acc -= fixed;
        }
      }

      function sim(dt){
        time += dt;
        // input
        const vx = (keys.has('ArrowRight')||keys.has('KeyD')) - (keys.has('ArrowLeft')||keys.has('KeyA'));
        const vy = (keys.has('ArrowDown')||keys.has('KeyS')) - (keys.has('ArrowUp')||keys.has('KeyW'));
        const sp = player.s * ((vx && vy) ? 1/Math.SQRT2 : 1);
        player.x = clamp(player.x + (vx? (vx>0?1:-1):0)*sp, player.r, W-player.r);
        player.y = clamp(player.y + (vy? (vy>0?1:-1):0)*sp, player.r, H-player.r);

        // wall kill
        const pr = { x:player.x-player.r, y:player.y-player.r, w:player.r*2, h:player.r*2 };
        for(const w of walls){ if(rectHit(pr,w)){ die(); return; } }

        // enemies
        for(const e of enemies){
          stepEnemy(e, dt);
          if(e.kind==='dot'){
            if(d2(player.x,player.y, e.x,e.y) <= (player.r+e.r)*(player.r+e.r)){ die(); return; }
          } else {
            if(circleRect(player.x,player.y,player.r, e.r)){ die(); return; }
          }
        }

        // tokens and win
        tokens = tokens.filter(tok => !circleRect(player.x,player.y,player.r, tok));
        if(tokens.length===0 && circleRect(player.x,player.y,player.r, L.goal)){ win(time); }
      }

      function draw(ts){
        ctx.clearRect(0,0,W,H);
        for(const w of walls) drawWall(w);
        drawGoal(L.goal);
        for(const tok of tokens) drawToken(tok,ts);
        for(const e of enemies) drawEnemy(e);

        // player
        ctx.beginPath(); ctx.fillStyle='#ffffff'; ctx.arc(player.x,player.y,player.r,0,Math.PI*2); ctx.fill();
        ctx.lineWidth=2; ctx.strokeStyle='#8dcf7a'; ctx.stroke();

        // HUD
        ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(8,8,240,78);
        ctx.fillStyle='#e9ffe5'; ctx.font='bold 14px ui-rounded, system-ui, Inter, Arial';
        ctx.fillText(`Level ${currentLevel+1} / ${LV.length}`, 16, 28);
        ctx.fillText(`Fireflies ${tokens.length}`, 16, 48);
        ctx.fillText(`Time ${time.toFixed(2)}s`, 16, 68);
      }

      function frame(ts){
        if(!running) return;
        const dt = Math.min(0.1, (ts - last) / 1000);
        last = ts;
        step(dt);
        draw(ts);
        raf = requestAnimationFrame(frame);
      }

      // Control flow
      function cleanup(){
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', kd, {passive:false});
        window.removeEventListener('keyup', ku, {passive:false});
        window.removeEventListener('blur', onBlur);
        document.removeEventListener('visibilitychange', onVis);
      }

      function die(){
        running=false; cleanup();
        show(`<h2>You died</h2><div style="text-align:right;margin-top:8px"><a class="btn" id="retry" href="#">Retry</a></div>`);
        $('#retry')?.addEventListener('click', e=>{ e.preventDefault(); hide(); runLevel(currentLevel); });
      }

      function win(t){
        running=false; cleanup();
        if(!(currentLevel in bestTimes) || t < bestTimes[currentLevel]){ bestTimes[currentLevel]=t; saveBestTimes(); }
        const nxt = currentLevel+1;
        if(nxt>=LV.length){
          show(`<h2>All levels complete!</h2><div>Gorgeous run.</div><div style="text-align:right;margin-top:8px"><a class="btn" id="menu" href="#">Menu</a></div>`);
          $('#menu')?.addEventListener('click', e=>{ e.preventDefault(); hide(); });
        }else{
          show(`<h2>Glade Reached!</h2><div>Time: ${t.toFixed(2)}s</div><div style="text-align:right;margin-top:8px"><a class="btn" id="next" href="#">Next</a></div>`);
          $('#next')?.addEventListener('click', e=>{ e.preventDefault(); hide(); runLevel(nxt); });
        }
      }

      // Input handling: no stuck keys
      const kd = (e)=>{
        // Prevent scroll with arrows/space; ignore repeats to avoid sticky
        if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
        if(e.repeat) return;
        const code = e.code || e.key;
        if(code) keys.add(code);
        if(e.key && e.key.toLowerCase()==='r'){ die(); }
        if(e.key==='Escape'){
          running=false; cancelAnimationFrame(raf);
          show('<h2>Paused</h2><div style="text-align:right"><a class="btn" id="resume" href="#">Resume</a><a class="btn ghost" id="menu" href="#" style="margin-left:8px">Menu</a></div>');
          $('#resume')?.addEventListener('click', ev=>{ ev.preventDefault(); hide(); running=true; last=performance.now(); requestAnimationFrame(frame); });
          $('#menu')?.addEventListener('click', ev=>{ ev.preventDefault(); hide(); });
        }
      };
      const ku = (e)=>{ const code = e.code || e.key; if(code) keys.delete(code); };
      const onBlur = ()=> clearKeys();
      const onVis = ()=>{ if(document.hidden) clearKeys(); };

      window.addEventListener('keydown', kd, {passive:false});
      window.addEventListener('keyup', ku, {passive:false});
      window.addEventListener('blur', onBlur);
      document.addEventListener('visibilitychange', onVis);

      // Start loop
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    // UI — Options/Levels/Stats/How
    function showLevels(){
      const cells = Array.from({length: LV.length},(_,i)=>`<div class='cell' data-i='${i}'>${i+1}</div>`).join('');
      show(`<h2>Select Level</h2><div class='grid'>${cells}</div><div style='text-align:right'><a class='btn ghost' id='back' href='#'>Back</a></div>`);
      panel.querySelectorAll('.cell').forEach(el=>el.addEventListener('click', ()=>{ hide(); __fireflyBoot(parseInt(el.dataset.i,10)||0); }));
      $('#back')?.addEventListener('click', e=>{ e.preventDefault(); hide(); });
    }
    function showOptions(){
      const html = `
        <h2>Options</h2>
        <div class="kv"><label>Difficulty</label><div><select id="opt-diff">
          <option value="easy" ${settings.difficulty==='easy'?'selected':''}>Easy</option>
          <option value="normal" ${settings.difficulty==='normal'?'selected':''}>Normal</option>
          <option value="hard" ${settings.difficulty==='hard'?'selected':''}>Hard</option>
          <option value="insane" ${settings.difficulty==='insane'?'selected':''}>Insane</option>
        </select></div></div>
        <div class="kv"><label>Speed boost</label><div><input id="opt-boost" class="range" type="range" min="1.0" max="1.8" step="0.05" value="${settings.speedBoost}"><div id="opt-boost-val">${settings.speedBoost.toFixed(2)}</div></div></div>
        <div style='text-align:right;margin-top:12px'><a id='save' class='btn' href='#'>Save</a> <a id='x' class='btn ghost' href='#' style='margin-left:8px'>Close</a></div>
      `;
      show(html);
      const diffSel = $('#opt-diff'), boost = $('#opt-boost'), boostVal = $('#opt-boost-val');
      boost?.addEventListener('input', e=>{ boostVal.textContent = Number(e.target.value).toFixed(2); });
      $('#save')?.addEventListener('click', e=>{ e.preventDefault(); settings.difficulty = diffSel.value; settings.speedBoost = parseFloat(boost.value); saveSettings(); hide(); });
      $('#x')?.addEventListener('click', e=>{ e.preventDefault(); hide(); });
    }
    function showStats(){
      const rows = Object.keys(bestTimes).sort((a,b)=>a-b).map(k=>`<div class="kv"><div>Level ${Number(k)+1}</div><div style="text-align:right">${bestTimes[k].toFixed(2)}s</div></div>`).join('') || '<p>No best times yet.</p>';
      show(`<h2>Stats</h2>${rows}<div style='text-align:right;margin-top:10px'><a id='x' class='btn ghost' href='#'>Close</a></div>`);
      $('#x')?.addEventListener('click', e=>{ e.preventDefault(); hide(); });
    }
    function showHow(){
      show("<h2>How to Play</h2><p>Collect all fireflies and reach the glade. Avoid red bots and walls. WASD/Arrows to move. R to restart. Esc to pause.</p><div style='text-align:right'><a id='x' class='btn ghost' href='#'>Close</a></div>");
      $('#x')?.addEventListener('click', e=>{ e.preventDefault(); hide(); });
    }

    // Expose for index.html
    window.__fireflyBoot = (i=0)=>boot(i);
    window.__fireflyShowLevels = ()=>showLevels();
    window.__fireflyShowOptions = ()=>showOptions();
    window.__fireflyShowStats = ()=>showStats();
    window.__fireflyShowHow = ()=>showHow();

    // Bind (in case header script didn't run yet)
    const bind = (sel, fn)=>{ const el=$(sel); if(el) el.addEventListener('click', e=>{ e.preventDefault(); fn(); }); };
    bind('#btn-play', ()=>boot(0));
    bind('#cta-play', ()=>boot(0));
    bind('#btn-levels', ()=>showLevels());
    bind('#btn-options', ()=>showOptions());
    bind('#btn-stats', ()=>showStats());
    bind('#cta-how', ()=>showHow());
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', main); else main();
})();
