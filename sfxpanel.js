/* sfxpanel.js — панель звуковых эффектов (клавиша Tab, только на игровом экране).
 * Одновременно может звучать ТОЛЬКО ОДИН звук — новый останавливает предыдущий.
 * Громкость задаётся для каждого файла отдельно (по умолчанию — общая).
 * Для мультиплеера: SfxPanel.onPlay = src => отправить всем. */
const SfxPanel = (() => {
  const FILES = [
    { src: 'audio/mellstroy-poekhali-iopte.mp3',          label: 'Меллстрой — поехали, ёпте',        vol: 1   },
    { src: 'audio/posidim-melstroi.mp3',                  label: 'Посидим, Меллстрой',               vol: 2.5 },
    { src: 'audio/niukhai-bystree.mp3',                   label: 'Ньюхай, быстрее',                  vol: 1   },
    { src: 'audio/patriot-slushaet.mp3',                  label: 'Патриот слушает',                  vol: 1   },
    { src: 'audio/o-bratik-ty-che-tozhe-zdes-litvin.mp3', label: 'О, братик, ты чё тоже здесь (Литвин)', vol: 1 },
    { src: 'audio/smekh-rebenka.mp3',                     label: 'Смех ребёнка',                     vol: 1   },
    { src: 'audio/sendvich-so-spushchenkoi.mp3',          label: 'Сэндвич со сгущёнкой',             vol: 1   }
  ];

  const panel = document.getElementById('sfx-panel');
  const list = document.getElementById('sfx-list');
  const preloaded = FILES.map(f => { const a = new Audio(f.src); a.preload = 'auto'; return a; });
  list.innerHTML = FILES.map((f, i) => `<button class="sfx-btn" data-i="${i}">${f.label}</button>`).join('');

  let current = null;   // текущий играющий звук

  function stopCurrent() {
    if (current) {
      try { current.pause(); current.currentTime = 0; } catch (e) {}
      current = null;
    }
  }

  function playLocal(i) {
    stopCurrent();
    const file = FILES[i];
    const base = preloaded[i].cloneNode();
    base.volume = Math.min(1, (Sound.state.sfx || 1) * (file.vol || 1));
    base.play().catch(() => {});
    current = base;
    base.addEventListener('ended', () => { if (current === base) current = null; });
  }

  const api = {
    onPlay: null,
    isOpen: () => panel.classList.contains('open'),
    open() { panel.classList.add('open'); },
    close() { panel.classList.remove('open'); },
    toggle() { api.isOpen() ? api.close() : api.open(); },

    // чужой звук (без рассылки). Проигрывает локально, тоже один за раз.
    play(src) {
      stopCurrent();
      const idx = FILES.findIndex(f => f.src === src);
      if (idx >= 0) {
        const file = FILES[idx];
        const a = preloaded[idx].cloneNode();
        a.volume = Math.min(1, (Sound.state.sfx || 1) * (file.vol || 1));
        a.play().catch(() => {});
        current = a;
        a.addEventListener('ended', () => { if (current === a) current = null; });
      } else {
        Sound.playFile(src);
      }
    }
  };

  list.addEventListener('click', e => {
    const b = e.target.closest('.sfx-btn');
    if (!b) return;
    const i = +b.dataset.i;
    playLocal(i);
    if (api.onPlay) api.onPlay(FILES[i].src);
  });

  addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (!document.getElementById('game').classList.contains('active')) return;
    e.preventDefault();
    api.toggle();
  });

  return api;
})();