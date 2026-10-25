const { app, BrowserWindow, Menu, ipcMain, Notification } = require('electron');
const path = require('path');
const server = require('./net-server.js');
// === AUTO-UPDATE ===
const { autoUpdater } = require('electron-updater');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

ipcMain.handle('net:start', (e, o) => server.start({ port: +(o && o.port) || 47100, password: o && o.password }));
ipcMain.handle('net:stop', () => { server.stop(); return true; });
ipcMain.handle('net:ips', () => server.localIPs());

/* ===== AUTO-UPDATE =====
 * Стратегия:
 *  - Проверка при старте, каждые 30 минут и при возврате фокуса (троттлинг 5 мин).
 *  - Скачивание автоматически в фоне (autoDownload).
 *  - После скачивания шлём 'update:ready' в рендер. Рендер сам решает когда ставиться:
 *      • в лобби — тихая перезагрузка через 3 сек;
 *      • в игре — ждём выхода в меню;
 *      • если пользователь всё игнорирует — autoInstallOnAppQuit поставит при закрытии.
 *  - allowPrerelease включается автоматически, если текущая версия имеет суффикс (-beta и т.п.).
 */
let updateReady = null;        // { version } после скачивания
let updateDownloadedAt = 0;
let mainWindow = null;

function sendUpdateStatus(data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { mainWindow.webContents.send('update:status', data); } catch (e) {}
  }
}
function sendUpdateReady(data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { mainWindow.webContents.send('update:ready', data); } catch (e) {}
  }
}

function setupUpdater() {
  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.autoRunAppAfterInstall = true;

  // Автоопределение prerelease по текущей версии
  const currentVer = app.getVersion();
  autoUpdater.allowPrerelease = /-/.test(currentVer);
  console.log('[updater] current', currentVer, '· allowPrerelease =', autoUpdater.allowPrerelease);

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err);
    sendUpdateStatus({ status: 'error', message: String((err && err.message) || err) });
  });
  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] checking…');
    sendUpdateStatus({ status: 'checking' });
  });
  autoUpdater.on('update-available', (info) => {
    console.log('[updater] available:', info.version);
    sendUpdateStatus({ status: 'available', version: info.version });
  });
  autoUpdater.on('update-not-available', (info) => {
    console.log('[updater] no updates');
    sendUpdateStatus({ status: 'up-to-date', version: info && info.version });
  });
  autoUpdater.on('download-progress', (p) => {
    sendUpdateStatus({ status: 'downloading', percent: p.percent });
  });
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] downloaded:', info.version);
    updateReady = { version: info.version };
    updateDownloadedAt = Date.now();
    sendUpdateStatus({ status: 'downloaded', version: info.version });
    sendUpdateReady({ version: info.version });

    // Нотификация в ОС — только если окно не в фокусе (иначе уже есть toast в игре)
    const focused = mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused();
    if (!focused && Notification.isSupported()) {
      try {
        new Notification({
          title: "Nazay's Monopoly",
          body: `Обновление ${info.version} загружено. Будет установлено автоматически.`,
        }).show();
      } catch (e) {}
    }
  });

  const check = () => {
    autoUpdater.checkForUpdates().catch(err => {
      console.error('[updater] check failed:', err);
      sendUpdateStatus({ status: 'error', message: String((err && err.message) || err) });
    });
  };

  check();
  setInterval(check, 30 * 60 * 1000); // каждые 30 минут

  // Проверка при возврате фокуса (не чаще, чем раз в 5 минут)
  let lastFocusCheck = 0;
  app.on('browser-window-focus', () => {
    if (Date.now() - lastFocusCheck < 5 * 60 * 1000) return;
    lastFocusCheck = Date.now();
    check();
  });
}

ipcMain.handle('app:version', () => app.getVersion());

ipcMain.handle('update:check', async () => {
  try {
    const r = await autoUpdater.checkForUpdates();
    return { ok: true, version: r && r.updateInfo && r.updateInfo.version };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
});

ipcMain.handle('update:install', () => {
  if (!updateReady) return { ok: false, error: 'Обновление ещё не загружено' };
  // Даём IPC-ответу уйти до того, как приложение начнёт завершаться
  setImmediate(() => {
    try {
      autoUpdater.quitAndInstall(true, true); // isSilent, isForceRunAfter
    } catch (err) {
      console.error('[updater] quitAndInstall failed:', err);
    }
  });
  return { ok: true };
});

ipcMain.handle('update:get-status', () => ({
  ready: !!updateReady,
  version: updateReady && updateReady.version,
  downloadedAt: updateDownloadedAt,
}));

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1100, minHeight: 700,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false      // хост считает игру, даже если окно свёрнуто
    }
  });
  Menu.setApplicationMenu(null);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { mainWindow.setFullScreen(!mainWindow.isFullScreen()); e.preventDefault(); }
    if (input.key === 'F12' && !app.isPackaged) { mainWindow.webContents.toggleDevTools(); e.preventDefault(); }
  });
  mainWindow.on('closed', () => { mainWindow = null; });

  // После полной загрузки страницы — если обновление уже готово, досылаем событие,
  // на случай если рендер зарегистрировал слушателя уже после первого emit.
  mainWindow.webContents.on('did-finish-load', () => {
    if (updateReady) sendUpdateReady({ version: updateReady.version });
  });
}

app.whenReady().then(() => {
  createWindow();
  if (app.isPackaged) setupUpdater();
});
app.on('before-quit', () => server.stop());
app.on('window-all-closed', () => app.quit());