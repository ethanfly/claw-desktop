import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  windowControl: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  },
  onTrayNewSession: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('tray-new-session', handler)
    return () => ipcRenderer.removeListener('tray-new-session', handler)
  },
  readOpenClawConfig: () => ipcRenderer.invoke('read-openclaw-config'),
  getDeviceIdentity: () => ipcRenderer.invoke('device-identity'),
  signDevicePayload: (privateKey: string, payload: string) =>
    ipcRenderer.invoke('device-sign', { privateKey, payload }),
})
