/* game.js
   Complete rewrite to:
   - Implement 20 deterministic "World's Hardest Game" style levels (no chasing).
   - Fix level progression (uses a robust currentLevel state).
   - Add options for enemy speed multiplier, enemy density (more obstacles), and difficulty presets.
   - Improve visuals hooks (theme) and stable keyboard handling with cleanup.
   - Expose window.__firefly* functions for index.html header buttons.
*/
(function(){
  'use strict';

  function main(){
    const $ = s => document.querySelector(s);
    const panel = $('#panel'), bg = $('#bg'), game = $('#game');
    if(!panel || !bg || !game){ console.error('game.js: missing required DOM elements (#panel, #bg, #game).'); return; }
    const ctx = game.getContext('2d');
    if(!ctx){ console.error('game.js: failed to get canvas context'); return; }

    // ----- persistent settings -----
    const defaults = {
      theme: 'nature',              // design theme: 'nature'
      enemySpeedMultiplier: 1.0,    // global speed multiplier
      enemyDensity: 1.0,            // multiplier for number of moving obstacles
      difficulty: 'normal'          // easy | normal | hard
    };
    let settings = Object.assign({}, defaults);
    try{ const raw = localStorage.getItem('fireflySettings'); if(raw) settings = Object.assign({}, settings, JSON.parse(raw)); } catch(e){}
    function saveSettings(){ try{ localStorage.setItem('fireflySettings', JSON.stringify(settings)); } catch(e){} }

    // ----- background / theme drawing (improved nature look) -----
    (function bgLoop(ts){
      const w = bg.width, h = bg.height, b = bg.getContext('2d');
      if(!b) return;
      b.clearRect(0,0,w,h);
      // layered nature gradient + subtle leaf texture
      const g = b.createLinearGradient(0,0,0,h);
      g.addColorStop(0, '#07220e');
      g.addColorStop(0.5, '#08321a');
      g.addColorStop(1, '#05160a');
      b.fillStyle = g; b.fillRect(0,0,w,h);

      // soft spotlight + floating light orbs (like firefly glow)
      b.globalCompositeOperation = 'lighter';
      for(let i=0;i<14;i++){
        const x = ( (ts * 0.01 + i * 97) % (w + 200) ) - 100;
        const y = 60 + (i*33 % (h-120)) + Math.sin(ts*0.0007 + i)*8;
        const r = 18 + (Math.sin(ts*0.001 + i)*6);
        const grd = b.createRadialGradient(x,y,0,x,y,r);
        grd.addColorStop(0, 'rgba(190,240,130,0.18)');
        grd.addColorStop(0.25, 'rgba(190,240,130,0.06)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        b.fillStyle = grd;
        b.fillRect(x-r, y-r, r*2, r*2);
      }
      b.globalCompositeOperation = 'source-over';

      // subtle leaf pattern: repeated translucent shapes
      b.globalAlpha = 0.06;
      b.fillStyle = '#0f3a20';
      for(let yy=0; yy<h; yy += 32){
        for(let xx=0; xx<w; xx += 32){
          b.beginPath();
          b.ellipse(xx+8 + ((yy/10) % 8), yy+8 + ((xx/10) % 8), 18, 6, Math.PI*0.18, 0, Math.PI*2);
          b.fill();
        }
      }
      b.globalAlpha = 1;
      requestAnimationFrame(bgLoop);
    })(performance.now());

    // ----- utilities -----
    const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
    const R = (x,y,w,h) => ({ x,y,w,h });
    const rectIntersects = (a,b) => !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
    function circleRectCollision(cx, cy, cr, rect){
      // closest point on rect to circle center
      const px = clamp(cx, rect.x, rect.x + rect.w);
      const py = clamp(cy, rect.y, rect.y + rect.h);
      const dx = cx - px, dy = cy - py;
      return dx*dx + dy*dy <= cr*cr;
    }

    // ----- level system -----
    const W = 960, H = 520;
    const LV = [];

    // Helper: create enemy following an ordered path (no chasing)
    function mkEnemy(x,y,w,h,pathPoints,speed){
      return {
        r: R(x,y,w,h),
        path: pathPoints.map(p => ({ x: p[0], y: p[1] })),
        speed: speed,
        idx: 0,
        dir: 1,
        // visual offset smoothing (for crisp movement)
        ox: x, oy: y
      };
    }

    // Build 20 deterministic levels. Inspired by World's Hardest Game: precise corridors, moving rectangles.
    function buildLevels(){
      LV.length = 0;
      // Level 1 - simple cross pattern
      LV.push({
        start: [80, 260],
        goal: R(W-120, 240, 40, 60),
        walls: [
          R(0,0,W,20), R(0,H-20,W,20), R(0,0,20,H), R(W-20,0,20,H),
          R(200,120,20,280), R(460,0,20,180)
        ],
        tokens: [ R(300,90,20,20), R(520,430,20,20) ],
        enemies: [
          mkEnemy(120,130,18,18, [[120,130],[420,130],[420,390],[120,390]], 2.2),
          mkEnemy(540,130,18,18, [[540,130],[740,130]], 2.6)
        ]
      });

      // Procedurally create harder levels (2..20)
      for(let li = 2; li <= 20; li++){
        const speedBase = 2.4 + (li - 1) * 0.18; // increase base speed with level
        const nRows = 2 + Math.min(6, Math.floor(li/3));
        const walls = [ R(0,0,W,20), R(0,H-20,W,20), R(0,0,20,H), R(W-20,0,20,H) ];
        const gap = Math.floor((H - 120) / (nRows+1));
        const enemies = [];
        const tokens = [
          R(240 + (li*13)%200, 60 + (li*11)%80, 20,20),
          R(W-260 - (li*17)%180, H-80 - (li*7)%80, 20,20)
        ];

        // walls making maze-like corridors
        for(let r=0; r<nRows; r++){
          const y = 80 + (r+1)*gap;
          if(r % 2 === 0){
            walls.push(R(120, y, W - 240, 16));
          } else {
            walls.push(R(160, y, W - 320, 16));
          }
        }

        // add moving enemies in alternating corridors
        for(let r=0; r<nRows; r++){
          const y = 80 + (r+1)*gap;
          const count = 2 + Math.floor((li + r) % 3); // density changes slightly
          for(let e=0; e < count * Math.max(1, Math.round(settings.enemyDensity)); e++){
            const xA = 120 + 30 + (e*80) % (W-320);
            const xB = W - 120 - 30 - (e*80) % (W-320);
            const sp = speedBase + ((r + e) % 3) * 0.2;
            enemies.push(mkEnemy(xA, y - 8, 16, 16, [[xA, y - 8],[xB, y - 8]], sp));
          }
        }

        // extra obstacles in later levels
        if(li >= 10){
          walls.push(R(360, 120, 20, 280), R(620, 120, 20, 280));
        }

        LV.push({
          start: [80, (li % 2) ? 80 : H - 80],
          goal: R(W-120, (li % 2) ? H - 120 : 80, 40, 60),
          walls, tokens, enemies
        });
      }
    }

    buildLevels();

    // ----- rendering helpers -----
    function drawWall(r){
      // stylized hedge
      ctx.fillStyle = '#234b25';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = '#0a2a12';
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
    function drawGoal(g){
      ctx.save();
      const grd = ctx.createLinearGradient(g.x, g.y, g.x + g.w, g.y + g.h);
      grd.addColorStop(0, '#c7f0a8'); grd.addColorStop(1, '#9acd6b');
      ctx.fillStyle = grd;
      ctx.fillRect(g.x, g.y, g.w, g.h);
      ctx.strokeStyle = '#1f4e22';
      ctx.lineWidth = 2;
      ctx.strokeRect(g.x, g.y, g.w, g.h);
      ctx.restore();
    }
    function drawFireflyToken(t, ts){
      const cx = t.x + t.w/2, cy = t.y + t.h/2;
      const r = 5 + Math.sin(ts*0.01 + (cx+cy)*0.02) * 2;
      const g = ctx.createRadialGradient(cx,cy,0,cx,cy,r*3);
      g.addColorStop(0, 'rgba(255,230,120,0.95)');
      g.addColorStop(0.25, 'rgba(255,230,120,0.45)');
      g.addColorStop(1, 'rgba(255,230,120,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx,cy, r*1.9, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fffbe8';
      ctx.beginPath(); ctx.arc(cx,cy,2,0,Math.PI*2); ctx.fill();
    }

    // ----- main game loop and state -----
    let currentLevel = 0;
    let keyState = {};
    function boot(i = 0){
      hidePanel();
      currentLevel = clamp(i|0, 0, LV.length - 1);
      runLevel(currentLevel);
    }

    function hidePanel(){ panel.classList.add('hidden'); }
    function showPanel(html){ panel.innerHTML = html; panel.classList.remove('hidden'); }

    // run level with robust cleanup
    function runLevel(i){
      // defensive: rebuild levels in case settings changed density
      buildLevels();

      currentLevel = clamp(i|0, 0, LV.length - 1);
      const L = LV[currentLevel];
      // copy arrays/objects so we can mutate them safely
      const walls = L.walls.map(w => Object.assign({}, w));
      let tokens = L.tokens.map(t => Object.assign({}, t));
      const enemies = L.enemies.map(en => ({
        r: Object.assign({}, en.r),
        path: en.path.map(p => ({ x: p.x, y: p.y })),
        speed: (en.speed || 2) * (settings.enemySpeedMultiplier || 1),
        idx: en.idx || 0,
        dir: en.dir || 1,
        ox: en.r.x, oy: en.r.y
      }));
      const player = { x: L.start[0], y: L.start[1], r: 11, s: 3.2 };
      let t = 0, last = performance.now(), running = true;

      // playfield loop functions
      function step(dt){
        t += dt;
        // player movement - arrow / WASD
        let vx = (keyState['ArrowRight'] || keyState['d'] || keyState['D'] ? 1 : 0) - (keyState['ArrowLeft'] || keyState['a'] || keyState['A'] ? 1 : 0);
        let vy = (keyState['ArrowDown'] || keyState['s'] || keyState['S'] ? 1 : 0) - (keyState['ArrowUp'] || keyState['w'] || keyState['W'] ? 1 : 0);
        const norm = (vx && vy) ? (1 / Math.SQRT2) : 1;
        const sp = player.s * norm;
        player.x = clamp(player.x + (vx ? (vx > 0 ? 1 : -1) : 0) * sp, player.r, W - player.r);
        player.y = clamp(player.y + (vy ? (vy > 0 ? 1 : -1) : 0) * sp, player.r, H - player.r);

        // wall collision kills player
        const pr = { x: player.x - player.r, y: player.y - player.r, w: player.r*2, h: player.r*2 };
        for(const w of walls){ if(rectIntersects(pr, w)){ die(); return; } }

        // advance enemies strictly along their path (no chasing)
        for(const e of enemies){
          const nextIndex = e.idx + e.dir;
          const tgt = e.path[nextIndex] || e.path[e.idx];
          // center of enemy
          const ex = e.r.x + e.r.w/2, ey = e.r.y + e.r.h/2;
          let dx = tgt.x - ex, dy = tgt.y - ey;
          const dist = Math.hypot(dx, dy) || 1;
          const move = e.speed * dt;
          if(dist <= move){
            // step to next node
            if(e.path[nextIndex]){
              e.idx = nextIndex;
            } else {
              // bounce or loop
              if(e.dir === 1 && e.idx === e.path.length - 1) e.dir = -1;
              else if(e.dir === -1 && e.idx === 0) e.dir = 1;
              e.idx += e.dir;
            }
          } else {
            e.r.x += (dx / dist) * move;
            e.r.y += (dy / dist) * move;
          }
          // collision check with player (circle-rect)
          const centerX = e.r.x + e.r.w/2, centerY = e.r.y + e.r.h/2;
          if(Math.hypot(centerX - player.x, centerY - player.y) < player.r + Math.max(e.r.w, e.r.h) / 2){
            die(); return;
          }
        }

        // collect tokens
        tokens = tokens.filter(tok => {
          const collected = circleRectCollision(player.x, player.y, player.r, tok);
          return !collected;
        });

        // victory: all tokens collected and player reaches goal rect
        if(tokens.length === 0 && circleRectCollision(player.x, player.y, player.r, L.goal)){
          win();
          return;
        }
      }

      function draw(ts){
        ctx.clearRect(0,0,W,H);
        // decorative border
        ctx.save();
        ctx.translate(0,0);

        // draw walls
        for(const w of walls) drawWall(w);
        // goal area
        drawGoal(L.goal);

        // tokens (fireflies)
        for(const tok of tokens) drawFireflyToken(tok, ts);

        // enemies as red blocks with shadow
        for(const e of enemies){
          ctx.fillStyle = '#c92f2f';
          ctx.fillRect(e.r.x, e.r.y, e.r.w, e.r.h);
          ctx.strokeStyle = '#6a0f0f';
          ctx.lineWidth = 2;
          ctx.strokeRect(e.r.x, e.r.y, e.r.w, e.r.h);
        }

        // player - green orb
        ctx.beginPath();
        ctx.fillStyle = '#fff';
        ctx.arc(player.x, player.y, player.r, 0, Math.PI*2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#8dcf7a';
        ctx.stroke();

        // HUD (top-left)
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(8, 8, 220, 74);
        ctx.fillStyle = '#e7fbe6';
        ctx.font = 'bold 14px ui-rounded, system-ui, Inter, Arial';
        ctx.fillText(`Level ${currentLevel + 1} / ${LV.length}`, 16, 28);
        ctx.fillText(`Fireflies ${tokens.length}`, 16, 48);
        ctx.fillText(`Time ${t.toFixed(2)}s`, 16, 68);

        ctx.restore();
      }

      // frame loop
      let raf = 0;
      function frame(ts){
        if(!running) return;
        const dt = Math.min(0.05, (ts - last) / 1000);
        last = ts;
        step(dt);
        draw(ts);
        raf = requestAnimationFrame(frame);
      }

      // death and win logic
      function die(){
        running = false;
        cleanup();
        // small flash panel then restart same level
        showPanel(`<h2>You died</h2><div style="text-align:right;margin-top:8px"><a class="btn" id="retry" href="#">Retry</a></div>`);
        const retry = document.getElementById('retry');
        retry && retry.addEventListener('click', (ev) => { ev.preventDefault(); hidePanel(); runLevel(currentLevel); });
      }
      function win(){
        running = false;
        cleanup();
        const nextIdx = currentLevel + 1;
        if(nextIdx >= LV.length){
          showPanel(`<h2>All levels complete!</h2><div style="text-align:right;margin-top:8px"><a class="btn" id="home" href="#">Menu</a></div>`);
          const home = document.getElementById('home');
          home && home.addEventListener('click',(e)=>{ e.preventDefault(); hidePanel(); });
        } else {
          showPanel(`<h2>Glade Reached!</h2><div>Time: ${t.toFixed(2)}s</div><div style="text-align:right;margin-top:8px"><a class="btn" id="n" href="#">Next</a></div>`);
          const n = document.getElementById('n');
          n && n.addEventListener('click', (e) => { e.preventDefault(); hidePanel(); runLevel(nextIdx); });
        }
      }

      // keyboard handling
      const onKeyDown = (e) => {
        keyState[e.key] = true;
        if(e.key && e.key.toLowerCase() === 'r'){ die(); }
        if(e.key === 'Escape'){
          // pause panel
          running = false;
          cancelAnimationFrame(raf);
          showPanel('<h2>Paused</h2><div style="text-align:right"><a class="btn" id="resume" href="#">Resume</a><a class="btn ghost" id="menu" href="#" style="margin-left:8px">Menu</a></div>');
          const r = document.getElementById('resume');
          r && r.addEventListener('click', (ev) => { ev.preventDefault(); hidePanel(); running = true; last = performance.now(); requestAnimationFrame(frame); });
          const m = document.getElementById('menu');
          m && m.addEventListener('click', (ev) => { ev.preventDefault(); hidePanel(); });
        }
      };
      const onKeyUp = (e) => { keyState[e.key] = false; };

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);

      function cleanup(){
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        cancelAnimationFrame(raf);
      }

      // start loop
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    // ----- UI and Controls (exposed for header) -----
    function renderLevelSelector(){
      const cells = Array.from({ length: LV.length }, (_, i) => `<div class='cell' data-i='${i}'>${i+1}</div>`).join('');
      showPanel(`<h2>Select Level</h2><div class='grid'>${cells}</div><div style='text-align:right'><a class='btn ghost' id='back' href='#'>Back</a></div>`);
      panel.querySelectorAll('.cell').forEach(el => el.addEventListener('click', (evt) => {
        const idx = parseInt(el.dataset.i, 10) || 0;
        hidePanel();
        boot(idx);
      }));
      const back = panel.querySelector('#back');
      back && back.addEventListener('click', (e) => { e.preventDefault(); hidePanel(); });
    }

    function renderOptions(){
      const html = `
        <h2>Options</h2>
        <div class="kv"><label>Enemy speed multiplier</label><div><input id="opt-speed" class="range" type="range" min="0.6" max="2.5" step="0.1" value="${settings.enemySpeedMultiplier}"><div id="opt-speed-val">${settings.enemySpeedMultiplier}</div></div></div>
        <div class="kv"><label>Enemy density</label><div><input id="opt-density" class="range" type="range" min="0.6" max="2.0" step="0.1" value="${settings.enemyDensity}"><div id="opt-density-val">${settings.enemyDensity}</div></div></div>
        <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
          <label>Difficulty:</label>
          <select id="opt-difficulty">
            <option value="easy" ${settings.difficulty === 'easy' ? 'selected' : ''}>Easy</option>
            <option value="normal" ${settings.difficulty === 'normal' ? 'selected' : ''}>Normal</option>
            <option value="hard" ${settings.difficulty === 'hard' ? 'selected' : ''}>Hard</option>
          </select>
        </div>
        <div style='text-align:right;margin-top:12px'><a id='save' class='btn' href='#'>Save</a> <a id='x' class='btn ghost' href='#' style='margin-left:8px'>Close</a></div>
      `;
      showPanel(html);

      const sSpeed = $('#opt-speed'), sSpeedVal = $('#opt-speed-val');
      const sDensity = $('#opt-density'), sDensityVal = $('#opt-density-val');
      const sDiff = $('#opt-difficulty');

      sSpeed && sSpeed.addEventListener('input', e => { sSpeedVal.textContent = e.target.value; });
      sDensity && sDensity.addEventListener('input', e => { sDensityVal.textContent = e.target.value; });

      $('#save') && $('#save').addEventListener('click', (ev) => {
        ev.preventDefault();
        settings.enemySpeedMultiplier = parseFloat(sSpeed.value);
        settings.enemyDensity = parseFloat(sDensity.value);
        settings.difficulty = sDiff.value;
        // apply difficulty presets if chosen
        if(settings.difficulty === 'easy'){ settings.enemySpeedMultiplier = Math.min(settings.enemySpeedMultiplier, 1.0); settings.enemyDensity = Math.max(0.8, settings.enemyDensity); }
        if(settings.difficulty === 'hard'){ settings.enemySpeedMultiplier = Math.max(settings.enemySpeedMultiplier, 1.4); settings.enemyDensity = Math.max(1.2, settings.enemyDensity); }
        saveSettings();
        hidePanel();
      });

      const x = $('#x'); x && x.addEventListener('click', (e) => { e.preventDefault(); hidePanel(); });
    }

    // expose functions for index.html (header wiring)
    window.__fireflyBoot = (i=0) => boot(i);
    window.__fireflyShowLevels = () => renderLevelSelector();
    window.__fireflyShowOptions = () => renderOptions();
    window.__fireflyShowStats = () => { showPanel("<h2>Stats</h2><p>Best times and attempts are local to your browser (coming soon).</p><div style='text-align:right'><a id='x' class='btn ghost' href='#'>Close</a></div>"); const x = $('#x'); x && x.addEventListener('click',(e)=>{ e.preventDefault(); hidePanel(); }); };
    window.__fireflyShowHow = () => { showPanel("<h2>How to Play</h2><p>Navigate the green orb to collect all fireflies, then reach the glade without touching red bots or walls. Precise movement and timing required.</p><div style='text-align:right'><a id='x' class='btn ghost' href='#'>Close</a></div>"); const x = $('#x'); x && x.addEventListener('click',(e)=>{ e.preventDefault(); hidePanel(); }); };

    // wire header buttons that are actual DOM elements too
    const bindBtn = (sel, fn) => { const el = $(sel); if(el) el.addEventListener('click', (e) => { e.preventDefault(); fn(); }); };
    bindBtn('#btn-play', () => boot(0));
    bindBtn('#cta-play', () => boot(0));
    bindBtn('#btn-levels', () => window.__fireflyShowLevels && window.__fireflyShowLevels());
    bindBtn('#btn-options', () => window.__fireflyShowOptions && window.__fireflyShowOptions());
    bindBtn('#btn-stats', () => window.__fireflyShowStats && window.__fireflyShowStats());
    bindBtn('#cta-how', () => window.__fireflyShowHow && window.__fireflyShowHow());
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main); else main();
})();
