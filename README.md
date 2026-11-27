# 话题签 · ThreadTag

让你一眼认出每段对话在做什么。比如，讨论三天旅行行程时，话题签可以把会话命名为「📅 周末旅行｜规划三天行程」，下次打开侧栏就能找到。

话题签支持 **Codex、Antigravity Desktop、Claude Code 和 DeepSeek Harness**。装好后，它可以自动整理标题，也可以按你的要求预览或改名。

## 先选一种命名方式

| 模式 | 什么时候选 |
| :--- | :--- |
| **本地模式（`local`，默认）** | 想省额度或离线使用。话题签在本机根据对话内容提取对象和目标，生成标题不消耗模型额度。 |
| **宿主模型模式（`native`）** | 对话经常有多轮跟进，希望模型结合上下文抓住主线。话题签使用当前应用已登录的轻量模型，沿用该应用的额度。模型不可用时会自动切回本地规则生成这次的标题。 |

两种模式可随时切换。用宿主模型无需为话题签单独配置 API Key。

## 安装

需要 Node.js 22 或更新版本。把下面这段话发给你正在用的 Codex、Antigravity、Claude Code 或 DeepSeek Harness：

> 请为我安装 [话题签 ThreadTag](https://github.com/Rowan314/threadtag) 完整插件，并按仓库里的 [宿主接入说明](https://github.com/Rowan314/threadtag/blob/main/references/hosts.md) 为我当前使用的应用启用自动命名。使用默认的本地模式，安装好后请验证能否自动生成标题。

如果你想用宿主模型，把最后一句里的「默认的本地模式」换成「宿主模型模式」。想自己安装，可以查看[各应用的安装与接入步骤](references/hosts.md)。

## 怎么用

开启自动命名后，照常聊天即可。标题会尽量保留项目、论文或模型的原名。已手动修改的标题会受到保护。对话转向新任务时，可以明确说「换个话题：……」。

你也可以直接对 Agent 说：

- 「先预览这个对话的标题。」
- 「把当前对话改名为『✍️ 读书笔记｜整理初稿』。」
- 「把话题签切到宿主模型模式。」或「切回纯本地模式。」
- 「暂停话题签自动命名。」或「恢复话题签自动命名。」

预览只显示候选标题，确认改名后才会写入。

## 许可与致谢

[MIT 许可证](LICENSE)。命名规则参考了 [oil-agy-title](https://github.com/oil-oil/oil-agy-title) 和 [oil-codex-title](https://github.com/oil-oil/oil-codex-title)。
