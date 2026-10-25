const { app, BrowserWindow, Menu, ipcMain, Notification } = require('electron');
const path = require('path');
const server = require('./net-server.js');
// === AUTO-UPDATE ===
const { autoUpdater } = require('electron-updater');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

ipcMain.handle('net:start', (e, o) => server.start({ port: +(o && o.port) || 47100, password: o && o.password }));
ipcMain.handle('net:stop', () => { server.stop(); return true; });
ipcMain.handle('net:ips', () => server.localIPs());

// === AUTO-UPDATE ===
// Проверяет обновления на GitHub Releases, качает в фоне, ставит при выходе.
function setupUpdater() {
  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => console.error('[updater] error:', err));
  autoUpdater.on('checking-for-update', () => console.log('[updater] checking…'));
  autoUpdater.on('update-available', (info) => console.log('[updater] available:', info.version));
  autoUpdater.on('update-not-available', () => console.log('[updater] no updates'));
  autoUpdater.on('download-progress', (p) => {
    console.log(`[updater] downloading ${p.percent.toFixed(1)}%`);
  });
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] downloaded:', info.version);
    if (Notification.isSupported()) {
      try {
        new Notification({
          title: "Nazay's Monopoly",
          body: `Обновление ${info.version} загружено. Установится при следующем запуске.`,
        }).show();
      } catch (e) {}
    }
  });

  const check = () => autoUpdater.checkForUpdatesAndNotify().catch(err => console.error('[updater]', err));
  check();
  setInterval(check, 30 * 60 * 1000); // каждые 30 минут
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1100, minHeight: 700,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false      // хост считает игру, даже если окно свёрнуто
    }
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => win.show());
  win.loadFile('index.html');
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.key === 'F12' && !app.isPackaged) { win.webContents.toggleDevTools(); e.preventDefault(); }
  });
}

app.whenReady().then(() => {
  createWindow();
  // === AUTO-UPDATE ===
  // Работает только в собранном .exe, не в `npm start`.
  if (app.isPackaged) setupUpdater();
});
app.on('before-quit', () => server.stop());
app.on('window-all-closed', () => app.quit());