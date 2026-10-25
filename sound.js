/* sound.js — звуковая система и музыка с разблокировкой при первом действии
 *
 * Карта звуков. Чтобы заменить звук на новый — поменяй путь в блоке F.
 *
 * Для ивентов добавлены функции-заглушки (пока играют похожие существующие файлы).
 * Когда найдёшь нормальные звуки — просто поменяй пути в F.eventStar / F.eventSpin /
 * F.eventArrow / F.eventHit, сами вызовы в коде трогать не надо.
 */
const Sound = (() => {
  const F = {
    // --- UI ---
    hover:      'audio/klik-knopki--standart.mp3',
    click:      'audio/button-click-noisy-close-high.mp3',
    open:       'audio/polesdvig.mp3',
    close:      'audio/69880c1f5e57698.mp3',
    error:      'audio/error.mp3',

    // --- Музыка лобби ---
    lobby:      'audio/The_Slow_Pour.mp3',

    // --- Ход / фишка / кубики ---
    diceRoll:   'audio/c7df5ff40ccf1b6.mp3',
    chipStep:   'audio/free-sound-1674871939.mp3',
    teleport:   'audio/teleport-opening-sound.mp3',

    // --- Деньги (покупка / аренда / служебные клетки) ---
    money:      'audio/audiojoiner120623175716.mp3',

    // --- Клетки ---
    doctor:     'audio/rzhd-pribytie-poezda.mp3',
    jail:       'audio/guk-guk-politsiia.mp3',

    // --- Монополия / аукцион / почта ---
    monopoly:   'audio/fanfare-sound.mp3',
    letter:     'audio/discord-notification.mp3',

    // --- Чат / формы ---
    msgSend:    'audio/xiaomi-notice.mp3',
    deal:       'audio/festive-festive-fireworks-background-sound-effect.mp3',

    // --- Дуэль ---
    shot:       'audio/shooting-a-short-gun.mp3',

    // --- Ивенты: звёздный переход, рулетка, стрелка, попадание ---
    // Заменить, когда найдёшь подходящие звуки. Пока играют похожие.
    eventStar:  'audio/teleport-opening-sound.mp3',           // «вжух» при вылете звезды
    eventSpin:  'audio/klik-knopki--standart.mp3',            // тик рулетки
    eventArrow: 'audio/mechanisms-strikes-single-short-distant.mp3', // остановка стрелки на игроке
    eventHit:   'audio/shooting-a-short-gun.mp3'              // попадание по игроку
  };

  const KEY = 'nm_sound_v1';
  const state = Object.assign(
    { music: 0.22, sfx: 1, muteMusic: false, muteSfx: false },
    JSON.parse(localStorage.getItem(KEY) || '{}')
  );
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));

  const pool = {};
  const preload = (src) => {
    if (pool[src]) return pool[src];
    const a = new Audio(src);
    a.preload = 'auto';
    a.load();
    pool[src] = a;
    return a;
  };
  Object.values(F).forEach(preload);

  const music = preload(F.lobby);
  music.loop = true;
  let want = false;
  const apply = () => { music.volume = state.muteMusic ? 0 : state.music; };
  apply();

  let unlocked = false;
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    Object.values(pool).forEach(a => {
      try {
        const v = a.volume;
        a.volume = 0;
        const p = a.play();
        if (p && p.then) p.then(() => { a.pause(); a.currentTime = 0; a.volume = v; }).catch(() => { a.volume = v; });
        else { a.pause(); a.currentTime = 0; a.volume = v; }
      } catch (e) {}
    });
    if (want) music.play().catch(() => {});
  }
  addEventListener('pointerdown', unlock, { once: true });
  addEventListener('pointermove', unlock, { once: true });
  addEventListener('keydown', unlock, { once: true });
  addEventListener('touchstart', unlock, { once: true });

  const playMusic = () => { want = true; music.play().catch(() => {}); };
  const stopMusic = () => { want = false; music.pause(); };

  const sfx = (src) => {
    if (state.muteSfx || !src) return;
    const a = preload(src).cloneNode();
    a.volume = state.sfx;
    a.play().catch(() => {});
  };

  // Повторное воспроизведение файла N раз с интервалом gap мс.
  // Используется, например, для тюрьмы (guk-guk 3 раза подряд).
  const playN = (src, n, gap) => {
    if (state.muteSfx || !src || n <= 0) return;
    const step = gap || 400;
    for (let i = 0; i < n; i++) setTimeout(() => sfx(src), i * step);
  };

  return {
    state,

    // UI
    hover:  () => sfx(F.hover),
    click:  () => sfx(F.click),
    open:   () => sfx(F.open),
    close:  () => sfx(F.close),
    error:  () => sfx(F.error),

    // Категории
    diceRoll: () => sfx(F.diceRoll),
    chipStep: () => sfx(F.chipStep),
    teleport: () => sfx(F.teleport),
    money:    () => sfx(F.money),
    doctor:   () => sfx(F.doctor),
    jail:     () => playN(F.jail, 3, 450),   // 3 раза подряд
    monopoly: () => sfx(F.monopoly),
    letter:   () => sfx(F.letter),
    msgSend:  () => sfx(F.msgSend),
    deal:     () => sfx(F.deal),
    shot:     () => sfx(F.shot),

    // Ивенты (новые)
    eventStar:  () => sfx(F.eventStar),
    eventSpin:  () => sfx(F.eventSpin),
    eventArrow: () => sfx(F.eventArrow),
    eventHit:   () => sfx(F.eventHit),

    // Общий API
    playFile: src => sfx(src),
    playN,
    playMusic, stopMusic,

    setMusic(v) { state.music = v; apply(); save(); },
    setSfx(v)   { state.sfx = v; save(); },
    muteMusic(b){ state.muteMusic = b; apply(); save(); },
    muteSfx(b)  { state.muteSfx = b; save(); }
  };
})();

/* Автоматические звуки для кнопок */
document.addEventListener('pointerover', e => {
  const b = e.target.closest('.btn');
  if (b && !b.contains(e.relatedTarget) && !b.classList.contains('disabled')) Sound.hover();
});
document.addEventListener('click', e => {
  const b = e.target.closest('.btn');
  if (!b) return;
  if (b.classList.contains('disabled') || b.disabled) { Sound.error(); return; }
  Sound.click();
});