import { createContext, useContext } from 'react'

/* ---- Types ---- */
export type Lang = 'en' | 'zh'

/* ---- Translations ---- */
const strings: Record<Lang, Record<string, string>> = {
  en: {
    // TitleBar
    'titlebar.connected': 'Connected',
    'titlebar.disconnected': 'Disconnected',

    // ConnectDialog
    'connect.title': 'Connect to your OpenClaw gateway',
    'connect.gatewayUrl': 'Gateway URL',
    'connect.auth': 'Authentication',
    'connect.auth.token': 'Token',
    'connect.auth.password': 'Password',
    'connect.tokenLabel': 'Gateway Token',
    'connect.passwordLabel': 'Gateway Password',
    'connect.tokenPlaceholder': 'Enter your token...',
    'connect.passwordPlaceholder': 'Enter your password...',
    'connect.connecting': 'Connecting...',
    'connect.connect': 'Connect',
    'connect.hint': 'Make sure your OpenClaw gateway is running and accessible',
    'connect.autoLoaded': 'Auto-loaded from ~/.openclaw/openclaw.json',
    'connect.tokenLoaded': 'Token loaded',
    'connect.passwordLoaded': 'Password loaded',

    // Sidebar
    'sidebar.newSession': 'New Session',
    'sidebar.noSessions': 'No sessions yet',
    'sidebar.showThinking': 'Show Thinking',
    'sidebar.showTools': 'Show Tool Calls',
    'sidebar.connected': 'Connected',
    'sidebar.disconnected': 'Disconnected',
    'sidebar.language': 'Language',

    // ChatView
    'chat.welcome': 'Welcome to Claw Desktop',
    'chat.welcomeDesc': 'Start a conversation with your OpenClaw agent.',
    'chat.welcomeHint': 'Type a message below to begin.',
    'chat.refresh': 'Refresh',

    // InputArea
    'input.disabled': 'Not connected...',
    'input.running': 'Waiting for response...',
    'input.placeholder': 'Type a message... (Enter to send, Shift+Enter for newline)',
    'input.stop': 'Stop',
    'input.send': 'Send',
    'input.attach': 'Attach image',

    // MessageBubble
    'msg.thinking': 'Thinking',
    'msg.chars': 'chars',
    'msg.copy': 'Copy',
    'msg.copied': 'Copied',

    // ToolCard
    'tool.args': 'Arguments',
    'tool.output': 'Output',
    'tool.running': 'Running...',

    // RunningIndicator
    'run.using': 'Using',
    'run.processing': 'Processing...',

    // Session label
    'session.main': 'Main',
    'session.new': 'New Chat',
  },

  zh: {
    // TitleBar
    'titlebar.connected': '已连接',
    'titlebar.disconnected': '未连接',

    // ConnectDialog
    'connect.title': '连接到你的 OpenClaw 网关',
    'connect.gatewayUrl': '网关地址',
    'connect.auth': '认证方式',
    'connect.auth.token': '令牌',
    'connect.auth.password': '密码',
    'connect.tokenLabel': '网关令牌',
    'connect.passwordLabel': '网关密码',
    'connect.tokenPlaceholder': '输入你的令牌...',
    'connect.passwordPlaceholder': '输入你的密码...',
    'connect.connecting': '连接中...',
    'connect.connect': '连接',
    'connect.hint': '确保你的 OpenClaw 网关正在运行并可访问',
    'connect.autoLoaded': '已从 ~/.openclaw/openclaw.json 自动加载',
    'connect.tokenLoaded': '令牌已加载',
    'connect.passwordLoaded': '密码已加载',

    // Sidebar
    'sidebar.newSession': '新建会话',
    'sidebar.noSessions': '暂无会话',
    'sidebar.showThinking': '显示思考过程',
    'sidebar.showTools': '显示工具调用',
    'sidebar.connected': '已连接',
    'sidebar.disconnected': '未连接',
    'sidebar.language': '语言',

    // ChatView
    'chat.welcome': '欢迎使用 Claw Desktop',
    'chat.welcomeDesc': '与你的 OpenClaw 智能体开始对话。',
    'chat.welcomeHint': '在下方输入消息开始。',
    'chat.refresh': '刷新',

    // InputArea
    'input.disabled': '未连接...',
    'input.running': '等待回复...',
    'input.placeholder': '输入消息...（回车发送，Shift+回车换行）',
    'input.stop': '停止',
    'input.send': '发送',
    'input.attach': '添加图片',

    // MessageBubble
    'msg.thinking': '思考过程',
    'msg.chars': '字符',
    'msg.copy': '复制',
    'msg.copied': '已复制',

    // ToolCard
    'tool.args': '参数',
    'tool.output': '输出',
    'tool.running': '运行中...',

    // RunningIndicator
    'run.using': '正在使用',
    'run.processing': '处理中...',

    // Session label
    'session.main': '主会话',
    'session.new': '新对话',
  },
}

/* ---- Detect system language ---- */
export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem('claw-lang')
    if (saved === 'zh' || saved === 'en') return saved
  } catch { /* ignore */ }
  const nav = navigator.language.toLowerCase()
  return nav.startsWith('zh') ? 'zh' : 'en'
}

/* ---- Translate function ---- */
export function t(key: string, lang: Lang, params?: Record<string, string>): string {
  let s = strings[lang]?.[key] ?? strings.en[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, v)
  }
  return s
}

/* ---- React Context ---- */
interface I18nContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, params?: Record<string, string>) => string
}

export const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
})

export function useI18n() {
  return useContext(I18nContext)
}
