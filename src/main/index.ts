import { app, BrowserWindow, shell, Menu, ipcMain, Tray, nativeImage } from 'electron'
import { join } from 'path'
import { homedir } from 'os'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import crypto from 'node:crypto'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
}

// When a second instance is launched, focus the existing window
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    if (!mainWindow.isVisible()) mainWindow.show()
    mainWindow.focus()
  }
})

/* ---- tray i18n ---- */
function isSystemChinese(): boolean {
  const lang = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || app.getLocale()
  return lang.toLowerCase().startsWith('zh')
}

function buildTray(): void {
  // Build a small 16x16 tray icon from the app icon
  let iconPath: string
  if (process.env.ELECTRON_RENDERER_URL) {
    // Dev mode
    iconPath = join(process.cwd(), 'build', 'icon.png')
  } else {
    // Production: look in resources
    iconPath = join(process.resourcesPath, 'icon.png')
  }

  let trayIcon: Electron.NativeImage
  if (existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  } else {
    // Fallback: generate a minimal 16x16 purple circle
    const size = 16
    const buf = Buffer.alloc(size * size * 4)
    for (let i = 0; i < size * size; i++) {
      buf[i * 4] = 0x7c     // R
      buf[i * 4 + 1] = 0x3a // G
      buf[i * 4 + 2] = 0xed // B (#7c3aed)
      buf[i * 4 + 3] = 255  // A
    }
    trayIcon = nativeImage.createFromBuffer(buf, { width: size, height: size })
  }

  tray = new Tray(trayIcon)

  const zh = isSystemChinese()
  tray.setToolTip(zh ? 'Claw Desktop - 桌面客户端' : 'Claw Desktop')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Claw Desktop', enabled: false },
    { type: 'separator' },
    {
      label: zh ? '显示窗口' : 'Show Window',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore()
          if (!mainWindow.isVisible()) mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    {
      label: zh ? '新建会话' : 'New Session',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore()
          if (!mainWindow.isVisible()) mainWindow.show()
          mainWindow.focus()
          mainWindow.webContents.send('tray-new-session')
        }
      },
    },
    { type: 'separator' },
    {
      label: zh ? '退出' : 'Quit',
      click: () => {
        forceQuit = true
        app.quit()
      },
    },
  ])
  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
    }
  })
}

let forceQuit = false

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
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Minimize to tray instead of closing
  mainWindow.on('close', (e) => {
    if (!forceQuit) {
      e.preventDefault()
      mainWindow?.hide()
    }
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
ipcMain.on('window-close', () => {
  // Hide to tray instead of closing
  mainWindow?.hide()
})
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
    const rawBind = gateway.bind ?? '127.0.0.1'

    // Normalize bind address: loopback/localhost/0.0.0.0 → 127.0.0.1
    let bind = rawBind
    if (bind === 'loopback' || bind === 'localhost') bind = '127.0.0.1'
    else if (bind === '0.0.0.0') bind = '127.0.0.1'

    return {
      url: `http://${bind}:${port}`,
      authMode: auth.mode === 'password' ? 'password' : 'token',
      token: typeof auth.token === 'string' ? auth.token : '',
      password: typeof auth.password === 'string' ? auth.password : '',
    }
  } catch (e) {
    console.error('[openclaw-config] failed to read/parse config:', e)
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
  buildTray()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Don't quit on window close — keep running in tray
  // The user must use "Quit" from tray context menu to exit
})
