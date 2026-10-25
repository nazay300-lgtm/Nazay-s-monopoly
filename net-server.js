/* net-server.js — «хаб» комнаты. Работает в главном процессе Electron.
 * Версия 1.2: token-based reconnect + grace-period при disconnect в игре. */
const os = require('os');
const crypto = require('crypto');
let WSS = null;
try { WSS = require('ws').WebSocketServer; } catch (e) { WSS = null; }

let wss = null, room = null, hb = null;
const MAX_PLAYERS = 4;
const GRACE_MS = 6000;

const clean = n => (String(n || '').replace(/[^\p{L}\p{N} _\-.]/gu, '').trim().slice(0, 16)) || 'Игрок';
const send = (c, m) => { try { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(m)); } catch (e) {} };
const list = () => [...room.clients.values()].sort((a, b) => a.id - b.id);
const bcast = m => list().forEach(c => send(c, m));
const info = () => ({ t: 'room', phase: room.phase,
  players: list().map(c => ({ id: c.id, name: c.name, ready: c.ready, host: c.host })) });
const allReady = () => room.clients.size >= 2 && list().every(c => c.ready);

function start({ port, password }) {
  return new Promise(resolve => {
    stop();
    if (!WSS) return resolve({ ok: false, error: 'Не установлен модуль ws. Выполните в папке игры: npm install' });
    const token = crypto.randomBytes(16).toString('hex');
    room = { pw: String(password || ''), token, phase: 'lobby', hostId: null, nextId: 1, clients: new Map(), timer: null };
    let ok = false;
    try { wss = new WSS({ port, host: '0.0.0.0' }); }
    catch (e) { return resolve({ ok: false, error: String(e.message || e) }); }
    wss.on('listening', () => { ok = true; resolve({ ok: true, token }); });
    wss.on('error', e => {
      if (ok) return;
      resolve({ ok: false, error: e.code === 'EADDRINUSE'
        ? 'Порт 47100 уже занят. Закройте старую комнату или перезапустите игру.' : String(e.message || e) });
      stop();
    });
    wss.on('connection', onConn);
    hb = setInterval(() => {
      if (!wss) return;
      wss.clients.forEach(ws => { if (ws.dead) return ws.terminate(); ws.dead = true; try { ws.ping(); } catch (e) {} });
    }, 15000);
  });
}

function stop() {
  clearInterval(hb); hb = null;
  if (room) {
    if (room.timer) clearTimeout(room.timer);
    room.clients.forEach(c => { if (c.graceTimer) clearTimeout(c.graceTimer); });
  }
  if (wss) {
    try { wss.clients.forEach(ws => { try { ws.terminate(); } catch (e) {} }); } catch (e) {}
    try { wss.close(); } catch (e) {}
  }
  wss = null; room = null;
}

function onConn(ws) {
  ws.dead = false;
  ws.on('pong', () => { ws.dead = false; });
  let me = null;
  ws.on('message', raw => {
    let m; try { m = JSON.parse(String(raw)); } catch (e) { return; }
    if (!room) return;
    if (!me) { me = join(ws, m); return; }
    if (me.ws !== ws) return;
    onMsg(me, m);
  });
  ws.on('close', () => {
    if (!me) return;
    if (me.ws !== ws) return;
    leave(me);
  });
  ws.on('error', () => {});
}

function join(ws, m) {
  const fail = msg => { send({ ws }, { t: 'err', msg }); try { ws.close(); } catch (e) {} return null; };
  if (!m || m.t !== 'join') return fail('Ожидалось подключение');

  // 1) RECONNECT: клиент вернулся с тем же clientId
  if (m.clientId) {
    for (const c of room.clients.values()) {
      if (c.cid === m.clientId) {
        if (c.ws && c.ws !== ws) { try { c.ws.close(); } catch (e) {} }
        c.ws = ws;
        if (c.graceTimer) { clearTimeout(c.graceTimer); c.graceTimer = null; }
        c.disconnected = false;
        send(c, { t: 'joined', id: c.id, host: c.host, reconnect: true });
        const h = room.clients.get(room.hostId);
        if (h && h !== c) send(h, { t: 'rejoined', id: c.id });
        return c;
      }
    }
  }

  // 2) Новый клиент
  const isHost = room.hostId == null && m.token === room.token;
  if (!isHost) {
    if (room.hostId == null) return fail('Комната ещё не готова');
    if (String(m.pw || '') !== room.pw) return fail('Неверный пароль');
    if (room.phase !== 'lobby') return fail('Игра уже началась или вот-вот начнётся');
    if (room.clients.size >= MAX_PLAYERS) return fail('Комната заполнена (максимум 4 игрока)');
  }
  const base = clean(m.name), taken = new Set(list().map(c => c.name));
  let name = base, k = 2;
  while (taken.has(name)) name = `${base.slice(0, 13)} ${k++}`;
  const c = { id: room.nextId++, cid: m.clientId || null, ws, name, ready: false, host: isHost, disconnected: false, graceTimer: null };
  room.clients.set(c.id, c);
  if (isHost) room.hostId = c.id;
  send(c, { t: 'joined', id: c.id, host: isHost });
  bcast(info());
  return c;
}

function onMsg(c, m) {
  if (m.t === 'ready') {
    if (room.phase === 'lobby' || room.phase === 'starting') { c.ready = !!m.v; bcast(info()); checkStart(); }
  } else if (m.t === 'g') {
    if (room.phase !== 'game') return;
    if (c.host) {
      const out = { t: 'g', from: c.id, d: m.d };
      if (Array.isArray(m.to)) m.to.forEach(id => { const x = room.clients.get(id); if (x && !x.host) send(x, out); });
      else list().forEach(x => { if (!x.host) send(x, out); });
    } else {
      const h = room.clients.get(room.hostId);
      if (h) send(h, { t: 'g', from: c.id, d: m.d });
    }
  }
}

function checkStart() {
  if (room.phase === 'game') return;
  const ready = allReady();

  if (room.phase === 'lobby' && ready) {
    room.phase = 'starting';
    bcast({ t: 'starting', ms: 3000 });
    clearTimeout(room.timer);
    room.timer = setTimeout(() => {
      room.timer = null;
      if (room.phase === 'starting' && allReady()) {
        room.phase = 'game';
        bcast({ t: 'start', players: list().map(c => ({ id: c.id, name: c.name })) });
      } else {
        room.phase = 'lobby';
        bcast({ t: 'cancel' });
        bcast(info());
      }
    }, 3000);
  } else if (room.phase === 'starting' && !ready) {
    clearTimeout(room.timer); room.timer = null;
    room.phase = 'lobby';
    bcast({ t: 'cancel' });
    bcast(info());
  }
}

function leave(c) {
  if (!room || !room.clients.has(c.id)) return;

  if (c.host) {
    bcast({ t: 'hostLeft' });
    room.clients.forEach(x => { try { x.ws.close(); } catch (e) {} });
    room.clients.clear(); room.phase = 'lobby'; room.hostId = null;
    return;
  }

  if (room.phase === 'game') {
    c.disconnected = true;
    const h = room.clients.get(room.hostId);
    if (h) send(h, { t: 'disconnected', id: c.id });
    if (c.graceTimer) clearTimeout(c.graceTimer);
    c.graceTimer = setTimeout(() => {
      c.graceTimer = null;
      if (!c.disconnected) return;
      room.clients.delete(c.id);
      if (h) send(h, { t: 'left', id: c.id });
    }, GRACE_MS);
    return;
  }

  room.clients.delete(c.id);
  checkStart();
  bcast(info());
}

function localIPs() {
  const out = [], ifs = os.networkInterfaces();
  Object.keys(ifs).forEach(name => (ifs[name] || []).forEach(i => {
    if ((i.family === 'IPv4' || i.family === 4) && !i.internal)
      out.push({ ip: i.address, name, radmin: i.address.startsWith('26.') || /radmin/i.test(name) });
  }));
  return out;
}

module.exports = { start, stop, localIPs };