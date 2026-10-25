/* script.js — ядро UI: экраны, окна, лобби, профиль, заставка, мультиплеер-меню, автообновление. */
const $ = id => document.getElementById(id);
const wait = ms => new Promise(r => setTimeout(r, ms));
const DEV_PASSWORD = '100sosisok';
const isElectron = !!(window.desktop && window.desktop.isElectron);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const withTimeout = (p, ms, msg) => Promise.race([
  p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg || 'Таймаут')), ms))
]);

document.addEventListener('error', e => {
  if (e.target && e.target.tagName === 'IMG' && e.target.hasAttribute('data-errem')) {
    try { e.target.remove(); } catch (_) {}
  }
}, true);

const Game = { dev: false, players: [] };

/* ===== Профиль ===== */
const Profile = {
  KEY: 'nm_profile',
  clean: s => String(s || '').replace(/[^\p{L}\p{N} _\-.]/gu, '').trim().slice(0, 16),
  get name() { try { return this.clean(JSON.parse(localStorage.getItem(this.KEY) || '{}').name) || 'Игрок'; } catch (e) { return 'Игрок'; } },
  save(n) { const v = this.clean(n); if (v.length < 2) return false; localStorage.setItem(this.KEY, JSON.stringify({ name: v })); return true; }
};

/* ===== Экраны ===== */
const Screens = {
  busy: false,
  async show(id) {
    let guard = 0;
    while (this.busy && guard++ < 100) await wait(50);
    if (this.busy) return;
    const cur = document.querySelector('.screen.active');
    if (cur && cur.id === id) return;
    this.busy = true;
    try { Sound.open(); } catch (e) {}
    try {
      if (cur) {
        cur.classList.remove('fade-in');
        await wait(900);
        cur.classList.remove('active');
      }
      const nxt = $(id);
      if (nxt) {
        nxt.classList.add('active');
        void nxt.offsetWidth;
        nxt.classList.add('fade-in');
      }
    } finally {
      this.busy = false;
    }
  },
  swap(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active', 'fade-in'));
    const n = $(id); if (n) n.classList.add('active', 'fade-in');
  }
};

/* ===== Окна ===== */
const LOCKED = ['buy', 'jail', 'mono-fx', 'gameover', 'confirm', 'sell'];
const Modal = {
  open(id) { try { Sound.open(); } catch (e) {} const n = $(id); if (n) n.classList.add('show'); },
  close(id) { const n = $(id); if (n) n.classList.remove('show'); },
  closeAll() { document.querySelectorAll('.overlay.show').forEach(o => { if (!LOCKED.includes(o.id)) o.classList.remove('show'); }); }
};
document.querySelectorAll('.overlay').forEach(o => {
  o.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    o.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t));
    o.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.dataset.p === t.dataset.t));
  }));
  o.addEventListener('mousedown', e => { if (e.target === o && !LOCKED.includes(o.id)) Modal.close(o.id); });
});
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => Modal.close(b.dataset.close)));
addEventListener('keydown', e => { if (e.key === 'Escape') Modal.closeAll(); });

/* ===== Панель обновлений (about) ===== */
const updItems = document.querySelectorAll('.upd-item');
if (updItems.length) {
  updItems.forEach(item => {
    item.addEventListener('click', () => {
      updItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const v = item.dataset.v;
      const content = document.getElementById('upd-content');
      if (!content) return;
      if (v === '1.2.5') {
        content.innerHTML = `<h3>Version 1.2.5 beta</h3><p class="dim">Что нового:</p><ul class="upd-ul dim">
          <li>Добавлен ивент «Аэрохоккей».</li>
          <li>Новые дуэли.</li>
          <li>Фикс мелких багов.</li>
          <li>Фикс аукционов.</li>
          <li>Фикс тюрьмы.</li>
        </ul>`;
      } else if (v === '1.2') {
        content.innerHTML = `<h3>Version 1.2 beta</h3><p class="dim">Что нового:</p><ul class="upd-ul dim">
          <li>Исправлен баг рассинхрона хоста и игроков, при котором из ивента выходил только хост.</li>
          <li>Добавлена оптимизация подключения: автопереподключение и устойчивость к разрывам связи.</li>
          <li>Исправлен баг с бесконечной стрельбой в дуэли (спам шаров).</li>
          <li>Улучшена стабильность сетевого соединения.</li>
        </ul>`;
      } else if (v === '1.1') {
        content.innerHTML = `<h3>Version 1.1 beta</h3><p class="dim">Что нового:</p><ul class="upd-ul dim">
          <li>Улучшена стабильность онлайн-режима.</li>
          <li>Убрана задержка после броска кубиков в мультиплеере.</li>
          <li>Новые арены для Дуэли.</li>
          <li>Исправлен баг с зависанием после ивента.</li>
          <li>Добавлена коллизия стен в Дуэли.</li>
          <li>Добавлен таймер в Дуэль (3:30).</li>
          <li>Поумневшие боты в Дуэли (не бьются в стены, мансят).</li>
          <li>DEV-панель: прямой запуск ивентов.</li>
        </ul>`;
      } else if (v === '1.0') {
        content.innerHTML = `<h3>Version 1.0.0</h3><p class="dim">Первый публичный релиз.</p>`;
      }
    });
  });
}

/* ===== Плашка подтверждения ===== */
let _confirmResolve = null;
function askConfirm(title, desc) {
  return new Promise(res => {
    if (_confirmResolve) {
      const prev = _confirmResolve;
      _confirmResolve = null;
      try { prev(false); } catch (_) {}
    }
    $('cf-title').textContent = title;
    $('cf-desc').textContent = desc;
    _confirmResolve = res;
    Modal.open('confirm');
  });
}
document.addEventListener('DOMContentLoaded', () => {
  const yes = $('cf-yes'), no = $('cf-no');
  if (yes) yes.addEventListener('click', () => {
    const r = _confirmResolve; _confirmResolve = null;
    Modal.close('confirm');
    if (r) r(true);
  });
  if (no) no.addEventListener('click', () => {
    const r = _confirmResolve; _confirmResolve = null;
    Modal.close('confirm');
    if (r) r(false);
  });
});

/* ===== Переходы ===== */
function resetRoom() {
  Room.players = [];
  Room.info = null;
  Room.starting = false;
  if (Room.cd) { clearInterval(Room.cd); Room.cd = 0; }
}
function toLobby() {
  try { Board.stop(); } catch (e) { console.error('Board.stop:', e); }
  try { DevPanel.close(); } catch (e) { console.error('DevPanel.close:', e); }
  try { SfxPanel.close(); } catch (e) { console.error('SfxPanel.close:', e); }
  resetRoom();
  Screens.show('lobby');
  try { Sound.playMusic(); } catch (e) {}
}
function leaveToLobby(msg) {
  try { Net.leave(); } catch (e) {}
  try { Board.stop(); } catch (e) {}
  resetRoom();
  try { DevPanel.close(); } catch (e) {}
  try { SfxPanel.close(); } catch (e) {}
  Modal.closeAll();
  document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
  Screens.show('lobby');
  try { Sound.playMusic(); } catch (e) {}
  if (msg) { try { Board.toast(msg); } catch (e) {} }
}
function startSingle(dev) {
  Game.dev = dev;
  try { Sound.stopMusic(); } catch (e) {}
  try { Board.start(Profile.name); } catch (e) { console.error('Board.start:', e); }
  Screens.show('game');
}

/* ===== Лобби ===== */
if (!isElectron) $('b-friends').classList.add('disabled');
$('b-friends').addEventListener('click', () => { if (!isElectron) return; Screens.show('friends'); });
$('b-single').addEventListener('click', () => startSingle(false));
$('b-settings').addEventListener('click', () => { $('pf-name').value = Profile.name; $('pf-msg').textContent = ''; Modal.open('settings'); });
$('b-about').addEventListener('click', () => Modal.open('about'));
$('b-exit').addEventListener('click', () => {
  if (isElectron) { window.close(); return; }
  try { Sound.error(); } catch (_) {}
  alert('Выход доступен только в Windows-версии игры.');
});
$('b-friends-back').addEventListener('click', () => Screens.show('lobby'));

$('b-game-exit').addEventListener('click', async () => {
  const ok = await askConfirm('Выйти из игры?', Net.connected ? 'Вы будете считаться банкротом, партия продолжится без вас.' : 'Текущая партия будет потеряна.');
  if (!ok) return;
  if (Net.connected) leaveToLobby(); else toLobby();
});

$('go-lobby').addEventListener('click', () => { Modal.close('gameover'); if (Net.connected) leaveToLobby(); else toLobby(); });

/* ===== Профиль ===== */
$('pf-save').addEventListener('click', () => {
  if (Profile.save($('pf-name').value)) { $('pf-name').value = Profile.name; $('pf-msg').style.color = '#9be3b0'; $('pf-msg').textContent = 'Никнейм сохранён'; }
  else { $('pf-msg').style.color = ''; $('pf-msg').textContent = 'От 2 до 16 символов: буквы, цифры, пробел, _ - .'; try { Sound.error(); } catch (e) {} }
});

/* ===== DEV ===== */
function tryDev() {
  if ($('dev-pass').value === DEV_PASSWORD) { $('dev-pass').value = ''; $('dev-err').textContent = ''; Modal.close('settings'); startSingle(true); }
  else { $('dev-err').textContent = 'Неверный пароль'; try { Sound.error(); } catch (e) {} }
}
$('dev-go').addEventListener('click', tryDev);
$('dev-pass').addEventListener('keydown', e => { if (e.key === 'Enter') tryDev(); });

/* ===== Настройки звука ===== */
const mm = $('m-music'), ms = $('m-sfx'), ma = $('m-all'), vm = $('v-music'), vs = $('v-sfx');
const syncAll = () => { ma.checked = mm.checked && ms.checked; };
mm.checked = Sound.state.muteMusic; ms.checked = Sound.state.muteSfx; syncAll();
vm.value = Math.round(Sound.state.music * 100); vs.value = Math.round(Sound.state.sfx * 100);
mm.addEventListener('change', () => { Sound.muteMusic(mm.checked); syncAll(); });
ms.addEventListener('change', () => { Sound.muteSfx(ms.checked); syncAll(); });
ma.addEventListener('change', () => { mm.checked = ms.checked = ma.checked; Sound.muteMusic(ma.checked); Sound.muteSfx(ma.checked); });
vm.addEventListener('input', () => Sound.setMusic(vm.value / 100));
vs.addEventListener('input', () => Sound.setSfx(vs.value / 100));

/* =====================================================================
 *  МУЛЬТИПЛЕЕР
 * ===================================================================== */
const Room = { players: [], info: null, starting: false, cd: 0 };
const SUITS = ['♠', '♥', '♦', '♣'];
const IP_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

function renderRoom() {
  const me = Room.players.find(p => p.id === Net.id);
  $('room-cards').innerHTML = Room.players.map((p, i) => `
    <div class="pcard ${p.ready ? 'ready' : ''} ${p.id === Net.id ? 'mine' : ''}" style="--i:${i}">
      <span class="pc-corner tl">${SUITS[i % 4]}</span><span class="pc-corner br">${SUITS[i % 4]}</span>
      <div class="pcard-suit">${SUITS[i % 4]}</div>
      <div class="pcard-name">${esc(p.name)}</div>
      <div class="pcard-role">${p.host ? 'Хост' : 'Игрок'}</div>
      <div class="pcard-state">${p.ready ? '✔ Готов' : 'Не готов'}</div>
    </div>`).join('');
  $('room-ready').textContent = me && me.ready ? 'Отменить готовность' : 'Готов';
  $('room-ready').classList.toggle('on', !!(me && me.ready));
  $('room-info').innerHTML = Net.isHost && Room.info
    ? `Друзья подключаются по IP <b>${esc(Room.info.ip)}</b> · пароль <b>${esc(Room.info.pw)}</b>`
    : 'Нажмите «Готов», когда будете готовы к игре';
  if (!Room.starting) $('room-note').textContent = Room.players.length < 2 ? 'Ожидаем игроков… (нужно минимум 2)' : '';
}

function goRoom() {
  Modal.close('mp-create'); Modal.close('mp-join');
  Screens.swap('room');
  renderRoom();
}

$('b-create').addEventListener('click', async () => {
  $('mp-err').textContent = ''; $('mp-pw').value = ''; $('mp-ips').textContent = '';
  Modal.open('mp-create');
  try {
    const ips = await window.desktop.localIPs();
    const best = ips.find(x => x.radmin) || ips[0];
    if (best) $('mp-ip').value = best.ip;
    $('mp-ips').textContent = ips.length ? 'Найдены адреса: ' + ips.map(x => x.ip + (x.radmin ? ' (Radmin)' : '')).join(', ') : 'Сетевые адреса не найдены — включите Radmin VPN';
  } catch (e) {}
});
$('mp-cancel').addEventListener('click', () => Modal.close('mp-create'));
$('mp-go').addEventListener('click', async () => {
  const ip = $('mp-ip').value.trim(), pw = $('mp-pw').value.trim(), err = $('mp-err');
  err.textContent = '';
  if (!IP_RE.test(ip)) { err.textContent = 'Введите свой IP (адрес в Radmin VPN)'; try { Sound.error(); } catch (_) {} return; }
  if (pw.length < 3) { err.textContent = 'Пароль — минимум 3 символа'; try { Sound.error(); } catch (_) {} return; }
  try {
    const ips = await window.desktop.localIPs();
    if (!ips.some(x => x.ip === ip)) { err.textContent = 'Такого адреса нет на этом компьютере. Включите Radmin VPN и введите свой Radmin-IP.'; try { Sound.error(); } catch (_) {} return; }
  } catch (e) {}
  $('mp-go').disabled = true; err.style.color = ''; err.textContent = 'Создаём комнату…';
  try {
    await withTimeout(Net.host({ password: pw, name: Profile.name }), 20000, 'Таймаут подключения');
    Room.info = { ip, pw }; resetRoom(); Room.info = { ip, pw };
    goRoom(); err.textContent = '';
  } catch (e) {
    err.textContent = String(e);
    try { Sound.error(); } catch (_) {}
  } finally {
    $('mp-go').disabled = false;
  }
});

$('b-join').addEventListener('click', () => { $('mj-err').textContent = ''; Modal.open('mp-join'); });
$('mj-cancel').addEventListener('click', () => Modal.close('mp-join'));
$('mj-go').addEventListener('click', async () => {
  const ip = $('mj-ip').value.trim(), pw = $('mj-pw').value.trim(), err = $('mj-err');
  err.textContent = '';
  if (!IP_RE.test(ip)) { err.textContent = 'Введите IP хоста (его адрес в Radmin VPN)'; try { Sound.error(); } catch (_) {} return; }
  if (!pw) { err.textContent = 'Введите пароль комнаты'; try { Sound.error(); } catch (_) {} return; }
  $('mj-go').disabled = true; err.textContent = 'Подключаемся…';
  try {
    await withTimeout(Net.join({ ip, password: pw, name: Profile.name }), 20000, 'Таймаут подключения');
    resetRoom(); Room.info = null;
    goRoom(); err.textContent = '';
  } catch (e) {
    err.textContent = String(e);
    try { Sound.error(); } catch (_) {}
  } finally {
    $('mj-go').disabled = false;
  }
});

$('room-ready').addEventListener('click', () => { const me = Room.players.find(p => p.id === Net.id); Net.ready(!(me && me.ready)); });
$('room-leave').addEventListener('click', () => leaveToLobby());

Net.on('room', m => { Room.players = m.players; renderRoom(); });
Net.on('starting', () => {
  Room.starting = true; let n = 3;
  if (Room.cd) { clearInterval(Room.cd); Room.cd = 0; }
  const set = () => { $('room-note').textContent = `Все готовы! Игра начинается через ${n}…`; };
  set();
  Room.cd = setInterval(() => {
    n--;
    if (n <= 0) {
      clearInterval(Room.cd); Room.cd = 0;
      $('room-note').textContent = 'Загрузка...';
    } else set();
  }, 1000);
});
Net.on('cancel', () => {
  Room.starting = false;
  if (Room.cd) { clearInterval(Room.cd); Room.cd = 0; }
  renderRoom();
});

Net.on('start', m => {
  console.log('START EVENT RECEIVED:', m);

  Room.starting = false;
  if (Room.cd) { clearInterval(Room.cd); Room.cd = 0; }
  $('room-note').textContent = 'Загрузка...';

  try { Sound.stopMusic(); Game.dev = false; } catch (e) {}

  Screens.swap('game');

  if (Net.isHost && m && m.players) {
    try {
      Board.hostStart(m.players);
      Board.go();
    } catch (e) {
      console.error('Старт игры (хост) упал:', e);
      try { Board.toast('Ошибка старта, попробуйте ещё раз'); } catch (_) {}
      return;
    }
  }

  try { SfxPanel.onPlay = src => Board.sfxSend(src); } catch (e) {}
});

Net.on('g', m => Board.netMsg(m.d, m.from));
Net.on('left', m => Board.onLeft(m.id));
Net.on('hostLeft', () => leaveToLobby('Хост закрыл комнату'));
Net.on('closed', () => leaveToLobby('Соединение с игрой потеряно'));

Net.on('disconnected', () => { try { Board.toast('Связь потеряна, переподключаемся…'); } catch (e) {} });
Net.on('reconnecting', m => { try { Board.toast(`Переподключение (${m.attempt}/6)…`); } catch (e) {} });
Net.on('reconnected', () => {
  try { Board.toast('Связь восстановлена'); } catch (e) {}
  try { Board.resync(); } catch (e) { console.error('Board.resync:', e); }
});

/* =====================================================================
 *  АВТООБНОВЛЕНИЕ
 * ===================================================================== */
let manualCheck = false;

(function setupAutoUpdate() {
  if (!isElectron) return;
  const D = window.desktop || {};
  const updBtn = $('upd-check');
  const installBtn = $('upd-install');
  const statusEl = $('upd-status');
  const verEl = $('upd-ver');
  const canUpd = !!D.packaged && typeof D.updateCheck === 'function';

  if (verEl && typeof D.getVersion === 'function') {
    D.getVersion().then(v => { verEl.textContent = v || '—'; }).catch(() => {});
  }

  if (!canUpd) {
    if (updBtn) { updBtn.disabled = true; updBtn.textContent = 'Недоступно в dev-режиме'; updBtn.classList.add('disabled'); }
    if (statusEl) statusEl.textContent = 'Автообновление работает только в собранной версии (.exe)';
    return;
  }

  const inGame = () => { const g = $('game'); return g && g.classList.contains('active'); };
  const showToast = t => { try { Board.toast(t); } catch (e) { console.log('[update]', t); } };

  let pendingInstall = false;
  let installTimer = null;
  let readyHandled = false;

  function installNow() {
    if (typeof D.updateInstall !== 'function') return;
    clearTimeout(installTimer);
    D.updateInstall().then(r => {
      if (!r || !r.ok) showToast('Не удалось установить обновление: ' + ((r && r.error) || 'неизвестно'));
    }).catch(err => console.error('[update] install:', err));
  }

  function handleReady(info) {
    if (readyHandled) return;
    readyHandled = true;
    const v = (info && info.version) || '';
    if (installBtn) installBtn.style.display = '';
    if (inGame()) {
      pendingInstall = true;
      showToast(`Обновление ${v} загружено. Установится при выходе в меню.`);
    } else {
      showToast(`Обновление ${v} загружено. Перезапуск через 3 секунды…`);
      installTimer = setTimeout(installNow, 3000);
    }
  }

  if (typeof D.onUpdateReady === 'function') D.onUpdateReady(handleReady);
  if (typeof D.updateGetStatus === 'function') {
    D.updateGetStatus().then(s => {
      if (s && s.ready && s.version) handleReady({ version: s.version });
    }).catch(() => {});
  }

  const gameScreen = $('game');
  if (gameScreen) {
    const obs = new MutationObserver(() => {
      if (pendingInstall && !inGame()) {
        pendingInstall = false;
        showToast('Применяем обновление…');
        setTimeout(installNow, 1200);
      }
    });
    obs.observe(gameScreen, { attributes: true, attributeFilter: ['class'] });
  }

  if (typeof D.onUpdateStatus === 'function') {
    D.onUpdateStatus(s => {
      if (!s || !statusEl) return;
      const open = $('settings') && $('settings').classList.contains('show');
      switch (s.status) {
        case 'checking':    if (open) statusEl.textContent = 'Проверяем…'; break;
        case 'available':   if (open) statusEl.textContent = `Найдено ${s.version}, скачиваем…`; break;
        case 'downloading': if (open) statusEl.textContent = `Скачиваем ${Math.round(s.percent || 0)}%`; break;
        case 'downloaded':  statusEl.textContent = `Готово: ${s.version}`; break;
        case 'up-to-date':  if (open && manualCheck) statusEl.textContent = 'Обновлений нет'; manualCheck = false; break;
        case 'error':       if (open && manualCheck) { statusEl.textContent = 'Ошибка: ' + (s.message || ''); manualCheck = false; } break;
      }
    });
  }

  if (updBtn) {
    updBtn.addEventListener('click', async () => {
      manualCheck = true;
      updBtn.disabled = true;
      if (statusEl) statusEl.textContent = 'Проверяем…';
      try {
        const r = await D.updateCheck();
        if (!r || !r.ok) {
          manualCheck = false;
          if (statusEl) statusEl.textContent = 'Ошибка: ' + ((r && r.error) || 'неизвестно');
        }
      } catch (e) {
        manualCheck = false;
        if (statusEl) statusEl.textContent = 'Ошибка: ' + String(e);
      }
      updBtn.disabled = false;
    });
  }

  if (installBtn) installBtn.addEventListener('click', () => {
    installBtn.disabled = true;
    installNow();
  });
})();

/* ===== ЗАСТАВКА ===== */
const INTRO = { BLACK: 1500, LOGO_IN: 2600, LOGO_HOLD: 3000, LOGO_OUT: 2600, GAP: 600,
                STAR_IN: 2600, STAR_SPIN: 5000, STAR_OUT: 2000, GAP2: 700, LOBBY_IN: 4200 };
(async function intro() {
  const ov = $('intro'), logo = $('intro-logo'), star = $('intro-star'), lobby = $('lobby');
  try {
    await wait(INTRO.BLACK);
    logo.style.setProperty('--tt', INTRO.LOGO_IN + 'ms'); logo.classList.add('show');
    await wait(INTRO.LOGO_IN + INTRO.LOGO_HOLD);
    logo.style.setProperty('--tt', INTRO.LOGO_OUT + 'ms'); logo.classList.remove('show');
    await wait(INTRO.LOGO_OUT + INTRO.GAP);
    star.style.setProperty('--tt', INTRO.STAR_IN + 'ms'); star.classList.add('show', 'spin');
    await wait(INTRO.STAR_IN + INTRO.STAR_SPIN);
    star.style.setProperty('--tt', INTRO.STAR_OUT + 'ms'); star.classList.remove('show');
    await wait(INTRO.STAR_OUT + INTRO.GAP2);
    ov.style.setProperty('--ti', INTRO.LOBBY_IN + 'ms');
    lobby.classList.add('ready');
    try { Sound.playMusic(); } catch (e) {}
    ov.classList.add('done');
    await wait(INTRO.LOBBY_IN);
  } catch (err) {
    console.error('intro:', err);
  } finally {
    ov.style.display = 'none';
    lobby.inert = false;
  }
})();