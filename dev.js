/* dev.js — DEV-панель разработчика. Открывается клавишей Shift (нажал и отпустил),
 * только в DEV-режиме (Настройки → DEV → пароль) и только на игровом экране.
 * Вся логика игры лежит в Board.dev (board.js) — здесь только кнопки. */
const DevPanel = (() => {
  const $ = id => document.getElementById(id);
  const panel = $('dev-panel');
  let filled = false;

  const gameOn = () => $('game').classList.contains('active');
  const sceneOn = () => $('ev-scene').classList.contains('on');
  const typing = t => t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
  const pid = () => +$('dv-player').value;
  const say = t => { $('dv-status').textContent = t; };

  function fill() {
    const cells = Board.cells, D = Board.dev;
    $('dv-player').innerHTML = Board.players.map((p, i) => `<option value="${i}">${p.name}</option>`).join('');
    $('dv-ev-p1').innerHTML = Board.players.map((p, i) => `<option value="${i}">${p.name}</option>`).join('');
    $('dv-ev-p2').innerHTML = Board.players.map((p, i) => `<option value="${i}">${p.name}</option>`).join('');
    
    $('dv-cell').innerHTML = cells.map((c, i) => `<option value="${i}">${i}. ${c.n}</option>`).join('');
    $('dv-biz').innerHTML = cells.map((c, i) => c.t === 'biz' ? `<option value="${i}">${c.n}</option>` : '').join('');
    $('dv-group').innerHTML = Object.keys(D.groups).map(k =>
      `<option value="${k}">${k.replace('g', 'Группа ')}: ${D.groups[k].map(i => cells[i].n).join(', ')}</option>`).join('');
    const nums = [1, 2, 3, 4, 5, 6].map(n => `<option value="${n}">${n}</option>`).join('');
    $('dv-d1').innerHTML = nums; $('dv-d2').innerHTML = nums;
    filled = true;
  }

  const api = {
    isOpen: () => panel.classList.contains('open'),
    open() { if (!filled) fill(); panel.classList.add('open'); },
    close() { panel.classList.remove('open'); },
    toggle() { api.isOpen() ? api.close() : api.open(); }
  };

  /* Shift: срабатывает на отпускание, если между нажатием и отпусканием не было других клавиш */
  let clean = false;
  addEventListener('keydown', e => {
    if (e.key === 'Shift') { if (!e.repeat) clean = true; }
    else clean = false;
  });
  addEventListener('keyup', e => {
    if (e.key !== 'Shift' || !clean) return;
    clean = false;
    if (typing(e.target)) return;
    if (!Game.dev || !gameOn() || sceneOn()) return;
    api.toggle();
  });

  panel.addEventListener('click', async e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a, D = Board.dev, p = pid(), name = Board.players[p].name;
    const cell = +$('dv-cell').value, biz = +$('dv-biz').value, grp = $('dv-group').value;
    const amt = parseInt($('dv-money').value || '0', 10) || 0;

    switch (a) {
      case 'star':       say('Звезда…'); FX.testStar(); break;
      case 'jailfx':     say('Тюрьма: ' + name); D.jailFx(p); break;
      case 'mono':       say('Монополия: ' + name); D.monoTest(p, grp); break;
      case 'ev-direct-duel': D.eventDirect('duel', +$('dv-ev-p1').value, +$('dv-ev-p2').value); say('Запуск дуэли'); break;
      case 'ev-direct-steal': D.eventDirect('steal', +$('dv-ev-p1').value, +$('dv-ev-p2').value); say('Запуск дележки'); break;
      case 'ev-direct-traitor': D.eventDirect('traitor', +$('dv-ev-p1').value, +$('dv-ev-p2').value); say('Запуск предателя'); break;
      case 'ev-direct-airhockey': D.eventDirect('airhockey', +$('dv-ev-p1').value, +$('dv-ev-p2').value); say('Запуск аэрохоккея'); break;
      case 'm-add':      D.money(p, 'add', amt); say(`${name}: +${amt} €`); break;
      case 'm-sub':      D.money(p, 'sub', amt); say(`${name}: −${amt} €`); break;
      case 'm-set':      D.money(p, 'set', amt); say(`${name}: баланс ${amt} €`); break;
      case 'tp':         say((await D.teleport(p, cell, $('dv-apply').checked)) ? `${name} → «${Board.cells[cell].n}»` : 'Дождитесь конца хода'); break;
      case 'give':       say(D.giveBiz(p, biz) ? `${name} получил «${Board.cells[biz].n}»` : 'Не вышло'); break;
      case 'take':       say(D.takeBiz(biz) ? `«${Board.cells[biz].n}» свободен` : 'Бизнес и так свободен'); break;
      case 'star-up':    say(D.stars(biz, 1) ? 'Звезда добавлена' : 'У бизнеса нет владельца'); break;
      case 'star-down':  say(D.stars(biz, -1) ? 'Звезда снята' : 'У бизнеса нет владельца'); break;
      case 'give-group': D.giveGroup(p, grp); say(`${name} получил группу`); break;
      case 'take-all':   D.takeAll(p); say(`У ${name} забраны все бизнесы`); break;
      case 'dice':       D.dice(+$('dv-d1').value, +$('dv-d2').value); say(`Следующий бросок: ${$('dv-d1').value} и ${$('dv-d2').value}`); break;
      case 'jail-in':    D.jailIn(p); say(`${name} в тюрьме`); break;
      case 'jail-out':   D.jailOut(p); say(`${name} выпущен`); break;
    }
  });

  return api;
})();