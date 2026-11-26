# 话题签 · ThreadTag

为科研、开发、创作和日常事务自动维护易检索的会话标题，统一使用「`类别 emoji 对象｜目标`」格式（≤ 42 字，对象在前，保留项目、论文、模型原名，跟随用户主要语言）。

- **10 类场景分类**：🎯 实验、📚 论文、✍️ 写作、🎨 创作、🧑‍💻 开发、📅 日程、🧾 杂务、🔎 调研、⚙️ 环境、💬 讨论
- **双生成模式**：默认纯本地规则（零消耗、离线、毫秒级）；可选 `native` 模式直接复用宿主已登录的轻量模型，超时或不可用时自动回退本地规则
- **多宿主独立接入**：支持 **Antigravity Desktop**、**Codex**、**Claude Code** 和 **DeepSeek Harness**
- **稳定与隐私保护**：不覆写手动标题、自动跳过子会话/归档会话、过滤 URL/路径/邮箱/密钥等敏感模式；需要切换主线时说「换个话题：…」或 `New topic: …`

> 命名规范、对象优先与后台稳定设计借鉴了 [oil-agy-title](https://github.com/oil-oil/oil-agy-title) 和 [oil-codex-title](https://github.com/oil-oil/oil-codex-title)。

## 依赖

- Node.js 22+
- 使用 `native` 模式时，需对应宿主 CLI 已登录（无需单独配置外部 API Key）

## 安装

### 作为 Skill 使用

将仓库克隆到你的全局 Skills 目录（例如 `~/.agent/skills/threadtag`、`~/.codex/skills/threadtag` 或 `~/.claude/skills/threadtag`）：

```sh
git clone https://github.com/Rowan314/threadtag.git ~/.agent/skills/threadtag
```

安装后可在对话中直接调用 `/threadtag` 或让 Agent 预览、更新会话标题。

### 启用各宿主后台自动命名

| 宿主 | 自动入口 | 写回方式 | `native` 轻量模型 |
| :--- | :--- | :--- | :--- |
| **Antigravity Desktop** | 插件 `Stop` Hook | 本机 `ConversationService` | Gemini 3.8 Flash (`low`) |
| **Codex** | `hooks.json` `Stop` Hook | App Server `thread/name/set` | GPT-6 Luna (`low`) |
| **Claude Code** | `settings.json` `Stop` Hook | 追加 `custom-title` 到会话 `.jsonl` | Haiku (`low`, `--safe-mode`) |
| **DeepSeek Harness** | 原生 `sessionTitle` provider | Harness 原生持久化 | `deepseek-flash` |

各宿主详细配置见 [references/hosts.md](references/hosts.md)。

## 常用命令

以下命令在 `scripts/` 目录下运行（或指定 `scripts/threadtag.mjs` 完整路径）：

```sh
node scripts/threadtag.mjs preview '精读《SPaGS》论文'
node scripts/threadtag.mjs preview-session <codex|claude|antigravity> <会话UUID>
node scripts/threadtag.mjs rename <codex|claude|antigravity> <会话UUID> '新标题'

node scripts/threadtag.mjs model         # 查看当前模式（local / native）
node scripts/threadtag.mjs model native  # 启用宿主轻量模型
node scripts/threadtag.mjs model local   # 切回纯本地规则

node scripts/threadtag.mjs pause         # 全局暂停自动命名
node scripts/threadtag.mjs resume        # 恢复自动命名

node scripts/threadtag.mjs hook-config codex   # 生成 Codex hooks.json 片段
node scripts/threadtag.mjs hook-config claude  # 生成 Claude Code settings.json 片段
node scripts/threadtag.mjs deepseek-patch      # 生成 DeepSeek Harness 补丁
```

## 许可证

[MIT](LICENSE)
