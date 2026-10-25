/* net-client.js — клиент сети. Хост тоже подключается как клиент к своему же хабу (127.0.0.1).
 * Версия 1.2: устойчивое подключение (ретраи), автопереподключение при разрыве, outbox. */
const Net = (() => {
  const PORT = 47100;
  const LS_KEY = 'nm_client_id';
  const CONNECT_TIMEOUT = 6000;
  const CONNECT_RETRIES = 3;
  const RECONNECT_MAX = 6;

  let ws = null, myId = null, host = false;
  let reconnecting = false, attempts = 0;
  let reconnectInfo = null;
  let started = false;
  const L = {};
  const outbox = [];

  const on = (t, fn) => { (L[t] = L[t] || new Set()).add(fn); return () => L[t] && L[t].delete(fn); };
  const emit = (t, d) => (L[t] ? [...L[t]] : []).forEach(fn => { try { fn(d); } catch (e) { console.error('Net.' + t, e); } });

  function getClientId() {
    try {
      let v = localStorage.getItem(LS_KEY);
      if (!v) {
        v = 'c_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(LS_KEY, v);
      }
      return v;
    } catch (e) {
      return 'c_temp_' + Math.random().toString(36).slice(2);
    }
  }

  function flushOutbox() {
    if (!ws || ws.readyState !== 1) return;
    while (outbox.length) {
      try { ws.send(JSON.stringify(outbox[0])); outbox.shift(); }
      catch (e) { return; }
    }
  }

  function tryOpen(url, joinMsg, { retries = CONNECT_RETRIES, baseDelay = 700 } = {}) {
    return new Promise((resolve, reject) => {
      let attempt = 0;
      const doTry = () => {
        attempt++;
        let sock;
        try { sock = new WebSocket(url); }
        catch (e) { sock = null; }
        if (!sock) {
          if (attempt <= retries) return setTimeout(doTry, baseDelay * attempt);
          return reject('Неверный адрес');
        }
        let settled = false;
        const fail = m => {
          if (settled) return;
          settled = true;
          try { sock.close(); } catch (e) {}
          if (attempt <= retries) return setTimeout(doTry, baseDelay * attempt);
          reject(m);
        };
        const tmo = setTimeout(() => fail('Нет ответа. Проверьте IP, Radmin VPN и что хост создал комнату.'), CONNECT_TIMEOUT);
        sock.onopen = () => { try { sock.send(JSON.stringify(joinMsg)); } catch (e) { fail('Не удалось отправить join'); } };
        sock.onerror = () => fail('Не удалось подключиться. Проверьте IP, Radmin VPN и брандмауэр хоста.');
        sock.onclose = () => fail('Соединение закрыто');
        sock.onmessage = ev => {
          let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
          if (settled) return;
          if (m.t === 'joined') {
            settled = true;
            clearTimeout(tmo);
            ws = sock; myId = m.id; host = !!m.host; started = true;
            sock.onmessage = e2 => { let x; try { x = JSON.parse(e2.data); } catch (e) { return; } emit(x.t, x); };
            sock.onclose = () => {
              if (ws !== sock) return;
              ws = null;
              emit('disconnected', {});
              scheduleReconnect();
            };
            sock.onerror = () => { /* обрабатывается в onclose */ };
            flushOutbox();
            resolve(m);
          } else if (m.t === 'err') {
            fail(m.msg || 'Ошибка подключения');
          }
        };
      };
      doTry();
    });
  }

  function scheduleReconnect() {
    if (!started) return;
    if (reconnecting) return;
    if (!reconnectInfo) { emit('closed', {}); return; }
    reconnecting = true;
    attempts = 0;
    const tryAgain = () => {
      if (!reconnecting) return;
      attempts++;
      if (attempts > RECONNECT_MAX) {
        reconnecting = false;
        emit('closed', {});
        return;
      }
      emit('reconnecting', { attempt: attempts });
      const { url, joinMsg } = reconnectInfo;
      tryOpen(url, joinMsg, { retries: 0 })
        .then(() => {
          reconnecting = false;
          attempts = 0;
          emit('reconnected', {});
        })
        .catch(() => setTimeout(tryAgain, Math.min(1000 * attempts, 5000)));
    };
    tryAgain();
  }

  const send = m => {
    if (ws && ws.readyState === 1) {
      try { ws.send(JSON.stringify(m)); return; }
      catch (e) { /* падение → в outbox */ }
    }
    outbox.push(m);
    if (outbox.length > 200) outbox.shift();
  };

  return {
    PORT, on,
    get id() { return myId; },
    get isHost() { return host; },
    get connected() { return !!ws && ws.readyState === 1; },

    async host({ password, name }) {
      if (!window.desktop) throw 'Мультиплеер доступен только в приложении (.exe)';
      const r = await window.desktop.netStart({ port: PORT, password });
      if (!r.ok) throw r.error;
      const url = `ws://127.0.0.1:${PORT}`;
      const joinMsg = { t: 'join', name, token: r.token, clientId: getClientId() };
      reconnectInfo = { url, joinMsg };
      try { return await tryOpen(url, joinMsg); }
      catch (e) { await window.desktop.netStop(); throw e; }
    },

    join({ ip, password, name }) {
      const url = `ws://${ip}:${PORT}`;
      const joinMsg = { t: 'join', name, pw: password, clientId: getClientId() };
      reconnectInfo = { url, joinMsg };
      return tryOpen(url, joinMsg);
    },

    ready(v) { send({ t: 'ready', v: !!v }); },

    game(d, to) { send(host ? { t: 'g', to: to || 'all', d } : { t: 'g', d }); },

    leave() {
      const wasHost = host, s = ws;
      reconnecting = false; attempts = 0; started = false;
      reconnectInfo = null;
      ws = null; host = false; myId = null;
      outbox.length = 0;
      if (s) { try { s.close(); } catch (e) {} }
      if (wasHost && window.desktop) window.desktop.netStop();
    }
  };
})();