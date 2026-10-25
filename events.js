/* events.js — ивенты: Дуэль, Украсть/разделить, Предатель, Аэрохоккей. */
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
      const MAX_HP = 2;
      const BULLET_SPEED = 7;
      const PLAYER_SPEED = 3.6;
      const DUEL_TIME = 120;
      const FIRE_CD = 260;
      const MAX_BULLETS = 12;
      const NET_INTERVAL = 66;
      const INPUT_INTERVAL = 50;

      let W = 0, H = 0;
      let mySide = null;
      if (isMP) {
        if (io.kind(a.id) === 'me') mySide = 'p1';
        else if (io.kind(b.id) === 'me') mySide = 'p2';
      } else {
        if (!a.bot) mySide = 'p1';
        else if (!b.bot) mySide = 'p2';
      }

      const keys = {};
      const aim = { x: 0.5, y: 0.5 };
      let fireQueued = false;
      let lastClickAt = 0;
      const onKey = e => { keys[e.key.toLowerCase()] = true; };
      const offKey = e => { keys[e.key.toLowerCase()] = false; };
      const onMove = e => {
        const r = canvas.getBoundingClientRect();
        aim.x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        aim.y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
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
        <div class="duel-timer" id="duel-timer">2:00</div>
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

      function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

      function drawArena(W, H) {
        ctx.fillStyle = '#0d0d14';
        ctx.fillRect(0, 0, W, H);
        const b = { x: 30, y: 30, w: W - 60, h: H - 60 };
        ctx.fillStyle = '#15151f';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = 'rgba(212,162,74,.55)';
        ctx.lineWidth = 3;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = 'rgba(212,162,74,.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(b.x + b.w / 2, b.y);
        ctx.lineTo(b.x + b.w / 2, b.y + b.h);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 60, 0, Math.PI * 2);
        ctx.stroke();
        return b;
      }

      function drawChar(p, pl) {
        const angle = Number.isFinite(p.angle) ? p.angle : 0;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
        const metal = ctx.createLinearGradient(0, -7, 0, 7);
        metal.addColorStop(0, '#f4e7c7'); metal.addColorStop(.35, '#aeb6c0'); metal.addColorStop(.7, '#59636e'); metal.addColorStop(1, '#242b33');
        ctx.fillStyle = '#303943'; ctx.strokeStyle = '#d9c18a'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(7, -9, 17, 18, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = metal; ctx.strokeStyle = '#202833'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.roundRect(16, -4.8, 24, 9.6, 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#202833'; ctx.fillRect(35, -5.7, 7, 11.4);
        ctx.fillStyle = '#d9c18a'; ctx.fillRect(39, -4.4, 2, 8.8);
        ctx.restore();
        ctx.save();
        ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
        const body = ctx.createRadialGradient(p.x - 7, p.y - 8, 2, p.x, p.y, 22);
        body.addColorStop(0, '#fff'); body.addColorStop(.22, pl.color); body.addColorStop(1, '#171923');
        ctx.fillStyle = body; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '20px "Segoe UI Symbol","Noto Sans Symbols 2",sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 3;
        ctx.fillText(pl.e, p.x, p.y); ctx.restore();
      }

      function drawBullet(b) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = b.owner === 'p1' ? '#ff9d3c' : '#ff5d73';
        ctx.fill();
      }

      function drawReady(W, H, t0) {
        if (performance.now() - t0 > READY_MS) return;
        const left = READY_MS - (performance.now() - t0);
        ctx.fillStyle = 'rgba(0,0,0,.5)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#d4a24a';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '700 28px "TitleFont","Anton",sans-serif';
        ctx.fillText('ПРИГОТОВЬТЕСЬ', W / 2, H / 2 - 50);
        ctx.font = '700 84px "TitleFont","Anton",sans-serif';
        ctx.fillText(String(Math.max(1, Math.ceil(left / 800))), W / 2, H / 2 + 20);
      }

      function drawWin(winner, W, H) {
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#d4a24a';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '700 46px "TitleFont","Anton",sans-serif';
        if (winner) ctx.fillText('ПОБЕДА: ' + winner.name.toUpperCase(), W / 2, H / 2);
        else ctx.fillText('ВРЕМЯ ВЫШЛО', W / 2, H / 2);
      }

      function cleanup() {
        removeEventListener('keydown', onKey);
        removeEventListener('keyup', offKey);
        canvas.removeEventListener('mousemove', onMove);
        canvas.removeEventListener('click', onClick);
      }

      requestAnimationFrame(() => {
        const r = canvas.getBoundingClientRect();
        canvas.width = r.width * devicePixelRatio;
        canvas.height = r.height * devicePixelRatio;
        ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        W = canvas.width / devicePixelRatio;
        H = canvas.height / devicePixelRatio;
        if (isHost) hostLoop(); else clientLoop();
      });

      function hostLoop() {
        const B = { x: 30, y: 30, w: W - 60, h: H - 60 };
        const spawnP1 = { x: B.x + 60, y: B.y + B.h / 2 };
        const spawnP2 = { x: B.x + B.w - 60, y: B.y + B.h / 2 };
        const p1 = { x: spawnP1.x, y: spawnP1.y, r: 20, hp: MAX_HP, fireCd: 0, angle: 0 };
        const p2 = { x: spawnP2.x, y: spawnP2.y, r: 20, hp: MAX_HP, fireCd: 0, angle: Math.PI };
        const bullets = [];
        let over = false, overTime = 0, winner = null;
        const t0 = performance.now();
        const ready = () => performance.now() - t0 > READY_MS;
        let lastTick = performance.now();

        let timeLeft = DUEL_TIME;
        const timerInt = setInterval(() => {
          if (over) return;
          timeLeft--;
          if (timerEl) {
            const m = Math.floor(Math.max(0, timeLeft) / 60);
            const s = Math.max(0, timeLeft) % 60;
            timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
          }
          if (timeLeft <= 0) { over = true; winner = p1.hp > p2.hp ? Lp : p2.hp > p1.hp ? Rp : null; clearInterval(timerInt); }
        }, 1000);

        const remote = { p1: null, p2: null };
        const offIn = io && io.on && io.on('duel:in', d => { remote[d.side] = d.in; });

        const aiStep = (me, foe, now, side) => {
          const dx = foe.x - me.x, dy = foe.y - me.y, d = Math.hypot(dx, dy) || 1;
          me.angle = Math.atan2(dy, dx);
          let vx = 0, vy = 0;
          if (d > 260) { vx = dx / d; vy = dy / d; }
          else if (d < 160) { vx = -dx / d; vy = -dy / d; }
          else {
            const perp = Math.atan2(dy, dx) + Math.PI / 2;
            vx = Math.cos(perp); vy = Math.sin(perp);
          }
          me.x = clamp(me.x + vx * 1.8, B.x + me.r, B.x + B.w - me.r);
          me.y = clamp(me.y + vy * 1.8, B.y + me.r, B.y + B.h - me.r);
          if (now >= me.fireCd && d < 500 && Math.random() < 0.04) {
            me.fireCd = now + 600 + Math.random() * 400;
            const ang = Math.atan2(foe.y - me.y, foe.x - me.x) + (Math.random() - 0.5) * 0.15;
            if (bullets.length < MAX_BULLETS) bullets.push({ x: me.x, y: me.y, vx: Math.cos(ang) * BULLET_SPEED, vy: Math.sin(ang) * BULLET_SPEED, owner: side, life: 110 });
          }
        };

        const applyInput = (p, inp, side, now) => {
          if (!inp || !inp.keys) return;
          if (inp.aim && Number.isFinite(inp.aim.x) && Number.isFinite(inp.aim.y)) p.angle = Math.atan2(inp.aim.y * H - p.y, inp.aim.x * W - p.x);
          const k = inp.keys;
          let nx = p.x, ny = p.y;
          if (k['w'] || k['ц']) ny -= PLAYER_SPEED;
          if (k['s'] || k['ы']) ny += PLAYER_SPEED;
          if (k['a'] || k['ф']) nx -= PLAYER_SPEED;
          if (k['d'] || k['в']) nx += PLAYER_SPEED;
          nx = clamp(nx, B.x + p.r, B.x + B.w - p.r);
          ny = clamp(ny, B.y + p.r, B.y + B.h - p.r);
          p.x = nx; p.y = ny;
          if (inp.fire && now >= (p.fireCd || 0) && bullets.length < MAX_BULLETS) {
            p.fireCd = now + FIRE_CD;
            const aimX = inp.aim && Number.isFinite(inp.aim.x) ? inp.aim.x : .5;
            const aimY = inp.aim && Number.isFinite(inp.aim.y) ? inp.aim.y : .5;
            const tx = aimX * W, ty = aimY * H;
            const ang = Math.atan2(ty - p.y, tx - p.x); p.angle = ang;
            const muzzle = p.r + 9;
            bullets.push({ x: p.x + Math.cos(ang) * muzzle, y: p.y + Math.sin(ang) * muzzle, vx: Math.cos(ang) * BULLET_SPEED, vy: Math.sin(ang) * BULLET_SPEED, owner: side, life: 90, r: 5 });
          }
        };

        let lastSend = 0, raf;
        const loop = () => {
          const now = performance.now();
          lastTick = now;

          const p1Prev = { x: p1.x, y: p1.y };
          const p2Prev = { x: p2.x, y: p2.y };
          if (!over && ready()) {
            if (mySide === 'p1') { applyInput(p1, { keys, aim, fire: fireQueued }, 'p1', now); fireQueued = false; }
            else if (remote.p1) { applyInput(p1, remote.p1, 'p1', now); remote.p1.fire = false; }
            else if (a.bot) aiStep(p1, p2, now, 'p1');

            if (mySide === 'p2') { applyInput(p2, { keys, aim, fire: fireQueued }, 'p2', now); fireQueued = false; }
            else if (remote.p2) { applyInput(p2, remote.p2, 'p2', now); remote.p2.fire = false; }
            else if (b.bot) {
              const tmp = { x: p2.x, y: p2.y, r: 20, fireCd: p2.fireCd, hp: p2.hp, angle: p2.angle };
              aiStep(tmp, p1, now, 'p2');
              p2.x = tmp.x; p2.y = tmp.y; p2.fireCd = tmp.fireCd; p2.angle = tmp.angle;
            }
          }

          for (let i = bullets.length - 1; i >= 0; i--) {
            const bl = bullets[i];
            const oldX = bl.x, oldY = bl.y;
            bl.x += bl.vx; bl.y += bl.vy; bl.life--;
            if (bl.x < B.x || bl.x > B.x + B.w || bl.y < B.y || bl.y > B.y + B.h || bl.life <= 0) { bullets.splice(i, 1); continue; }
            const targetSide = bl.owner === 'p1' ? 'p2' : 'p1';
            const tgt = targetSide === 'p2' ? p2 : p1;
            const prevTgt = targetSide === 'p2' ? p2Prev : p1Prev;
            const rx0 = oldX - prevTgt.x, ry0 = oldY - prevTgt.y;
            const rx1 = bl.x - tgt.x, ry1 = bl.y - tgt.y;
            const sx = rx1 - rx0, sy = ry1 - ry0;
            const denom = sx * sx + sy * sy;
            const t = denom > 1e-9 ? clamp(-(rx0 * sx + ry0 * sy) / denom, 0, 1) : 0;
            const nearX = rx0 + sx * t, nearY = ry0 + sy * t;
            const hitRadius = tgt.r + (bl.r || 5);
            if (nearX * nearX + nearY * nearY <= hitRadius * hitRadius) {
              if (!over && tgt.hp > 0) {
                tgt.hp = Math.max(0, tgt.hp - 1);
                if (isMP) io.bc({ k: 'duel:hit', side: targetSide });
                if (tgt.hp <= 0) { over = true; winner = bl.owner === 'p1' ? Lp : Rp; }
              }
              bullets.splice(i, 1);
            }
          }

          if (isMP && now - lastSend > NET_INTERVAL) {
            lastSend = now;
            io.bc({
              k: 'duel:state', timeLeft,
              p1: { x: p1.x / W, y: p1.y / H, hp: p1.hp, angle: p1.angle },
              p2: { x: p2.x / W, y: p2.y / H, hp: p2.hp, angle: p2.angle },
              bullets: bullets.map(b => ({ x: b.x / W, y: b.y / H, o: b.owner })),
              over
            });
          }

          updHud(p1.hp, p2.hp);
          drawArena(W, H);
          bullets.forEach(drawBullet);
          drawChar(p1, Lp);
          drawChar(p2, Rp);
          drawReady(W, H, t0);

          if (over) {
            const win = p1.hp > p2.hp ? Lp : p2.hp > p1.hp ? Rp : null;
            const finalWin = winner || win;
            drawWin(finalWin, W, H);
            overTime += 16;
            if (overTime > 1800) {
              clearInterval(timerInt);
              const loser = finalWin === Lp ? Rp : (finalWin === Rp ? Lp : null);
              const steal = finalWin && loser ? Math.round(Math.max(0, loser.money) * 0.15) : 0;
              if (offIn) offIn();
              cleanup();
              if (isMP) io.bc({ k: 'duel:end', winner: finalWin ? finalWin.id : null });
              cancelAnimationFrame(raf);
              resolve({ winner: finalWin, loser, steal });
              return;
            }
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      }

      function clientLoop() {
        const t0 = performance.now();
        let curr = null, prev = null, currT = 0, prevT = 0;
        let ended = false;

        const offState = io.on('duel:state', d => {
          prev = curr; prevT = currT;
          curr = {
            timeLeft: d.timeLeft,
            p1: { x: d.p1.x * W, y: d.p1.y * H, hp: d.p1.hp, angle: Number.isFinite(d.p1.angle) ? d.p1.angle : 0 },
            p2: { x: d.p2.x * W, y: d.p2.y * H, hp: d.p2.hp, angle: Number.isFinite(d.p2.angle) ? d.p2.angle : Math.PI },
            bullets: (d.bullets || []).map(b => ({ x: b.x * W, y: b.y * H, o: b.o })),
            over: !!d.over
          };
          currT = performance.now();
          if (timerEl) {
            const m = Math.floor(Math.max(0, curr.timeLeft) / 60);
            const s = Math.max(0, curr.timeLeft) % 60;
            timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
          }
        });
        const offEnd = io.on('duel:end', () => { ended = true; });
        const offHit = io.on('duel:hit', () => {});

        let lastSend = 0, raf;
        const loop = () => {
          const now = performance.now();
          if (mySide && now - lastSend > INPUT_INTERVAL) {
            lastSend = now;
            io.toHost({ k: 'duel:in', side: mySide, in: { keys: { ...keys }, aim: { ...aim }, fire: fireQueued } });
            fireQueued = false;
          }

          drawArena(W, H);

          if (curr) {
            const lerpT = prev && currT > prevT ? Math.min(1, (now - currT) / Math.max(1, currT - prevT)) : 1;
            const ip = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
            const drawP1 = prev && currT > prevT ? { ...ip(prev.p1, curr.p1, lerpT), angle: Number.isFinite(curr.p1.angle) ? curr.p1.angle : 0 } : curr.p1;
            const drawP2 = prev && currT > prevT ? { ...ip(prev.p2, curr.p2, lerpT), angle: Number.isFinite(curr.p2.angle) ? curr.p2.angle : Math.PI } : curr.p2;

            curr.bullets.forEach(drawBullet);
            drawChar(drawP1, Lp);
            drawChar(drawP2, Rp);
            updHud(curr.p1.hp, curr.p2.hp);

            if (curr.over) {
              const win = curr.p1.hp > 0 ? Lp : (curr.p2.hp > 0 ? Rp : null);
              drawWin(win, W, H);
            }
          }

          drawReady(W, H, t0);

          if (ended) {
            cleanup();
            offState && offState(); offEnd && offEnd(); offHit && offHit();
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

  /* ===================== УКРАСТЬ / РАЗДЕЛИТЬ ===================== */
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

      const pending = { a: null, b: null };
      let offPick = null;
      if (isHost && isMP) {
        offPick = io.on('steal:pick', d => {
          if (d && (d.side === 'a' || d.side === 'b') && (d.choice === 'steal' || d.choice === 'share')) {
            pending[d.side] = d.choice;
          }
        });
      }

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
      }

      if (!iAmPlaying) { await sleep(DECIDE * 1000); clearInterval(tick); }

      let cA = null, cB = null, text = '';
      if (isHost) {
        if (iAmPlaying) {
          if (iAmA) pending.a = myChoice || 'share';
          if (iAmB) pending.b = myChoice || 'share';
        }
        const waitForPick = async side => {
          const deadline = performance.now() + DECIDE * 1000 + 5000;
          while (!pending[side] && performance.now() < deadline) await sleep(60);
          return pending[side] || 'share';
        };
        if (a.bot) cA = botPick();
        else if (iAmA) cA = myChoice || 'share';
        else if (isMP && io.kind(a.id) === 'remote') cA = await waitForPick('a');
        if (b.bot) cB = botPick();
        else if (iAmB) cB = myChoice || 'share';
        else if (isMP && io.kind(b.id) === 'remote') cB = await waitForPick('b');
        if (offPick) offPick();
        text = stealText(a, b, cA, cB);
        if (isMP) io.bc({ k: 'steal:show', cA, cB, text });
      } else {
        if (iAmPlaying && isMP) {
          io.toHost({ k: 'steal:pick', side: iAmA ? 'a' : 'b', choice: myChoice });
        }
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

  /* ===================== ПРЕДАТЕЛЬ ===================== */
  function traitor(tr, others, io) {
    return new Promise(async resolve => {
      const stage = g('ev-traitor').querySelector('.traitor-stage');
      const isMP = !!(io && io.mp);
      const isHost = !isMP || io.isHost;
      const iAmTraitor = isMP ? (io.kind(tr.id) === 'me') : !tr.bot;

      let remoteVictim = null;
      let offPick = null;
      if (isHost && isMP && !iAmTraitor && !tr.bot) {
        offPick = io.on('traitor:pick', d => { if (d && d.victimId != null) remoteVictim = d.victimId; });
      }

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
        if (tr.bot) {
          await sleep(2500);
          victimId = others.slice().sort((x, y) => y.money - x.money)[0].id;
        } else if (iAmTraitor) {
          victimId = await new Promise(res => {
            g('traitor-list').querySelectorAll('.traitor-card').forEach(card => {
              card.addEventListener('click', () => res(+card.dataset.id), { once: true });
            });
          });
        } else {
          const deadline = performance.now() + 30000;
          while (remoteVictim == null && performance.now() < deadline) await sleep(80);
          victimId = remoteVictim != null ? remoteVictim : others[0].id;
        }
        if (offPick) offPick();
        if (isMP) io.bc({ k: 'traitor:show', victimId });
      } else {
        if (iAmTraitor) {
          victimId = await new Promise(res => {
            g('traitor-list').querySelectorAll('.traitor-card').forEach(card => {
              card.addEventListener('click', () => res(+card.dataset.id), { once: true });
            });
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

  /* ===================== АЭРОХОККЕЙ ===================== */
  function airHockey(a, b, io) {
    return new Promise(resolve => {
      const canvas = g('ah-canvas');
      let ctx = canvas && canvas.getContext('2d');
      const hud = g('ah-hud');
      const hintEl = g('ah-hint');
      const stageWrap = g('ev-airhockey');
      const stage = stageWrap && stageWrap.querySelector('.airhockey-stage');

      if (stage) stage.classList.remove('ah-field-reveal');

      if (!canvas || !ctx || !hud || !stage) {
        console.error('[airHockey] missing DOM', { canvas: !!canvas, ctx: !!ctx, hud: !!hud, stage: !!stage });
        resolve({ winner: null, loser: null, score: '—', tie: true });
        return;
      }

      const isMP = !!(io && io.mp);
      const isHost = !isMP || !!io.isHost;
      const Lp = a, Rp = b;
      const FIELD_W = 1400, FIELD_H = 760;
      const WALL = 28, GOAL_H = 224;
      const PUCK_R = 20, PADDLE_R = 52;
      const MATCH_TIME = 300, WIN_SCORE = 3;
      const SEND_MS = 50;
      const SNAPSHOT_MS = 50;
      const MAX_PUCK_SPEED = 1050;
      const PUCK_DRAG = 0.9985;
      const RESTITUTION = 0.91;
      const GOAL_Y1 = (FIELD_H - GOAL_H) / 2;
      const GOAL_Y2 = GOAL_Y1 + GOAL_H;
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      const hypot = (x, y) => Math.hypot(x, y);
      const now = () => performance.now();

      let mySide = null;
      if (isMP) {
        if (io.kind(a.id) === 'me') mySide = 'p1';
        else if (io.kind(b.id) === 'me') mySide = 'p2';
      } else {
        if (!a.bot) mySide = 'p1';
        else if (!b.bot) mySide = 'p2';
      }
      const sideName = side => side === 'p1' ? Lp.name : Rp.name;
      const playerFor = side => side === 'p1' ? Lp : Rp;

      let puck = { x: FIELD_W / 2, y: FIELD_H / 2, vx: 0, vy: 0 };
      const p1Paddle = { x: FIELD_W * 0.22, y: FIELD_H / 2, vx: 0, vy: 0 };
      const p2Paddle = { x: FIELD_W * 0.78, y: FIELD_H / 2, vx: 0, vy: 0 };
      const paddles = { p1: p1Paddle, p2: p2Paddle };
      let p1Score = 0, p2Score = 0;
      let timeLeft = MATCH_TIME;
      let phase = 'opening';
      let winner = null, over = false, lastScorer = null;
      let goalPauseUntil = 0;
      let lastSnapshot = 0;
      let raf = 0, settled = false, endSent = false;
      let openingOverlay = null;
      let goalBanner = null, goalBannerTimer = 0;
      let resizeObserver = null;
      const cleanupFns = [];
      const remoteInputs = { p1: null, p2: null };
      let latestState = null;
      let targetPuck = { ...puck };
      let lastStateAt = 0;
      let viewW = 0, viewH = 0, dpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
      let fieldCache = null, fieldCacheKey = '';
      let localMouse = { x: mySide === 'p1' ? p1Paddle.x : p2Paddle.x, y: FIELD_H / 2 };
      let lastLocalMouse = { ...localMouse, t: now() };
      let inputEnabled = false;
      let resizeAttempts = 0;

      let gradP1 = null, gradP2 = null, gradPuck = null;
      function ensureGradients() {
        if (gradP1 && gradP2 && gradPuck) return;
        gradP1 = ctx.createRadialGradient(-15, -17, 3, 0, 0, PADDLE_R);
        gradP1.addColorStop(0, '#ffffff'); gradP1.addColorStop(.22, Lp.color || '#2678d8'); gradP1.addColorStop(1, '#10263a');
        gradP2 = ctx.createRadialGradient(-15, -17, 3, 0, 0, PADDLE_R);
        gradP2.addColorStop(0, '#ffffff'); gradP2.addColorStop(.22, Rp.color || '#d84d54'); gradP2.addColorStop(1, '#10263a');
        gradPuck = ctx.createRadialGradient(-5, -6, 2, 0, 0, PUCK_R * 1.25);
        gradPuck.addColorStop(0, '#727d86'); gradPuck.addColorStop(.28, '#171c22'); gradPuck.addColorStop(1, '#020406');
      }
      function invalidateGradients() { gradP1 = gradP2 = gradPuck = null; }

      function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
      }

      hud.innerHTML = `
        <div class="ah-p"><span class="ah-dot" style="background:${Lp.color};color:${Lp.color}"></span><span class="ah-name">${escapeHtml(Lp.name)}</span><span class="ah-score" id="ah-score-p1">0</span></div>
        <div class="ah-center-hud"><div class="ah-timer" id="ah-timer">5:00</div><div class="ah-period" id="ah-period">РОЗЫГРЫШ</div></div>
        <div class="ah-p right"><span class="ah-score" id="ah-score-p2">0</span><span class="ah-name">${escapeHtml(Rp.name)}</span><span class="ah-dot" style="background:${Rp.color};color:${Rp.color}"></span></div>`;
      const score1El = g('ah-score-p1'), score2El = g('ah-score-p2');
      const timerEl = g('ah-timer'), periodEl = g('ah-period');

      function updateHud() {
        if (score1El) score1El.textContent = p1Score;
        if (score2El) score2El.textContent = p2Score;
        if (timerEl) {
          const secs = Math.max(0, Math.ceil(timeLeft));
          timerEl.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
        }
        if (periodEl) {
          const labels = { opening:'КТО НАЧИНАЕТ', transition:'ВЫХОД НА ЛЁД', countdown:'ПРИГОТОВЬТЕСЬ', playing:'МАТЧ ИДЁТ', goalPause:'ГОЛ!', ended:'МАТЧ ЗАВЕРШЁН' };
          periodEl.textContent = labels[phase] || 'АЭРОХОККЕЙ';
        }
      }

      function resizeCanvas() {
        const wrap = canvas.parentElement;
        if (!wrap) return;
        const rect = wrap.getBoundingClientRect();
        if ((rect.width < 60 || rect.height < 60) && resizeAttempts < 40) {
          resizeAttempts++;
          setTimeout(resizeCanvas, 50);
          return;
        }
        resizeAttempts = 0;
        const portrait = !!mySide;
        const aspectW = portrait ? FIELD_H : FIELD_W;
        const aspectH = portrait ? FIELD_W : FIELD_H;
        const cw = Math.max(100, rect.width - 8);
        const ch = Math.max(100, rect.height - 8);
        const scale = Math.max(0.05, Math.min(cw / aspectW, ch / aspectH));
        const cssW = Math.floor(aspectW * scale);
        const cssH = Math.floor(aspectH * scale);
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
        const nextWidth = Math.round(cssW * dpr), nextHeight = Math.round(cssH * dpr);
        if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
          canvas.width = nextWidth; canvas.height = nextHeight;
          fieldCache = null; fieldCacheKey = '';
          invalidateGradients();
        }
        viewW = cssW; viewH = cssH;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      cleanupFns.push(() => window.removeEventListener('resize', resizeCanvas));
      if (window.ResizeObserver && canvas.parentElement) {
        resizeObserver = new ResizeObserver(resizeCanvas);
        resizeObserver.observe(canvas.parentElement);
        cleanupFns.push(() => resizeObserver && resizeObserver.disconnect());
      }

      function screenToField(clientX, clientY) {
        const r = canvas.getBoundingClientRect();
        const sx = clamp((clientX - r.left) / Math.max(1, r.width), 0, 1);
        const sy = clamp((clientY - r.top) / Math.max(1, r.height), 0, 1);
        if (mySide === 'p1') return { x: FIELD_W * (1 - sy), y: FIELD_H * sx };
        if (mySide === 'p2') return { x: FIELD_W * sy, y: FIELD_H * (1 - sx) };
        return { x: FIELD_W * sx, y: FIELD_H * sy };
      }
      function placeLocalPaddle(point, stamp = now()) {
        if (!mySide || !inputEnabled) return;
        const p = paddles[mySide];
        const left = mySide === 'p1';
        localMouse.x = clamp(point.x, left ? WALL + PADDLE_R : FIELD_W / 2 + 8, left ? FIELD_W / 2 - PADDLE_R - 8 : FIELD_W - WALL - PADDLE_R);
        localMouse.y = clamp(point.y, WALL + PADDLE_R, FIELD_H - WALL - PADDLE_R);
        const dt = Math.max(0.008, Math.min(0.08, (stamp - lastLocalMouse.t) / 1000));
        p.vx = (localMouse.x - p.x) / dt;
        p.vy = (localMouse.y - p.y) / dt;
        p.x = localMouse.x; p.y = localMouse.y;
        lastLocalMouse = { ...localMouse, t: stamp };
      }
      const onPointerMove = e => {
        if (!mySide || !inputEnabled) return;
        placeLocalPaddle(screenToField(e.clientX, e.clientY));
      };
      const onTouchMove = e => {
        if (!e.touches || !e.touches[0]) return;
        onPointerMove(e.touches[0]);
        e.preventDefault();
      };
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('touchmove', onTouchMove, { passive: false });
      cleanupFns.push(() => {
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('touchmove', onTouchMove);
      });

      function paintField() {
        ctx.save();
        ctx.clearRect(0, 0, viewW, viewH);
        if (mySide === 'p1') {
          ctx.translate(0, viewH); ctx.rotate(-Math.PI / 2);
          ctx.scale(viewH / FIELD_W, viewW / FIELD_H);
        } else if (mySide === 'p2') {
          ctx.translate(viewW, 0); ctx.rotate(Math.PI / 2);
          ctx.scale(viewH / FIELD_W, viewW / FIELD_H);
        } else {
          ctx.scale(viewW / FIELD_W, viewH / FIELD_H);
        }
        const ice = ctx.createLinearGradient(0, 0, FIELD_W, FIELD_H);
        ice.addColorStop(0, '#f5fbff'); ice.addColorStop(.48, '#dceef8'); ice.addColorStop(1, '#eef8fc');
        ctx.fillStyle = ice; ctx.fillRect(0, 0, FIELD_W, FIELD_H);
        ctx.fillStyle = 'rgba(35,106,153,.035)';
        for (let x = WALL; x < FIELD_W - WALL; x += 28) ctx.fillRect(x, WALL, 1, FIELD_H - WALL * 2);
        for (let y = WALL; y < FIELD_H - WALL; y += 28) ctx.fillRect(WALL, y, FIELD_W - WALL * 2, 1);
        ctx.strokeStyle = 'rgba(194,35,57,.88)'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(FIELD_W / 2, WALL); ctx.lineTo(FIELD_W / 2, FIELD_H - WALL); ctx.stroke();
        ctx.beginPath(); ctx.arc(FIELD_W / 2, FIELD_H / 2, 78, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#c22339'; ctx.beginPath(); ctx.arc(FIELD_W / 2, FIELD_H / 2, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(35,94,180,.8)'; ctx.lineWidth = 4;
        [FIELD_W * .28, FIELD_W * .72].forEach(x => { ctx.beginPath(); ctx.moveTo(x, WALL); ctx.lineTo(x, FIELD_H - WALL); ctx.stroke(); });
        ctx.strokeStyle = 'rgba(194,35,57,.65)'; ctx.lineWidth = 3;
        [[FIELD_W*.15,FIELD_H*.25],[FIELD_W*.15,FIELD_H*.75],[FIELD_W*.85,FIELD_H*.25],[FIELD_W*.85,FIELD_H*.75]].forEach(([x,y]) => {
          ctx.beginPath(); ctx.arc(x, y, 42, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = '#c22339'; ctx.fill();
        });
        const gy1 = GOAL_Y1, gy2 = GOAL_Y2;
        ctx.fillStyle = '#152a3d';
        ctx.fillRect(0, 0, FIELD_W, WALL); ctx.fillRect(0, FIELD_H - WALL, FIELD_W, WALL);
        ctx.fillRect(0, WALL, WALL, gy1 - WALL); ctx.fillRect(0, gy2, WALL, FIELD_H - WALL - gy2);
        ctx.fillRect(FIELD_W - WALL, WALL, WALL, gy1 - WALL); ctx.fillRect(FIELD_W - WALL, gy2, WALL, FIELD_H - WALL - gy2);
        [[0, 'left'], [FIELD_W - WALL, 'right']].forEach(([x, side]) => {
          ctx.fillStyle = side === 'left' ? 'rgba(45,135,205,.15)' : 'rgba(212,75,75,.15)';
          ctx.fillRect(x, gy1, WALL, GOAL_H);
          ctx.strokeStyle = 'rgba(28,69,101,.38)'; ctx.lineWidth = 1;
          for (let y = gy1 + 8; y < gy2; y += 12) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + WALL, y); ctx.stroke(); }
          for (let xx = x + 8; xx < x + WALL; xx += 10) { ctx.beginPath(); ctx.moveTo(xx, gy1); ctx.lineTo(xx, gy2); ctx.stroke(); }
        });
        ctx.strokeStyle = '#c22339'; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(0, gy1); ctx.lineTo(WALL, gy1); ctx.moveTo(0, gy2); ctx.lineTo(WALL, gy2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(FIELD_W - WALL, gy1); ctx.lineTo(FIELD_W, gy1); ctx.moveTo(FIELD_W - WALL, gy2); ctx.lineTo(FIELD_W, gy2); ctx.stroke();
        ctx.strokeStyle = '#29485f'; ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(WALL / 2, WALL / 2); ctx.lineTo(FIELD_W - WALL / 2, WALL / 2);
        ctx.moveTo(WALL / 2, FIELD_H - WALL / 2); ctx.lineTo(FIELD_W - WALL / 2, FIELD_H - WALL / 2);
        ctx.moveTo(WALL / 2, WALL / 2); ctx.lineTo(WALL / 2, gy1);
        ctx.moveTo(WALL / 2, gy2); ctx.lineTo(WALL / 2, FIELD_H - WALL / 2);
        ctx.moveTo(FIELD_W - WALL / 2, WALL / 2); ctx.lineTo(FIELD_W - WALL / 2, gy1);
        ctx.moveTo(FIELD_W - WALL / 2, gy2); ctx.lineTo(FIELD_W - WALL / 2, FIELD_H - WALL / 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(16,43,62,.8)'; ctx.font = 'bold 19px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(Lp.name.toUpperCase(), FIELD_W * .22, FIELD_H - WALL - 18);
        ctx.fillText(Rp.name.toUpperCase(), FIELD_W * .78, WALL + 18);
        ctx.restore();
      }

      function drawField() {
        if (!viewW || !viewH) return;
        const key = `${canvas.width}x${canvas.height}:${viewW}x${viewH}:${dpr}:${mySide || 'spectator'}`;
        if (!fieldCache || fieldCacheKey !== key) {
          fieldCache = document.createElement('canvas');
          fieldCache.width = canvas.width; fieldCache.height = canvas.height;
          const mainCtx = ctx;
          ctx = fieldCache.getContext('2d');
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          paintField();
          ctx = mainCtx;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          fieldCacheKey = key;
          invalidateGradients();
        }
        ctx.clearRect(0, 0, viewW, viewH);
        ctx.drawImage(fieldCache, 0, 0, viewW, viewH);
      }

      function withFieldTransform(fn) {
        ctx.save();
        if (mySide === 'p1') {
          ctx.translate(0, viewH); ctx.rotate(-Math.PI / 2); ctx.scale(viewH / FIELD_W, viewW / FIELD_H);
        } else if (mySide === 'p2') {
          ctx.translate(viewW, 0); ctx.rotate(Math.PI / 2); ctx.scale(viewH / FIELD_W, viewW / FIELD_H);
        } else ctx.scale(viewW / FIELD_W, viewH / FIELD_H);
        fn(); ctx.restore();
      }
      function drawPaddle(p, pl, side) {
        const color = pl.color || (side === 'p1' ? '#2678d8' : '#d84d54');
        ensureGradients();
        ctx.save();
        ctx.shadowColor = color; ctx.shadowBlur = 22;
        ctx.translate(p.x, p.y);
        ctx.beginPath(); ctx.arc(0, 0, PADDLE_R, 0, Math.PI * 2);
        ctx.fillStyle = side === 'p1' ? gradP1 : gradP2;
        ctx.fill();
        ctx.shadowBlur = 0; ctx.lineWidth = 6; ctx.strokeStyle = '#f8fdff'; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, PADDLE_R * .76, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 37px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 4;
        ctx.fillText(String(pl.e || (side === 'p1' ? '1' : '2')), 0, 1);
        ctx.restore();
      }
      function drawPuck() {
        ensureGradients();
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = 13; ctx.shadowOffsetY = 5;
        ctx.translate(puck.x, puck.y);
        ctx.beginPath(); ctx.arc(0, 0, PUCK_R, 0, Math.PI * 2);
        ctx.fillStyle = gradPuck; ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.strokeStyle = '#aab5bf'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
      }
      function render() {
        if (!viewW || !viewH) return;
        drawField();
        withFieldTransform(() => {
          drawPaddle(p1Paddle, Lp, 'p1'); drawPaddle(p2Paddle, Rp, 'p2'); drawPuck();
          if (phase === 'goalPause') {
            ctx.fillStyle = 'rgba(7,17,27,.17)'; ctx.fillRect(WALL, WALL, FIELD_W - WALL*2, FIELD_H - WALL*2);
          }
        });
      }

      function showBanner(title, sub, cls = '') {
        if (goalBanner) goalBanner.remove();
        goalBanner = document.createElement('div'); goalBanner.className = `ah-goal-banner ${cls}`;
        goalBanner.innerHTML = `<div class="ah-goal-text">${escapeHtml(title)}</div><div class="ah-goal-sub">${escapeHtml(sub || '')}</div>`;
        stage.appendChild(goalBanner);
        requestAnimationFrame(() => goalBanner && goalBanner.classList.add('show'));
        clearTimeout(goalBannerTimer);
        goalBannerTimer = setTimeout(() => {
          if (!goalBanner) return;
          goalBanner.classList.remove('show'); const old = goalBanner; goalBanner = null;
          setTimeout(() => old.remove(), 450);
        }, 2300);
      }
      function addOverlay(className, html) {
        const el = document.createElement('div'); el.className = className; el.innerHTML = html; stage.appendChild(el); return el;
      }

      function cleanup() {
        if (settled) return;
        settled = true;
        if (raf) cancelAnimationFrame(raf);
        cleanupFns.splice(0).forEach(fn => { try { fn(); } catch (_) {} });
        clearTimeout(goalBannerTimer);
        if (openingOverlay) openingOverlay.remove();
        if (goalBanner) goalBanner.remove();
      }
      function finishMatch(resultWinner, reason) {
        if (over) return;
        over = true; winner = resultWinner || null; phase = 'ended'; inputEnabled = false;
        puck.vx = 0; puck.vy = 0;
        if (isHost && isMP && !endSent) {
          endSent = true;
          io.bc({ k: 'ah:end', winner, p1Score, p2Score, timeLeft, reason: reason || 'finished' });
          publishState(true);
        }
        showFinish(reason || 'finished');
      }
      function showFinish(reason) {
        const w = winner === 'p1' ? Lp : winner === 'p2' ? Rp : null;
        const l = winner === 'p1' ? Rp : winner === 'p2' ? Lp : null;
        const score = `${p1Score} : ${p2Score}`;
        cleanup();
        resolve({ winner: w, loser: l, score, tie: !winner, reason });
      }
      function publishState(force = false) {
        if (!isMP || !isHost) return;
        const t = now(); if (!force && t - lastSnapshot < SNAPSHOT_MS) return;
        lastSnapshot = t;
        io.bc({ k: 'ah:state', puck: { ...puck }, p1: { x: p1Paddle.x, y: p1Paddle.y, vx: p1Paddle.vx, vy: p1Paddle.vy }, p2: { x: p2Paddle.x, y: p2Paddle.y, vx: p2Paddle.vx, vy: p2Paddle.vy }, p1Score, p2Score, timeLeft, phase, over, winner, lastScorer, goalPauseRemaining: Math.max(0, goalPauseUntil - t) });
      }

      async function runOpeningDraw() {
        phase = 'opening'; updateHud();
        const iconA = escapeHtml(String(Lp.e || '♟'));
        const iconB = escapeHtml(String(Rp.e || '♟'));
        openingOverlay = addOverlay('ah-opening-screen', `
          <div class="ah-gear ah-gear-tl">⚙</div><div class="ah-gear ah-gear-tr">⚙</div>
          <div class="ah-gear ah-gear-bl">⚙</div><div class="ah-gear ah-gear-br">⚙</div>
          <div class="ah-opening-kicker">MONOPOLY EVENT · AIR HOCKEY</div>
          <div class="ah-opening-title">КТО НАЧИНАЕТ?</div>
          <div class="ah-opening-panel">
            <div class="ah-opening-player" id="ah-opening-p1" style="--player-color:${escapeHtml(Lp.color || '#3478c9')}">
              <div class="ah-opening-token">${iconA}</div><div class="ah-opening-name">${escapeHtml(Lp.name)}</div><div class="ah-opening-label">ИГРОК 1</div>
            </div>
            <div class="ah-opening-center"><div class="ah-opening-orbit"><span>✦</span><span>✦</span><span>✦</span></div><div class="ah-opening-vs">VS</div><div class="ah-opening-status" id="ah-opening-status">ВЫБИРАЕМ СТАРТУЮЩЕГО</div></div>
            <div class="ah-opening-player" id="ah-opening-p2" style="--player-color:${escapeHtml(Rp.color || '#c94b56')}">
              <div class="ah-opening-token">${iconB}</div><div class="ah-opening-name">${escapeHtml(Rp.name)}</div><div class="ah-opening-label">ИГРОК 2</div>
            </div>
          </div>
          <div class="ah-opening-footer"><span class="ah-opening-dot"></span> ПОДГОТОВКА К МАТЧУ <span class="ah-opening-dot"></span></div>`);
        const p1Card = openingOverlay.querySelector('#ah-opening-p1');
        const p2Card = openingOverlay.querySelector('#ah-opening-p2');
        const status = openingOverlay.querySelector('#ah-opening-status');
        let chosenSide = null;
        let offOpening = null;
        if (isHost) {
          chosenSide = Math.random() < .5 ? 'p1' : 'p2';
          if (isMP) {
            await sleep(180);
            io.bc({ k: 'ah:opening-result', side: chosenSide });
          }
        } else if (isMP) {
          chosenSide = await new Promise(resolve => {
            let done = false;
            offOpening = io.on('ah:opening-result', d => {
              if (done || !d || !['p1','p2'].includes(d.side)) return;
              done = true; if (offOpening) offOpening(); offOpening = null; resolve(d.side);
            });
          });
        }
        if (!chosenSide) chosenSide = Math.random() < .5 ? 'p1' : 'p2';
        const totalTicks = 26;
        for (let i = 0; i < totalTicks; i++) {
          const active = i === totalTicks - 1 ? chosenSide : (i % 2 ? 'p1' : 'p2');
          p1Card.classList.toggle('is-active', active === 'p1');
          p2Card.classList.toggle('is-active', active === 'p2');
          if (status) status.textContent = i === totalTicks - 1 ? 'РЕЗУЛЬТАТ ЗАКРЕПЛЁН' : 'ВЫБИРАЕМ СТАРТУЮЩЕГО';
          try { if (typeof Sound !== 'undefined' && i % 2 === 0 && Sound.eventArrow) Sound.eventArrow(); } catch (_) {}
          await sleep(85 + Math.pow(i / totalTicks, 2) * 115);
        }
        p1Card.classList.toggle('is-winner', chosenSide === 'p1');
        p2Card.classList.toggle('is-winner', chosenSide === 'p2');
        p1Card.classList.remove('is-active'); p2Card.classList.remove('is-active');
        const chosen = chosenSide === 'p1' ? Lp : Rp;
        if (status) status.innerHTML = `<span class="ah-opening-winner-name">${escapeHtml(chosen.name)}</span><br>НАЧИНАЕТ ИГРУ`;
        try { if (typeof Sound !== 'undefined' && Sound.eventArrow) Sound.eventArrow(); } catch (_) {}
        await sleep(1500);
        if (offOpening) offOpening();
        return { winner: chosenSide };
      }

      async function starTransition() {
        phase = 'transition'; updateHud();
        try { if (typeof Sound !== 'undefined' && Sound.eventStar) Sound.eventStar(); } catch (_) {}

        const showField = async () => {
          if (openingOverlay) { openingOverlay.remove(); openingOverlay = null; }
          stage.classList.add('ah-field-reveal');
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          resizeCanvas();
          invalidateGradients();
          render();
        };

        if (typeof FX !== 'undefined' && typeof FX.starPass === 'function') {
          await FX.starPass(showField);
        } else {
          await showField();
          await sleep(800);
        }
      }

      async function countdown() {
        phase = 'countdown'; updateHud(); inputEnabled = false;
        const cd = addOverlay('ah-countdown', '3');
        for (let i = 3; i >= 1; i--) {
          cd.textContent = String(i); cd.classList.remove('pop'); void cd.offsetWidth; cd.classList.add('pop');
          try { if (typeof Sound !== 'undefined' && Sound.eventSpin) Sound.eventSpin(); } catch (_) {}
          await sleep(1000);
        }
        cd.textContent = 'ВПЕРЁД!'; cd.classList.remove('pop'); void cd.offsetWidth; cd.classList.add('pop');
        await sleep(650); cd.remove();
      }

      function resetPuckForConcedingPlayer(concededSide) {
        const p = paddles[concededSide];
        const candidates = concededSide === 'p1'
          ? [FIELD_W * .32, FIELD_W * .25, FIELD_W * .40]
          : [FIELD_W * .68, FIELD_W * .75, FIELD_W * .60];
        puck.x = candidates.sort((x, y) => Math.abs(y - p.x) - Math.abs(x - p.x))[0];
        puck.y = FIELD_H / 2; puck.vx = 0; puck.vy = 0;
      }
      function clampPaddle(side, p) {
        if (side === 'p1') p.x = clamp(p.x, WALL + PADDLE_R, FIELD_W / 2 - PADDLE_R - 7);
        else p.x = clamp(p.x, FIELD_W / 2 + PADDLE_R + 7, FIELD_W - WALL - PADDLE_R);
        p.y = clamp(p.y, WALL + PADDLE_R, FIELD_H - WALL - PADDLE_R);
      }
      function scoreGoal(scorerSide, at) {
        if (over || phase !== 'playing') return;
        if (scorerSide === 'p1') p1Score++; else p2Score++;
        lastScorer = scorerSide;
        try { if (typeof Sound !== 'undefined' && Sound.money) Sound.money(); } catch (_) {}
        showBanner('ГОЛ!', `${sideName(scorerSide)} забивает`);
        updateHud();
        if ((scorerSide === 'p1' ? p1Score : p2Score) >= WIN_SCORE) {
          finishMatch(scorerSide, 'score'); return;
        }
        phase = 'goalPause'; goalPauseUntil = at + 2400;
        resetPuckForConcedingPlayer(scorerSide === 'p1' ? 'p2' : 'p1');
        publishState(true);
      }
      function resolvePaddleCollision(side) {
        const p = paddles[side];
        const dx = puck.x - p.x, dy = puck.y - p.y;
        let dist = hypot(dx, dy);
        const minDist = PUCK_R + PADDLE_R;
        if (dist >= minDist) return;
        let nx, ny;
        if (dist < .001) { nx = side === 'p1' ? 1 : -1; ny = 0; dist = .001; }
        else { nx = dx / dist; ny = dy / dist; }
        const overlap = minDist - dist;
        puck.x += nx * (overlap + .25); puck.y += ny * (overlap + .25);
        const pvx = Number.isFinite(p.vx) ? p.vx : 0;
        const pvy = Number.isFinite(p.vy) ? p.vy : 0;
        const relVx = puck.vx - pvx, relVy = puck.vy - pvy;
        const along = relVx * nx + relVy * ny;
        if (along < 0) {
          puck.vx -= (1 + RESTITUTION) * along * nx;
          puck.vy -= (1 + RESTITUTION) * along * ny;
          puck.vx += pvx * .22; puck.vy += pvy * .22;
          const speed = hypot(puck.vx, puck.vy);
          if (speed > MAX_PUCK_SPEED) { puck.vx *= MAX_PUCK_SPEED / speed; puck.vy *= MAX_PUCK_SPEED / speed; }
          try { if (typeof Sound !== 'undefined' && Sound.shot) Sound.shot(); } catch (_) {}
        }
        p.vx = 0; p.vy = 0;
      }
      function stepPhysics(dt, at) {
        if (phase !== 'playing') return;
        const substeps = Math.max(1, Math.min(5, Math.ceil(dt / .008)));
        const subDt = dt / substeps;
        for (let i = 0; i < substeps && phase === 'playing'; i++) {
          const drag = Math.pow(PUCK_DRAG, subDt * 60);
          puck.vx *= drag; puck.vy *= drag;
          puck.x += puck.vx * subDt; puck.y += puck.vy * subDt;
          if (puck.y - PUCK_R < WALL) { puck.y = WALL + PUCK_R; puck.vy = Math.abs(puck.vy) * RESTITUTION; }
          if (puck.y + PUCK_R > FIELD_H - WALL) { puck.y = FIELD_H - WALL - PUCK_R; puck.vy = -Math.abs(puck.vy) * RESTITUTION; }
          if (puck.x + PUCK_R < WALL) {
            if (puck.y >= GOAL_Y1 + PUCK_R * .15 && puck.y <= GOAL_Y2 - PUCK_R * .15) { scoreGoal('p2', at); break; }
            puck.x = WALL + PUCK_R; puck.vx = Math.abs(puck.vx) * RESTITUTION;
          }
          if (puck.x - PUCK_R > FIELD_W - WALL) {
            if (puck.y >= GOAL_Y1 + PUCK_R * .15 && puck.y <= GOAL_Y2 - PUCK_R * .15) { scoreGoal('p1', at); break; }
            puck.x = FIELD_W - WALL - PUCK_R; puck.vx = -Math.abs(puck.vx) * RESTITUTION;
          }
          resolvePaddleCollision('p1');
          resolvePaddleCollision('p2');
          if (hypot(puck.vx, puck.vy) < 7) { puck.vx = 0; puck.vy = 0; }
        }
        p1Paddle.vx = p1Paddle.vy = 0; p2Paddle.vx = p2Paddle.vy = 0;
      }

      function updateBot(dt) {
        if (phase !== 'playing') return;
        for (const botSide of ['p1', 'p2']) {
          if (!playerFor(botSide).bot) continue;
          const p = paddles[botSide];
          const isLeft = botSide === 'p1';
          const defendX = isLeft ? FIELD_W * .23 : FIELD_W * .77;
          const ownHalf = isLeft ? puck.x < FIELD_W * .57 : puck.x > FIELD_W * .43;
          const targetX = clamp(puck.x + (isLeft ? -PADDLE_R * .55 : PADDLE_R * .55),
            isLeft ? WALL + PADDLE_R : FIELD_W / 2 + PADDLE_R + 8,
            isLeft ? FIELD_W / 2 - PADDLE_R - 8 : FIELD_W - WALL - PADDLE_R);
          const targetY = clamp(puck.y, WALL + PADDLE_R, FIELD_H - WALL - PADDLE_R);
          const tx = ownHalf ? targetX : defendX;
          const ty = ownHalf ? targetY : FIELD_H / 2 + (puck.y - FIELD_H / 2) * .32;
          const maxMove = (ownHalf ? 520 : 360) * dt;
          const oldX = p.x, oldY = p.y;
          const dx = tx - p.x, dy = ty - p.y, d = hypot(dx, dy);
          if (d > 1) { p.x += dx / d * Math.min(d, maxMove); p.y += dy / d * Math.min(d, maxMove); }
          clampPaddle(botSide, p);
          p.vx = (p.x - oldX) / Math.max(dt, .001); p.vy = (p.y - oldY) / Math.max(dt, .001);
        }
      }

      function startAuthoritativeLoop() {
        let last = now();
        const onInput = io && io.on && io.on('ah:input', (d, from) => {
          if (!d || (d.side !== 'p1' && d.side !== 'p2')) return;
          const side = from === a.id ? 'p1' : from === b.id ? 'p2' : null;
          if (!side || playerFor(side).bot || side === mySide) return;
          remoteInputs[side] = { x: clamp(Number(d.x) || 0, 0, 1) * FIELD_W, y: clamp(Number(d.y) || 0, 0, 1) * FIELD_H, at: now() };
        });
        if (onInput) cleanupFns.push(onInput);
        function loop(at) {
          if (settled) return;
          const dt = clamp((at - last) / 1000, .001, .035); last = at;
          if (phase === 'playing') {
            timeLeft = Math.max(0, timeLeft - dt);
            if (timeLeft <= 0) {
              const result = p1Score > p2Score ? 'p1' : p2Score > p1Score ? 'p2' : null;
              finishMatch(result, 'time');
            }
          }
          if (phase === 'goalPause' && at >= goalPauseUntil) {
            phase = 'playing'; puck.vx = 0; puck.vy = 0;
          }
          for (const side of ['p1','p2']) {
            if (side === mySide || playerFor(side).bot) continue;
            const input = remoteInputs[side]; if (!input) continue;
            const p = paddles[side], oldX = p.x, oldY = p.y;
            p.x += (input.x - p.x) * .78; p.y += (input.y - p.y) * .78;
            clampPaddle(side, p);
            p.vx = (p.x - oldX) / dt; p.vy = (p.y - oldY) / dt;
          }
          updateBot(dt);
          stepPhysics(dt, at);
          if (isMP) publishState();
          updateHud(); render();
          raf = requestAnimationFrame(loop);
        }
        raf = requestAnimationFrame(loop);
      }

      function startClientLoop() {
        let endReceived = false, endPayload = null;
        const offState = io.on('ah:state', d => {
          if (!d || !d.puck || !d.p1 || !d.p2) return;
          latestState = d; targetPuck = { ...d.puck }; lastStateAt = now();
          if (phase !== 'playing' || d.phase !== 'playing') puck = { ...d.puck };
          if (mySide !== 'p1') Object.assign(p1Paddle, d.p1);
          if (mySide !== 'p2') Object.assign(p2Paddle, d.p2);
          p1Score = d.p1Score || 0; p2Score = d.p2Score || 0;
          timeLeft = Number.isFinite(d.timeLeft) ? d.timeLeft : timeLeft;
          phase = d.phase || phase; over = !!d.over; winner = d.winner || null;
          lastScorer = d.lastScorer || null;
          if (phase === 'goalPause' && !goalBanner) showBanner('ГОЛ!', `${sideName(lastScorer)} забивает`);
          if (phase === 'playing') inputEnabled = !!mySide;
          if (phase === 'ended') showFinish(endPayload && endPayload.reason || 'finished');
        });
        const offEnd = io.on('ah:end', d => {
          if (!d || endReceived) return;
          endReceived = true; endPayload = d; over = true; winner = d.winner || null;
          p1Score = Number.isFinite(d.p1Score) ? d.p1Score : p1Score;
          p2Score = Number.isFinite(d.p2Score) ? d.p2Score : p2Score;
          timeLeft = Number.isFinite(d.timeLeft) ? d.timeLeft : timeLeft;
          phase = 'ended'; showFinish(d.reason || 'finished');
        });
        cleanupFns.push(offState, offEnd);
        const send = setInterval(() => {
          if (!mySide || !inputEnabled || !isMP) return;
          const p = paddles[mySide];
          io.toHost({ k: 'ah:input', side: mySide, x: p.x / FIELD_W, y: p.y / FIELD_H });
        }, SEND_MS);
        cleanupFns.push(() => clearInterval(send));
        function loop() {
          if (settled) return;
          const at = now();
          if (latestState && at - lastStateAt < 500) {
            if (mySide !== 'p1') { p1Paddle.x += (latestState.p1.x - p1Paddle.x) * .32; p1Paddle.y += (latestState.p1.y - p1Paddle.y) * .32; }
            if (mySide !== 'p2') { p2Paddle.x += (latestState.p2.x - p2Paddle.x) * .32; p2Paddle.y += (latestState.p2.y - p2Paddle.y) * .32; }
            if (latestState.phase === 'playing') {
              puck.x += (targetPuck.x - puck.x) * .42; puck.y += (targetPuck.y - puck.y) * .42;
              puck.vx = latestState.puck.vx; puck.vy = latestState.puck.vy;
            } else { puck.x = targetPuck.x; puck.y = targetPuck.y; }
          }
          updateHud(); render();
          raf = requestAnimationFrame(loop);
        }
        raf = requestAnimationFrame(loop);
      }

      (async () => {
        try {
          render();
          const opening = await runOpeningDraw();
          puck.x = opening.winner === 'p1' ? FIELD_W * .28 : FIELD_W * .72;
          puck.y = FIELD_H / 2; puck.vx = 0; puck.vy = 0;
          await starTransition();
          await countdown();
          if (settled) return;
          phase = 'playing'; timeLeft = MATCH_TIME; inputEnabled = !!mySide;
          hintEl.textContent = mySide ? 'Ведите курсор по полю. Ракетка следует за мышью.' : 'РЕЖИМ ЗРИТЕЛЯ · НАБЛЮДЕНИЕ ЗА МАТЧЕМ';
          if (isHost) {
            publishState(true);
            startAuthoritativeLoop();
          } else startClientLoop();
        } catch (err) {
          console.error('airHockey:', err);
          if (!settled) { cleanup(); resolve({ winner: null, loser: null, score: `${p1Score} : ${p2Score}`, tie: true, reason: 'error' }); }
        }
      })();
    });
  }

  return { duel, stealShare, traitor, airHockey, stealText };
})();