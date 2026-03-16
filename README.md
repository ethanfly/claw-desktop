# Claw Desktop

OpenClaw 网关桌面客户端，基于 Electron + React + TypeScript 构建。

![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss)

## 功能

- WebSocket 连接 OpenClaw 网关（协议 v3）
- 多会话管理（新建、切换、列表）
- 流式消息输出（Markdown 渲染 + GFM）
- Thinking/Tool 调用实时流展示
- 文件附件支持（图片预览、文件上传）
- 中英文双语界面
- 龙虾动画 Agent 头像
- 自定义标题栏（最小化/最大化/关闭）

## 开发

```bash
npm install          # 安装依赖
npm run dev          # 启动开发模式（热更新）
npm run build        # 生产构建
npm run preview      # 预览生产构建
npm run dist         # 打包分发
```

## 项目结构

```
src/
  main/index.ts              # Electron 主进程 - 窗口创建、菜单、IPC
  preload/index.ts           # Context bridge
  renderer/
    App.tsx                  # 根组件 - 状态管理、事件处理
    lib/
      gateway.ts             # OpenClaw 网关 WebSocket 客户端
      types.ts               # TypeScript 类型定义
      i18n.ts                # 国际化（中/英）
    components/
      ConnectDialog.tsx       # 网关连接对话框
      Sidebar.tsx             # 会话列表侧边栏
      ChatView.tsx            # 聊天主视图
      MessageBubble.tsx       # 消息气泡（Markdown 渲染）
      InputArea.tsx           # 输入区域（附件、发送）
      AgentAvatar.tsx         # 龙虾动画头像
      ToolCard.tsx            # 工具调用卡片
      ThinkingBlock.tsx       # 思考过程折叠块
      TitleBar.tsx            # 自定义标题栏
```

## 配置

首次启动会弹出连接对话框，需要填写：

- **网关地址**：OpenClaw 网关的 URL（默认 `http://127.0.0.1:18789`）
- **认证方式**：令牌（Token）或密码（Password）

配置会自动保存到本地存储。

## 许可

MIT
