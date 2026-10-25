/* fx.js — режиссёр ивента (сцена со слоями) и звёздные переходы. */
const FX = (() => {
  const g = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const T = {
    SCENE_IN: 1400, SCENE_OUT: 1800, FADE: 1800,
    STAR_FLY: 3000, STAR_PAUSE: 600, STAR_WHITE_AT: 1200, FLASH_IN: 1400, FLASH_OUT: 2200,
    TEST_SELECT: 10000, DIM_HOLD: 10000, ARROW_SPIN: 10000, ARROW_GAP: 1800, DRAW_HOLD: 10000, RESULT_HOLD: 5000
  };

  const TESTS = [
    { id: 'duel', label: 'ДУЭЛЬ', icon: '⚔', need: 2,
      desc: 'WASD — движение, ЛКМ — огненный шар. 2 жизни. 2 минуты. Победитель забирает 15% состояния проигравшего.' },
    { id: 'steal', label: 'УКРАСТЬ / ДЕЛИТЬ', icon: '💰', need: 2,
      desc: 'Делят 500 €. Оба разделили — по 250 €. Один украл — забирает все 500 €. Оба украли — никто ничего не получает.' },
    { id: 'traitor', label: 'ПРЕДАТЕЛЬ', icon: '🗡', need: 1,
      desc: 'Предатель забирает 15% кошелька у выбранного им игрока.' },
    { id: 'airhockey', label: 'АЭРОХОККЕЙ', icon: '🏒', need: 2,
      desc: 'Забить первым 3 гола за 5 минут. Двигайте мышью — фишка следует за курсором. Победитель забирает 15% состояния проигравшего.' }
  ];
  const LAYERS = ['L-star', 'L-dim', 'L-draw', 'L-table', 'L-frame', 'L-result', 'L-game', 'ev-duel', 'ev-steal', 'ev-traitor', 'ev-airhockey'];
  let running = false;

  function lay(id, on, ms = T.FADE) { const e = g(id); e.style.setProperty('--t', ms + 'ms'); e.classList.toggle('on', on); }
  function layNow(id, on) { const e = g(id); e.classList.add('instant'); e.classList.toggle('on', on); void e.offsetWidth; e.classList.remove('instant'); }
  async function crossfade(offIds, onIds, ms = T.FADE) { offIds.forEach(id => lay(id, false, ms)); onIds.forEach(id => lay(id, true, ms)); await sleep(ms); }

  async function starPass(swap, fast) {
    const k = fast ? { fly: 1300, pause: 200, white: 650, fin: 800, fout: 1300, grow: '1.4s', flyD: '1.3s' }
                   : { fly: T.STAR_FLY, pause: T.STAR_PAUSE, white: T.STAR_WHITE_AT, fin: T.FLASH_IN, fout: T.FLASH_OUT, grow: '', flyD: '' };
    const star = g('sc-star'), flash = g('sc-flash');
    star.className = 'sc-star'; star.style.animationDuration = '';
    flash.style.setProperty('--t', '0ms'); flash.classList.remove('on'); void flash.offsetWidth;
    layNow('L-star', true);
    star.classList.add('fly'); if (k.flyD) star.style.animationDuration = k.flyD;
    await sleep(k.fly + k.pause);
    star.classList.remove('fly'); star.classList.add('grow'); star.style.animationDuration = k.grow;
    await sleep(k.white);
    flash.style.setProperty('--t', k.fin + 'ms'); flash.classList.add('on');
    await sleep(k.fin + 100);
    try { await swap(); } catch (e) { console.error('starPass swap:', e); }
    star.className = 'sc-star'; star.style.animationDuration = '';
    flash.style.setProperty('--t', k.fout + 'ms'); flash.classList.remove('on');
    await sleep(k.fout);
    layNow('L-star', false);
  }

  function getPositions(players) {
    const size = g('ev-table-area').clientWidth || 380, R = Math.round(size * 0.5 + 40), n = players.length, pos = {};
    if (n === 4) { pos[players[0].id] = { x: 0, y: -R }; pos[players[1].id] = { x: R, y: 0 }; pos[players[2].id] = { x: 0, y: R }; pos[players[3].id] = { x: -R, y: 0 }; }
    else if (n === 3) { pos[players[0].id] = { x: 0, y: -R }; pos[players[1].id] = { x: Math.round(R * 0.87), y: Math.round(R * 0.5) }; pos[players[2].id] = { x: -Math.round(R * 0.87), y: Math.round(R * 0.5) }; }
    else { pos[players[0].id] = { x: -R, y: 0 }; pos[players[1].id] = { x: R, y: 0 }; }
    const svg = {};
    players.forEach(p => { svg[p.id] = { x: 50 + pos[p.id].x / (size / 2) * 50, y: 50 + pos[p.id].y / (size / 2) * 50 }; });
    return { pos, svg };
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function buildSeats(players) {
    const seats = g('ev-seats'); seats.innerHTML = '';
    const { pos } = getPositions(players);
    players.forEach(p => {
      const s = document.createElement('div'); s.className = 'ev-seat'; s.dataset.pid = p.id;
      s.style.transform = `translate(${pos[p.id].x}px, ${pos[p.id].y}px)`;
      s.innerHTML = `<div class="ev-marker"></div><div class="ev-chip" style="--c:${p.color}"><span class="ev-e">${p.e}</span></div><div class="ev-name">${esc(p.name)}</div>`;
      seats.appendChild(s);
    });
    requestAnimationFrame(() => seats.querySelectorAll('.ev-seat').forEach(s => s.classList.add('show')));
  }

  const arrow = { group: null, ang: 0 };
  function createArrow() {
    const svg = g('ev-arrows'); svg.innerHTML = '';
    svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    arrow.ang = Math.random() * 360;
    arrow.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    arrow.group.setAttribute('transform', `rotate(${arrow.ang} 50 50)`);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    [['x1', 50], ['y1', 50], ['x2', 98], ['y2', 50], ['stroke', '#d43030'], ['stroke-width', 2.4], ['stroke-linecap', 'round'], ['marker-end', 'url(#arrowHead)']].forEach(([a, v]) => line.setAttribute(a, v));
    line.style.filter = 'drop-shadow(0 0 10px rgba(212,48,48,.95))';
    arrow.group.appendChild(line); svg.appendChild(arrow.group);
  }
  function spinArrow(to, duration) {
    const from = arrow.ang, delta = (((to - from) % 360) + 360) % 360, total = 360 * 5 + delta, t0 = performance.now();
    return new Promise(res => {
      const step = now => {
        const t = Math.min(1, (now - t0) / duration);
        arrow.group.setAttribute('transform', `rotate(${from + total * (1 - Math.pow(1 - t, 4))} 50 50)`);
        if (t < 1) requestAnimationFrame(step); else { arrow.ang = from + total; res(); }
      };
      requestAnimationFrame(step);
    });
  }

  function planEvent(players, forcedId) {
    const test = (forcedId && TESTS.find(t => t.id === forcedId)) || TESTS[Math.floor(Math.random() * TESTS.length)];
    const pool = players.map(p => p.id);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return { test: test.id, ids: players.map(p => p.id), parts: pool.slice(0, test.need) };
  }

  async function phaseTest(id) {
    const screen = g('ev-test-screen'), label = g('ev-test-label'), line = g('ev-flip-line');
    label.textContent = 'ВЫБОР ИВЕНТА'; line.textContent = ''; line.className = 'ev-flip-line';
    screen.classList.add('show'); await sleep(1400);
    const target = TESTS.find(t => t.id === id) || TESTS[0], ti = TESTS.indexOf(target), n = TESTS.length, N = 40;
    label.textContent = 'ИСПЫТАНИЕ';
    const t0 = performance.now();
    for (let k = 0; k < N; k++) {
      line.textContent = TESTS[(((ti - (N - 1 - k)) % n) + n) % n].label;
      line.classList.remove('tick'); void line.offsetWidth; line.classList.add('tick');
      if (k < N - 1) await sleep(55 + 480 * Math.pow(k / (N - 1), 3));
    }
    line.classList.add('final');
    const rest = T.TEST_SELECT - (performance.now() - t0); if (rest > 0) await sleep(rest);
    return target;
  }
  async function phaseDim(text, swap, reveal) {
    const dt = g('dim-text'); dt.textContent = text;
    lay('L-dim', true, T.FADE); await sleep(T.FADE + 100);
    swap(); dt.classList.add('on'); await sleep(T.DIM_HOLD);
    dt.classList.remove('on'); await sleep(500);
    reveal(); lay('L-dim', false, T.FADE); await sleep(T.FADE);
  }
  async function phaseArrow(players, ids) {
    const text = g('ev-sub'), { svg } = getPositions(players), picked = [];
    await sleep(T.ARROW_GAP);
    for (let i = 0; i < ids.length; i++) {
      text.textContent = i === 0 ? 'Стрелка выбирает...' : 'Стрелка выбирает второго...';
      await sleep(700);
      const target = players.find(p => p.id === ids[i]), tp = svg[target.id];
      await spinArrow(Math.atan2(tp.y - 50, tp.x - 50) * 180 / Math.PI, T.ARROW_SPIN);
      try { Sound.arrowHit(); } catch (e) {}
      const seat = document.querySelector(`.ev-seat[data-pid="${target.id}"]`); if (seat) seat.classList.add('picked');
      text.textContent = `Выпал: ${target.name}`; picked.push(target);
      await sleep(T.ARROW_GAP);
    }
    return picked;
  }
  const chipHtml = (p, size) => `<div class="draw-p"><div class="ev-chip" style="--c:${p.color};--sz:${size}px"><span class="ev-e">${p.e}</span></div><div class="nm" style="color:${p.color}">${esc(p.name)}</div></div>`;
  function fillDraw(test, parts) {
    const sep = test.id === 'duel' ? 'VS' : test.id === 'steal' ? '&' : test.id === 'airhockey' ? '🏒' : '·', size = parts.length > 2 ? 86 : 108;
    g('draw-kicker').textContent = 'РЕЗУЛЬТАТ ЖЕРЕБЬЁВКИ';
    g('draw-players').innerHTML = parts.map((p, i) => (i ? `<div class="draw-vs">${sep}</div>` : '') + chipHtml(p, size)).join('');
    g('draw-test').textContent = `${test.icon}  ${test.label}`; g('draw-desc').textContent = test.desc;
  }
  function fillResult(title, rows) {
    g('result-title').textContent = title;
    g('result-body').innerHTML = (rows || []).map(r => `<div class="res-row"><span class="lbl">${esc(r.lbl)}</span><span class="val ${r.cls || ''}">${esc(r.val)}</span></div>`).join('');
  }
  async function closeModals() { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); await sleep(700); }

  function resetScene() {
    LAYERS.forEach(id => layNow(id, false));
    const sc = g('ev-scene'); sc.style.transition = 'none'; sc.classList.remove('on'); void sc.offsetWidth; sc.style.transition = '';
    g('ev-test-screen').classList.remove('show');
    const line = g('ev-flip-line'); line.textContent = ''; line.className = 'ev-flip-line';
    g('ev-center').classList.add('hidden'); g('ev-arrows').classList.remove('show'); g('ev-arrows').innerHTML = '';
    g('ev-seats').innerHTML = ''; g('dim-text').classList.remove('on');
    g('ev-sub').textContent = ''; g('ev-sub').style.opacity = ''; g('draw-players').innerHTML = '';
  }

  async function runEvent(opts) {
    if (running) return;
    running = true;
    const scene = g('ev-scene'), plan = opts.plan, io = opts.io;
    try {
      const all = plan.ids.map(i => Board.players[i]);
      await closeModals();
      resetScene(); buildSeats(all); createArrow();
      scene.style.setProperty('--t', T.SCENE_IN + 'ms'); scene.classList.add('on'); await sleep(T.SCENE_IN + 300);

      await starPass(() => { layNow('L-frame', true); layNow('L-table', true); });
      await sleep(500);

      const test = await phaseTest(plan.test);
      await phaseDim('ВЫБОР УЧАСТНИКОВ',
        () => { g('ev-test-screen').classList.remove('show'); g('ev-sub').textContent = ''; g('ev-center').classList.remove('hidden'); },
        () => g('ev-arrows').classList.add('show'));

      const parts = await phaseArrow(all, plan.parts);
      fillDraw(test, parts);
      g('ev-sub').style.opacity = '0';
      await crossfade(['L-table'], ['L-draw'], T.FADE);
      await sleep(T.DRAW_HOLD);

      lay('L-frame', false, T.FADE); lay('L-game', true, T.FADE); lay('ev-' + test.id, true, T.FADE);

      let r;
      try {
        if (test.id === 'duel') {
          r = await Promise.race([
            Events.duel(parts[0], parts[1], io),
            sleep(240000).then(() => ({ winner: null, loser: null, steal: 0 }))
          ]);
        } else if (test.id === 'steal') {
          r = await Promise.race([
            Events.stealShare(parts[0], parts[1], io),
            sleep(90000).then(() => ({ cA: 'share', cB: 'share', text: 'Время истекло' }))
          ]);
        } else if (test.id === 'airhockey') {
          r = await Promise.race([
            Events.airHockey(parts[0], parts[1], io),
            sleep(420000).then(() => ({ winner: null, loser: null, score: null }))
          ]);
        } else {
          r = await Promise.race([
            Events.traitor(parts[0], all.filter(p => p.id !== parts[0].id), io),
            sleep(60000).then(() => ({ victim: all.find(p => p.id !== parts[0].id) || parts[0], taken: 0, traitor: parts[0] }))
          ]);
        }
      } catch (err) {
        console.error('Event inner error:', err);
        r = { winner: null, loser: null, steal: 0 };
      }

      let out;
      try {
        out = await Promise.race([
          opts.finish(test, parts, r),
          sleep(15000).then(() => ({
            title: 'ИВЕНТ ЗАВЕРШЁН',
            rows: [{ lbl: 'Внимание', val: 'Результат не получен', cls: 'res-gold' }]
          }))
        ]);
      } catch (err) {
        console.error('opts.finish error:', err);
        out = {
          title: 'ИВЕНТ ЗАВЕРШЁН',
          rows: [{ lbl: 'Ошибка', val: String(err && err.message || err), cls: 'res-lose' }]
        };
      }

      const swapToResult = () => {
        ['L-game', 'L-frame', 'L-draw', 'L-table', 'ev-duel', 'ev-steal', 'ev-traitor', 'ev-airhockey'].forEach(id => layNow(id, false));
        fillResult(out.title, out.rows);
        layNow('L-result', true);
      };
      await starPass(swapToResult);
      await sleep(T.RESULT_HOLD);

      try { Board.renderPlayers(); } catch (e) {}
      scene.style.setProperty('--t', T.SCENE_OUT + 'ms'); scene.classList.remove('on');
      await sleep(T.SCENE_OUT + 200); resetScene();
    } catch (err) {
      console.error('runEvent error:', err);
      scene.style.setProperty('--t', T.SCENE_OUT + 'ms'); scene.classList.remove('on');
      await sleep(T.SCENE_OUT + 200); resetScene();
    } finally { running = false; }
  }

  async function testStar() {
    if (running) return; running = true;
    const sc = g('ev-scene');
    try {
      resetScene(); sc.style.setProperty('--t', T.SCENE_IN + 'ms'); sc.classList.add('on'); await sleep(T.SCENE_IN + 200);
      await starPass(() => {});
      sc.style.setProperty('--t', T.SCENE_OUT + 'ms'); sc.classList.remove('on'); await sleep(T.SCENE_OUT + 200); resetScene();
    } finally { running = false; }
  }
  async function transition(swap) {
    if (running) { swap(); return; }
    running = true;
    const sc = g('ev-scene');
    try {
      resetScene(); sc.style.setProperty('--t', '600ms'); sc.classList.add('on'); await sleep(700);
      await starPass(swap, true);
      sc.style.setProperty('--t', '900ms'); sc.classList.remove('on'); await sleep(1000); resetScene();
    } finally { running = false; }
  }

  return { runEvent, planEvent, testStar, transition, starPass, TESTS };
})();