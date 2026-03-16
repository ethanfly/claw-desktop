# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development

```bash
npm run dev       # Start electron-vite dev server with HMR
npm run build     # Production build (main + preload + renderer)
npm run preview   # Preview production build
npm run dist      # Build + package with electron-builder
```

## Tech Stack

- **Shell**: Electron 33 (main process, preload script)
- **Build**: electron-vite (multi-target Vite for main/preload/renderer)
- **UI**: React 18 + TypeScript
- **Styling**: Tailwind CSS 3 (dark theme, custom accent colors)
- **Markdown**: react-markdown + remark-gfm + highlight.js

## Architecture

```
src/
  main/index.ts          # Electron main process - window creation
  preload/index.ts        # Context bridge (minimal)
  renderer/
    App.tsx               # Root component - all state management, event wiring
    lib/gateway.ts        # OpenClaw gateway WebSocket client (protocol v3)
    lib/types.ts          # Shared TypeScript interfaces
    components/
      ConnectDialog.tsx   # Gateway URL + auth token/password form
      Sidebar.tsx         # Session list, new session, toggles (thinking/tools)
      ChatView.tsx        # Message list, streaming text, tool cards, input area
      MessageBubble.tsx   # Individual message with markdown rendering
      ToolCard.tsx        # Tool call display (args + output, expandable)
      ThinkingBlock.tsx   # Collapsible thinking/reasoning block
      RunningIndicator.tsx# Animated dots showing agent is active
      InputArea.tsx       # Textarea + send/abort buttons
```

## OpenClaw Gateway Protocol

The `GatewayClient` (lib/gateway.ts) connects via WebSocket to an OpenClaw gateway:

1. **Connect**: WebSocket opens → gateway sends `connect.challenge` with nonce → client sends `connect` request with auth
2. **Chat**: `chat.history` (load messages), `chat.send` (send message), `chat.abort` (cancel run)
3. **Events**: `chat.event` (delta/final/aborted/error), `agent.event` (tool/compaction/thinking streams)

Key protocol details:
- Message frames: `{ type: "req", id, method, params }` / `{ type: "res", id, ok, payload }` / `{ type: "event", event, payload, seq }`
- Session keys follow `agentId:sessionId` format (e.g. `main:default`)
- New sessions are created by generating a new session key; the gateway creates them on first message
- No client-side timeout — the client waits indefinitely for responses
- Input is blocked while the agent is running (runStatus.running === true)
- `sessions.list` method returns active sessions

## State Management

All state lives in `App.tsx` using React hooks. No external state library. Key state:
- `messages`: Completed chat messages (ChatMessage[])
- `streamingText`: Current partial assistant response
- `toolEntries`: Active tool calls for the current run
- `thinkingText`: Current thinking stream text
- `runStatus`: Whether the agent is actively running

Refs (`sessionRef`, `streamingRef`, `runIdRef`) are used in event callbacks to avoid stale closures.
