/* events.js — три ивента: Дуэль, Украсть/разделить, Предатель. */
const Events = (() => {
  const g = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function stealText(a, b, cA, cB) {
    if (cA === 'steal' && cB === 'steal') return 'Оба украли — никто ничего не получил.';
    if (cA === 'steal') return `${a.name} украл 500 €.`;
    if (cB === 'steal') return `${b.name} украл 500 €.`;
    return 'Оба разделили — по 250 € каждому.';
  }

  /* ===================== ДУЭЛЬ ===================== */
  function duel(a, b, io) {
    return new Promise(resolve => {
      const canvas = g('duel-canvas');
      const ctx = canvas.getContext('2d');
      const hud = g('duel-head');
      let timerEl = null;
      const isMP = !!(io && io.mp);
      const isHost = !isMP || io.isHost;

      const Lp = a, Rp = b;
      const READY_MS = 2400;
      const MAX_HP = 10;
      const BULLET_SPEED = 9;
      const PLAYER_SPEED = 4.0;
      const DUEL_TIME = 210;

      // ИСПРАВЛЕНО: кулдаун стрельбы для людей (раньше был только у ботов).
      // 280 мс ≈ 3.5 выстрела/сек — не даёт спамить 10 шаров за раз.
      const FIRE_CD = 280;
      // ИСПРАВЛЕНО: жёсткий предел одновременных пуль, чтобы не лагало.
      const MAX_BULLETS = 30;

      let W = 0, H = 0;

      let mySide = null;
      if (isMP) {
        if (io.kind(a.id) === 'me') mySide = 'p1';
        else if (io.kind(b.id) === 'me') mySide = 'p2';
      } else {
        if (!a.bot) mySide = 'p1';
        else if (!b.bot) mySide = 'p2';
      }

      const mapId = Math.random() < 0.5 ? 1 : 3;

      const keys = {};
      const aim = { x: 0.5, y: 0.5 };
      let fireQueued = false;
      // ИСПРАВЛЕНО: троттлинг кликов на клиенте.
      let lastClickAt = 0;
      const onKey = e => { keys[e.key.toLowerCase()] = true; };
      const offKey = e => { keys[e.key.toLowerCase()] = false; };
      const onMove = e => {
        const r = canvas.getBoundingClientRect();
        aim.x = (e.clientX - r.left) / r.width;
        aim.y = (e.clientY - r.top) / r.height;
      };
      const onClick = () => {
        const now = performance.now();
        if (now - lastClickAt < FIRE_CD) return;
        lastClickAt = now;
        fireQueued = true;
      };
      addEventListener('keydown', onKey);
      addEventListener('keyup', offKey);
      canvas.addEventListener('mousemove', onMove);
      canvas.addEventListener('click', onClick);

      const hpBarHTML = pl => `
        <div class="duel-hp-bar">
          <div class="duel-hp-fill" data-hp-fill style="--c:${pl.color};width:100%"></div>
          <div class="duel-hp-num" data-hp-num>${MAX_HP} / ${MAX_HP}</div>
        </div>`;

      hud.innerHTML = `
        <div class="duel-p">
          <span class="duel-dot" style="color:${Lp.color};background:${Lp.color}"></span>
          <span class="duel-name">${Lp.name}</span>
          ${hpBarHTML(Lp)}
        </div>
        <div class="duel-timer" id="duel-timer">3:30</div>
        <div class="duel-p">
          ${hpBarHTML(Rp)}
          <span class="duel-name">${Rp.name}</span>
          <span class="duel-dot" style="color:${Rp.color};background:${Rp.color}"></span>
        </div>`;

      timerEl = g('duel-timer');

      const hpFills = hud.querySelectorAll('[data-hp-fill]');
      const hpNums = hud.querySelectorAll('[data-hp-num]');
      const updHud = (hp1, hp2) => {
        hp1 = Math.max(0, hp1); hp2 = Math.max(0, hp2);
        if (hpFills[0]) hpFills[0].style.width = (hp1 / MAX_HP * 100) + '%';
        if (hpFills[1]) hpFills[1].style.width = (hp2 / MAX_HP * 100) + '%';
        if (hpNums[0]) hpNums[0].textContent = `${hp1} / ${MAX_HP}`;
        if (hpNums[1]) hpNums[1].textContent = `${hp2} / ${MAX_HP}`;
      };
      updHud(MAX_HP, MAX_HP);

      function getMapData(W, H, id) {
        const data = { walls: [], circles: [] };
        if (id === 1) {
          data.bounds = { x: 30, y: 30, w: W - 60, h: H - 60 };
          data.walls = [
            { x1: W/2, y1: H/2 - 60, x2: W/2, y2: H/2 - 10 },
            { x1: W/2, y1: H/2 + 10, x2: W/2, y2: H/2 + 60 }
          ];
          data.circles = [
            { x: W/4, y: H/2, r: 25 },
            { x: 3*W/4, y: H/2, r: 25 }
          ];
        } else {
          data.bounds = { x: 30, y: 30, w: W - 60, h: H - 60 };
          data.walls = [
            { x1: W/2, y1: H/2 - 80, x2: W/2, y2: H/2 + 80 },
            { x1: 30, y1: 30, x2: W * 0.25, y2: 30 },
            { x1: 30, y1: 30, x2: 30, y2: H * 0.25 },
            { x1: W - 30, y1: 30, x2: W * 0.75, y2: 30 },
            { x1: W - 30, y1: 30, x2: W - 30, y2: H * 0.25 },
            { x1: 30, y1: H - 30, x2: W * 0.25, y2: H - 30 },
            { x1: 30, y1: H - 30, x2: 30, y2: H * 0.75 },
            { x1: W - 30, y1: H - 30, x2: W * 0.75, y2: H - 30 },
            { x1: W - 30, y1: H - 30, x2: W - 30, y2: H * 0.75 }
          ];
          data.circles = [
            { x: W/3, y: H/2, r: 25 },
            { x: 2*W/3, y: H/2, r: 25 }
          ];
        }
        return data;
      }

      let mapData = null;

      function distToSegment(p, v, w) {
        const l2 = (v.x - w.x)**2 + (v.y - w.y)**2;
        if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
      }

      function checkCollision(x, y, r) {
        if (!mapData) return false;
        const b = mapData.bounds;
        if (x - r < b.x || x + r > b.x + b.w || y - r < b.y || y + r > b.y + b.h) return true;
        for (let w of mapData.walls) {
          if (distToSegment({x, y}, {x: w.x1, y: w.y1}, {x: w.x2, y: w.y2}) < r + 4) return true;
        }
        for (let c of mapData.circles) {
          if (Math.hypot(x - c.x, y - c.y) < r + c.r) return true;
        }
        return false;
      }

      function checkBulletWall(x, y) {
        if (!mapData) return false;
        const b = mapData.bounds;
        if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) return true;
        for (let w of mapData.walls) {
          if (distToSegment({x, y}, {x: w.x1, y: w.y1}, {x: w.x2, y: w.y2}) < 5) return true;
        }
        for (let c of mapData.circles) {
          if (Math.hypot(x - c.x, y - c.y) < c.r) return true;
        }
        return false;
      }

      function isLoS(x1, y1, x2, y2) {
        const dist = Math.hypot(x2 - x1, y2 - y1);
        const steps = Math.ceil(dist / 10);
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          if (checkBulletWall(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
        }
        return true;
      }

      function drawMap(W, H) {
        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(212,162,74,.05)';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

        ctx.strokeStyle = 'rgba(212,162,74,.55)';
        ctx.fillStyle = '#15151f';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';

        if (!mapData) return;
        const b = mapData.bounds;
        ctx.strokeRect(b.x, b.y, b.w, b.h);

        mapData.walls.forEach(w => {
          ctx.beginPath(); ctx.moveTo(w.x1, w.y1); ctx.lineTo(w.x2, w.y2); ctx.stroke();
        });
        mapData.circles.forEach(c => {
          ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        });
      }

      const drawChar = (p, pl, ang, r) => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.fillStyle = '#222';
        ctx.fillRect(0, -5, r + 20, 10);
        ctx.strokeStyle = 'rgba(212,162,74,.7)';
        ctx.strokeRect(0, -5, r + 20, 10);
        ctx.restore();
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = pl.color;
        ctx.shadowColor = pl.color; ctx.shadowBlur = 25;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = `${r * 1.15}px "Segoe UI Symbol","Noto Sans Symbols 2",sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(pl.e, p.x, p.y);
      };

      const drawReady = (W, H, t0) => {
        if (performance.now() - t0 > READY_MS) return;
        const left = READY_MS - (performance.now() - t0);
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#d4a24a';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '700 28px "TitleFont","Anton",sans-serif';
        ctx.fillText('ПРИГОТОВЬТЕСЬ', W / 2, H / 2 - 50);
        ctx.font = '700 84px "TitleFont","Anton",sans-serif';
        ctx.fillText(String(Math.max(1, Math.ceil(left / 800))), W / 2, H / 2 + 20);
      };

      const drawWin = (winner, W, H) => {
        ctx.fillStyle = 'rgba(0,0,0,.5)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#d4a24a';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '700 46px "TitleFont","Anton",sans-serif';
        if (winner) ctx.fillText('ПОБЕДА: ' + winner.name.toUpperCase(), W / 2, H / 2);
        else ctx.fillText('ВРЕМЯ ВЫШЛО', W / 2, H / 2);
      };

      const spawnSparks = (arr, x, y, color) => {
        for (let i = 0; i < 8; i++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 1.5 + Math.random() * 3;
          arr.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 18 + Math.random() * 12, color: color || '#ffd166' });
        }
      };
      const tickSparks = (arr, dt) => {
        for (let i = arr.length - 1; i >= 0; i--) {
          const s = arr[i]; s.x += s.vx; s.y += s.vy; s.vx *= 0.92; s.vy *= 0.92; s.life -= dt;
          if (s.life <= 0) arr.splice(i, 1);
        }
      };
      const drawSparks = (arr) => {
        arr.forEach(s => {
          ctx.save();
          ctx.globalAlpha = Math.max(0, s.life / 24);
          ctx.fillStyle = s.color; ctx.shadowColor = s.color; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.arc(s.x, s.y, 2, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        });
      };

      const hitMark = (x, y) => {
        const flash = document.createElement('div');
        flash.className = 'duel-hit-flash';
        canvas.parentNode.appendChild(flash);
        requestAnimationFrame(() => flash.classList.add('on'));
        setTimeout(() => { flash.classList.remove('on'); setTimeout(() => flash.remove(), 200); }, 120);
        const cross = document.createElement('div');
        cross.className = 'duel-hit-cross';
        const rect = canvas.getBoundingClientRect();
        const pRect = canvas.parentNode.getBoundingClientRect();
        cross.style.left = (rect.left - pRect.left + x / devicePixelRatio) + 'px';
        cross.style.top = (rect.top - pRect.top + y / devicePixelRatio) + 'px';
        canvas.parentNode.appendChild(cross);
        requestAnimationFrame(() => cross.classList.add('on'));
        setTimeout(() => { cross.classList.remove('on'); setTimeout(() => cross.remove(), 400); }, 350);
      };

      requestAnimationFrame(() => {
        const r = canvas.getBoundingClientRect();
        canvas.width = r.width * devicePixelRatio;
        canvas.height = r.height * devicePixelRatio;
        ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        W = canvas.width / devicePixelRatio;
        H = canvas.height / devicePixelRatio;
        mapData = getMapData(W, H, mapId);

        if (isHost) hostLoop(); else clientLoop();
      });

      function cleanup() {
        removeEventListener('keydown', onKey);
        removeEventListener('keyup', offKey);
        canvas.removeEventListener('mousemove', onMove);
        canvas.removeEventListener('click', onClick);
      }

      function hostLoop() {
        const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
        const startP1 = { x: W * 0.15, y: H / 2 };
        const startP2 = { x: W * 0.85, y: H / 2 };
        const p1 = { x: startP1.x, y: startP1.y, r: 22, hp: MAX_HP, cd: 0, fireCd: 0 };
        const p2 = { x: startP2.x, y: startP2.y, r: 22, hp: MAX_HP, cd: 0, fireCd: 0 };
        const bullets = [], sparks = [];
        let over = false, overTime = 0;
        const t0 = performance.now();
        const ready = () => performance.now() - t0 > READY_MS;
        let lastTick = performance.now();

        let timeLeft = DUEL_TIME;
        const timerInt = setInterval(() => {
          if (over) return;
          timeLeft--;
          const m = Math.floor(timeLeft / 60);
          const s = timeLeft % 60;
          if (timerEl) timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
          if (timeLeft <= 0) {
            over = true;
            clearInterval(timerInt);
          }
        }, 1000);

        const remote = { p1: null, p2: null };
        const offIn = io && io.on && io.on('duel:in', d => { remote[d.side] = d.in; });

        // УЛУЧШЕННЫЙ ИИ
        const aiStep = (me, foe, now, side) => {
          const dx = foe.x - me.x, dy = foe.y - me.y, d = Math.hypot(dx, dy) || 1;
          const los = isLoS(me.x, me.y, foe.x, foe.y);
          let vx = 0, vy = 0;

          if (los) {
            if (d > 300) { vx = dx / d; vy = dy / d; }
            else if (d < 180) { vx = -dx / d; vy = -dy / d; }
            else {
              const perp = Math.atan2(dy, dx) + Math.PI / 2;
              const dir = Math.sin(now / 800 + (side === 'p1' ? 0 : Math.PI)) > 0 ? 1 : -1;
              vx = Math.cos(perp) * dir;
              vy = Math.sin(perp) * dir;
            }
            if (now >= me.cd && d < 650) {
              me.cd = now + 700 + Math.random() * 500;
              const ang = Math.atan2(foe.y - me.y, foe.x - me.x) + (Math.random() - 0.5) * 0.18;
              if (bullets.length < MAX_BULLETS) {
                bullets.push({ x: me.x, y: me.y, vx: Math.cos(ang) * BULLET_SPEED, vy: Math.sin(ang) * BULLET_SPEED, owner: side, life: 110 });
              }
            }
          } else {
            vx = dx / d;
            vy = dy / d;
          }

          const sp = 1.8;
          let nx = me.x + vx * sp;
          let ny = me.y + vy * sp;

          if (!checkCollision(nx, ny, me.r)) {
            me.x = nx; me.y = ny;
          } else {
            if (!checkCollision(nx, me.y, me.r)) me.x = nx;
            else if (!checkCollision(me.x, ny, me.r)) me.y = ny;
            else {
              me.x += (Math.random() - 0.5) * 3;
              me.y += (Math.random() - 0.5) * 3;
            }
          }
        };

        // ИСПРАВЛЕНО: теперь принимает now и применяет FIRE_CD.
        // Ограничивает и локального игрока, и remote. Убирает спам.
        const applyInput = (p, inp, side, now) => {
          if (!inp || !inp.keys) return;
          const k = inp.keys;
          let nx = p.x, ny = p.y;
          if (k['w'] || k['ц']) ny -= PLAYER_SPEED;
          if (k['s'] || k['ы']) ny += PLAYER_SPEED;
          if (k['a'] || k['ф']) nx -= PLAYER_SPEED;
          if (k['d'] || k['в']) nx += PLAYER_SPEED;

          nx = clamp(nx, p.r, W - p.r);
          ny = clamp(ny, p.r, H - p.r);

          if (!checkCollision(nx, ny, p.r)) { p.x = nx; p.y = ny; }
          else {
            if (!checkCollision(nx, p.y, p.r)) p.x = nx;
            else if (!checkCollision(p.x, ny, p.r)) p.y = ny;
          }

          if (inp.fire && inp.aim && now >= (p.fireCd || 0) && bullets.length < MAX_BULLETS) {
            p.fireCd = now + FIRE_CD;
            const tx = inp.aim.x * W, ty = inp.aim.y * H;
            const ang = Math.atan2(ty - p.y, tx - p.x);
            bullets.push({ x: p.x, y: p.y, vx: Math.cos(ang) * BULLET_SPEED, vy: Math.sin(ang) * BULLET_SPEED, owner: side, life: 90 });
            try { Sound.shot(); } catch (e) {}
            io && isMP && io.bc({ k: 'duel:shot' });
          }
        };

        let lastSend = 0, raf;
        const loop = () => {
          const now = performance.now();
          const dt = Math.min(64, now - lastTick);
          lastTick = now;

          if (!over && ready()) {
            // ИСПРАВЛЕНО: после применения remote-input сбрасываем fire,
            // чтобы пуля не создавалась каждый кадр до прихода следующего input.
            if (mySide === 'p1') { applyInput(p1, { keys, aim, fire: fireQueued }, 'p1', now); fireQueued = false; }
            else if (remote.p1) { applyInput(p1, remote.p1, 'p1', now); remote.p1.fire = false; }
            else if (a.bot) aiStep(p1, p2, now, 'p1');

            if (mySide === 'p2') { applyInput(p2, { keys, aim, fire: fireQueued }, 'p2', now); fireQueued = false; }
            else if (remote.p2) { applyInput(p2, remote.p2, 'p2', now); remote.p2.fire = false; }
            else if (b.bot) aiStep(p2, p1, now, 'p2');
          }

          for (let i = bullets.length - 1; i >= 0; i--) {
            const bl = bullets[i];
            bl.x += bl.vx; bl.y += bl.vy; bl.life--;
            if (checkBulletWall(bl.x, bl.y)) {
              spawnSparks(sparks, bl.x, bl.y, bl.owner === 'p1' ? '#ff9d3c' : '#ff5d73');
              bullets.splice(i, 1); continue;
            }
            if (bl.life <= 0) { bullets.splice(i, 1); continue; }
            const tgt = bl.owner === 'p1' ? p2 : p1;
            if (Math.hypot(bl.x - tgt.x, bl.y - tgt.y) < tgt.r) {
              if (!over) {
                tgt.hp--;
                hitMark(tgt.x * devicePixelRatio, tgt.y * devicePixelRatio);
                try { Sound.eventHit(); } catch (e) {}
                if (isMP) io.bc({ k: 'duel:hit', side: bl.owner === 'p1' ? 'p2' : 'p1', hp: tgt.hp });
                if (tgt.hp <= 0) over = true;
              }
              bullets.splice(i, 1);
            }
          }

          tickSparks(sparks, dt);
          if (sparks.length > 200) sparks.splice(0, sparks.length - 200);

          if (isMP && now - lastSend > 33) {
            lastSend = now;
            io.bc({
              k: 'duel:state', mapId, timeLeft,
              p1: { x: p1.x / W, y: p1.y / H, hp: p1.hp },
              p2: { x: p2.x / W, y: p2.y / H, hp: p2.hp },
              bullets: bullets.map(b => ({ x: b.x / W, y: b.y / H, owner: b.owner })),
              sparks: sparks.map(s => ({ x: s.x / W, y: s.y / H, color: s.color, life: s.life })),
              over
            });
          }

          updHud(p1.hp, p2.hp);
          drawMap(W, H);

          bullets.forEach(bl => {
            ctx.beginPath(); ctx.arc(bl.x, bl.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = bl.owner === 'p1' ? '#ff9d3c' : '#ff5d73';
            ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 18; ctx.fill(); ctx.shadowBlur = 0;
          });
          drawSparks(sparks);

          [ { p: p1, pl: Lp, side: 'p1' }, { p: p2, pl: Rp, side: 'p2' } ].forEach(({ p, pl, side }) => {
            if (p.hp <= 0 && over) return;
            const aimNorm = (mySide === side) ? aim : null;
            const ang = (mySide === side && aimNorm) ? Math.atan2(aimNorm.y * H - p.y, aimNorm.x * W - p.x)
              : Math.atan2((side === 'p1' ? p2 : p1).y - p.y, (side === 'p1' ? p2 : p1).x - p.x);
            drawChar(p, pl, ang, p.r);
          });

          drawReady(W, H, t0);

          if (over) {
            const win = p1.hp > 0 ? Lp : (p2.hp > 0 ? Rp : null);
            drawWin(win, W, H);
            overTime += 16;
            if (overTime > 1800) {
              clearInterval(timerInt);
              const winner = p1.hp > 0 ? Lp : (p2.hp > 0 ? Rp : null);
              const loser = p1.hp > 0 ? Rp : (p2.hp > 0 ? Lp : null);
              const steal = winner ? Math.round(Math.max(0, loser.money) * 0.15) : 0;
              if (offIn) offIn();
              cleanup();
              if (isMP) io.bc({ k: 'duel:end' });
              cancelAnimationFrame(raf);
              resolve({ winner, loser, steal });
              return;
            }
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      }

      function clientLoop() {
        const t0 = performance.now();
        const sparks = [];
        let state = { mapId, timeLeft: DUEL_TIME, p1: { x: 0.1, y: 0.5, hp: MAX_HP }, p2: { x: 0.9, y: 0.5, hp: MAX_HP }, bullets: [], over: false };
        let ended = false;

        const offState = io.on('duel:state', d => {
          state = {
            mapId: d.mapId, timeLeft: d.timeLeft,
            p1: { x: d.p1.x * W, y: d.p1.y * H, hp: d.p1.hp },
            p2: { x: d.p2.x * W, y: d.p2.y * H, hp: d.p2.hp },
            bullets: (d.bullets || []).map(b => ({ x: b.x * W, y: b.y * H, owner: b.owner })),
            over: !!d.over
          };
          if (d.sparks) {
            d.sparks.forEach(s => sparks.push({ x: s.x * W, y: s.y * H, vx: 0, vy: 0, life: s.life, color: s.color }));
            if (sparks.length > 200) sparks.splice(0, sparks.length - 200);
          }
          if (timerEl) {
            const m = Math.floor(state.timeLeft / 60);
            const s = state.timeLeft % 60;
            timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
          }
        });
        const offEnd = io.on('duel:end', () => { ended = true; });
        const offHit = io.on('duel:hit', d => {
          const tgt = d.side === 'p1' ? state.p1 : state.p2;
          hitMark(tgt.x * devicePixelRatio, tgt.y * devicePixelRatio);
          try { Sound.eventHit(); } catch (e) {}
        });
        const offShot = io.on('duel:shot', () => { try { Sound.shot(); } catch (e) {} });

        let lastSend = 0, raf, lastTick = performance.now();
        const loop = () => {
          const now = performance.now();
          const dt = Math.min(64, now - lastTick);
          lastTick = now;

          if (mySide && now - lastSend > 33) {
            lastSend = now;
            io.toHost({ k: 'duel:in', side: mySide, in: { keys: { ...keys }, aim: { ...aim }, fire: fireQueued } });
            fireQueued = false;
          }

          tickSparks(sparks, dt);
          drawMap(W, H);

          state.bullets.forEach(bl => {
            ctx.beginPath(); ctx.arc(bl.x, bl.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = bl.owner === 'p1' ? '#ff9d3c' : '#ff5d73';
            ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 18; ctx.fill(); ctx.shadowBlur = 0;
          });
          drawSparks(sparks);

          [ { p: state.p1, pl: Lp, side: 'p1' }, { p: state.p2, pl: Rp, side: 'p2' } ].forEach(({ p, pl, side }) => {
            if (!p || (p.hp <= 0 && state.over)) return;
            const aimNorm = (mySide === side) ? aim : null;
            const ang = (mySide === side && aimNorm) ? Math.atan2(aimNorm.y * H - p.y, aimNorm.x * W - p.x)
              : Math.atan2((side === 'p1' ? state.p2 : state.p1).y - p.y, (side === 'p1' ? state.p2 : state.p1).x - p.x);
            drawChar(p, pl, ang, 22);
          });

          drawReady(W, H, t0);
          if (state.over) {
            const win = state.p1.hp > 0 ? Lp : (state.p2.hp > 0 ? Rp : null);
            drawWin(win, W, H);
          }

          updHud(state.p1.hp, state.p2.hp);

          if (ended) {
            cleanup();
            offState && offState(); offEnd && offEnd(); offHit && offHit(); offShot && offShot();
            cancelAnimationFrame(raf);
            resolve({ winner: null, loser: null, steal: 0 });
            return;
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      }
    });
  }

  function stealShare(a, b, io) {
    return new Promise(async resolve => {
      const stage = g('ev-steal').querySelector('.steal-stage');
      const isMP = !!(io && io.mp);
      const isHost = !isMP || io.isHost;
      const iAmA = isMP ? (io.kind(a.id) === 'me') : !a.bot;
      const iAmB = isMP ? (io.kind(b.id) === 'me') : !b.bot;
      const iAmPlaying = iAmA || iAmB;
      const hasHuman = !a.bot || !b.bot;
      const DECIDE = hasHuman ? 30 : 5;
      const botPick = () => Math.random() < 0.5 ? 'share' : 'steal';

      stage.innerHTML = `
        <div class="steal-kicker">SYSTEM OF EVENTS</div>
        <div class="steal-title">Как вы хотите распорядиться с 500 €?</div>
        <div class="steal-pair"><span style="color:${a.color}">${a.name}</span><i>&amp;</i><span style="color:${b.color}">${b.name}</span></div>
        ${iAmPlaying ? `<div class="steal-actions" id="steal-actions">
          <button class="btn main" id="steal-share">Разделить</button>
          <button class="btn" id="steal-steal">Украсть</button></div>` : ''}
        <div class="steal-wait" id="steal-wait">
          <div id="steal-wait-text">${iAmPlaying ? 'Ваш выбор' : 'Игроки решают...'}</div>
          <div class="steal-timer" id="steal-timer">${DECIDE}</div>
        </div>
        <div class="steal-result" id="steal-result" style="display:none"></div>`;

      let t = DECIDE;
      const tick = setInterval(() => { t--; const el = g('steal-timer'); if (el) el.textContent = Math.max(0, t); }, 1000);

      let myChoice = null;
      if (iAmPlaying) {
        myChoice = await new Promise(res => {
          const to = setTimeout(() => res('share'), DECIDE * 1000);
          g('steal-share').onclick = () => { clearTimeout(to); res('share'); };
          g('steal-steal').onclick = () => { clearTimeout(to); res('steal'); };
        });
        clearInterval(tick);
        g('steal-actions').style.display = 'none';
        g('steal-timer').style.display = 'none';
        g('steal-wait-text').textContent = 'Выбор сделан. Ожидание соперника...';
      } else { await sleep(DECIDE * 1000); clearInterval(tick); }

      let cA = null, cB = null, text = '';
      if (isHost) {
        const pending = {};
        const offPick = io && io.on && io.on('steal:pick', d => { pending[d.side] = d.choice; });
        const waitForPick = async side => {
          const deadline = performance.now() + 12000;
          while (!pending[side] && performance.now() < deadline) await sleep(80);
          return pending[side] || 'share';
        };
        if (a.bot) cA = botPick(); else if (iAmA) cA = myChoice; else if (isMP && io.kind(a.id) === 'remote') cA = await waitForPick('a');
        if (b.bot) cB = botPick(); else if (iAmB) cB = myChoice; else if (isMP && io.kind(b.id) === 'remote') cB = await waitForPick('b');
        if (offPick) offPick();
        text = stealText(a, b, cA, cB);
        if (isMP) io.bc({ k: 'steal:show', cA, cB, text });
      } else {
        if (iAmPlaying) io.toHost({ k: 'steal:pick', side: iAmA ? 'a' : 'b', choice: myChoice });
        const r = await new Promise(res => { const off = io.on('steal:show', d => { off(); res(d); }); });
        cA = r.cA; cB = r.cB; text = r.text;
      }

      g('steal-wait').style.display = 'none';
      const res = g('steal-result');
      res.style.display = '';
      res.innerHTML = `
        <div class="sr-choices">
          <div class="sr-card ${cA === 'steal' ? 'stole' : 'shared'}">
            <div class="sr-name" style="color:${a.color}">${a.name}</div>
            <div class="sr-choice">${cA === 'steal' ? 'УКРАЛ' : 'РАЗДЕЛИЛ'}</div>
          </div>
          <div class="sr-card ${cB === 'steal' ? 'stole' : 'shared'}">
            <div class="sr-name" style="color:${b.color}">${b.name}</div>
            <div class="sr-choice">${cB === 'steal' ? 'УКРАЛ' : 'РАЗДЕЛИЛ'}</div>
          </div>
        </div>
        <div style="margin-top:1rem;font-style:italic;color:rgba(232,226,212,.85)">${text}</div>`;

      await sleep(4500);
      resolve({ cA, cB, text });
    });
  }

  function traitor(tr, others, io) {
    return new Promise(async resolve => {
      const stage = g('ev-traitor').querySelector('.traitor-stage');
      const isMP = !!(io && io.mp);
      const isHost = !isMP || io.isHost;
      const iAmTraitor = isMP ? (io.kind(tr.id) === 'me') : !tr.bot;

      stage.innerHTML = `
        <div class="traitor-kicker">SYSTEM OF EVENTS</div>
        <div class="traitor-title" id="traitor-title">${tr.name} — предатель выбирает</div>
        <div class="traitor-list" id="traitor-list"></div>
        <div class="traitor-result" id="traitor-result" style="display:none"></div>`;

      g('traitor-list').innerHTML = others.map(o => `
        <div class="traitor-card" data-id="${o.id}">
          <div class="tc-name" style="color:${o.color}">${o.name}</div>
          <div class="tc-info">Баланс: <b>${o.money} €</b></div>
        </div>`).join('');

      let victimId = null;
      if (isHost) {
        if (tr.bot) { await sleep(2500); victimId = others.slice().sort((x, y) => y.money - x.money)[0].id; }
        else if (iAmTraitor) {
          victimId = await new Promise(res => {
            g('traitor-list').querySelectorAll('.traitor-card').forEach(card => { card.addEventListener('click', () => res(+card.dataset.id), { once: true }); });
          });
        } else { victimId = await new Promise(res => { const off = io.on('traitor:pick', d => { off(); res(d.victimId); }); }); }
        if (isMP) io.bc({ k: 'traitor:show', victimId });
      } else {
        if (iAmTraitor) {
          victimId = await new Promise(res => {
            g('traitor-list').querySelectorAll('.traitor-card').forEach(card => { card.addEventListener('click', () => res(+card.dataset.id), { once: true }); });
          });
          io.toHost({ k: 'traitor:pick', victimId });
        }
        const r = await new Promise(res => { const off = io.on('traitor:show', d => { off(); res(d); }); });
        victimId = r.victimId;
      }

      const victim = others.find(o => o.id === victimId) || others[0];
      const taken = Math.round(Math.max(0, victim.money) * 0.15);

      g('traitor-title').textContent = 'Предатель сделал свой выбор';
      g('traitor-list').innerHTML = '';
      const res = g('traitor-result');
      res.style.display = '';
      res.innerHTML = `${tr.name} снял ${taken} € с ${victim.name}`;

      await sleep(4500);
      resolve({ victim, taken, traitor: tr });
    });
  }

  return { duel, stealShare, traitor, stealText };
})();