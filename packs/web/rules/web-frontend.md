---
name: web-frontend
description: 编写或修改 Web 前端页面、组件、路由、样式时使用
globs: [app/**, src/**/*.tsx, src/**/*.jsx, pages/**, components/**]
alwaysApply: false
---

# Web 前端约定

- **Next.js**：先看项目所用版本自带的文档 `node_modules/next/dist/docs/`（Next.js 16 起随包附带），不要凭记忆使用旧 API；默认服务端组件，只有需要状态/事件/浏览器 API 时才加 `'use client'`。
- **Vite**：环境变量只用 `import.meta.env.VITE_*`；不要把密钥打进前端包。
- 组件要可访问：语义化标签、可键盘操作、表单有 label、图片有 alt；颜色对比度达标。
- 数据获取写明缓存与失效策略；加载、空、错误三种状态都要有 UI。
- 不引入新的 UI/状态库，除非设计（02-design.md）中有 ADR。
