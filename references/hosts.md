# 话题签 · ThreadTag

给科研、开发、聊天和日常杂事生成容易找回的标题，统一使用「类别 emoji 对象｜目标」。比如 `🎯 QVHighlights 三种子｜训练`、`🧑‍💻 Tabard 标题栏背景｜修复`、`🧾 课程提交材料｜整理`。

话题签借鉴 [oil-agy-title](https://github.com/oil-oil/oil-agy-title) 和 [oil-codex-title](https://github.com/oil-oil/oil-codex-title) 的对象优先、标题稳定和后台命名设计。默认使用本地规则。分类涵盖实验、论文、写作、创作、开发、日程、杂务、调研、环境和讨论。产品名保留原文，规则优先覆盖简洁的中文需求和常见英文动词。表达不明确或带有路径、邮箱等敏感模式时保留现有标题。标题建立后，用「换个话题：……」或 `New topic: …` 明确切换主线。

## 快速预览

需要 Node.js 22 或更高版本。以下 `node threadtag.mjs` 命令在仓库的 `scripts/` 目录执行。

```sh
node threadtag.mjs preview '精读《SPaGS》论文'
node threadtag.mjs preview '续跑 QVHighlights 三种子训练' '继续，补充 LPIPS'
```

## 接入 Agent

建议把整个目录放在稳定位置。以下命令从该目录运行。四个接入方式独立，可以按需启用。

| 宿主 | 自动入口 | 写回 |
| --- | --- | --- |
| Codex | Stop Hook 后台运行 | App Server 的 `thread/name/set` |
| Claude Code | Stop Hook 后台运行 | 追加 `custom-title` 记录到会话 `.jsonl` |
| DeepSeek Harness | 原生 `sessionTitle` 的 all-prompts 标题提供方 | Harness 自己持久化并投影到列表 |
| Antigravity Desktop | 完整插件 `Stop` Hook 后台运行 | 本机 `ConversationService` 实时更新；找不到可用服务时原子写入 `annotations/*.pbtxt` |

### Codex

先用 `node threadtag.mjs hook-config codex` 生成配置。将生成的 Stop 项加入 `${CODEX_HOME:-$HOME/.codex}/hooks.json` 的 `hooks.Stop`，保留已有项。文件不存在时可直接写入生成结果。路径和 Node 可执行文件均按生成时的实际位置填写。重启宿主或开启新会话，若宿主要求信任 Hook，在它的 Hook 设置中核对命令后授权。

```sh
node threadtag.mjs preview-session codex <会话UUID>
node threadtag.mjs rename codex <会话UUID> '我指定的标题'
```

自动模式会为尚无跟踪记录的会话生成标题，也会维护仍由插件管理的标题。在已跟踪的会话中手动修改标题后，后续自动命名保留该标题。可在 Codex Desktop 的 **Settings → Hooks** 核对 `Stop` Hook 的启用和信任状态。通过真实 CLI 和桌面版 App Server 回合已验证触发和写回，Codex 会话列表接口可读到新标题。

### Claude Code

先用 `node threadtag.mjs hook-config claude` 生成配置，将生成的 `hooks.Stop` 项合入 `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json` 的 `hooks.Stop` 数组，保留已有设置，再开启新会话生效。

```sh
node threadtag.mjs preview-session claude <会话UUID>
node threadtag.mjs rename claude <会话UUID> '我指定的标题'
```

适配器会在 `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects/*/<会话UUID>.jsonl` 中读取最近的用户消息和最新 `custom-title`，自动跳过纯 sidechain 子会话与已有手动 `/rename` 标题，写回时向对应 `.jsonl` 末尾追加 `custom-title` 记录（与 Claude Code 原生 `/rename` 格式一致，支持 `claude --resume "<标题>"`）。

### DeepSeek Harness

用 `node threadtag.mjs deepseek-patch` 生成 YAML，将两项合入 `${DSH_HOME:-$HOME/.dsh}/profiles/desktop/cordis.patch.yml` 的根数组，再重启 Harness。补丁禁用默认 `session-title-llm`，注册独立 provider。若已配置其他第三方标题 provider，保留其中一个启用。回退时删除这两项。

手动改名用 Harness 自带的侧边栏菜单。Harness 把手动标题标记为用户来源，后续自动修订会跳过它。此适配面向 DeepSeek Harness。普通 DeepSeek 网页和只调用 API 的命令行可用通用 `preview`。

### Antigravity Desktop

仓库根目录自带 `plugin.json`、`hooks.json` 和 `skills/threadtag/SKILL.md`，可直接作为完整 Antigravity 插件安装：

```sh
agy plugin install /path/to/threadtag
# 或直接复制到全局插件目录：
cp -R /path/to/threadtag ~/.gemini/config/plugins/threadtag
```

先停用同一会话上的其他标题插件（如 `oil-agy-title`），以免两个 `Stop` Hook 同时更新。后台 `Stop` Hook 优先采用宿主注入的连接信息，也会从 Antigravity 的 `daemon/hub_*.json` 查找本机服务。服务确认持有当前会话后，`ConversationService` 更新标题并刷新打开的侧栏。找不到可用服务时，插件原子更新 `annotations/<id>.pbtxt`，标题在重新加载会话后显示。已置顶、已归档的会话，以及会话服务标记的子会话会自动跳过。

安装后可运行 `node threadtag.mjs doctor` 检查环境，在新会话聊一轮后运行 `node threadtag.mjs status` 查看最近 5 条后台触发记录。`conversation_service` 表示通过会话服务更新，`pbtxt_fallback` 表示只写磁盘。

### 可选宿主轻量模型

```sh
node threadtag.mjs model         # 查看模式
node threadtag.mjs model native  # 使用宿主自己的模型
node threadtag.mjs model local   # 使用纯本地规则
```

模型模式由四个宿主共用，默认本地。旧版 `deepseek` 模式按本地处理，切换到宿主模式使用 `model native`。沿用宿主已有登录和额度，话题签无需单独配置 API 或密钥。

| 宿主 | 轻量模型 | 推理强度 |
| --- | --- | --- |
| Codex | GPT-6 Luna，由登录后的 Codex CLI 启动临时会话 | Low |
| Claude Code | Haiku，由登录后的 `claude -p --safe-mode` 临时调用 | Low |
| Antigravity | Gemini 3.8 Flash，由登录后的 `agy` CLI 调用 | Low |
| DeepSeek Harness | `deepseek-flash`，由 Harness 原生标题 SDK 调用 | 取模型声明的第一档 |

现有手动标题、稳定标题的普通跟进和简单问候跳过模型。新标题和明确换题可使用最近三条用户需求经过滤的短句。模型不可用、超时或返回标题校验失败时回退本地规则。通用 `preview` 没有宿主上下文，使用本地规则。宿主安装、启用和登录各自独立。

## 暂停与恢复

```sh
node threadtag.mjs pause
node threadtag.mjs resume
```

这两个命令控制所有适配入口的自动标题，预览仍然可用。状态默认保存在 `~/.local/state/threadtag`，可通过 `THREADTAG_HOME` 覆盖。Codex 和 Antigravity 会在写前重新读取标题和近期需求，检查在后台运行期间是否有变化。宿主标题接口没有条件写入参数，手动修改恰好落在最终检查和写入之间时仍存在竞争窗口。

