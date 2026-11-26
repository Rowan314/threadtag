# 工作日志

## 2026-11-26 07:24 UTC 封装话题签 Skill

- 将命名引擎和三个宿主适配器打包到全局 Skill，加入对话内预览、改名和自动接入说明。
- 验证 Codex Skills 软链接可解析、Skill 格式和内置预览命令。
- 后台接入由用户单独启用。

## 2026-11-26 07:33 UTC 加入创作分类和可选模型

- 命名规则加入 🎨 创作。所有宿主共用同一模型开关，默认本地，启用后可调用关闭思考的 DeepSeek V4 Flash。
- 14 项自动测试通过，隔离 Codex App Server 写回通过。模型请求使用替身验证，真实 API 未验收。

## 2026-11-26 07:43 UTC 改用宿主原生模型

- 可选模式统一为 native，移除独立 API 请求和密钥设置。Codex 与 Antigravity 复用登录 CLI，DeepSeek Harness 复用原生标题 SDK。
- 15 项自动测试通过。Codex 与 Antigravity 已用登录态返回测试标题，Codex 隔离写回复测通过。Harness SDK 可加载，桌面真实会话生成待验证。

## 2026-11-26 11:45 UTC 新增 Claude Code 适配与分类图标调整

- 新增 `scripts/claude/adapter.mjs`（读取/追加 `custom-title` JSONL），在 `threadtag.mjs` 与 `native-cli.mjs` 接入 Claude Code 的 `Stop` Hook、`hook-config claude` 与 `claude -p --model haiku --safe-mode` 原生模型调用。
- 将开发/实验图标调整为 `🧑‍💻` / `🎯`，并放行 `validTitle` 与 `rename` 前缀中 `🧑‍💻` 的零宽连接符。
- 涉及文件：`SKILL.md`、`references/hosts.md`、`scripts/naming.mjs`、`scripts/threadtag.mjs`、`scripts/native-cli.mjs`、`scripts/claude/adapter.mjs`。
- 待办：本机 `claude` CLI 尚未 `/login`，登录后可验收 Claude Code `native` 模式与桌面/终端实时触发。
