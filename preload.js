const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  isElectron: true,
  platform: process.platform,
  netStart: o => ipcRenderer.invoke('net:start', o),
  netStop: () => ipcRenderer.invoke('net:stop'),
  localIPs: () => ipcRenderer.invoke('net:ips')
});