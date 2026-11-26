---
name: threadtag
description: 话题签。为科研、开发、聊天和日常事务生成或预览「类别 emoji 对象｜目标」会话标题，按明确要求更新当前会话标题，或接入 Codex、Claude Code、DeepSeek Harness、Antigravity 的自动命名。适用于“给当前对话起个标题”“预览话题签”“启用或暂停自动命名”等请求。
---

# 话题签 · ThreadTag

## 预览与改名

1. 从用户的需求提取本次对话的持续目标。继续、提交、测试、补指标和截图通常是跟进。先找具体对象，保留项目、论文、模型名和有区分度的实验设置。
2. 在此 Skill 目录运行 `node scripts/threadtag.mjs preview '近期的实质需求'`。可以按时间顺序传入多条用户需求。命令只读，返回候选标题。
3. 复杂表述可以根据对话直接拟标题。用「一个类别 emoji + 空格 + 对象｜目标」，控制在 42 字符以内，保留用户主要语言。类别包括 🎯 实验、📚 论文、✍️ 写作、🎨 创作、🧑‍💻 开发、📅 日程、🧾 杂务、🔎 调研、⚙️ 环境和 💬 讨论。证据不足时保留现有标题，标题避免包含密钥、内部链接、具体地址和其他私人信息。
4. 预览只返回候选。用户明确要求改名时，优先使用宿主的会话改名能力，并核实目标是用户指定的会话。Codex 或 Claude Code 无原生工具时，可执行 `node scripts/threadtag.mjs rename <codex|claude> <会话UUID> '<标题>'`。缺少可用写回接口时，返回可复制的标题并说明写回状态。

例如 `🎯 QVHighlights 三种子｜训练`、`📚 SPaGS｜精读`、`🧑‍💻 Tabard 标题栏背景｜修复`。

## 自动命名与诊断

- 检查环境、Hook 与当前会话读取：`node scripts/threadtag.mjs doctor`
- 查看当前模式、已跟踪会话数与最近 5 条后台命名记录：`node scripts/threadtag.mjs status`
- 只有在用户要求安装、配置或排查自动命名，或切换轻量模型时，才读 [宿主接入说明](references/hosts.md)。其中命令从本 Skill 的 `scripts/` 目录执行。Skill 本身供对话内调用，后台自动命名由插件 `Stop` Hook 或各宿主入口负责。
