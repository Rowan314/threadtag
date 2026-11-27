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

## 2026-11-26 14:08 UTC 封装为完整 Antigravity 插件并支持 pbtxt 后台写回

- 将 `plugin.json` 与 `hooks.json` 提升至仓库根目录并添加 `skills/threadtag/SKILL.md` 软链接，移除 `scripts/` 下旧清单；本机 `~/.gemini/config/plugins/threadtag` 改为指向仓库根目录。
- `scripts/antigravity/adapter.mjs` 新增 `annotations/*.pbtxt` 原子读写降级通道，解决桌面端 `Stop` Hook 未注入 RPC 环境变量时无法写回的问题。
- 新增 `doctor`、`status` 命令与 `~/.local/state/threadtag/events.jsonl` 精简事件日志。
- 验证：`agy plugin validate` 通过（`skills 1 · hooks 1`），`lsrpc GetAllPlugins` 已识别，`doctor`/`status` 与无 RPC 环境变量下的 `pbtxt_fallback` 隔离端到端测试全部通过。

## 2026-11-26 14:58 UTC 修复 Antigravity/Codex 首轮默认标题被误判为手动标题的问题

- 根因：Antigravity 首轮结束前会自动写入默认标题（如 `List Codex Threads`），旧逻辑将未跟踪会话的任何非空标题直接判为 `locked=true`（`手动标题已固定`）。
- 修复：`scripts/threadtag.mjs` 仅在已建立基线（`state` 含 `title`）后，或 Claude Code（`custom-title` 仅由手动 `/rename` 产生）时将非托管标题锁定为手动标题。

## 2026-11-26 15:37 UTC 恢复 Antigravity 桌面端标题实时更新

- 桌面 `Stop` Hook 缺少 RPC 环境变量时，从宿主私有的 `daemon/hub_*.json` 发现负责该会话的本机服务，经 `ConversationService` 更新已打开窗口的标题。
- 涉及 `scripts/antigravity/{connection,adapter}.mjs`、`test/antigravity.test.mjs` 及两份接入文档。保留离线注解写回。
- 4 项回归测试通过；Antigravity 2.35.2 新会话的顶部和侧栏无需刷新即更新。Codex 的现有 Hook 为可信，真实 CLI 和桌面版 App Server 均触发并写回，桌面列表接口读到新标题。
- 本机已通过插件软链接加载修复；本轮只验证 Antigravity 和 Codex。
