import { app, BrowserWindow, shell, Menu, ipcMain } from 'electron'
import { join } from 'path'
import { homedir } from 'os'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import crypto from 'node:crypto'

let mainWindow: BrowserWindow | null = null

function buildMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = []

  // macOS app menu (required)
  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about', label: `About ${app.name}` },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    })
  }

  // Edit menu — standard clipboard only, no file operations
  template.push({
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ],
  })

  // View menu — window controls
  template.push({
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  })

  // Window menu
  template.push({
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' },
      ...(isMac
        ? [
            { type: 'separator' as const },
            { role: 'front' as const },
            { type: 'separator' as const },
            { role: 'window' as const },
          ]
        : [{ role: 'close' }]),
    ],
  })

  // Help menu
  template.push({
    label: 'Help',
    submenu: [
      {
        label: 'About Claw Desktop',
        click: () => {
          mainWindow?.webContents.executeJavaScript(`
            alert('Claw Desktop v1.0.0\\nOpenClaw Desktop Chat Client')
          `)
        },
      },
    ],
  })

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  buildMenu()

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'Claw Desktop',
    backgroundColor: '#0f0f0f',
    show: false,
    frame: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Window control IPC handlers
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.on('window-close', () => mainWindow?.close())
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false)

// Read OpenClaw config from ~/.openclaw/openclaw.json (JSON5)
ipcMain.handle('read-openclaw-config', () => {
  try {
    const configPath = process.env.OPENCLAW_CONFIG_PATH
      || join(homedir(), '.openclaw', 'openclaw.json')

    if (!existsSync(configPath)) return null

    const raw = readFileSync(configPath, 'utf-8')
    // Strip JSON5 comments and trailing commas
    const cleaned = raw
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/,\s*([}\]])/g, '$1')
    const cfg = JSON.parse(cleaned)

    const gateway = cfg?.gateway ?? {}
    const auth = gateway.auth ?? {}
    const port = gateway.port ?? 18789
    const bind = gateway.bind ?? '127.0.0.1'

    return {
      url: `http://${bind === '0.0.0.0' ? '127.0.0.1' : bind}:${port}`,
      authMode: auth.mode === 'password' ? 'password' : 'token',
      token: typeof auth.token === 'string' ? auth.token : '',
      password: typeof auth.password === 'string' ? auth.password : '',
    }
  } catch {
    return null
  }
})

// Device identity for OpenClaw gateway (Ed25519 key pair)
const DEVICE_IDENTITY_PATH = join(homedir(), '.claw-desktop', 'device-identity.json')

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function loadOrCreateDeviceIdentity(): { deviceId: string; publicKey: string; privateKey: string } {
  try {
    if (existsSync(DEVICE_IDENTITY_PATH)) {
      const raw = readFileSync(DEVICE_IDENTITY_PATH, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed?.deviceId && parsed?.publicKey && parsed?.privateKey) {
        return parsed
      }
    }
  } catch { /* regenerate */ }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
  const pubDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer

  // Extract raw 32-byte Ed25519 public key (strip SPKI header)
  const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex')
  const rawPubKey = pubDer.subarray(0, spkiPrefix.length).equals(spkiPrefix)
    ? pubDer.subarray(spkiPrefix.length)
    : pubDer

  // Device ID = SHA-256 of raw public key bytes (must match server's deriveDeviceIdFromPublicKey)
  const deviceId = crypto.createHash('sha256').update(rawPubKey).digest('hex')
  const publicKeyB64Url = base64UrlEncode(rawPubKey)
  const privB64 = base64UrlEncode(privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer)

  const identity = { deviceId, publicKey: publicKeyB64Url, privateKey: privB64 }
  try {
    mkdirSync(join(homedir(), '.claw-desktop'), { recursive: true })
    writeFileSync(DEVICE_IDENTITY_PATH, JSON.stringify(identity, null, 2))
  } catch { /* ignore write failure */ }
  return identity
}

function signDevicePayload(privateKeyB64: string, payload: string): string {
  const keyData = Buffer.from(privateKeyB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  const key = crypto.createPrivateKey({ key: keyData, format: 'der', type: 'pkcs8' })
  const sig = crypto.sign(null, Buffer.from(payload, 'utf-8'), key)
  return base64UrlEncode(sig)
}

ipcMain.handle('device-identity', () => {
  return loadOrCreateDeviceIdentity()
})

ipcMain.handle('device-sign', (_e, { privateKey, payload }: { privateKey: string; payload: string }) => {
  return signDevicePayload(privateKey, payload)
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
