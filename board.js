/* board.js — игровое ядро (поле, ход, экономика, аукцион, сделки, ивенты) + мультиплеер. */
const Board = (() => {
  const N = 38, W = 12, H = 9;
  const STEP_X = 0.5, STEP_Y = 0.375;
  const WAIT_MS = 3000, STEP_PAUSE = 110;
  const START_MONEY = 3000, START_BONUS = 200;
  const JAIL_BASE = 150, JAIL_GROW = 0.15;
  const JAIL_MAX_ATTEMPTS = 5;
  const BOT_RESERVE = 300, BOT_BID_MIN = 500;
  const AUCTION_INVITE_MS = 10000, AUCTION_TRADE_MS = 20000, AUCTION_STEP = 25;
  const AUCTION_HARD_LIMIT = AUCTION_INVITE_MS + AUCTION_TRADE_MS + 30000;
  const AUCTION_SYNC_EVERY = 5;
  const AUCTION_CLIENT_FALLBACK_MS = 5000;
  const AUCTION_LEADER_LEAVE_EXTEND = 5000;
  const EVENT_EVERY = 15;
  const AUCTION_WAIT_MAX = 60 * 1000;
  const TURN_MS = 4 * 60 * 1000, TURN_TICK = 100;
  const BUY_TIMEOUT_MS = 30000, JAIL_TIMEOUT_MS = 30000, RENT_TIMEOUT_MS = 60000;
  const MONEY_ANIM_MS = 800;

  const COLORS = ['#3aa0ff', '#ff4d5e', '#3ddc84', '#a865ff'];
  const PIECES = ['♛', '♞', '♜', '♝'];

  const g = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => 'm_' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

  const BIZ = {
    metro:{price:150,rent:15,group:'g1'}, auchan:{price:150,rent:15,group:'g1'}, ikea:{price:150,rent:15,group:'g1'},
    subway:{price:200,rent:30,group:'g2'}, kfc:{price:200,rent:30,group:'g2'}, mcdonalds:{price:200,rent:30,group:'g2'},
    nike:{price:280,rent:28,group:'g3'}, reebok:{price:280,rent:28,group:'g3'}, adidas:{price:280,rent:28,group:'g3'},
    scania:{price:400,rent:32,group:'g4'}, man:{price:400,rent:32,group:'g4'},
    sony:{price:480,rent:36,group:'g5'}, lg:{price:480,rent:36,group:'g5'}, samsung:{price:480,rent:36,group:'g5'},
    beeline:{price:520,rent:44,group:'g6'}, megafon:{price:520,rent:44,group:'g6'}, mts:{price:520,rent:44,group:'g6'},
    gucci:{price:700,rent:56,group:'g7'}, chanel:{price:700,rent:56,group:'g7'}, lacoste:{price:700,rent:56,group:'g7'},
    pepsi:{price:900,rent:90,group:'g8'}, cocacola:{price:900,rent:90,group:'g8'},
    yandex:{price:500,rent:100,group:'g9'}, google:{price:500,rent:100,group:'g9'},
    microsoft:{price:500,rent:100,group:'g9'}, apple:{price:500,rent:100,group:'g9'}
  };
  const UPGRADE_PCT = [0.42, 0.56, 0.94, 1.22, 1.67];
  const RENT_MULT = [1, 2, 5, 10, 20, 40];

  const CELLS = [
    { t:'cnr', n:'СТАРТ' }, { t:'biz', n:'Метро', img:'metro', key:'metro' },
    { t:'svc', n:'+100 €', k:'plus' }, { t:'biz', n:'Ашан', img:'auchan', key:'auchan' },
    { t:'biz', n:'ИКЕА', img:'ikea', key:'ikea' }, { t:'svc', n:'Врач', k:'doctor' },
    { t:'biz', n:'Яндекс', img:'yandex', key:'yandex' }, { t:'biz', n:'Сабвей', img:'subway', key:'subway' },
    { t:'biz', n:'КФС', img:'kfc', key:'kfc' }, { t:'svc', n:'Телепорт', k:'tp' },
    { t:'biz', n:'Макдоналдс', img:'mcdonalds', key:'mcdonalds' }, { t:'cnr', n:'Тюрьма' },
    { t:'biz', n:'Найк', img:'nike', key:'nike' }, { t:'biz', n:'Рибок', img:'reebok', key:'reebok' },
    { t:'biz', n:'Адидас', img:'adidas', key:'adidas' }, { t:'biz', n:'Майкрософт', img:'microsoft', key:'microsoft' },
    { t:'biz', n:'Скания', img:'scania', key:'scania' }, { t:'svc', n:'+100 €', k:'plus' },
    { t:'biz', n:'Ман', img:'man', key:'man' }, { t:'cnr', n:'Казино' },
    { t:'biz', n:'Сони', img:'sony', key:'sony' }, { t:'svc', n:'−100 €', k:'minus' },
    { t:'biz', n:'ЛДЖИ', img:'lg', key:'lg' }, { t:'biz', n:'Самсунг', img:'samsung', key:'samsung' },
    { t:'svc', n:'Ход назад', k:'back' }, { t:'biz', n:'Гугл', img:'google', key:'google' },
    { t:'biz', n:'Билайн', img:'beeline', key:'beeline' }, { t:'biz', n:'Мегафон', img:'megafon', key:'megafon' },
    { t:'svc', n:'Телепорт', k:'tp' }, { t:'biz', n:'МТС', img:'mts', key:'mts' },
    { t:'cnr', n:'Отдых' }, { t:'biz', n:'Гуччи', img:'gucci', key:'gucci' },
    { t:'biz', n:'Шанель', img:'chanel', key:'chanel' }, { t:'biz', n:'Лакоста', img:'lacoste', key:'lacoste' },
    { t:'biz', n:'Аппле', img:'apple', key:'apple' }, { t:'biz', n:'Пепси', img:'pepsi', key:'pepsi' },
    { t:'svc', n:'−100 €', k:'minus' }, { t:'biz', n:'Кола', img:'cocacola', key:'cocacola' }
  ];

  const GROUPS = {};
  CELLS.forEach((c, i) => { if (c.t !== 'biz') return; const gr = BIZ[c.key].group; (GROUPS[gr] = GROUPS[gr] || []).push(i); });

  const gridPos = i => i <= 11 ? { c:i, r:0 } : i <= 19 ? { c:11, r:i - 11 } : i <= 30 ? { c:11 - (i - 19), r:8 } : { c:0, r:8 - (i - 30) };
  const side = i => [0,11,19,30].includes(i) ? 'corner' : i < 11 ? 'top' : i < 19 ? 'right' : i < 30 ? 'bottom' : 'left';
  const CORNER_SLOTS = [[-.2,-.17],[.2,-.17],[-.2,.17],[.2,.17]];
  function point(i, d) {
    const { c, r } = gridPos(i), cx = c + .5, cy = r + .5, s = side(i);
    if (s === 'corner') { const o = CORNER_SLOTS[Math.min(3, Math.round(d))]; return { x: cx + o[0], y: cy + o[1] }; }
    if (s === 'top')    return { x: cx, y: 1.23 + d * STEP_Y };
    if (s === 'bottom') return { x: cx, y: 7.77 - d * STEP_Y };
    if (s === 'left')   return { x: 1.30 + d * STEP_X, y: cy };
    return { x: 10.70 - d * STEP_X, y: cy };
  }

  let MP = false, IS_HOST = true, ME = 0, over = false;
  let chips = [], Q = [], yieldSet = new Set(), cellEls = [], owner = [], stars = [];
  let busy = false, cur = 0, session = 0, turnNo = 1, dir = 1;
  let skipNext = [], inJail = [], jailFee = [], jailAttempts = [], loans = [], reverseNext = [], upgraded = [];
  let auction = null, auctionSeq = 0, turnBlocked = false, aucSyncTick = 0;
  let chatState = {}, chatUnread = {}, mailInbox = [], forms = {}, interactTarget = null;
  let turnTimer = null, rentLocal = null, rentCancel = null, buyCancel = null, jailCancel = null;
  let sellCancel = null, sellPl = null;
  let devDice = null, vq = Promise.resolve(), lastMoney = [], syncQueued = false, msT = 0;
  let pend = {}, askSeq = 0, monoQueue = Promise.resolve();
  let moneyAnimRAF = null;
  const monopolyShown = {};

  function bc(d, seats) { if (!MP || !IS_HOST) return; Net.game(d, seats ? seats.map(s => Game.players[s].nid) : null); }
  function toHost(d) { if (MP && !IS_HOST) Net.game(d); }
  const seatsExcept = (...ex) => Game.players.map(p => p.id).filter(i => i !== ME && !ex.includes(i));

  const STICKY = new Set(['res', 'duel:end', 'steal:show', 'traitor:show', 'ah:end']);
  let evL = {}, evLast = {};
  const evOn = (k, fn) => { (evL[k] = evL[k] || new Set()).add(fn); if (STICKY.has(k) && evLast[k]) { const v = evLast[k]; setTimeout(() => fn(v.d, v.from), 0); } return () => evL[k] && evL[k].delete(fn); };
  const evEmit = (k, d, from) => { if (STICKY.has(k)) evLast[k] = { d, from }; (evL[k] ? [...evL[k]] : []).forEach(fn => fn(d, from)); };
  const evReset = () => { evL = {}; evLast = {}; };
  const makeIO = () => ({
    isHost: IS_HOST, mp: MP, me: ME,
    kind: pid => Game.players[pid].bot ? 'bot' : (pid === ME ? 'me' : 'remote'),
    bc: d => bc({ v: 'ev', ...d }),
    toHost: d => toHost({ a: 'ev', ...d }),
    on: evOn
  });

  function build() {
    const b = g('board');
    b.querySelectorAll('.cell').forEach(e => e.remove());
    cellEls = []; owner = Array(N).fill(null); stars = Array(N).fill(0);
    CELLS.forEach((cl, i) => {
      const p = gridPos(i), d = document.createElement('div');
      d.className = 'cell ' + cl.t + (cl.k ? ' k-' + cl.k : '');
      d.style.gridColumn = p.c + 1; d.style.gridRow = p.r + 1;
      d.innerHTML = cl.t === 'biz' ? `<div class="plate"><img src="img/${cl.img}.png" alt="" data-errem></div><span class="nm">${cl.n}</span><span class="price">${BIZ[cl.key].price} €</span>` : `<span class="big">${cl.n}</span>`;
      d.addEventListener('click', () => onCellClick(i));
      b.insertBefore(d, b.firstChild);
      cellEls[i] = d;
    });
    buildTrack();
  }
  function renderCellPrice(i) {
    const el = cellEls[i], c = CELLS[i];
    if (!el || c.t !== 'biz') return;
    const pe = el.querySelector('.price'); if (!pe) return;
    if (owner[i] == null) { pe.textContent = BIZ[c.key].price + ' €'; pe.classList.remove('rent'); }
    else { pe.textContent = Math.round(BIZ[c.key].rent * RENT_MULT[stars[i]]) + ' €'; pe.classList.add('rent'); }
  }
  function renderStars(i) {
    const el = cellEls[i]; if (!el) return;
    let s = el.querySelector('.stars');
    if (!stars[i]) { if (s) s.remove(); }
    else { if (!s) { s = document.createElement('div'); s.className = 'stars'; el.appendChild(s); } s.textContent = '★'.repeat(stars[i]); }
    renderCellPrice(i); queueSync();
  }
  function setOwner(i, p) {
    owner[i] = p;
    const el = cellEls[i];
    if (el) {
      if (p == null) { el.classList.remove('owned'); el.style.removeProperty('--own'); }
      else { el.classList.add('owned'); el.style.setProperty('--own', Game.players[p].color); }
    }
    try { resetMonoFlags(); } catch (e) { console.error(e); }
    renderCellPrice(i); queueSync();
  }
  function buildTrack() {
    const pts = [];
    for (let i = 0; i <= N; i++) { const p = point(i % N, 0); pts.push(`${p.x},${p.y}`); }
    let html = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polyline points="${pts.join(' ')}"/></svg>`;
    for (let i = 0; i < N; i++) { const p = point(i, 0); html += `<i class="node${side(i) === 'corner' ? ' big' : ''}" style="left:${p.x / W * 100}%;top:${p.y / H * 100}%"></i>`; }
    g('track').innerHTML = html;
  }

  const PIPS = { 1:[[2,2]], 2:[[1,1],[3,3]], 3:[[1,1],[2,2],[3,3]], 4:[[1,1],[1,3],[3,1],[3,3]], 5:[[1,1],[1,3],[2,2],[3,1],[3,3]], 6:[[1,1],[2,1],[3,1],[1,3],[2,3],[3,3]] };
  const ORI = { 1:[0,0], 2:[-90,0], 3:[0,-90], 4:[0,90], 5:[90,0], 6:[0,180] };
  const face = (v, cls) => `<div class="face ${cls}">${PIPS[v].map(p => `<i style="grid-area:${p[0]}/${p[1]}"></i>`).join('')}</div>`;
  const dieHTML = () => `<div class="die"><div class="cube">${face(1,'fr')}${face(6,'bk')}${face(3,'rt')}${face(4,'lf')}${face(2,'tp')}${face(5,'bt')}</div></div>`;
  function throwDice(a, b) {
    try { Sound.diceRoll(); } catch (e) {}
    const dice = [...g('dice').querySelectorAll('.die')];
    [a, b].forEach((v, i) => {
      const die = dice[i], cube = die.firstChild, [rx, ry] = ORI[v];
      cube.style.transition = 'none'; cube.style.transform = `rotateX(${rand(-180,180)}deg) rotateY(${rand(-180,180)}deg)`;
      die.classList.remove('toss'); void die.offsetWidth; die.style.animationDelay = (i * 0.12) + 's'; die.classList.add('toss');
      cube.style.transition = 'transform 3.4s cubic-bezier(.22,1,.36,1)';
      cube.style.transform = `rotateX(${rx + 720 + 720 * i}deg) rotateY(${ry + 1080 - 720 * i}deg)`;
    });
    return sleep(4000);
  }
  async function waitBar(ms) {
    const w = g('wait'), f = g('fill');
    f.style.transition = 'none'; f.style.width = '0'; w.classList.add('on'); void f.offsetWidth;
    f.style.transition = `width ${ms}ms linear`; f.style.width = '100%';
    await sleep(ms); w.classList.remove('on');
  }

  function place(ch, x, y) { ch.x = x; ch.y = y; ch.el.style.left = (x / W * 100) + '%'; ch.el.style.top = (y / H * 100) + '%'; }
  function layout() { Q.forEach((q, i) => q.forEach((ch, k) => { const shift = yieldSet.has(i) && side(i) !== 'corner' ? 1 : 0, p = point(i, k + shift); place(ch, p.x, p.y); })); }
  const smooth = t => t * t * (3 - 2 * t);
  const dist = (a, b) => Math.hypot(b.x - a.x, (b.y - a.y) * 4 / 3);
  function leg(ch, a, b, my) {
    try { Sound.chipStep(); } catch (e) {}
    return new Promise(res => {
      const dur = Math.max(300, Math.min(520, dist(a, b) * 320)), t0 = performance.now();
      const f = now => {
        if (my !== session) return res();
        const t = Math.min(1, (now - t0) / dur), e = smooth(t), h = Math.sin(Math.PI * t);
        place(ch, a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e);
        ch.el.style.setProperty('--hy', (-9 * h) + 'px'); ch.el.style.setProperty('--hs', 1 + 0.14 * h); ch.el.style.setProperty('--ss', 1 - 0.25 * h);
        if (t < 1) requestAnimationFrame(f); else res();
      };
      requestAnimationFrame(f);
    });
  }
  async function move(ch, steps) {
    if (steps <= 0) return { passedStart: false };
    const my = session, q = Q[ch.stop], ix = q.indexOf(ch); if (ix >= 0) q.splice(ix, 1);
    const passed = []; let s = ch.stop, passedStart = false;
    for (let k = 0; k < steps; k++) { s = (s + dir + N) % N; if (s === 0 && ch.stop !== 0) passedStart = true; passed.push(s); }
    const dest = passed[steps - 1];
    const pts = [{ x: ch.x, y: ch.y }];
    passed.forEach((st, k) => pts.push(k === steps - 1 ? point(st, Q[st].length) : point(st, 0)));
    ch.el.classList.add('moving'); layout();
    for (let k = 0; k < steps; k++) {
      if (my !== session) return { passedStart };
      if (k > 0) yieldSet.delete(passed[k - 1]); if (k < steps - 1) yieldSet.add(passed[k]);
      layout(); await leg(ch, pts[k], pts[k + 1], my); if (k < steps - 1) await sleep(STEP_PAUSE);
    }
    if (my !== session) return { passedStart };
    yieldSet.clear(); Q[dest].push(ch); ch.stop = dest; ch.el.classList.remove('moving');
    ['--hy','--hs','--ss'].forEach(v => ch.el.style.removeProperty(v)); layout();
    return { passedStart };
  }
  async function teleport(ch, target) {
    try { Sound.teleport(); } catch (e) {}
    const my = session, q = Q[ch.stop], ix = q.indexOf(ch); if (ix >= 0) q.splice(ix, 1);
    const from = { x: ch.x, y: ch.y }, to = point(target, Q[target].length);
    ch.el.classList.add('moving');
    await new Promise(res => {
      const t0 = performance.now();
      const f = now => {
        if (my !== session) return res();
        const t = Math.min(1, (now - t0) / 900), e = smooth(t);
        place(ch, from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e);
        if (t < 1) requestAnimationFrame(f); else res();
      };
      requestAnimationFrame(f);
    });
    Q[target].push(ch); ch.stop = target; ch.el.classList.remove('moving'); layout();
  }

  function log(text, cls, onClick) {
    const l = g('log'), d = document.createElement('div');
    if (cls) d.className = cls;
    d.textContent = text;
    if (onClick) d.addEventListener('click', onClick);
    l.appendChild(d); l.scrollTop = l.scrollHeight;
  }
  function glog(text, cls, aucId) { log(text, cls, aucId ? openAuctionPage : null); bc({ v: 'log', text, cls, auc: aucId }); }
  function toast(text) {
    const zone = g('toast-zone-global'); if (!zone) return;
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = text;
    zone.appendChild(el); setTimeout(() => el.remove(), 4200);
  }
  function notice(pid, text) { if (pid === ME) toast(text); else bc({ v: 'toast', text }, [pid]); }

  function bizMarketValue(idx) {
    const c = CELLS[idx]; if (!c || c.t !== 'biz') return 0;
    const base = BIZ[c.key].price; let v = base;
    for (let s = 0; s < (stars[idx] || 0); s++) v += Math.round(base * UPGRADE_PCT[s]);
    return v;
  }
  function totalWorth(pid) { let sum = Game.players[pid].money; owner.forEach((o, i) => { if (o === pid) sum += bizMarketValue(i); }); return sum; }
  function countCompanies(pid) { let n = 0; owner.forEach(o => { if (o === pid) n++; }); return n; }
  const hasMonopoly = (pid, group) => GROUPS[group].every(i => owner[i] === pid);

  function snapshot() {
    return { p: Game.players.map(p => [p.money, p.alive ? 1 : 0]), o: owner.slice(), s: stars.slice(),
      j: inJail.map(Boolean), l: loans.map(l => l ? l.turnsLeft : 0), cur, turnNo };
  }
  function queueSync() { if (!MP || !IS_HOST || syncQueued) return; syncQueued = true; setTimeout(() => { syncQueued = false; bc({ v: 'state', ...snapshot() }); }, 30); }
  function applyState(s) {
    s.p.forEach((v, i) => { if (Game.players[i]) { Game.players[i].money = v[0]; Game.players[i].alive = !!v[1]; } });
    s.o.forEach((o, i) => { if (owner[i] !== o) setOwner(i, o); });
    s.s.forEach((n, i) => { if (stars[i] !== n) { stars[i] = n; renderStars(i); } });
    inJail = s.j; loans = s.l.map(n => n ? { turnsLeft: n } : null); cur = s.cur; turnNo = s.turnNo; renderPlayers();
    if (Modal_isOpen('sell') && sellPl) renderSellModal(sellPl);
  }
  function moneySound() { const t = performance.now(); if (t - msT < 250) return; msT = t; try { Sound.money(); } catch (e) {} }

  function moneyAnimLoop(now) {
    let active = false;
    Game.players.forEach((p, i) => {
      if (p._disp == null || p._animTo == null || p._disp === p._animTo) return;
      active = true;
      const t = Math.min(1, (now - p._animStart) / MONEY_ANIM_MS);
      p._disp = Math.round(p._animFrom + (p._animTo - p._animFrom) * t);
      const el = g('players').querySelector(`[data-money-pid="${i}"]`);
      if (el) el.textContent = p._disp + ' €';
      if (t >= 1) { p._disp = p._animTo; p._animFrom = p._animTo; }
    });
    moneyAnimRAF = active ? requestAnimationFrame(moneyAnimLoop) : null;
  }

  function renderPlayers() {
    try {
      const pl = Game.players;
      if (lastMoney.length === pl.length && pl.some((p, i) => p.money !== lastMoney[i])) moneySound();
      lastMoney = pl.map(p => p.money);
      pl.forEach(p => {
        if (p._disp == null) { p._disp = p.money; p._animTo = p.money; p._animFrom = p.money; p._animStart = 0; return; }
        if (p._animTo !== p.money) { p._animFrom = p._disp; p._animTo = p.money; p._animStart = performance.now(); }
      });
      if (!moneyAnimRAF) moneyAnimRAF = requestAnimationFrame(moneyAnimLoop);

      const unread = mailInbox.filter(m => !m.read).length;
      g('players').innerHTML = pl.map((p, i) => {
        const isMe = i === ME, alive = p.alive;
        const actionBtns = isMe && alive ? `<button class="btn" data-loan="1">Кредит</button><button class="btn bankrupt" data-bankrupt="1">Банкрот</button>` : '';
        const mailBtn = isMe && alive ? `<button class="btn pc-mail" data-mail="1">Почта${unread ? ` <span class="mail-badge">${unread}</span>` : ''}</button>` : '';
        const tp = turnTimer && turnTimer.pid === i && alive ? turnTimer.pct : 1;
        const timerHtml = p.bot ? '' : `<div class="pc-timer"><div class="pc-timer-fill" data-timer="${i}" style="width:${tp * 100}%;background:${p.color}"></div></div>`;
        const show = p._disp != null ? p._disp : p.money;
        const moneyHtml = alive ? `<div class="money" data-money-pid="${i}">${show} €</div>` : `<div class="money">зритель</div>`;
        return `<div class="pc${i === cur ? ' turn' : ''}${alive ? '' : ' dead'}" data-p="${i}" style="--c:${p.color}">
          <div class="pc-info">
            <div class="nm-row"><div class="mini"><div class="bd" data-e="${p.e}"></div></div><div class="nm">${esc(p.name)}</div>${chatUnread[i] ? '<span class="unread" title="Новое сообщение">✉</span>' : ''}</div>
            ${moneyHtml}
            ${alive ? `<div class="worth">Итого: ${totalWorth(i)} €</div>` : ''}
            ${alive ? `<div class="companies">Компаний: <b>${countCompanies(i)}</b></div>` : ''}
            ${loans[i] ? `<div class="loan-tag">кредит · ${loans[i].turnsLeft} х.</div>` : ''}
            ${inJail[i] ? `<div class="loan-tag" style="color:#ff9d9d">в тюрьме${jailAttempts[i] ? ` · ${jailAttempts[i]}/5` : ''}</div>` : ''}
          </div>
          <div class="pc-side">${actionBtns}${mailBtn}</div>
          ${timerHtml}
        </div>`;
      }).join('');
      g('turn-pill').textContent = 'Ход ' + turnNo;

      const bk = g('players').querySelector('[data-bankrupt]');
      if (bk) bk.addEventListener('click', async e => {
        e.stopPropagation();
        if (!(await askConfirm('Объявить банкротство?', 'Вы выйдете из игры и станете зрителем. Отменить это нельзя.'))) return;
        if (IS_HOST) doBankruptManual(ME); else toHost({ a: 'bankrupt' });
      });
      const ln = g('players').querySelector('[data-loan]');
      if (ln) ln.addEventListener('click', e => { e.stopPropagation(); if (loans[ME]) { toast('Кредит уже взят'); Sound.error(); return; } Modal.open('loan'); });
      const mb = g('players').querySelector('[data-mail]');
      if (mb) mb.addEventListener('click', e => { e.stopPropagation(); renderMailbox(); Modal.open('mailbox'); });
      g('players').querySelectorAll('.pc').forEach(el => el.addEventListener('click', ev => {
        if (ev.target.closest('.btn')) return;
        const i = +el.dataset.p;
        if (i === ME || !Game.players[i].alive) return;
        openInteract(i);
      }));
      queueSync();
    } catch (err) { console.error('renderPlayers:', err); }
  }
  function setRoll(on) { const b = g('b-roll'); if (!b) return; b.classList.toggle('disabled', !on); b.disabled = !on; }
  function resetRollBtn() { const b = g('b-roll'); if (!b) return; b.textContent = 'Бросить кубики'; b.classList.remove('red'); setRoll(false); }

  function stopTurnTimer() { if (turnTimer) { clearInterval(turnTimer.int); turnTimer = null; } }
  function startTurnTimer(pid, ms, logic) {
    stopTurnTimer();
    const my = session; let elapsed = 0;
    turnTimer = { pid, pct: 1, int: 0 };
    turnTimer.int = setInterval(() => {
      if (my !== session) { stopTurnTimer(); return; }
      if (g('ev-scene').classList.contains('on')) return;
      elapsed += TURN_TICK;
      const left = ms - elapsed;
      if (left <= 0) { stopTurnTimer(); if (logic) onTurnTimeout(pid); return; }
      turnTimer.pct = left / ms;
      const el = g('players').querySelector(`[data-timer="${pid}"]`);
      if (el) el.style.width = (turnTimer.pct * 100) + '%';
    }, TURN_TICK);
  }
  function onTurnTimeout(pid) { if (busy || cur !== pid) return; bankruptPlayer(pid, 'не бросил кубики за 4 минуты — выбывает'); next(); }

  function askBuyUI(pl) {
    return new Promise(res => {
      g('buy-title').textContent = CELLS[pl.idx].n;
      g('buy-desc').textContent = `Цена: ${pl.price} €. Ваш баланс: ${pl.money} €.`;
      ['buy-yes', 'buy-auction'].forEach(id => { const n = g(id); n.replaceWith(n.cloneNode(true)); });
      const Y = g('buy-yes'), A = g('buy-auction'), can = pl.money >= pl.price;
      Y.disabled = !can; Y.classList.toggle('disabled', !can);
      let done = false;
      const fin = v => { if (done) return; done = true; clearTimeout(to); buyCancel = null; Modal.close('buy'); res(v); };
      Y.addEventListener('click', () => fin('buy')); A.addEventListener('click', () => fin('auction'));
      const to = setTimeout(() => fin('auction'), BUY_TIMEOUT_MS); buyCancel = () => fin(null);
      Modal.open('buy');
    });
  }
  function askJailUI(pl) {
    return new Promise(res => {
      const canRoll = pl.attempt <= JAIL_MAX_ATTEMPTS;
      const canPay = pl.money >= pl.fee;
      let desc;
      if (!canRoll) {
        desc = canPay
          ? `Все ${JAIL_MAX_ATTEMPTS} попыток израсходованы. Только выкуп: ${pl.fee} €.`
          : `Все ${JAIL_MAX_ATTEMPTS} попыток израсходованы. Не хватает на выкуп (${pl.fee} €) — банкрот.`;
      } else {
        desc = `Попытка ${pl.attempt}/${JAIL_MAX_ATTEMPTS}. Заплатить ${pl.fee} € или бросить кубики (нужен дубль 2)?`;
      }
      g('jail-desc').textContent = desc;
      ['jail-pay', 'jail-roll'].forEach(id => { const n = g(id); n.replaceWith(n.cloneNode(true)); });
      let done = false;
      const fin = v => { if (done) return; done = true; clearTimeout(to); jailCancel = null; Modal.close('jail'); res(v); };
      const payBtn = g('jail-pay'), rollBtn = g('jail-roll');
      payBtn.disabled = !canPay; payBtn.classList.toggle('disabled', !canPay);
      rollBtn.disabled = !canRoll; rollBtn.classList.toggle('disabled', !canRoll);
      payBtn.addEventListener('click', () => { if (canPay) fin('pay'); });
      rollBtn.addEventListener('click', () => { if (canRoll) fin('roll'); });
      const to = setTimeout(() => {
        if (canRoll) fin('roll');
        else if (canPay) fin('pay');
        else fin('bankrupt');
      }, JAIL_TIMEOUT_MS);
      jailCancel = () => fin(null);
      Modal.open('jail');
    });
  }
  function askRentUI(rent) {
    return new Promise(res => {
      const btn = g('b-roll');
      btn.textContent = `Оплатить ${rent} €`; btn.classList.remove('disabled'); btn.classList.add('red'); btn.disabled = false;
      rentLocal = () => { rentLocal = null; rentCancel = null; resetRollBtn(); res(true); };
      rentCancel = () => { if (!rentLocal) return; rentLocal = null; rentCancel = null; resetRollBtn(); res(false); };
    });
  }
  function askSellUI(pl) {
    return new Promise(res => {
      let done = false;
      const fin = v => { if (done) return; done = true; clearTimeout(to); sellCancel = null; sellPl = null; Modal.close('sell'); res(v); };
      sellPl = pl;
      renderSellModal(pl);
      const to = setTimeout(() => {
        const p = Game.players[pl.playerId];
        fin(p && p.money >= pl.need ? 'ok' : 'bankrupt');
      }, 90000);
      sellCancel = () => fin(null);
      g('sell-done').onclick = () => {
        const p = Game.players[pl.playerId];
        if (p && p.money >= pl.need) fin('ok');
      };
      g('sell-bankrupt').onclick = () => fin('bankrupt');
      Modal.open('sell');
    });
  }
  function localAsk(kind, pl) {
    if (kind === 'buy') return askBuyUI(pl);
    if (kind === 'jail') return askJailUI(pl);
    if (kind === 'sell') return askSellUI(pl);
    return askRentUI(pl.rent);
  }
  function cancelLocalAsk(kind) {
    if (kind === 'buy' && buyCancel) buyCancel();
    if (kind === 'jail' && jailCancel) jailCancel();
    if (kind === 'rent' && rentCancel) rentCancel();
    if (kind === 'sell' && sellCancel) sellCancel();
  }
  function ask(pid, kind, pl, ms, def) {
    if (pid === ME) return Promise.race([localAsk(kind, pl), sleep(ms).then(() => { cancelLocalAsk(kind); return def; })]);
    return new Promise(res => {
      const id = ++askSeq;
      const to = setTimeout(() => { delete pend[id]; bc({ v: 'askCancel', id, kind }, [pid]); res(def); }, ms);
      pend[id] = { pid, fn: val => { clearTimeout(to); delete pend[id]; res(val); } };
      bc({ v: 'ask', id, kind, pl }, [pid]);
    });
  }

  function onCellClick(i) {
    const c = CELLS[i];
    if (c.t !== 'biz' || owner[i] == null) return;
    if (owner[i] !== ME) { toast(`«${c.n}» принадлежит ${Game.players[owner[i]].name}`); return; }
    openBizModal(i);
  }
  function act(a, idx) { if (IS_HOST) ({ upgrade: doUpgrade, downgrade: doDowngrade, auction: doAuctionFromBiz })[a](ME, idx); else toHost({ a, idx }); }
  function openBizModal(i) {
    const c = CELLS[i], price = BIZ[c.key].price, st = stars[i];
    const upPrice = st < 5 ? Math.round(price * UPGRADE_PCT[st]) : 0;
    const canMono = hasMonopoly(ME, BIZ[c.key].group), canUp = !upgraded[ME];
    g('biz-title').textContent = c.n;
    g('biz-desc').innerHTML = `Ваш бизнес. Звёзд: <b>${st}</b>.<br>` +
      (st < 5 ? (!canMono ? `<span style="color:#ffb3b3">Нужна монополия группы для прокачки.</span>`
        : !canUp ? `<span style="color:#ffb3b3">Улучшение уже использовано в этом ходу.</span>`
        : `Улучшить до ${st + 1}★ за <b>${upPrice} €</b>.`) : `Максимальный уровень.`) +
      (st > 0 ? `<br>Снять звезду: +${Math.round(price * UPGRADE_PCT[st - 1])} €.` : '');
    ['biz-upgrade', 'biz-downgrade', 'biz-auction', 'biz-close'].forEach(id => { const n = g(id); n.replaceWith(n.cloneNode(true)); });
    const up = g('biz-upgrade'), down = g('biz-downgrade');
    const noUp = st >= 5 || !canMono || !canUp;
    up.disabled = noUp; up.classList.toggle('disabled', noUp);
    down.disabled = st === 0; down.classList.toggle('disabled', st === 0);
    up.addEventListener('click', () => { act('upgrade', i); Modal.close('biz'); });
    down.addEventListener('click', () => { act('downgrade', i); Modal.close('biz'); });
    g('biz-auction').addEventListener('click', () => { act('auction', i); Modal.close('biz'); });
    g('biz-close').addEventListener('click', () => Modal.close('biz'));
    Modal.open('biz');
  }
  function doUpgrade(pid, idx) {
    const p = Game.players[pid], c = CELLS[idx];
    if (!p || !p.alive || !c || c.t !== 'biz' || owner[idx] !== pid) return notice(pid, 'Это не ваш бизнес');
    if (!hasMonopoly(pid, BIZ[c.key].group)) return notice(pid, 'Нужна монополия группы');
    if (upgraded[pid]) return notice(pid, 'Улучшать можно один раз за ход');
    if (stars[idx] >= 5) return;
    const price = Math.round(BIZ[c.key].price * UPGRADE_PCT[stars[idx]]);
    if (p.money < price) return notice(pid, 'Недостаточно денег');
    p.money -= price; stars[idx]++; upgraded[pid] = true;
    renderStars(idx); renderPlayers();
    glog(`${p.name} улучшил «${c.n}» до ${stars[idx]}★ за ${price} €`);
  }
  function doDowngrade(pid, idx) {
    const p = Game.players[pid], c = CELLS[idx];
    if (!p || !p.alive || !c || c.t !== 'biz' || owner[idx] !== pid || stars[idx] <= 0) return;
    const refund = Math.round(BIZ[c.key].price * UPGRADE_PCT[stars[idx] - 1]);
    stars[idx]--; p.money += refund; renderStars(idx); renderPlayers();
    glog(`${p.name} снял звезду с «${c.n}», вернув ${refund} €`);
  }
  function doSellBiz(pid, idx) {
    const p = Game.players[pid], c = CELLS[idx];
    if (!p || !p.alive || !c || c.t !== 'biz' || owner[idx] !== pid) return;
    const refund = bizMarketValue(idx);
    p.money += refund;
    setOwner(idx, null);
    stars[idx] = 0;
    renderStars(idx);
    renderPlayers();
    glog(`${p.name} продал «${c.n}» в банк за ${refund} €`);
  }
  function renderSellModal(pl) {
    const p = Game.players[pl.playerId];
    if (!p) return;
    g('sell-need').textContent = pl.need + ' €';
    g('sell-balance').textContent = p.money + ' €';
    const list = g('sell-list');
    const assets = [];
    owner.forEach((o, i) => { if (o === p.id) assets.push(i); });
    if (!assets.length) {
      list.innerHTML = '<p class="dim" style="text-align:center;padding:1rem">Нет имущества для продажи</p>';
    } else {
      list.innerHTML = assets.map(i => {
        const c = CELLS[i], st = stars[i];
        const starVal = st > 0 ? Math.round(BIZ[c.key].price * UPGRADE_PCT[st - 1]) : 0;
        const bizVal = bizMarketValue(i);
        return `<div class="sell-row">
          <div class="sell-info"><b>${esc(c.n)}</b>${st ? ' ' + '★'.repeat(st) : ''}</div>
          <div class="sell-val">${bizVal} €</div>
          <div class="sell-actions">
            ${st > 0 ? `<button class="btn sm" data-sell="star" data-idx="${i}">Снять ★ (+${starVal} €)</button>` : ''}
            <button class="btn sm" data-sell="biz" data-idx="${i}">Продать (+${bizVal} €)</button>
          </div>
        </div>`;
      }).join('');
      list.querySelectorAll('[data-sell]').forEach(btn => {
        btn.addEventListener('click', () => {
          const mode = btn.dataset.sell, idx = +btn.dataset.idx;
          if (IS_HOST) {
            if (mode === 'star') doDowngrade(p.id, idx);
            else doSellBiz(p.id, idx);
          } else {
            toHost({ a: mode === 'star' ? 'downgrade' : 'sellbiz', idx });
          }
          renderSellModal(pl);
        });
      });
    }
    const doneBtn = g('sell-done');
    if (doneBtn) {
      const canPay = p.money >= pl.need;
      doneBtn.disabled = !canPay;
      doneBtn.classList.toggle('disabled', !canPay);
    }
  }
  function autoLiquidate(p, need) {
    let guard = 0;
    while (p.money < need && p.alive && guard++ < 30) {
      const assets = bidx(p.id);
      if (!assets.length) break;
      const withStar = assets.filter(i => stars[i] > 0);
      if (withStar.length) {
        let bestIdx = withStar[0], bestVal = Infinity;
        for (const i of withStar) {
          const c = CELLS[i];
          const val = Math.round(BIZ[c.key].price * UPGRADE_PCT[stars[i] - 1]);
          if (val < bestVal) { bestVal = val; bestIdx = i; }
        }
        doDowngrade(p.id, bestIdx);
      } else {
        let bestIdx = assets[0], bestVal = Infinity;
        for (const i of assets) {
          const val = bizMarketValue(i);
          if (val < bestVal) { bestVal = val; bestIdx = i; }
        }
        doSellBiz(p.id, bestIdx);
      }
    }
    if (p.alive && p.money < need) {
      bankruptPlayer(p.id, `не хватает на оплату ${need} € даже после продажи имущества`);
    }
  }
  async function ensureSolvency(p, need) {
    if (!p || !p.alive) return false;
    if (p.money >= need) return true;
    const assets = bidx(p.id);
    const totalAssets = assets.reduce((s, i) => s + bizMarketValue(i), 0);
    if (p.money + totalAssets < need) {
      bankruptPlayer(p.id, `не хватает на оплату ${need} € даже после продажи имущества`);
      return false;
    }
    if (p.bot) {
      autoLiquidate(p, need);
    } else {
      await ask(p.id, 'sell', { need, playerId: p.id }, 95000, 'bankrupt');
    }
    return p.alive && p.money >= need;
  }
  function doAuctionFromBiz(pid, idx) {
    const p = Game.players[pid], c = CELLS[idx];
    if (!p || !p.alive || !c || c.t !== 'biz' || owner[idx] !== pid) return;
    if (auction && !auction.finished) return notice(pid, 'Сейчас уже идёт аукцион');
    glog(`${p.name} выставил «${c.n}» на аукцион`);
    auctionStart(idx, pid, true, []);
  }

  function checkMonopoly(pid) {
    for (const gr in GROUPS) {
      if (GROUPS[gr].every(i => owner[i] === pid) && !monopolyShown[gr + '_' + pid]) { monopolyShown[gr + '_' + pid] = true; return { group: gr, cells: GROUPS[gr] }; }
    }
    return null;
  }
  function resetMonoFlags() {
    for (const key in monopolyShown) {
      const sep = key.indexOf('_'); if (sep < 0) { delete monopolyShown[key]; continue; }
      const gr = key.slice(0, sep), pid = +key.slice(sep + 1);
      if (!GROUPS[gr] || !GROUPS[gr].every(i => owner[i] === pid)) delete monopolyShown[key];
    }
  }
  function monopolyFx(pid, cells) {
    monoQueue = monoQueue.then(async () => {
      while (g('ev-scene').classList.contains('on')) await sleep(300);
      glog(`🎉 ${Game.players[pid].name} собрал монополию!`);
      await V({ v: 'mono', pid, cells });
    }).catch(e => console.error('monopolyFx:', e));
    return monoQueue;
  }
  async function monopolyVis(pid, cells) {
    try { Sound.monopoly(); } catch (e) {}
    const cards = g('mono-cards');
    cards.innerHTML = cells.map((i, k) => `<div class="mono-card" style="animation-delay:${0.15 * k}s"><img src="img/${CELLS[i].img}.png" alt="" data-errem><div class="mc-name">${CELLS[i].n}</div></div>`).join('');
    g('mono-text').textContent = `${Game.players[pid].name} собрал монополию`;
    Modal.open('mono-fx'); await sleep(6000); Modal.close('mono-fx'); await sleep(800); cards.innerHTML = '';
  }

  async function jailAnimVis(name) {
    try { Sound.jail(); } catch (e) {}
    const el = g('board'); el.classList.add('jail-flash');
    const b = document.createElement('div'); b.className = 'jail-banner'; b.textContent = `${name} отправился на кичу`; el.appendChild(b);
    await sleep(2000); el.classList.remove('jail-flash'); b.remove();
  }
  async function doV(d) {
    switch (d.v) {
      case 'init': clientStart(d); return;
      case 'state': applyState(d); return;
      case 'log': log(d.text, d.cls, d.auc ? openAuctionPage : null); return;
      case 'dice': g('sum').textContent = ''; await throwDice(d.a, d.b); g('sum').textContent = `Выпало ${d.a + d.b}`; return;
      case 'bar': await waitBar(d.ms); return;
      case 'sumclear': g('sum').textContent = ''; return;
      case 'move': { const old = dir; dir = d.dir; const r = await move(chips[d.pid], d.steps); dir = old; return r; }
      case 'tp': await teleport(chips[d.pid], d.to); return;
      case 'jail': await jailAnimVis(d.name); return;
      case 'mono': await monopolyVis(d.pid, d.cells); return;
      case 'deal': dealFx(d.pids); return;
      case 'evplan': await runEventClient(d.plan); return;
      case 'gameover': showGameOver(d.w); return;
    }
  }
  async function V(d) { bc(d); return doV(d); }

  function dealFx(pids) { try { Sound.deal(); } catch (e) {} if (pids.includes(ME)) showConfetti(); showFireworks(); }
  function showConfetti() {
    const cv = g('confetti-canvas'); if (!cv) return;
    const ctx = cv.getContext('2d'); cv.width = innerWidth; cv.height = innerHeight; cv.style.display = 'block';
    const colors = ['#d6b076','#f1dfb7','#d4a24a','#ffd166','#e43f5a','#3ddc84','#3aa0ff','#a865ff'], parts = [];
    for (let i = 0; i < 140; i++) parts.push({ x: Math.random() * cv.width, y: -20 - Math.random() * 120, vx: (Math.random() - .5) * 5, vy: 2 + Math.random() * 5, w: 6 + Math.random() * 8, h: 10 + Math.random() * 12, color: colors[Math.floor(Math.random() * colors.length)], rot: Math.random() * 6.28, vr: (Math.random() - .5) * .25 });
    let flash = document.querySelector('.confetti-flash');
    if (!flash) { flash = document.createElement('div'); flash.className = 'confetti-flash'; document.body.appendChild(flash); }
    requestAnimationFrame(() => flash.classList.add('on'));
    setTimeout(() => { flash.classList.remove('on'); setTimeout(() => flash.remove(), 600); }, 220);
    const t0 = performance.now();
    const tick = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      parts.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .05; p.rot += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore(); });
      if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else { ctx.clearRect(0, 0, cv.width, cv.height); cv.style.display = 'none'; }
    };
    requestAnimationFrame(tick);
  }
  function showFireworks() {
    const cv = g('fireworks-canvas'); if (!cv) return;
    const ctx = cv.getContext('2d'); cv.width = innerWidth; cv.height = innerHeight; cv.style.display = 'block';
    const colors = ['#d6b076','#f1dfb7','#d4a24a','#ffd166','#e43f5a','#3ddc84','#3aa0ff','#a865ff','#ff9d3c'], rockets = [], sparks = [];
    for (let r = 0; r < 3; r++) setTimeout(() => rockets.push({ x: cv.width * (.2 + .6 * Math.random()), y: cv.height, vy: -12 - Math.random() * 4, ty: cv.height * (.15 + .3 * Math.random()) }), r * 600);
    const t0 = performance.now();
    const tick = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i]; r.y += r.vy;
        ctx.save(); ctx.fillStyle = '#fff'; ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(r.x, r.y, 3, 0, 6.28); ctx.fill(); ctx.restore();
        if (r.y <= r.ty) {
          const n = 40 + Math.floor(Math.random() * 30), col = colors[Math.floor(Math.random() * colors.length)];
          for (let k = 0; k < n; k++) { const a = Math.random() * 6.28, sp = 2 + Math.random() * 5; sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 60 + Math.random() * 30, max: 90, color: col }); }
          rockets.splice(i, 1);
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]; s.x += s.vx; s.y += s.vy; s.vy += .08; s.vx *= .98; s.vy *= .98; s.life--;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        ctx.save(); ctx.globalAlpha = Math.max(0, s.life / s.max); ctx.fillStyle = s.color; ctx.shadowColor = s.color; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(s.x, s.y, 2.2, 0, 6.28); ctx.fill(); ctx.restore();
      }
      if (performance.now() - t0 < 4000 || rockets.length || sparks.length) requestAnimationFrame(tick); else { ctx.clearRect(0, 0, cv.width, cv.height); cv.style.display = 'none'; }
    };
    requestAnimationFrame(tick);
  }

  function bankruptPlayer(pid, why) {
    const p = Game.players[pid]; if (!p || !p.alive) return;
    p.alive = false;
    p.money = 0;
    owner.forEach((o, i) => { if (o === pid) { setOwner(i, null); stars[i] = 0; renderStars(i); } });
    inJail[pid] = false; loans[pid] = null; jailAttempts[pid] = 0;
    glog(`💥 ${p.name} ${why || 'обанкротился'}!`);
    try { handleAuctionLeave(pid); } catch (e) { console.error('handleAuctionLeave:', e); }
    renderPlayers();
  }
  function checkBankrupt() { Game.players.forEach(p => { if (p.alive && p.money < 0) bankruptPlayer(p.id); }); }
  function doBankruptManual(pid) {
    const p = Game.players[pid]; if (!p || !p.alive) return;
    bankruptPlayer(pid, 'объявил банкротство');
    Object.values(pend).forEach(e => { if (e.pid === pid) e.fn(null); });
    if (cur === pid && !busy) { stopTurnTimer(); bc({ v: 'turn', pid: -1 }); next(); }
    else { const alive = Game.players.filter(x => x.alive); if (alive.length <= 1) gameOver(alive[0]); }
  }
  function doLoan(pid) {
    const p = Game.players[pid]; if (!p || !p.alive) return;
    if (loans[pid]) return notice(pid, 'Кредит уже взят');
    loans[pid] = { amount: 750, turnsLeft: 10 }; p.money += 500;
    glog(`${p.name} взял кредит 500 € (вернуть 750 € через 10 ходов)`); renderPlayers();
  }
  function tickLoans() {
    Game.players.forEach((p, i) => {
      const L = loans[i]; if (!L || !p.alive) return;
      L.turnsLeft--;
      if (L.turnsLeft <= 0) {
        loans[i] = null;
        if (p.money >= L.amount) { p.money -= L.amount; glog(`${p.name} погасил кредит ${L.amount} €`); }
        else bankruptPlayer(i, 'не смог погасить кредит — банкрот');
      }
    });
  }

  async function applyCell(p, idx, passedStart) {
    try {
      if (passedStart) { p.money += START_BONUS; glog(`${p.name}: +${START_BONUS} € за проход СТАРТ`); }
      const c = CELLS[idx];
      if (c.t === 'biz') {
        const price = BIZ[c.key].price;
        if (owner[idx] == null) {
          if (p.bot) {
            if (p.money - price >= BOT_RESERVE) {
              p.money -= price; setOwner(idx, p.id); glog(`${p.name} купил «${c.n}» за ${price} €`);
              const mono = checkMonopoly(p.id); if (mono) { renderPlayers(); await monopolyFx(p.id, mono.cells); }
            } else { glog(`${p.name}: не хватает на «${c.n}» — аукцион`); auctionStart(idx, p.id, false, [p.id]); }
          } else {
            const res = await ask(p.id, 'buy', { idx, price, money: p.money }, BUY_TIMEOUT_MS + 5000, 'auction');
            if (!p.alive) return;
            if (res === 'buy') {
              if (p.money >= price) {
                p.money -= price; setOwner(idx, p.id); glog(`${p.name} купил «${c.n}» за ${price} €`);
                const mono = checkMonopoly(p.id); if (mono) { renderPlayers(); await monopolyFx(p.id, mono.cells); }
              } else notice(p.id, 'Не хватает денег');
            } else if (res === 'auction') { glog(`${p.name} отказался от покупки — аукцион по «${c.n}»`); auctionStart(idx, p.id, false, []); }
          }
        } else if (owner[idx] !== p.id) {
          const ownerP = Game.players[owner[idx]], st = stars[idx], rent = Math.round(BIZ[c.key].rent * RENT_MULT[st]);
          glog(`${p.name} должен оплатить ${rent} € ренты «${c.n}» (${st}★) игроку ${ownerP.name}`);
          const ok = await ensureSolvency(p, rent);
          if (!ok || !p.alive) { renderPlayers(); return; }
          p.money -= rent; ownerP.money += rent;
          glog(`${p.name} заплатил ${rent} € ренты «${c.n}» (${st}★) игроку ${ownerP.name}`);
        }
        renderPlayers(); return;
      }
      if (c.k === 'plus')  { p.money += 100; glog(`${p.name}: +100 €`); }
      if (c.k === 'minus') {
        const ok = await ensureSolvency(p, 100);
        if (!ok || !p.alive) { renderPlayers(); return; }
        p.money -= 100;
        glog(`${p.name}: −100 €`);
      }
      if (c.k === 'doctor') { skipNext[p.id] = true; try { Sound.doctor(); } catch (e) {} glog(`${p.name}: врач — пропуск хода`); }
      if (c.k === 'back') { reverseNext[p.id] = true; glog(`${p.name}: следующий ход назад`); }
      if (c.k === 'tp') {
        const t = Math.floor(Math.random() * N);
        await V({ v: 'tp', pid: p.id, to: t });
        glog(`${p.name}: телепорт на «${CELLS[t].n}»`);
        return applyCell(p, t, false);
      }
      if (c.n === 'Тюрьма') {
        await V({ v: 'jail', name: p.name });
        inJail[p.id] = true;
        jailAttempts[p.id] = 0;
        jailFee[p.id] = JAIL_BASE;
        glog(`${p.name} отправлен в тюрьму. Ход пропущен.`);
      }
      if (c.n === 'Казино') {
        const delta = Math.floor(Math.random() * 601) - 300;
        if (delta === 0) glog(`${p.name} в казино: ровно 0 €`);
        else if (delta > 0) { p.money += delta; glog(`${p.name} в казино: +${delta} €`); }
        else {
          const ok = await ensureSolvency(p, -delta);
          if (!ok || !p.alive) { renderPlayers(); return; }
          p.money += delta;
          glog(`${p.name} в казино: ${delta} €`);
        }
      }
      if (c.n === 'СТАРТ') glog(`${p.name} на СТАРТе`);
      if (c.n === 'Отдых') glog(`${p.name} отдыхает`);
      renderPlayers();
    } catch (err) { console.error('applyCell:', err); try { renderPlayers(); } catch (e) {} }
  }

  async function jailSequence(p) {
    const my = session;
    const attempt = (jailAttempts[p.id] || 0) + 1;
    const canRoll = attempt <= JAIL_MAX_ATTEMPTS;
    const canPay = p.money >= jailFee[p.id];

    if (!canRoll) {
      if (!canPay) {
        glog(`${p.name}: ${JAIL_MAX_ATTEMPTS} попыток в тюрьме, не хватает на выкуп ${jailFee[p.id]} € — банкрот`);
        bankruptPlayer(p.id, 'не смог выкупиться из тюрьмы');
        return;
      }
      p.money -= jailFee[p.id];
      inJail[p.id] = false;
      jailAttempts[p.id] = 0;
      glog(`${p.name}: попытки исчерпаны, платит ${jailFee[p.id]} € и выходит`);
      renderPlayers();
      return;
    }

    jailAttempts[p.id] = attempt;
    renderPlayers();

    let choice;
    if (p.bot) {
      choice = (canPay && Math.random() < 0.7) ? 'pay' : 'roll';
    } else {
      choice = await ask(p.id, 'jail', { fee: jailFee[p.id], attempt, max: JAIL_MAX_ATTEMPTS }, JAIL_TIMEOUT_MS + 5000, 'roll');
    }
    if (!p.alive) return;
    if (my !== session) return;

    if (choice === 'pay') {
      const fee = jailFee[p.id];
      const ok = await ensureSolvency(p, fee);
      if (!ok || !p.alive) { renderPlayers(); return; }
      p.money -= fee;
      inJail[p.id] = false;
      jailAttempts[p.id] = 0;
      glog(`${p.name} заплатил ${fee} € и вышел из тюрьмы`);
      renderPlayers();
      return;
    }

    if (choice === 'bankrupt') {
      bankruptPlayer(p.id, 'не смог выкупиться из тюрьмы');
      return;
    }

    const a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6);
    await V({ v: 'dice', a, b });
    if (my !== session) return;

    glog(`${p.name} бросает кубики: ${a} и ${b} (${a + b}). Попытка ${attempt}/${JAIL_MAX_ATTEMPTS}.`);
    if (a + b === 2) {
      inJail[p.id] = false;
      jailAttempts[p.id] = 0;
      glog(`${p.name} выбросил дубль 2 и вышел!`);
    } else {
      jailFee[p.id] = Math.round(jailFee[p.id] * (1 + JAIL_GROW));
      glog(`${p.name}: не вышел. Новый выкуп: ${jailFee[p.id]} €`);
    }
    renderPlayers();
  }

  const aucMin = () => auction.lastBid == null ? auction.startPrice : auction.lastBid + AUCTION_STEP;
  function auctionStart(idx, creator, fromOwner, blocked) {
    if (auction && !auction.finished) return false;
    const c = CELLS[idx], startPrice = BIZ[c.key].price, id = ++auctionSeq;
    abc({ ev: 'start', id, idx, startPrice, fromOwner: !!fromOwner, creator, blocked: blocked || [], lot: c.n });
    glog(`📨 Аукцион: «${c.n}», старт ${startPrice} €. Проверьте почту или нажмите на это сообщение.`, 'log-mail', id);
    return true;
  }
  function abc(m) { aucApply(m); bc({ v: 'auc', ...m }); }

  function aucApply(m) {
    if (m.ev === 'start') {
      auction = {
        id: m.id, idx: m.idx, startPrice: m.startPrice, fromOwner: m.fromOwner, creator: m.creator,
        blocked: new Set(m.blocked), lastBid: null, leader: null, phase: 'invite',
        deadline: performance.now() + AUCTION_INVITE_MS, startedAt: performance.now(),
        hist: [`Старт: ${m.startPrice} €`, `Приглашение (${AUCTION_INVITE_MS/1000} с)`], finished: false, result: null
      };
      aucSyncTick = 0;
      if (Game.players[ME] && Game.players[ME].alive) {
        mailInbox.push({ id: uid(), auctionId: m.id, lotName: m.lot, startPrice: m.startPrice, time: Date.now(), read: false });
        try { Sound.letter(); } catch (e) {}
        toast(`📨 Аукцион: ${m.lot} — зайдите в почту`);
      }
      g('auc-input').value = ''; g('auc-status').textContent = '';
      aucRender(); renderPlayers(); if (Modal_isOpen('mailbox')) renderMailbox();
      return;
    }

    if (!auction || auction.id !== m.id) return;

    if (m.ev === 'phase') {
      auction.phase = m.phase;
      if (m.phase === 'trade') { auction.deadline = performance.now() + AUCTION_TRADE_MS; auction.hist.push(`Торги (${AUCTION_TRADE_MS/1000} с)`); }
      if (Modal_isOpen('auction')) aucRender();
    } else if (m.ev === 'bid') {
      if (auction.finished) return;
      auction.lastBid = m.amount; auction.leader = m.pid;
      if (auction.phase === 'trade') auction.deadline = performance.now() + AUCTION_TRADE_MS;
      auction.hist.push(`${m.name}: ${m.amount} €`);
      g('auc-status').textContent = ''; aucRender();
    } else if (m.ev === 'sync') {
      auction.phase = m.phase || auction.phase;
      if (m.leader !== undefined) auction.leader = m.leader;
      if (m.lastBid !== undefined) auction.lastBid = m.lastBid;
      if (typeof m.remaining === 'number') auction.deadline = performance.now() + Math.max(0, m.remaining);
      if (m.finished && !auction.finished) {
        auction.finished = true;
        auction.result = m.result || { sold: false, winner: null, price: null };
        aucRender(); renderPlayers(); if (Modal_isOpen('mailbox')) renderMailbox();
        const id = m.id;
        setTimeout(() => { if (auction && auction.id === id) { Modal.close('auction'); auction = null; renderPlayers(); } }, 3500);
      } else if (Modal_isOpen('auction')) aucRender();
    } else if (m.ev === 'reset') {
      if (auction.finished) return;
      auction.leader = null;
      auction.lastBid = null;
      auction.hist.push(m.msg || 'Ставка сброшена');
      if (typeof m.remaining === 'number' && m.remaining > 0) auction.deadline = performance.now() + m.remaining;
      if (Modal_isOpen('auction')) aucRender();
    } else if (m.ev === 'end') {
      const wasFinished = auction.finished;
      auction.finished = true;
      auction.result = m;
      mailInbox.forEach(x => { if (x.auctionId === m.id) x.read = true; });
      aucRender(); renderPlayers(); if (Modal_isOpen('mailbox')) renderMailbox();
      if (!wasFinished) {
        const lot = CELLS[auction.idx].n;
        const txt = m.sold
          ? `🏆 Аукцион: ${Game.players[m.winner] ? Game.players[m.winner].name : '—'} забрал «${lot}» за ${m.price} €`
          : `Аукцион по «${lot}» не состоялся`;
        if (!Modal_isOpen('auction')) toast(txt);
        const id = m.id;
        setTimeout(() => { if (auction && auction.id === id) { Modal.close('auction'); auction = null; renderPlayers(); } }, 3500);
      }
    } else if (m.ev === 'reject') aucRejectUI(m.msg);
  }

  function aucRender() {
    const a = auction; if (!a) return;
    const c = CELLS[a.idx], me = Game.players[ME];
    g('auc-img').src = `img/${c.img}.png`; g('auc-name').textContent = c.n;
    g('auc-start').textContent = a.startPrice + ' €';
    g('auc-seller').textContent = a.fromOwner ? Game.players[a.creator].name : 'Банк';
    g('auc-leader-sum').textContent = a.lastBid == null ? '— €' : a.lastBid + ' €';
    g('auc-leader-name').textContent = a.leader == null ? 'Ставок пока нет' : Game.players[a.leader].name;
    g('auc-leader').classList.toggle('mine', a.leader === ME);
    g('auc-history').innerHTML = a.hist.slice().reverse().map((h, i) => `<div class="${i === 0 ? 'top' : ''}">${esc(h)}</div>`).join('');
    const isOwner = a.fromOwner && a.creator === ME;
    const can = !a.finished && a.phase === 'trade' && me && me.alive && !a.blocked.has(ME) && !isOwner;
    g('auc-actions').style.display = can ? '' : 'none';
    const r = a.result;
    g('auc-note').textContent = a.finished
      ? (r && r.sold ? `🏆 ${Game.players[r.winner].name} забирает «${c.n}» за ${r.price} €` : 'Аукцион не состоялся — ставок не было')
      : a.phase === 'invite' ? 'Приглашение — подождите, скоро начнутся торги'
      : isOwner ? 'Это ваш лот — вы наблюдаете за торгами' : (!can ? 'Вы наблюдаете за торгами' : '');
    if (can) { g('auc-input').placeholder = `от ${aucMin()} €`; g('auc-balance').textContent = `Ваш баланс: ${me.money} €`; }
    g('auction').classList.toggle('done', a.finished);
    aucTick();
  }

  function aucTick() {
    const a = auction; if (!a) return;
    const now = performance.now();

    if (!a.finished && IS_HOST) {
      if (++aucSyncTick >= AUCTION_SYNC_EVERY) {
        aucSyncTick = 0;
        bc({ v: 'auc', ev: 'sync', id: a.id,
             phase: a.phase, leader: a.leader, lastBid: a.lastBid,
             remaining: Math.max(0, a.deadline - now),
             finished: a.finished, result: a.result });
      }
    }

    if (!a.finished && IS_HOST && a.startedAt && now - a.startedAt > AUCTION_HARD_LIMIT) {
      console.warn('[auction] hard limit exceeded, forcing finish');
      try { finishAuction(); } catch (e) { console.error('[auction] finishAuction failed:', e); }
      return;
    }

    if (!a.finished && !IS_HOST && a.deadline && now - a.deadline > AUCTION_CLIENT_FALLBACK_MS) {
      console.warn('[auction] client fallback: end not received');
      a.finished = true;
      a.result = { sold: false, winner: null, price: null };
      if (Modal_isOpen('auction')) aucRender();
      renderPlayers();
      return;
    }

    let left = a.finished ? 0 : Math.max(0, a.deadline - now);

    if (!a.finished && a.phase === 'invite' && left <= 0) {
      if (IS_HOST) {
        a.phase = 'trade'; a.deadline = now + AUCTION_TRADE_MS;
        a.hist.push(`Торги (${AUCTION_TRADE_MS/1000} с)`);
        if (MP) bc({ v: 'auc', ev: 'phase', id: a.id, phase: 'trade' });
        left = AUCTION_TRADE_MS;
        if (Modal_isOpen('auction')) aucRender();
      }
    }
    if (!a.finished && a.phase === 'trade' && left <= 0) {
      if (IS_HOST) {
        try { finishAuction(); } catch (e) { console.error('[auction] finishAuction failed:', e); }
      }
      return;
    }

    if (Modal_isOpen('auction')) {
      g('auc-time').textContent = a.finished ? '✓' : Math.ceil(left / 1000);
      const total = a.phase === 'invite' ? AUCTION_INVITE_MS : AUCTION_TRADE_MS;
      g('auc-ring').style.strokeDashoffset = (339.3 * (1 - left / total)).toFixed(1);
      g('auc-ring').classList.toggle('hot', !a.finished && a.phase === 'trade' && left < 5000);
      g('auc-phase').textContent = a.finished ? 'Завершён' : a.phase === 'invite' ? 'Приглашение' : (a.lastBid == null ? 'Ожидание ставок' : 'Ставка держится');
    }
  }
  setInterval(aucTick, 200);

  let aucStatT = 0;
  function aucRejectUI(msg) { g('auc-status').textContent = msg; try { Sound.error(); } catch (e) {} clearTimeout(aucStatT); aucStatT = setTimeout(() => { g('auc-status').textContent = ''; }, 3500); }
  function openAuctionPage() { if (!auction) { toast('Этот аукцион уже завершён'); try { Sound.error(); } catch (e) {} return; } aucRender(); Modal.open('auction'); }

  function placeBid(pid, amount) {
    const a = auction, p = Game.players[pid];
    const rej = msg => { if (pid === ME) aucRejectUI(msg); else bc({ v: 'auc', ev: 'reject', msg }, [pid]); return false; };
    if (!a || a.finished) return rej('Аукцион уже завершён');
    if (a.phase === 'invite') return rej('Торги ещё не начались — подождите');
    if (!p || !p.alive) return rej('Вы не можете участвовать');
    if (a.blocked.has(pid) || (a.fromOwner && a.creator === pid)) return rej('Вы не можете делать ставки на этом аукционе');
    amount = Math.floor(+amount);
    const min = a.lastBid == null ? a.startPrice : a.lastBid + AUCTION_STEP;
    if (!(amount >= min)) return rej(`Минимальная ставка: ${min} €`);
    if (p.money < amount) return rej('Недостаточно денег');
    if (p.bot && p.money - amount < BOT_BID_MIN) return false;
    if (a.leader === pid) return rej('Ваша ставка уже лидирует');
    abc({ ev: 'bid', id: a.id, pid, amount, name: p.name });
    glog(`${p.name} поставил ${amount} € на «${CELLS[a.idx].n}»`);
    return true;
  }

  function broadcastAucEnd(a, sold, winner, price) {
    const msg = { ev: 'end', id: a.id, sold, winner, price };
    try { abc(msg); } catch (e) { console.error('bc end #1', e); }
    setTimeout(() => { try { bc({ v: 'auc', ...msg }); } catch (e) { console.error('bc end #2', e); } }, 800);
    setTimeout(() => { try { bc({ v: 'auc', ...msg }); } catch (e) { console.error('bc end #3', e); } }, 2500);
  }

  function finishAuction() {
    if (!IS_HOST) return;
    const a = auction; if (!a || a.finished) return;
    a.finished = true;
    try {
      const idx = a.idx, lot = CELLS[idx].n;
      let sold = false, winner = a.leader, price = a.lastBid;
      if (winner != null && price != null) {
        const w = Game.players[winner];
        if (w && w.alive && w.money >= price) {
          sold = true; w.money -= price;
          if (a.fromOwner) {
            const seller = Game.players[a.creator];
            if (seller && seller.alive) seller.money += price;
          }
          setOwner(idx, winner);
          glog(`🏆 ${w.name} выиграл аукцион на «${lot}» за ${price} €${a.fromOwner ? '' : ' (деньги банку)'}`);
        } else {
          winner = null;
          glog(`Аукцион по «${lot}» отменён — у победителя не хватило денег`);
        }
      } else glog(`Аукцион по «${lot}» не состоялся — ставок не было`);
      broadcastAucEnd(a, sold, winner, price);
      renderPlayers();
      if (sold) { try { const mono = checkMonopoly(winner); if (mono) monopolyFx(winner, mono.cells); } catch (e) { console.error(e); } }
      setTimeout(() => { if (turnBlocked) { turnBlocked = false; if (!busy && !over) beginTurn(); } }, 3700);
    } catch (err) {
      console.error('finishAuction error:', err);
      broadcastAucEnd(a, false, null, null);
    }
  }

  function handleAuctionLeave(pid) {
    if (!auction || auction.finished) return;
    if (auction.leader === pid) {
      auction.leader = null;
      auction.lastBid = null;
      auction.hist.push(`Лидер вышел из игры`);
      let rem = 0;
      if (auction.phase === 'trade') {
        const now = performance.now();
        const cur = Math.max(0, auction.deadline - now);
        rem = Math.max(AUCTION_LEADER_LEAVE_EXTEND, cur);
        auction.deadline = now + rem;
      }
      if (MP) bc({ v: 'auc', ev: 'reset', id: auction.id, msg: 'Лидер вышел из игры', remaining: rem });
      if (Modal_isOpen('auction')) aucRender();
    }
  }

  function botBidStep() {
    if (MP || !auction || auction.finished) return;
    if (auction.phase !== 'trade') return;
    Game.players.forEach((p, i) => {
      if (!p.bot || !p.alive || auction.blocked.has(i) || (auction.fromOwner && auction.creator === i) || auction.leader === i) return;
      const min = aucMin();
      if (p.money - min < BOT_BID_MIN) return;
      if (Math.random() < 0.35) placeBid(i, min + AUCTION_STEP * Math.floor(Math.random() * 3));
    });
  }
  setInterval(botBidStep, 2500);

  g('auc-quick').addEventListener('click', e => {
    const b = e.target.closest('[data-q]'); if (!b || !auction || auction.finished) return;
    const q = +b.dataset.q, base = auction.lastBid == null ? auction.startPrice : auction.lastBid;
    g('auc-input').value = q === 0 ? aucMin() : base + q;
  });
  function submitBid() {
    const a = auction; if (!a || a.finished) return;
    if (a.phase !== 'trade') { aucRejectUI('Торги ещё не начались'); return; }
    const v = parseInt(g('auc-input').value || '0', 10);
    if (!v) { aucRejectUI('Введите сумму ставки'); return; }
    if (IS_HOST) placeBid(ME, v); else toHost({ a: 'bid', amount: v });
  }
  g('auc-bid').addEventListener('click', submitBid);
  g('auc-input').addEventListener('keydown', e => { if (e.key === 'Enter') submitBid(); });

  function renderMailbox() {
    const body = g('mail-body'); if (!body) return;
    const list = mailInbox.slice().sort((a, b) => b.time - a.time);
    if (!list.length) { body.innerHTML = `<div class="mail-empty">Пока пусто. Приглашения на аукционы появятся здесь.</div>`; return; }
    body.innerHTML = list.map(m => {
      const live = auction && auction.id === m.auctionId && !auction.finished;
      if (!live && !m.read) m.read = true;
      const ago = new Date(m.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      return `<div class="mail-item ${!live ? 'read' : ''}" data-mail-id="${m.id}">
        <div class="mi-title">Аукцион: ${esc(m.lotName)}</div>
        <div class="mi-sub">Старт: ${m.startPrice} €${!live ? ' · завершён' : ' · идёт'}</div><div class="mi-time">${ago}</div></div>`;
    }).join('');
    body.querySelectorAll('.mail-item').forEach(el => el.addEventListener('click', () => {
      const m = mailInbox.find(x => x.id === el.dataset.mailId); if (!m) return;
      const live = auction && auction.id === m.auctionId && !auction.finished;
      if (live) { Modal.close('mailbox'); openAuctionPage(); } else { try { Sound.error(); } catch (e) {} }
      renderMailbox(); renderPlayers();
    }));
  }

  const Modal_isOpen = id => g(id).classList.contains('show');
  function openInteract(i) {
    const p = Game.players[i]; if (!p || !p.alive) return;
    interactTarget = i;
    g('interact-title').textContent = p.name;
    g('interact-desc').textContent = `Баланс: ${p.money} € · Итого: ${totalWorth(i)} €`;
    Modal.open('interact');
  }
  g('ia-close').addEventListener('click', () => Modal.close('interact'));
  g('ia-msg').addEventListener('click', () => { Modal.close('interact'); if (interactTarget != null) openChat(interactTarget); });

  function openChat(pid) {
    g('chat-title').textContent = `Чат с ${Game.players[pid].name}`;
    interactTarget = pid; chatUnread[pid] = false;
    if (!chatState[pid]) chatState[pid] = [];
    renderChat(pid); renderPlayers(); Modal.open('chat');
    setTimeout(() => g('chat-input').focus(), 200);
  }
  function renderChat(pid) {
    const body = g('chat-body'), them = Game.players[pid];
    body.innerHTML = (chatState[pid] || []).map(m => m.kind === 'text'
      ? `<div class="msg ${m.from === 'me' ? 'me' : ''}"><div class="bubble">${esc(m.text)}</div></div>`
      : renderFormCard(m, them)).join('');
    body.scrollTop = body.scrollHeight;
  }
  function sendChat() {
    const inp = g('chat-input'), text = inp.value.trim().slice(0, 200), to = interactTarget;
    if (!text || to == null) return;
    (chatState[to] = chatState[to] || []).push({ id: uid(), from: 'me', kind: 'text', text });
    inp.value = ''; renderChat(to); try { Sound.msgSend(); } catch (e) {}
    if (Game.players[to].bot) { setTimeout(() => rxChat(to, 'не пиши мне ублюдок'), 800 + Math.random() * 700); return; }
    if (IS_HOST) relayChat(ME, to, text); else toHost({ a: 'chat', to, text });
  }
  function relayChat(from, to, text) { if (!Game.players[to]) return; if (to === ME) rxChat(from, text); else bc({ v: 'chat', from, text }, [to]); }
  function rxChat(from, text) {
    (chatState[from] = chatState[from] || []).push({ id: uid(), from: 'them', kind: 'text', text });
    if (Modal_isOpen('chat') && interactTarget === from) renderChat(from);
    else { chatUnread[from] = true; toast(`✉ ${Game.players[from].name}: ${String(text).slice(0, 40)}`); try { Sound.letter(); } catch (e) {} renderPlayers(); }
  }
  g('chat-send').addEventListener('click', sendChat);
  g('chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
  g('chat-more').addEventListener('click', e => { e.stopPropagation(); g('chat-menu').classList.toggle('open'); });
  document.addEventListener('click', e => { if (!e.target.closest('#chat-menu') && !e.target.closest('#chat-more')) g('chat-menu').classList.remove('open'); });
  ['buy', 'sell', 'ask', 'give', 'swap'].forEach(t => g('chat-menu-' + t).addEventListener('click', () => { g('chat-menu').classList.remove('open'); openForm(t); }));

  const formTitle = t => ({ buy: 'Покупка бизнеса', sell: 'Продажа бизнеса', ask: 'Просьба денег', give: 'Передача денег', swap: 'Обмен бизнесами' }[t] || 'Сделка');
  function formBody(f) {
    if (f.type === 'buy') return `Бизнес: <b>${CELLS[f.idx].n}</b> · Сумма: <b>${f.sum} €</b>`;
    if (f.type === 'sell') return `Бизнес: <b>${CELLS[f.idx].n}</b> · Цена: <b>${f.sum} €</b>`;
    if (f.type === 'ask' || f.type === 'give') return `Сумма: <b>${f.sum} €</b>`;
    const side = f.paySide === 'me' ? 'Доплата от предлагающего' : f.paySide === 'them' ? 'Доплата от получателя' : 'Без доплаты';
    return `Предлагают: <b>${CELLS[f.mine].n}</b> ↔ Просят: <b>${CELLS[f.theirs].n}</b><br>${side}${f.paySide === 'none' ? '' : ` · <b>${f.sum} €</b>`}`;
  }
  function renderFormCard(m, them) {
    const f = m.form, who = m.from === 'me' ? 'Вы' : esc(them.name), st = m.status; let s;
    if (st === 'pending' && m.from === 'them') s = m.busy ? `<div class="form-status pending">Отправка…</div>`
      : `<div class="form-btns"><button class="btn main" data-form-ok="${m.id}">Согласиться</button><button class="btn" data-form-no="${m.id}">Отказать</button></div>`;
    else if (st === 'pending') s = `<div class="form-status pending">Ожидает ответа…</div>`;
    else if (st === 'accepted') s = `<div class="form-status accepted">✅ Согласовано</div>`;
    else s = `<div class="form-status declined">❌ Отказано${m.reason ? ' · ' + esc(m.reason) : ''}</div>`;
    return `<div class="msg form-msg ${m.from === 'me' ? 'me' : ''}"><div class="form-card ${st}"><div class="form-head">${formTitle(f.type)} · ${who}</div><div class="form-body">${formBody(f)}</div>${s}</div></div>`;
  }
  const bidx = pid => { const a = []; owner.forEach((o, i) => { if (o === pid) a.push(i); }); return a; };
  function fillBizSelect(sel, list) {
    sel.innerHTML = list.length ? list.map(i => `<option value="${i}">${CELLS[i].n}${stars[i] ? ' ' + '★'.repeat(stars[i]) : ''} — ${bizMarketValue(i)} €</option>`).join('') : `<option value="">— нет бизнесов —</option>`;
  }
  function openForm(type) {
    const pid = interactTarget; if (pid == null) return;
    const dis = (id, off) => { const b = g(id); b.disabled = off; b.classList.toggle('disabled', off); };
    if (type === 'buy') { const l = bidx(pid); fillBizSelect(g('frm-buy-select'), l); g('frm-buy-sum').value = ''; g('frm-buy-err').textContent = ''; dis('frm-buy-send', !l.length); Modal.open('frm-buy'); }
    if (type === 'sell') { const l = bidx(ME); fillBizSelect(g('frm-sell-select'), l); g('frm-sell-sum').value = ''; g('frm-sell-err').textContent = ''; dis('frm-sell-send', !l.length); Modal.open('frm-sell'); }
    if (type === 'ask') { g('frm-ask-sum').value = ''; g('frm-ask-err').textContent = ''; Modal.open('frm-ask'); }
    if (type === 'give') { g('frm-give-sum').value = ''; g('frm-give-err').textContent = ''; Modal.open('frm-give'); }
    if (type === 'swap') { fillBizSelect(g('frm-swap-mine'), bidx(ME)); fillBizSelect(g('frm-swap-theirs'), bidx(pid)); g('frm-swap-side').value = 'none'; g('frm-swap-sum').value = ''; g('frm-swap-err').textContent = ''; dis('frm-swap-send', !(bidx(ME).length && bidx(pid).length)); Modal.open('frm-swap'); }
  }
  function cleanForm(f) {
    if (!f) return null;
    const n = v => Math.max(0, Math.floor(+v) || 0), biz = i => (CELLS[i] && CELLS[i].t === 'biz') ? +i : -1, t = f.type;
    if (t === 'buy' || t === 'sell') { const idx = biz(f.idx); return idx < 0 ? null : { type: t, idx, sum: n(f.sum) }; }
    if (t === 'ask' || t === 'give') return { type: t, sum: n(f.sum) };
    if (t === 'swap') { const m = biz(f.mine), th = biz(f.theirs); if (m < 0 || th < 0) return null; const ps = ['me', 'them', 'none'].includes(f.paySide) ? f.paySide : 'none'; return { type: t, mine: m, theirs: th, paySide: ps, sum: ps === 'none' ? 0 : n(f.sum) }; }
    return null;
  }
  function pushForm(type, data) {
    const to = interactTarget; if (to == null) return;
    const id = uid(), msg = { id, from: 'me', kind: 'form', form: { type, ...data }, status: 'pending', peer: to };
    (chatState[to] = chatState[to] || []).push(msg);
    renderChat(to); try { Sound.msgSend(); } catch (e) {}
    const p = Game.players[to];
    if (p.bot) { setTimeout(() => { setFormStatus(id, 'declined', ''); log(`${p.name} отклонил сделку`); }, 1200 + Math.random() * 800); return; }
    if (IS_HOST) hostForm(ME, to, id, msg.form); else toHost({ a: 'form', to, id, form: msg.form });
  }
  const findFormMsg = id => { for (const k in chatState) { const m = chatState[k].find(x => x.id === id); if (m) return m; } return null; };
  function setFormStatus(id, status, reason) { const m = findFormMsg(id); if (!m) return; m.status = status; m.reason = reason || ''; m.busy = false; if (Modal_isOpen('chat') && interactTarget === m.peer) renderChat(m.peer); }
  function tell(seat, d) { if (seat === ME) doImm(d); else bc(d, [seat]); }
  function hostForm(from, to, id, form) {
    const f = cleanForm(form), T = Game.players[to], S = Game.players[from];
    if (!f || !T || !T.alive || !S || !S.alive || to === from) { tell(from, { v: 'formst', id, status: 'declined', reason: 'нельзя отправить' }); return; }
    forms[id] = { from, to, form: f, done: false };
    tell(to, { v: 'form', from, id, form: f });
  }
  function rxForm(from, id, form) {
    (chatState[from] = chatState[from] || []).push({ id, from: 'them', kind: 'form', form, status: 'pending', peer: from });
    if (Modal_isOpen('chat') && interactTarget === from) renderChat(from);
    else { chatUnread[from] = true; toast(`📨 ${Game.players[from].name}: ${formTitle(form.type).toLowerCase()}`); try { Sound.letter(); } catch (e) {} renderPlayers(); }
  }
  function applyDeal(S, R, f) {
    const ok = (c, why) => c ? '' : why;
    let r = '';
    switch (f.type) {
      case 'buy':  r = ok(owner[f.idx] === R.id, 'бизнес уже сменил владельца') || ok(S.money >= f.sum, 'не хватает денег'); if (r) return r; S.money -= f.sum; R.money += f.sum; setOwner(f.idx, S.id); break;
      case 'sell': r = ok(owner[f.idx] === S.id, 'бизнес уже сменил владельца') || ok(R.money >= f.sum, 'не хватает денег'); if (r) return r; R.money -= f.sum; S.money += f.sum; setOwner(f.idx, R.id); break;
      case 'ask':  r = ok(R.money >= f.sum, 'не хватает денег'); if (r) return r; R.money -= f.sum; S.money += f.sum; break;
      case 'give': r = ok(S.money >= f.sum, 'не хватает денег'); if (r) return r; S.money -= f.sum; R.money += f.sum; break;
      case 'swap': r = ok(owner[f.mine] === S.id && owner[f.theirs] === R.id, 'бизнес уже сменил владельца') || ok(f.paySide !== 'me' || S.money >= f.sum, 'не хватает денег на доплату') || ok(f.paySide !== 'them' || R.money >= f.sum, 'не хватает денег на доплату'); if (r) return r; setOwner(f.mine, R.id); setOwner(f.theirs, S.id); if (f.paySide === 'me') { S.money -= f.sum; R.money += f.sum; } if (f.paySide === 'them') { R.money -= f.sum; S.money += f.sum; } break;
    }
    return '';
  }
  function hostFormRes(seat, id, accept) {
    const f = forms[id]; if (!f || f.done || f.to !== seat) return;
    f.done = true;
    const S = Game.players[f.from], R = Game.players[f.to];
    let reason = '';
    if (accept) reason = (S.alive && R.alive) ? applyDeal(S, R, f.form) : 'игрок выбыл';
    const status = accept && !reason ? 'accepted' : 'declined';
    [f.from, f.to].forEach(s => tell(s, { v: 'formst', id, status, reason }));
    if (status === 'accepted') {
      glog(`🤝 ${S.name} и ${R.name} заключили сделку`);
      const m1 = checkMonopoly(S.id), m2 = checkMonopoly(R.id);
      renderPlayers(); V({ v: 'deal', pids: [S.id, R.id] });
      if (m1) monopolyFx(S.id, m1.cells); if (m2) monopolyFx(R.id, m2.cells);
    } else if (accept) glog(`Сделка ${S.name} и ${R.name} отклонена: ${reason}`);
  }
  function answerForm(id, accept) {
    const m = findFormMsg(id); if (!m || m.status !== 'pending' || m.from !== 'them' || m.busy) return;
    if (IS_HOST) hostFormRes(ME, id, accept);
    else { m.busy = true; renderChat(m.peer); toHost({ a: 'formres', id, accept }); }
  }
  g('chat-body').addEventListener('click', e => {
    const ok = e.target.closest('[data-form-ok]'), no = e.target.closest('[data-form-no]');
    if (ok) answerForm(ok.dataset.formOk, true); else if (no) answerForm(no.dataset.formNo, false);
  });
  const myMoney = () => Game.players[ME].money;
  g('frm-buy-cancel').addEventListener('click', () => Modal.close('frm-buy'));
  g('frm-buy-send').addEventListener('click', () => { const idx = +g('frm-buy-select').value, sum = parseInt(g('frm-buy-sum').value || '0', 10); if (!sum || sum <= 0) { g('frm-buy-err').textContent = 'Укажите сумму'; Sound.error(); return; } if (sum > myMoney()) { g('frm-buy-err').textContent = 'Сумма больше вашего баланса'; Sound.error(); return; } pushForm('buy', { idx, sum }); Modal.close('frm-buy'); });
  g('frm-sell-cancel').addEventListener('click', () => Modal.close('frm-sell'));
  g('frm-sell-send').addEventListener('click', () => { const idx = +g('frm-sell-select').value, sum = parseInt(g('frm-sell-sum').value || '0', 10); if (!sum || sum <= 0) { g('frm-sell-err').textContent = 'Укажите цену'; Sound.error(); return; } pushForm('sell', { idx, sum }); Modal.close('frm-sell'); });
  g('frm-ask-cancel').addEventListener('click', () => Modal.close('frm-ask'));
  g('frm-ask-send').addEventListener('click', () => { const sum = parseInt(g('frm-ask-sum').value || '0', 10); if (!sum || sum <= 0) { g('frm-ask-err').textContent = 'Укажите сумму'; Sound.error(); return; } pushForm('ask', { sum }); Modal.close('frm-ask'); });
  g('frm-give-cancel').addEventListener('click', () => Modal.close('frm-give'));
  g('frm-give-send').addEventListener('click', () => { const sum = parseInt(g('frm-give-sum').value || '0', 10); if (!sum || sum <= 0) { g('frm-give-err').textContent = 'Укажите сумму'; Sound.error(); return; } if (sum > myMoney()) { g('frm-give-err').textContent = 'Сумма больше вашего баланса'; Sound.error(); return; } pushForm('give', { sum }); Modal.close('frm-give'); });
  g('frm-swap-cancel').addEventListener('click', () => Modal.close('frm-swap'));
  g('frm-swap-send').addEventListener('click', () => { const mine = +g('frm-swap-mine').value, theirs = +g('frm-swap-theirs').value, paySide = g('frm-swap-side').value; const sum = paySide === 'none' ? 0 : parseInt(g('frm-swap-sum').value || '0', 10); if (paySide !== 'none' && (!sum || sum <= 0)) { g('frm-swap-err').textContent = 'Укажите сумму доплаты'; Sound.error(); return; } if (paySide === 'me' && sum > myMoney()) { g('frm-swap-err').textContent = 'Недостаточно средств на доплату'; Sound.error(); return; } pushForm('swap', { mine, theirs, paySide, sum }); Modal.close('frm-swap'); });

  g('loan-yes').addEventListener('click', () => { Modal.close('loan'); if (IS_HOST) doLoan(ME); else toHost({ a: 'loan' }); });
  g('loan-no').addEventListener('click', () => Modal.close('loan'));

  function hostFinish(test, parts, r) {
    let title = 'ИВЕНТ', rows = [];
    try {
      if (test.id === 'duel') {
        if (!r || !r.winner) {
          title = 'ИВЕНТ: ДУЭЛЬ';
          rows = [{ lbl: 'Итог', val: 'Время вышло — никто не победил', cls: 'res-lose' }];
        } else {
          const w = r.winner, l = r.loser;
          const steal = Math.round(Math.max(0, l.money) * 0.15);
          l.money -= steal; w.money += steal;
          title = 'ИВЕНТ: ДУЭЛЬ';
          rows = [
            { lbl: 'Победитель', val: w.name, cls: 'res-win' },
            { lbl: 'Проигравший', val: l.name, cls: 'res-lose' },
            { lbl: 'Забрано (15%)', val: steal + ' €', cls: 'res-gold' }
          ];
        }
      } else if (test.id === 'steal') {
        const a = parts[0], b = parts[1];
        const text = Events.stealText(a, b, r && r.cA, r && r.cB);
        if (r && r.cA === 'steal' && r.cB === 'steal') {}
        else if (r && r.cA === 'steal') a.money += 500;
        else if (r && r.cB === 'steal') b.money += 500;
        else { a.money += 250; b.money += 250; }
        title = 'ИВЕНТ: УКРАСТЬ ИЛИ РАЗДЕЛИТЬ';
        rows = [
          { lbl: a.name, val: r && r.cA === 'steal' ? 'УКРАЛ' : 'РАЗДЕЛИЛ', cls: r && r.cA === 'steal' ? 'res-lose' : 'res-win' },
          { lbl: b.name, val: r && r.cB === 'steal' ? 'УКРАЛ' : 'РАЗДЕЛИЛ', cls: r && r.cB === 'steal' ? 'res-lose' : 'res-win' },
          { lbl: 'Итог', val: text, cls: 'res-gold' }
        ];
      } else if (test.id === 'airhockey') {
        if (!r || !r.winner) {
          title = 'ИВЕНТ: АЭРОХОККЕЙ';
          rows = [
            { lbl: 'Итог', val: r && r.tie ? 'Ничья' : 'Матч не завершён', cls: r && r.tie ? 'res-gold' : 'res-lose' },
            { lbl: 'Счёт', val: r && r.score || '—', cls: 'res-gold' },
            { lbl: 'Денежный перевод', val: 'Не производится', cls: 'res-gold' }
          ];
        } else {
          const w = r.winner, l = r.loser;
          const netWorth = Math.max(0, totalWorth(l.id));
          const targetTransfer = Math.round(netWorth * 0.15);
          const steal = Math.min(Math.max(0, l.money), targetTransfer);
          l.money -= steal; w.money += steal;
          title = 'ИВЕНТ: АЭРОХОККЕЙ';
          rows = [
            { lbl: 'Победитель', val: w.name, cls: 'res-win' },
            { lbl: 'Проигравший', val: l.name, cls: 'res-lose' },
            { lbl: 'Счёт', val: r.score || '—', cls: 'res-gold' },
            { lbl: 'Забрано (15%)', val: steal + ' €', cls: 'res-gold' }
          ];
        }
      } else {
        const tr = parts[0];
        const v = (r && r.victim) || Game.players.find(p => p && p.id !== tr.id) || tr;
        const taken = Math.round(Math.max(0, v.money) * 0.15);
        v.money -= taken; tr.money += taken;
        title = 'ИВЕНТ: ПРЕДАТЕЛЬ';
        rows = [
          { lbl: 'Предатель', val: tr.name, cls: 'res-gold' },
          { lbl: 'Жертва', val: v.name, cls: 'res-lose' },
          { lbl: 'Забрано (15%)', val: taken + ' €', cls: 'res-gold' }
        ];
      }
    } catch (err) {
      console.error('hostFinish:', err);
      title = 'ИВЕНТ ЗАВЕРШЁН';
      rows = [{ lbl: 'Статус', val: 'Ошибка расчёта результата', cls: 'res-lose' }];
    }

    try { glog(title + ' завершён'); } catch (e) {}
    try { renderPlayers(); } catch (e) {}

    const payload = { v: 'ev', k: 'res', title, rows };
    try { bc(payload); } catch (e) { console.error('bc res #1', e); }
    setTimeout(() => { try { bc(payload); } catch (e) { console.error('bc res #2', e); } }, 800);
    setTimeout(() => { try { bc(payload); } catch (e) { console.error('bc res #3', e); } }, 2500);

    return { title, rows };
  }
  const clientFinish = () => new Promise(res => {
    let done = false, off = null;
    const fin = data => {
      if (done) return;
      done = true;
      if (off) { try { off(); } catch (e) {} }
      res(data);
    };
    off = evOn('res', d => fin({ title: d.title, rows: d.rows }));
    setTimeout(() => fin({
      title: 'ИВЕНТ ЗАВЕРШЁН',
      rows: [{ lbl: 'Внимание', val: 'Результат не получен от хоста', cls: 'res-gold' }]
    }), 12000);
  });
  async function runEventHost(forced) {
    const alive = Game.players.filter(p => p.alive);
    if (alive.length < 2) { console.warn('[Board] not enough alive players, skip event'); return; }
    const plan = FX.planEvent(alive, forced);
    evReset(); bc({ v: 'evplan', plan });
    await FX.runEvent({ plan, io: makeIO(), finish: hostFinish });
  }
  async function runEventClient(plan) { evReset(); await FX.runEvent({ plan, io: makeIO(), finish: clientFinish }); }

  function beginTurn() {
    if (over) return;
    const p = Game.players[cur], my = session;
    if (p.bot) setTimeout(() => { if (my === session && !busy && Game.players[cur] === p) roll(); }, 900);
    else {
      bc({ v: 'turn', pid: cur, ms: TURN_MS });
      setRoll(cur === ME);
      startTurnTimer(cur, TURN_MS, true);
    }
  }
  async function roll() {
    if (!IS_HOST || busy || over) return;
    if (auction) { turnBlocked = true; setRoll(false); return; }
    busy = true; setRoll(false); stopTurnTimer(); bc({ v: 'turn', pid: -1 });
    const my = session; dir = 1;
    const thisTurn = turnNo;
    try {
      const p = Game.players[cur];
      if (!p || !p.alive) { next(); return; }

      let skipMove = false;

      if (inJail[p.id]) {
        await jailSequence(p);
        if (my !== session) return;
        if (!p.alive) { skipMove = true; }
        else if (inJail[p.id]) {
          glog(`${p.name}: остаётся в тюрьме, ход пропущен`);
          skipMove = true;
        }
      }

      if (!skipMove && skipNext[p.id]) {
        skipNext[p.id] = false;
        glog(`${p.name}: пропускает ход`);
        skipMove = true;
      }

      if (!skipMove && Game.players[cur].alive) {
        let rdir = 1;
        if (reverseNext[p.id]) { reverseNext[p.id] = false; rdir = -1; glog(`${p.name}: ходит назад (1 ход)`); }

        let a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6);
        if (devDice) { a = devDice[0]; b = devDice[1]; devDice = null; }
        await V({ v: 'dice', a, b });
        if (my !== session) return;
        glog(`${p.name}: выпало ${a} и ${b} (${a + b})`);
        if (!MP) { await V({ v: 'bar', ms: WAIT_MS }); if (my !== session) return; }
        const mv = await V({ v: 'move', pid: p.id, steps: a + b, dir: rdir });
        if (my !== session) return;
        await applyCell(p, chips[p.id].stop, mv && mv.passedStart);
        if (my !== session) return;
        V({ v: 'sumclear' });
      }

      checkBankrupt(); tickLoans();

      if (auction) {
        let waited = 0;
        while (auction && waited < AUCTION_WAIT_MAX) { await sleep(300); waited += 300; }
        if (auction) { console.warn('[Board] auction stuck, forcing null'); auction = null; }
      }

      if (thisTurn > 0 && thisTurn % EVENT_EVERY === 0 && !over) {
        try { await runEventHost(); } catch (err) { console.error('[Board] event error:', err); }
        if (my !== session) return;
      }

      next();
    } catch (err) {
      console.error('[Board] roll error:', err);
      if (my === session) { try { next(); } catch (e) { console.error(e); } }
    }
  }
  function next() {
    stopTurnTimer();
    if (over) return;
    const alive = Game.players.filter(p => p.alive);
    if (alive.length <= 1) { gameOver(alive[0]); return; }
    let n = cur, guard = 0;
    do { n = (n + 1) % Game.players.length; if (++guard > Game.players.length * 2) { gameOver(alive[0]); return; } } while (!Game.players[n].alive);
    cur = n; turnNo++; busy = false; dir = 1;
    upgraded = upgraded.map(() => false);
    renderPlayers();
    if (auction) { turnBlocked = true; setRoll(false); return; }
    beginTurn();
  }
  function gameOver(w) {
    if (over) return;
    over = true; busy = true; stopTurnTimer();
    bc({ v: 'turn', pid: -1 }); bc({ v: 'gameover', w: w ? w.id : -1 });
    showGameOver(w ? w.id : -1);
  }
  function showGameOver(wid) {
    over = true; busy = true; stopTurnTimer(); rentLocal = null; resetRollBtn();
    const w = Game.players[wid];
    g('go-title').textContent = !w ? 'Игра окончена' : (wid === ME ? 'Вы победили!' : `Победил ${w.name}`);
    g('go-desc').textContent = w ? `Баланс победителя: ${w.money} €` : 'Все игроки выбыли.';
    log(w ? `🏆 ${w.name} — победитель!` : 'Игра окончена');
    setTimeout(() => Modal.open('gameover'), 800);
  }
  g('b-roll').addEventListener('click', () => {
    if (rentLocal) { rentLocal(); return; }
    if (cur !== ME || over) return;
    setRoll(false);
    if (IS_HOST) roll(); else toHost({ a: 'roll' });
  });

  function resetCommon(n) {
    session++; stopTurnTimer();
    if (moneyAnimRAF) { cancelAnimationFrame(moneyAnimRAF); moneyAnimRAF = null; }
    build();
    g('log').innerHTML = ''; g('sum').textContent = ''; g('wait').classList.remove('on');
    g('dice').innerHTML = dieHTML() + dieHTML(); g('chips').innerHTML = '';
    chips = []; Q = Array.from({ length: N }, () => []); yieldSet = new Set();
    dir = 1; turnNo = 1; cur = 0; over = false; busy = false;
    const z = v => Array(n).fill(v);
    skipNext = z(false); inJail = z(false); jailFee = z(JAIL_BASE); jailAttempts = z(0);
    loans = z(null); reverseNext = z(false); upgraded = z(false);
    auction = null; auctionSeq = 0; turnBlocked = false; aucSyncTick = 0;
    chatState = {}; chatUnread = {}; mailInbox = []; forms = {};
    pend = {}; rentLocal = rentCancel = buyCancel = jailCancel = null; sellCancel = null; sellPl = null;
    lastMoney = []; devDice = null;
    vq = Promise.resolve(); monoQueue = Promise.resolve(); evReset();
    for (const k in monopolyShown) delete monopolyShown[k];
    document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
    resetRollBtn();
  }
  function initPlayers(pl) {
    Game.players = pl;
    pl.forEach((p, i) => {
      const el = document.createElement('div'); el.className = 'chip'; el.style.setProperty('--c', p.color);
      el.innerHTML = `<div class="sh"></div><div class="bd" data-e="${p.e}"></div>`;
      g('chips').appendChild(el);
      const ch = { el, stop: 0, x: 0, y: 0, playerId: i }; chips.push(ch); Q[0].push(ch);
    });
    layout(); renderPlayers();
  }
  function start(name) {
    resetCommon(4); MP = false; IS_HOST = true; ME = 0;
    const cols = shuffle(COLORS), pcs = shuffle(PIECES), names = [name || 'Игрок', 'Бот 1', 'Бот 2', 'Бот 3'];
    initPlayers(names.map((n, i) => ({ id: i, name: n, color: cols[i], e: pcs[i], money: START_MONEY, alive: true, bot: i !== 0, nid: null })));
    log(`Игра началась. Старт: ${START_MONEY} € каждому.`);
    beginTurn();
  }
  function hostStart(list) {
    resetCommon(list.length); MP = true; IS_HOST = true; ME = 0;
    const cols = shuffle(COLORS), pcs = shuffle(PIECES);
    const pl = list.map((u, i) => ({ id: i, name: u.name, color: cols[i], e: pcs[i], money: START_MONEY, alive: true, bot: false, nid: u.id }));
    initPlayers(pl);
    bc({ v: 'init', players: pl.map(p => ({ id: p.id, name: p.name, color: p.color, e: p.e, nid: p.nid })) });
    log(`Игра началась. Старт: ${START_MONEY} € каждому.`);
  }
  function clientStart(d) {
    resetCommon(d.players.length); MP = true; IS_HOST = false;
    ME = Math.max(0, d.players.findIndex(p => p.nid === Net.id));
    initPlayers(d.players.map(p => ({ ...p, money: START_MONEY, alive: true, bot: false })));
    log(`Игра началась. Старт: ${START_MONEY} € каждому.`);
  }
  function stop() {
    session++;
    busy = false;
    stopTurnTimer();
  }
  const IMMEDIATE = new Set(['ev', 'evplan', 'sfx', 'chat', 'form', 'formst', 'ask', 'askCancel', 'auc', 'turn', 'toast']);
  function doImm(d) {
    switch (d.v) {
      case 'ev': evEmit(d.k, d, d.from); break;
      case 'evplan': runEventClient(d.plan).catch(e => console.error('runEventClient:', e)); break;
      case 'sfx': SfxPanel.play(d.src); break;
      case 'chat': rxChat(d.from, d.text); break;
      case 'form': rxForm(d.from, d.id, d.form); break;
      case 'formst': setFormStatus(d.id, d.status, d.reason); break;
      case 'ask': localAsk(d.kind, d.pl).then(val => toHost({ a: 'askres', id: d.id, val })); break;
      case 'askCancel': cancelLocalAsk(d.kind); break;
      case 'auc': aucApply(d); break;
      case 'turn': if (d.pid < 0) stopTurnTimer(); else { cur = d.pid; setRoll(d.pid === ME); startTurnTimer(d.pid, d.ms, false); renderPlayers(); } break;
      case 'toast': toast(d.text); break;
    }
  }
  function clientMsg(d) {
    if (IMMEDIATE.has(d.v)) { try { doImm(d); } catch (e) { console.error(e); } }
    else vq = vq.then(() => doV(d)).catch(e => console.error('doV', e));
  }
  function hostMsg(d, seat) {
    const p = Game.players[seat]; if (!p) return;
    switch (d.a) {
      case 'roll': if (seat === cur && !busy && p.alive && !p.bot) roll(); break;
      case 'askres': { const e = pend[d.id]; if (e && e.pid === seat) e.fn(d.val); break; }
      case 'bid': placeBid(seat, d.amount); break;
      case 'upgrade': doUpgrade(seat, +d.idx); break;
      case 'downgrade': doDowngrade(seat, +d.idx); break;
      case 'sellbiz': doSellBiz(seat, +d.idx); break;
      case 'auction': doAuctionFromBiz(seat, +d.idx); break;
      case 'loan': doLoan(seat); break;
      case 'bankrupt': doBankruptManual(seat); break;
      case 'chat': relayChat(seat, +d.to, String(d.text || '').slice(0, 200)); break;
      case 'form': hostForm(seat, +d.to, String(d.id), d.form); break;
      case 'formres': hostFormRes(seat, String(d.id), !!d.accept); break;
      case 'sfx': SfxPanel.play(d.src); bc({ v: 'sfx', src: d.src }, seatsExcept(seat)); break;
      case 'ev': evEmit(d.k, d, seat); break;
      case 'resync': {
        try { bc({ v: 'state', ...snapshot() }, [seat]); } catch (e) {}
        if (!busy && !over && cur === seat) bc({ v: 'turn', pid: cur, ms: TURN_MS }, [seat]);
        if (auction && !auction.finished) {
          try { bc({ v: 'auc', ev: 'sync', id: auction.id, phase: auction.phase, leader: auction.leader, lastBid: auction.lastBid, remaining: Math.max(0, auction.deadline - performance.now()), finished: auction.finished, result: auction.result }, [seat]); } catch (e) {}
        }
        break;
      }
    }
  }
  function netMsg(d, fromId) {
    if (!d) return;
    if (Net.isHost) { const seat = Game.players.findIndex(p => p.nid === fromId); if (seat >= 0) hostMsg(d, seat); }
    else clientMsg(d);
  }
  function onLeft(nid) {
    const seat = Game.players.findIndex(p => p.nid === nid);
    if (seat < 0 || !Game.players[seat].alive) return;
    Object.values(pend).forEach(e => { if (e.pid === seat) e.fn(null); });
    bankruptPlayer(seat, 'покинул игру');
    const alive = Game.players.filter(p => p.alive);
    if (alive.length <= 1) { gameOver(alive[0]); return; }
    if (cur === seat && !busy) { stopTurnTimer(); bc({ v: 'turn', pid: -1 }); next(); }
  }
  function sfxSend(src) { if (!MP) return; if (IS_HOST) bc({ v: 'sfx', src }); else toHost({ a: 'sfx', src }); }

  const dev = {
    groups: GROUPS,
    dice(a, b) { devDice = [a, b]; },
    event(t) { return runEventHost(t); },
    eventDirect(type, p1Id, p2Id) {
      if (busy) return;
      busy = true;
      const io = makeIO();
      delete evLast['ah:opening-result'];
      const p1 = Game.players[p1Id];
      const p2 = Game.players[p2Id];

      const scene = g('ev-scene');
      scene.style.transition = 'none';
      scene.classList.add('on');
      ['L-frame', 'L-table', 'L-draw', 'L-result'].forEach(id => g(id).classList.remove('on'));
      g('L-game').classList.add('on');
      ['ev-duel', 'ev-steal', 'ev-traitor', 'ev-airhockey'].forEach(id => g(id).classList.remove('on'));

      let testObj = { id: type };
      let parts = type === 'traitor' ? [p1] : [p1, p2];

      if (type === 'duel') g('ev-duel').classList.add('on');
      if (type === 'steal') g('ev-steal').classList.add('on');
      if (type === 'traitor') g('ev-traitor').classList.add('on');
      if (type === 'airhockey') g('ev-airhockey').classList.add('on');

      setTimeout(async () => {
        try {
          let r;
          if (type === 'duel') r = await Events.duel(p1, p2, io);
          else if (type === 'steal') r = await Events.stealShare(p1, p2, io);
          else if (type === 'airhockey') r = await Events.airHockey(p1, p2, io);
          else if (type === 'traitor') r = await Events.traitor(p1, Game.players.filter(x => x.id !== p1Id), io);

          scene.classList.remove('on');
          g('L-game').classList.remove('on');
          if (type === 'duel') g('ev-duel').classList.remove('on');
          if (type === 'steal') g('ev-steal').classList.remove('on');
          if (type === 'traitor') g('ev-traitor').classList.remove('on');
          if (type === 'airhockey') g('ev-airhockey').classList.remove('on');

          hostFinish(testObj, parts, r);
        } catch (e) {
          console.error('DEV event error:', e);
          scene.classList.remove('on');
          g('L-game').classList.remove('on');
        } finally {
          busy = false;
        }
      }, 100);
    },
    async teleport(pid, idx, apply) {
      if (busy) { toast('DEV: дождитесь конца хода'); return false; }
      await teleport(chips[pid], idx); log(`DEV: ${Game.players[pid].name} → «${CELLS[idx].n}»`);
      if (apply) await applyCell(Game.players[pid], idx, false);
      renderPlayers(); return true;
    },
    giveBiz(pid, idx) {
      if (CELLS[idx].t !== 'biz') return false;
      setOwner(idx, pid); log(`DEV: «${CELLS[idx].n}» → ${Game.players[pid].name}`);
      const mono = checkMonopoly(pid); renderPlayers(); if (mono) monopolyFx(pid, mono.cells); return true;
    },
    takeBiz(idx) { if (owner[idx] == null) return false; setOwner(idx, null); stars[idx] = 0; renderStars(idx); log(`DEV: «${CELLS[idx].n}» освобождён`); renderPlayers(); return true; },
    stars(idx, d) { if (owner[idx] == null) return false; stars[idx] = Math.max(0, Math.min(5, stars[idx] + d)); renderStars(idx); return true; },
    giveGroup(pid, gr) { GROUPS[gr].forEach(i => setOwner(i, pid)); const mono = checkMonopoly(pid); renderPlayers(); if (mono) monopolyFx(pid, mono.cells); },
    takeAll(pid) { owner.forEach((o, i) => { if (o === pid) { setOwner(i, null); stars[i] = 0; renderStars(i); } }); renderPlayers(); },
    money(pid, mode, v) { const p = Game.players[pid]; if (mode === 'add') p.money += v; else if (mode === 'sub') p.money -= v; else p.money = v; renderPlayers(); },
    jailFx(pid) { return jailAnimVis(Game.players[pid].name); },
    jailIn(pid) { inJail[pid] = true; jailAttempts[pid] = 0; jailFee[pid] = JAIL_BASE; renderPlayers(); },
    jailOut(pid) { inJail[pid] = false; jailAttempts[pid] = 0; renderPlayers(); },
    monoTest(pid, gr) { return monopolyFx(pid, GROUPS[gr]); }
  };

  return {
    start, hostStart, stop, netMsg, onLeft, sfxSend, toast,
    go() { if (IS_HOST) beginTurn(); },
    resync() { if (MP && !IS_HOST) toHost({ a: 'resync' }); },
    get players() { return Game.players; },
    get me() { return ME; },
    get mp() { return MP; },
    cells: CELLS, dev, renderPlayers
  };
})();