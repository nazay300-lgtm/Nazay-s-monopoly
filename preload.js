const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  isElectron: true,
  platform: process.platform,
  // true — запущено из .exe (packaged), false — через `electron .`
  packaged: !process.defaultApp,

  // Network
  netStart: o => ipcRenderer.invoke('net:start', o),
  netStop: () => ipcRenderer.invoke('net:stop'),
  localIPs: () => ipcRenderer.invoke('net:ips'),

  // App info
  getVersion: () => ipcRenderer.invoke('app:version'),

  // Auto-update API
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateInstall: () => ipcRenderer.invoke('update:install'),
  updateGetStatus: () => ipcRenderer.invoke('update:get-status'),
  onUpdateStatus: (cb) => {
    const h = (_e, d) => { try { cb(d); } catch (err) { console.error('onUpdateStatus', err); } };
    ipcRenderer.on('update:status', h);
    return () => ipcRenderer.removeListener('update:status', h);
  },
  onUpdateReady: (cb) => {
    const h = (_e, d) => { try { cb(d); } catch (err) { console.error('onUpdateReady', err); } };
    ipcRenderer.on('update:ready', h);
    return () => ipcRenderer.removeListener('update:ready', h);
  },
});