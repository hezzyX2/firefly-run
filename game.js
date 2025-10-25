(function(){
  function main(){
    const $ = s => document.querySelector(s);
    const on = (el, ev, fn) => el && el.addEventListener(ev, (e)=>{ e.preventDefault?.(); fn(e); });
    const panel = $("#panel"), bg = $("#bg"), game = $("#game");
    if(!panel || !bg || !game){ console.error('game.js: missing required DOM elements (#panel, #bg, #game).'); return; }
    const ctx = game.getContext && game.getContext('2d');
    if(!ctx){ console.error('game.js: failed to get canvas context'); return; }

    (function loop(ts){
      const w = bg.width, h = bg.height, b = bg.getContext('2d');
      if(!b) return;
      b.clearRect(0,0,w,h);
      const g = b.createLinearGradient(0,0,0,h); g.addColorStop(0,'#0b2c1b'); g.addColorStop(1,'#06180d');
      b.fillStyle = g; b.fillRect(0,0,w,h);
      b.globalAlpha = .15; b.fillStyle = '#0f3a20';
      for(let i=0;i<8;i++){
        const y = 40 + i*44 + Math.sin(ts*0.0005 + i) * 6;
        const x = ((ts*0.03 + i*140) % (w+240)) - 240;
        b.beginPath(); b.ellipse(x,y,200,36,0,0,Math.PI*2); b.fill();
      }
      b.globalAlpha = 1;
      for(let yy=0;yy<h;yy+=24){
        for(let xx=0;xx<w;xx+=24){
          b.fillStyle = ((xx/24 + yy/24) % 2 === 0) ? '#135a24' : '#0c3b17';
          b.fillRect(xx,yy,24,24);
        }
      }
      requestAnimationFrame(loop);
    })(performance.now());

    const show = (html)=>{ panel.innerHTML = html; panel.classList.remove('hidden'); };
    const hide = ()=> panel.classList.add('hidden');
    const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
    const R = (x,y,w,h)=>({x,y,w,h});
    const rectI = (a,b)=>!(a.x+a.w < b.x || b.x+b.w < a.x || a.y+a.h < b.y || b.y+b.h < a.y);
    function cRect(px,py,pr,r){
      const cx = clamp(px, r.x, r.x + r.w), cy = clamp(py, r.y, r.y + r.h);
      const dx = px - cx, dy = py - cy;
      return dx*dx + dy*dy <= pr*pr;
    }

    const W = 960, H = 520, LV = [];
    function addL(start,goal,walls,tok,enm){ LV.push({start,goal,walls,tok,enm}); }
    function line(y,n,s){
      const a = [];
      const step = (W-160) / (Math.max(1,n)-1 || 1);
      for(let i=0;i<n;i++){
        a.push({
          r: R(120 + i*step - 8, y - 8, 16, 16),
          path: [[120 + i*step, y], [W - 120 - i*step, y]],
          speed: s,
          bounce: true
        });
      }
      return a;
    }

    // Level 1 (manually defined)
    addL(
      [80,260],
      R(W-120,240,40,60),
      [
        R(0,0,W,20), R(0,H-20,W,20), R(0,0,20,H), R(W-20,0,20,H),
        R(220,120,20,280), R(420,120,20,280), R(620,120,20,280)
      ],
      [ R(300,90,20,20), R(520,430,20,20), R(740,90,20,20) ],
      [
        { r:R(140,260,16,16), path:[[140,100],[140,420]], speed:3, bounce:true },
        { r:R(340,260,16,16), path:[[340,100],[340,420]], speed:3, bounce:true },
        { r:R(540,260,16,16), path:[[540,100],[540,420]], speed:3, bounce:true }
      ]
    );

    // Levels 2..20 (generated)
    for(let i=2;i<=20;i++){
      const y1 = 100 + ((i*37) % 280), y2 = H - 100 - ((i*53) % 280);
      const walls = [
        R(0,0,W,20), R(0,H-20,W,20), R(0,0,20,H), R(W-20,0,20,H),
        R(160,y1,W-320,20), R(160,y2,W-320,20)
      ];
      const tok = [ R(240,60,20,20), R(W-260,H-80,20,20), R(W/2-10,H/2-10,20,20) ];
      const enm = line(y1-40, 3 + (i%3), 4 + (i%4)).concat(line(y2+40, 3 + ((i+1)%3), 4 + ((i+2)%4)));
      addL([80, (i%2) ? 80 : H-80], R(W-120, (i%2) ? H-120 : 80, 40, 60), walls, tok, enm);
    }

    function hedge(r){
      ctx.fillStyle = '#2a8d4e'; ctx.fillRect(r.x,r.y,r.w,r.h);
      ctx.strokeStyle = '#0d411e'; ctx.lineWidth = 2; ctx.strokeRect(r.x,r.y,r.w,r.h);
    }
    function glade(g){
      ctx.fillStyle = '#b5ec7f'; ctx.fillRect(g.x,g.y,g.w,g.h);
      ctx.strokeStyle = '#2b5a2a'; ctx.lineWidth = 2; ctx.strokeRect(g.x,g.y,g.w,g.h);
    }

    function firefly(t,ts){
      const cx = t.x + t.w/2, cy = t.y + t.h/2;
      const r = 6 + 2*(.5 + .5*Math.sin(ts*0.01 + (cx+cy)*.02));
      const grd = ctx.createRadialGradient(cx,cy,0,cx,cy,r*3);
      grd.addColorStop(0,'rgba(255,220,0,0.95)');
      grd.addColorStop(0.2,'rgba(255,220,0,0.6)');
      grd.addColorStop(1,'rgba(255,220,0,0)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx,cy,r*2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff7c0'; ctx.beginPath(); ctx.arc(cx,cy,3,0,Math.PI*2); ctx.fill();
    }

    function tx(s,x,y,sz=18,c='#f3ffe9'){
      ctx.font = `bold ${sz}px ui-rounded, ui-sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(s,x,y);
      ctx.fillStyle = c; ctx.fillText(s,x,y);
    }

    let keys = {};
    function boot(i){ hide(); runLevel(Math.max(0, Math.min(i, LV.length-1))); }

    function runLevel(i){
      const L = LV[i]; let t = 0;
      let tokens = L.tok.map(o=>({ ...o }));
      const walls = L.walls.map(o=>({...o})), goal = {...L.goal};
      const enemies = L.enm.map(e=>({
        r:{...e.r},
        path: e.path.map(p=>({x:p[0], y:p[1]})),
        speed: e.speed,
        bounce: !!e.bounce,
        idx: 0,
        dir: 1
      }));
      const p = { x: L.start[0], y: L.start[1], r:11, s:3.2 };
      let run = true, lf = performance.now();

      function step(dt){
        t += dt;
        let vx = (keys['ArrowRight']||keys['d']||keys['D'] ? 1 : 0) - (keys['ArrowLeft']||keys['a']||keys['A'] ? 1 : 0);
        let vy = (keys['ArrowDown']||keys['s']||keys['S'] ? 1 : 0) - (keys['ArrowUp']||keys['w']||keys['W'] ? 1 : 0);
        const sp = p.s * ((vx && vy) ? 1.414 : 1);
        p.x = clamp(p.x + (vx ? (vx>0 ? 1 : -1) : 0) * sp, p.r, W - p.r);
        p.y = clamp(p.y + (vy ? (vy>0 ? 1 : -1) : 0) * sp, p.r, H - p.r);

        const pr = { x: p.x - p.r, y: p.y - p.r, w: p.r*2, h: p.r*2 };
        for(const w of walls){ if(rectI(pr,w)){ die(); return; } }

        for(const e of enemies){
          const tgt = e.path[e.idx + e.dir] || e.path[e.idx];
          let dx = tgt.x - (e.r.x + e.r.w/2), dy = tgt.y - (e.r.y + e.r.h/2);
          const dist = Math.hypot(dx,dy) || 1;
          const move = e.speed * 1.25 * dt;
          if(dist <= move){
            if(e.idx + e.dir >= 0 && e.idx + e.dir < e.path.length){
              e.idx += e.dir;
            } else {
              if(e.bounce){
                e.dir *= -1;
                e.idx += e.dir;
              } else {
                e.idx = 0;
              }
            }
          } else {
            e.r.x += (dx / dist) * move;
            e.r.y += (dy / dist) * move;
          }
          const ex = e.r.x + e.r.w/2, ey = e.r.y + e.r.h/2;
          const dpx = ex - p.x, dpy = ey - p.y;
          if(Math.hypot(dpx,dpy) < p.r + Math.max(e.r.w, e.r.h)/2){
            die(); return;
          }
        }

        tokens = tokens.filter(o => !cRect(p.x, p.y, p.r, o));
        if(tokens.length === 0 && cRect(p.x, p.y, p.r, goal)){ win(t); return; }
      }

      function draw(ts){
        ctx.clearRect(0,0,W,H);
        for(const w of walls) hedge(w);
        glade(goal);
        for(const to of tokens) firefly(to,ts);
        for(const e of enemies){
          ctx.fillStyle = '#e14d4d'; ctx.fillRect(e.r.x,e.r.y,e.r.w,e.r.h);
          ctx.strokeStyle = '#5a1010'; ctx.lineWidth = 2; ctx.strokeRect(e.r.x,e.r.y,e.r.w,e.r.h);
        }
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#8dcf7a'; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.stroke();
        tx(`Level ${i+1}/${LV.length}`,12,24);
        tx(`Fireflies ${tokens.length}`,12,48);
        tx(`Time ${t.toFixed(2)}s`,12,72);
      }

      function frame(ts){
        const dt = Math.min(.05, (ts - lf) / 1000);
        lf = ts;
        if(run){ step(dt); draw(ts); requestAnimationFrame(frame); }
      }

      function die(){ run = false; setTimeout(()=>runLevel(i),120); }
      function win(time){
        show(`<h2>Glade Reached!</h2><div>Time: ${time.toFixed(2)}s</div><div style="text-align:right;margin-top:8px"><a class="btn" id="n" href="#">Next</a></div>`);
        const n = document.getElementById('n');
        n && n.addEventListener('click',(e)=>{ e.preventDefault(); hide(); if(i+1 < LV.length) runLevel(i+1); });
      }

      window.onkeydown = (e) => {
        keys[e.key] = true;
        if(e.key && e.key.toLowerCase() === 'r'){ die(); }
        if(e.key === 'Escape'){
          run = false;
          show('<h2>Paused</h2><div style="text-align:right"><a class="btn" id="r" href="#">Resume</a><a class="btn ghost" id="m" href="#" style="margin-left:8px">Menu</a></div>');
          const r = document.getElementById('r');
          r && r.addEventListener('click',(ev)=>{ ev.preventDefault(); hide(); run = true; lf = performance.now(); requestAnimationFrame(frame); });
          const m = document.getElementById('m');
          m && m.addEventListener('click',(ev)=>{ ev.preventDefault(); hide(); });
        }
      };
      window.onkeyup = (e) => { keys[e.key] = false; };

      requestAnimationFrame(frame);
    }

    const playFn = ()=> boot(0);
    on($("#btn-play"),'click',playFn);
    on($("#cta-play"),'click',playFn);

    on($("#btn-levels"),'click',()=>{
      const cells = Array.from({length:20},(_,i)=>`<div class='cell' data-i='${i}'>${i+1}</div>`).join('');
      show(`<h2>Select Level</h2><div class='grid'>${cells}</div><div style='text-align:right'><a class='btn ghost' id='back' href='#'>Back</a></div>`);
      panel.querySelectorAll('.cell').forEach(el=>el.addEventListener('click',()=>{ hide(); boot(parseInt(el.dataset.i)); }));
      const back = panel.querySelector('#back');
      back && back.addEventListener('click',(e)=>{ e.preventDefault(); hide(); });
    });

    on($("#btn-stats"),'click',()=>{
      show("<h2>Stats</h2><p>Best times saved locally.</p><div style='text-align:right'><a id='x' class='btn ghost' href='#'>Close</a></div>");
      const x = panel.querySelector('#x');
      x && x.addEventListener('click',(e)=>{ e.preventDefault(); hide(); });
    });

    on($("#btn-options"),'click',()=>{
      show("<h2>Options</h2><p>More coming soon.</p><div style='text-align:right'><a id='x' class='btn ghost' href='#'>Close</a></div>");
      const x = panel.querySelector('#x');
      x && x.addEventListener('click',(e)=>{ e.preventDefault(); hide(); });
    });

    on($("#cta-how"),'click',()=>alert('Collect the glowing fireflies, reach the glade, avoid reds. WASD/Arrows move, R restarts, Esc menu.'));
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main); else main();
})();