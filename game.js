/* game.js — World's Hardest Game style rebuild
   - 20 deterministic levels, no chasing (pattern-only enemies)
   - Robust level progression (no resets to 1 unless chosen)
   - Difficulty presets (Easy/Normal/Hard/Insane) scale enemy speed
   - Polished "Nature Ballet" visuals (kept inside CSS + background canvas)
   - Stats: best time per level (localStorage)
   - All header buttons wired via window.__firefly* API
*/
(function(){
  'use strict';

  function main(){
    const $ = s => document.querySelector(s);
    const panel = $('#panel'), bg = $('#bg'), game = $('#game');
    if(!panel || !bg || !game){ console.error('game.js: missing required DOM elements (#panel, #bg, #game).'); return; }
    const ctx = game.getContext('2d');
    if(!ctx){ console.error('game.js: failed to get canvas context'); return; }

    // persistent settings
    const defaults = {
      difficulty: 'normal', // easy | normal | hard | insane
      speedBoost: 1.0       // extra multiplier, optional fine-tune
    };
    let settings = {...defaults};
    try { const raw = localStorage.getItem('ffr_settings'); if(raw) settings = {...settings, ...JSON.parse(raw)}; } catch(e){}
    function saveSettings(){ try { localStorage.setItem('ffr_settings', JSON.stringify(settings)); } catch(e){} }

    // stats: best times per level index
    let bestTimes = {};
    try { const raw = localStorage.getItem('ffr_best'); if(raw) bestTimes = JSON.parse(raw) || {}; } catch(e){}
    function saveBestTimes(){ try { localStorage.setItem('ffr_best', JSON.stringify(bestTimes)); } catch(e){} }

    // background "Nature Ballet"
    (function loop(ts){
      const w = bg.width, h = bg.height, b = bg.getContext('2d');
      if(!b) return;
      b.clearRect(0,0,w,h);
      const g = b.createLinearGradient(0,0,0,h);
      g.addColorStop(0, '#062010');
      g.addColorStop(0.5, '#0a321b');
      g.addColorStop(1, '#041409');
      b.fillStyle = g; b.fillRect(0,0,w,h);

      // glints
      b.globalCompositeOperation = 'lighter';
      for(let i=0;i<16;i++){
        const x = ((ts*0.015 + i*140) % (w+240)) - 120;
        const y = 50 + (i*37 % (h-100)) + Math.sin(ts*0.0009 + i)*9;
        const r = 16 + Math.sin(ts*0.002 + i)*5;
        const gg = b.createRadialGradient(x,y,0,x,y,r);
        gg.addColorStop(0,'rgba(195,245,145,0.16)');
        gg.addColorStop(1,'rgba(195,245,145,0)');
        b.fillStyle = gg; b.fillRect(x-r,y-r,r*2,r*2);
      }
      b.globalCompositeOperation = 'source-over';

      // leaf wisps
      b.globalAlpha = 0.07; b.fillStyle = '#114b29';
      for(let yy=0; yy<h; yy+=30){
        for(let xx=0; xx<w; xx+=30){
          b.beginPath();
          b.ellipse(xx+10, yy+8, 20, 6, Math.PI*0.2, 0, Math.PI*2);
          b.fill();
        }
      }
      b.globalAlpha = 1;
      requestAnimationFrame(loop);
    })(performance.now());

    // utils
    const W = 960, H = 520;
    const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
    const R = (x,y,w,h)=>({x,y,w,h});
    const rectHit = (a,b)=>!(a.x+a.w<b.x || b.x+b.w<a.x || a.y+a.h<b.y || b.y+b.h<a.y);
    const dist2 = (ax,ay,bx,by)=>{ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; };
    const circleRect = (cx,cy,cr,r)=>{ const px=clamp(cx,r.x,r.x+r.w), py=clamp(cy,r.y,r.y+r.h); return dist2(cx,cy,px,py) <= cr*cr; };

    // enemy builders (pattern-only, no chase)
    function dot(x,y,r,ax,ay,bx,by,sp,loop=false){
      return { kind:'dot', x, y, r, a:{x:ax,y:ay}, b:{x:bx,y:by}, speed:sp, dir:1, loop };
    }
    function block(x,y,w,h,ax,ay,bx,by,sp,loop=false){
      return { kind:'block', r:R(x,y,w,h), a:{x:ax,y:ay}, b:{x:bx,y:by}, speed:sp, dir:1, loop };
    }

    // advance an enemy along its AB path
    function stepEnemy(e, dt){
      const sp = e.speed * dt;
      if(e.kind === 'dot'){
        const tx = e.dir>0 ? e.b.x : e.a.x;
        const ty = e.dir>0 ? e.b.y : e.a.y;
        const d = Math.hypot(tx - e.x, ty - e.y) || 1;
        if(d <= sp){
          if(e.loop){
            // jump to opposite endpoint and continue same dir
            e.x = tx; e.y = ty;
            e.dir *= -1; // bounce-like visual even in loop
          } else {
            e.x = tx; e.y = ty;
            e.dir *= -1; // bounce
          }
        } else {
          e.x += (tx - e.x) / d * sp;
          e.y += (ty - e.y) / d * sp;
        }
      } else {
        const cx = e.r.x + e.r.w/2, cy = e.r.y + e.r.h/2;
        const tx = e.dir>0 ? e.b.x : e.a.x;
        const ty = e.dir>0 ? e.b.y : e.a.y;
        const d = Math.hypot(tx - cx, ty - cy) || 1;
        if(d <= sp){
          if(e.loop){
            e.r.x = tx - e.r.w/2; e.r.y = ty - e.r.h/2;
            e.dir *= -1;
          } else {
            e.r.x = tx - e.r.w/2; e.r.y = ty - e.r.h/2;
            e.dir *= -1;
          }
        } else {
          const nx = cx + (tx - cx) / d * sp;
          const ny = cy + (ty - cy) / d * sp;
          e.r.x = nx - e.r.w/2; e.r.y = ny - e.r.h/2;
        }
      }
    }

    // drawing
    function drawWall(r){
      ctx.fillStyle = '#214a26'; ctx.fillRect(r.x,r.y,r.w,r.h);
      ctx.strokeStyle = '#0a2a12'; ctx.lineWidth = 2; ctx.strokeRect(r.x,r.y,r.w,r.h);
    }
    function drawGoal(g){
      const gg = ctx.createLinearGradient(g.x,g.y,g.x+g.w,g.y+g.h);
      gg.addColorStop(0,'#dff9c9'); gg.addColorStop(1,'#aee38a');
      ctx.fillStyle = gg; ctx.fillRect(g.x,g.y,g.w,g.h);
      ctx.strokeStyle = '#295e2a'; ctx.lineWidth = 2; ctx.strokeRect(g.x,g.y,g.w,g.h);
    }
    function drawToken(t,ts){
      const cx=t.x+t.w/2, cy=t.y+t.h/2;
      const r = 5 + Math.sin(ts*0.012 + (cx+cy)*0.02)*2;
      const g = ctx.createRadialGradient(cx,cy,0,cx,cy,r*3);
      g.addColorStop(0,'rgba(255,232,120,0.98)'); g.addColorStop(0.25,'rgba(255,232,120,0.45)'); g.addColorStop(1,'rgba(255,232,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx,cy,r*1.8,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#fffbe8'; ctx.beginPath(); ctx.arc(cx,cy,2,0,Math.PI*2); ctx.fill();
    }
    function drawEnemy(e){
      if(e.kind==='dot'){
        const grd = ctx.createRadialGradient(e.x,e.y,0,e.x,e.y,e.r*1.8);
        grd.addColorStop(0,'#ff6668'); grd.addColorStop(1,'#c02228');
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#700f13'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.stroke();
      }else{
        ctx.fillStyle = '#cc2d2f'; ctx.fillRect(e.r.x,e.r.y,e.r.w,e.r.h);
        ctx.strokeStyle = '#6a0f0f'; ctx.lineWidth = 2; ctx.strokeRect(e.r.x,e.r.y,e.r.w,e.r.h);
      }
    }

    // difficulty
    function diffMultiplier(){
      const base = (settings.difficulty==='easy')?0.9:(settings.difficulty==='normal')?1.1:(settings.difficulty==='hard')?1.35:1.6;
      return base * (settings.speedBoost || 1.0);
    }

    // level builder helpers (WHG-like patterns)
    function rowDots(y, x1, x2, n, r, sp, offset=0){
      const list = [];
      for(let i=0;i<n;i++){
        const t = i/(n-1||1);
        const sx = x1 + (x2-x1)*t;
        const dirRight = ((i+offset)%2)===0;
        const ax = dirRight? x1 : x2; const bx = dirRight? x2 : x1;
        list.push(dot(sx, y, r, ax, y, bx, y, sp, false));
      }
      return list;
    }
    function colDots(x, y1, y2, n, r, sp, offset=0){
      const list = [];
      for(let i=0;i<n;i++){
        const t = i/(n-1||1);
        const sy = y1 + (y2-y1)*t;
        const dirDown = ((i+offset)%2)===0;
        const ay = dirDown? y1 : y2; const by = dirDown? y2 : y1;
        list.push(dot(x, sy, r, x, ay, x, by, sp, false));
      }
      return list;
    }

    // define 20 levels (mix handcrafted + programmatic) — no chasing, tight corridors
    const LV = [];
    function buildLevels(){
      LV.length = 0;
      // L1 - intro
      LV.push({
        start:[60, H/2],
        goal:R(W-120, H/2-40, 60, 80),
        walls:[ R(0,0,W,20), R(0,H-20,W,20), R(0,0,20,H), R(W-20,0,20,H), R(200,100,20,H-200) ],
        tokens:[ R(260,90,20,20), R(260,H-110,20,20) ],
        enemies: [
          ...rowDots(120, 240, W-160, 4, 10, 2.2),
          ...rowDots(H-120, 240, W-160, 4, 10, 2.2, 1)
        ]
      });

      // L2 - two corridors crossing
      LV.push({
        start:[60, 80],
        goal:R(W-120, H-120, 60, 80),
        walls:[ R(0,0,W,20), R(0,H-20,W,20), R(0,0,20,H), R(W-20,0,20,H), R(160,200,W-320,20), R(160,320,W-320,20) ],
        tokens:[ R(W/2-10, 160,20,20), R(W/2-10, H-180,20,20) ],
        enemies: [
          ...colDots(W/2, 60, H-60, 5, 9, 2.6),
          ...rowDots(260, 120, W-120, 6, 9, 2.4),
        ]
      });

      // L3 - vertical gauntlet
      LV.push({
        start:[80, H-80],
        goal:R(W-120, 60, 60, 80),
        walls:[ R(0,0,W,20), R(0,H-20,W,20), R(0,0,20,H), R(W-20,0,20,H), R(280,80,20,H-160), R(560,80,20,H-160) ],
        tokens:[ R(420,60,20,20), R(420,H-80,20,20) ],
        enemies: [
          ...colDots(200, 100, H-100, 6, 10, 2.6),
          ...colDots(640, 100, H-100, 6, 10, 2.6, 1)
        ]
      });

      // L4 - zipper
      LV.push({
        start:[60, H/2],
        goal:R(W-120, H/2-40, 60, 80),
        walls:[ R(0,0,W,20), R(0,H-20,W,20), R(0,0,20,H), R(W-20,0,20,H),
                R(180,120, W-360, 16), R(180,220, W-360, 16), R(180,320, W-360, 16) ],
        tokens:[ R(W/2-10, 90,20,20), R(W/2-10, H-110,20,20) ],
        enemies: [
          ...rowDots(120, 200, W-200, 6, 9, 2.8),
          ...rowDots(220, 200, W-200, 6, 9, 2.8, 1),
          ...rowDots(320, 200, W-200, 6, 9, 3.0),
        ]
      });

      // L5 - pinwheel lanes
      LV.push({
        start:[80, 80],
        goal:R(W-120, H-120, 60, 80),
        walls:[ R(0,0,W,20), R(0,H-20,W,20), R(0,0,20,H), R(W-20,0,20,H),
                R(240,80,20,H-160), R(480,80,20,H-160), R(720,80,20,H-160) ],
        tokens:[ R(360,60,20,20), R(600,H-80,20,20) ],
        enemies: [
          ...rowDots(140, 80, W-80, 7, 9, 3.0),
          ...rowDots(H-140, 80, W-80, 7, 9, 3.0, 1)
        ]
      });

      // L6..L20 programmatic escalation
      for(let i=6;i<=20;i++){
        const speed = 2.8 + (i-5)*0.18;
        const rows = 3 + Math.min(5, Math.floor((i-4)/2));
        const walls = [ R(0,0,W,20), R(0,H-20,W,20), R(0,0,20,H), R(W-20,0,20,H) ];
        const enemies = [];
        const laneGap = (H-180) / rows;
        for(let r=0;r<rows;r++){
          const y = 90 + r*laneGap;
          walls.push(R(140, y-12, W-280, 12));
          enemies.push(...rowDots(y-36, 160, W-160, 5 + (i%3), 9, speed, r%2));
          enemies.push(...rowDots(y+36, 160, W-160, 5 + ((i+1)%3), 9, speed+0.2, (r+1)%2));
        }
        const tokens = [
          R(240 + (i*23)%200, 60 + (i*17)%80, 20,20),
          R(W-260 - (i*19)%220, H-100 - (i*13)%90, 20,20),
          ...(i%2 ? [R(W/2-10,H/2-10,20,20)] : [])
        ];
        const start = [80, (i%2) ? 80 : H-80];
        const goal = R(W-120, (i%2) ? H-120 : 80, 60, 80);
        if(i>=12) { walls.push(R(360,100,20,H-200), R(600,100,20,H-200)); }
        LV.push({ start, goal, walls, tokens, enemies });
      }
    }
    buildLevels();

    // game state
    let currentLevel = 0;
    let keys = {};
    function boot(i=0){ panel.classList.add('hidden'); currentLevel = clamp(i|0, 0, LV.length-1); runLevel(currentLevel); }

    function show(html){ panel.innerHTML = html; panel.classList.remove('hidden'); }
    function hide(){ panel.classList.add('hidden'); }

    function runLevel(i){
      currentLevel = clamp(i|0, 0, LV.length-1);
      const L = LV[currentLevel];
      const player = { x:L.start[0], y:L.start[1], r:11, s:3.2 };
      const walls = L.walls.map(w=>({...w}));
      let tokens = L.tokens.map(t=>({...t}));
      const enemies = L.enemies.map(e=>{
        const mul = diffMultiplier();
        if(e.kind==='dot'){
          return { ...e, x:e.x, y:e.y, speed:e.speed*mul, dir:e.dir };
        }else{
          return { ...e, r:{...e.r}, speed:e.speed*mul, dir:e.dir };
        }
      });
      let t=0, last=performance.now(), run=true, raf=0;

      function step(dt){
        t+=dt;
        let vx = (keys['ArrowRight']||keys['d']||keys['D']?1:0) - (keys['ArrowLeft']||keys['a']||keys['A']?1:0);
        let vy = (keys['ArrowDown']||keys['s']||keys['S']?1:0) - (keys['ArrowUp']||keys['w']||keys['W']?1:0);
        const sp = player.s * ((vx&&vy)?(1/Math.SQRT2):1);
        player.x = clamp(player.x + (vx? (vx>0?1:-1):0)*sp, player.r, W-player.r);
        player.y = clamp(player.y + (vy? (vy>0?1:-1):0)*sp, player.r, H-player.r);

        // wall instant-death
        const pr = { x:player.x-player.r, y:player.y-player.r, w:player.r*2, h:player.r*2 };
        for(const w of walls){ if(rectHit(pr,w)){ die(); return; } }

        // enemies
        for(const e of enemies){
          stepEnemy(e, dt);
          if(e.kind==='dot'){
            const rr = e.r + player.r;
            if(dist2(player.x,player.y, e.x,e.y) <= rr*rr){ die(); return; }
          }else{
            if(circleRect(player.x,player.y,player.r, e.r)){ die(); return; }
          }
        }

        // tokens and win
        tokens = tokens.filter(tok => !circleRect(player.x,player.y,player.r, tok));
        if(tokens.length===0 && circleRect(player.x,player.y,player.r, L.goal)){ win(t); return; }
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
        ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(8,8,230,74);
        ctx.fillStyle='#e9ffe5'; ctx.font='bold 14px ui-rounded, system-ui, Inter, Arial';
        ctx.fillText(`Level ${currentLevel+1} / ${LV.length}`, 16, 28);
        ctx.fillText(`Fireflies ${tokens.length}`, 16, 48);
        ctx.fillText(`Time ${t.toFixed(2)}s`, 16, 68);
      }

      function frame(ts){
        if(!run) return;
        const dt = Math.min(0.05, (ts - last)/1000);
        last = ts;
        step(dt);
        draw(ts);
        raf = requestAnimationFrame(frame);
      }

      function cleanup(){
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', kd);
        window.removeEventListener('keyup', ku);
      }

      function die(){
        run=false; cleanup();
        show(`<h2>You died</h2><div style="text-align:right;margin-top:8px"><a class="btn" id="retry" href="#">Retry</a></div>`);
        $('#retry')?.addEventListener('click', e=>{ e.preventDefault(); hide(); runLevel(currentLevel); });
      }

      function win(time){
        run=false; cleanup();
        if(!(currentLevel in bestTimes) || time < bestTimes[currentLevel]){
          bestTimes[currentLevel] = time; saveBestTimes();
        }
        const nxt = currentLevel+1;
        if(nxt>=LV.length){
          show(`<h2>All levels complete!</h2><div>Great job.</div><div style="text-align:right;margin-top:8px"><a class="btn" id="menu" href="#">Menu</a></div>`);
          $('#menu')?.addEventListener('click', e=>{ e.preventDefault(); hide(); });
        }else{
          show(`<h2>Glade Reached!</h2><div>Time: ${time.toFixed(2)}s</div><div style="text-align:right;margin-top:8px"><a class="btn" id="next" href="#">Next</a></div>`);
          $('#next')?.addEventListener('click', e=>{ e.preventDefault(); hide(); runLevel(nxt); });
        }
      }

      const kd = (e)=>{ keys[e.key]=true; if(e.key && e.key.toLowerCase()==='r'){ die(); }
        if(e.key==='Escape'){ run=false; cancelAnimationFrame(raf);
          show('<h2>Paused</h2><div style="text-align:right"><a class="btn" id="resume" href="#">Resume</a><a class="btn ghost" id="menu" href="#" style="margin-left:8px">Menu</a></div>');
          $('#resume')?.addEventListener('click', ev=>{ ev.preventDefault(); hide(); run=true; last=performance.now(); requestAnimationFrame(frame); });
          $('#menu')?.addEventListener('click', ev=>{ ev.preventDefault(); hide(); });
        }
      };
      const ku = (e)=>{ keys[e.key]=false; };

      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);

      requestAnimationFrame(frame);
    }

    // options / levels / stats UI
    function showLevels(){
      const cells = Array.from({length: LV.length},(_,i)=>`<div class='cell' data-i='${i}'>${i+1}</div>`).join('');
      show(`<h2>Select Level</h2><div class='grid'>${cells}</div><div style='text-align:right'><a class='btn ghost' id='back' href='#'>Back</a></div>`);
      panel.querySelectorAll('.cell').forEach(el=>{
        el.addEventListener('click', ()=>{
          const idx = parseInt(el.dataset.i,10)||0;
          hide(); boot(idx);
        });
      });
      $('#back')?.addEventListener('click', e=>{ e.preventDefault(); hide(); });
    }

    function showOptions(){
      const val = (x)=>String(x).replace(/(?<=\\d\\.\\d)\\d+/, m=>m.slice(0,2));
      const html = `
        <h2>Options</h2>
        <div class="kv">
          <label>Difficulty</label>
          <div>
            <select id="opt-diff">
              <option value="easy" ${settings.difficulty==='easy'?'selected':''}>Easy</option>
              <option value="normal" ${settings.difficulty==='normal'?'selected':''}>Normal</option>
              <option value="hard" ${settings.difficulty==='hard'?'selected':''}>Hard</option>
              <option value="insane" ${settings.difficulty==='insane'?'selected':''}>Insane</option>
            </select>
          </div>
        </div>
        <div class="kv"><label>Speed boost</label><div><input id="opt-boost" class="range" type="range" min="0.8" max="1.8" step="0.05" value="${settings.speedBoost}">
        <div id="opt-boost-val">${val(settings.speedBoost)}</div></div></div>
        <div style='text-align:right;margin-top:12px'><a id='save' class='btn' href='#'>Save</a> <a id='x' class='btn ghost' href='#' style='margin-left:8px'>Close</a></div>
      `;
      show(html);
      const diffSel = $('#opt-diff');
      const boost = $('#opt-boost');
      const boostVal = $('#opt-boost-val');
      boost?.addEventListener('input', e=>{ boostVal.textContent = val(e.target.value); });
      $('#save')?.addEventListener('click', e=>{
        e.preventDefault();
        settings.difficulty = diffSel.value;
        settings.speedBoost = parseFloat(boost.value);
        saveSettings();
        hide();
      });
      $('#x')?.addEventListener('click', e=>{ e.preventDefault(); hide(); });
    }

    function showStats(){
      const rows = Object.keys(bestTimes).sort((a,b)=>a-b).map(k=>{
        const lv = parseInt(k,10)+1; const s = bestTimes[k].toFixed(2)+'s';
        return `<div class="kv"><div>Level ${lv}</div><div style="text-align:right">${s}</div></div>`;
      }).join('') || '<p>No best times yet.</p>';
      show(`<h2>Stats</h2>${rows}<div style='text-align:right;margin-top:10px'><a id='x' class='btn ghost' href='#'>Close</a></div>`);
      $('#x')?.addEventListener('click', e=>{ e.preventDefault(); hide(); });
    }

    function showHow(){
      show("<h2>How to Play</h2><p>Collect all fireflies and reach the glade. Avoid red bots and walls. Movement: WASD / Arrow keys, R to restart, Esc to pause.</p><div style='text-align:right'><a id='x' class='btn ghost' href='#'>Close</a></div>");
      $('#x')?.addEventListener('click', e=>{ e.preventDefault(); hide(); });
    }

    // expose API for header
    window.__fireflyBoot = (i=0)=>boot(i);
    window.__fireflyShowLevels = ()=>showLevels();
    window.__fireflyShowOptions = ()=>showOptions();
    window.__fireflyShowStats = ()=>showStats();
    window.__fireflyShowHow = ()=>showHow();

    // bind buttons if present
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
