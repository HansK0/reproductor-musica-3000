const { contextBridge, ipcRenderer} = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  
  minimizeApp: () => ipcRenderer.send('minimizeApp'),
  maximizeApp: () => ipcRenderer.send('maximizeApp'),
  closeApp: () => ipcRenderer.send('closeApp'),

  get: (key) => ipcRenderer.invoke('store:get', key),
  set: (key, value) => ipcRenderer.invoke('store:set', key, value),
  delete: (key) => ipcRenderer.invoke('store:delete', key),

  onScanSongs: (typeOpen) => ipcRenderer.invoke("scanSongs", typeOpen),

  openDevTools: () => ipcRenderer.send('openDevTools'),

  deleteSong: (path) => ipcRenderer.invoke('song:delete', path),

  onThumbarAction: (callback) => ipcRenderer.on('thumbar-action', (_e, action) => callback(action)),
  notifyPlaybackState: (isPlaying) => ipcRenderer.send('playback-state-changed', isPlaying),

})

window.addEventListener('DOMContentLoaded', () => {
})