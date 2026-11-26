export const categories = "🎯 实验、📚 论文、✍️ 写作、🎨 创作、🧑‍💻 开发、📅 日程、🧾 杂务、🔎 调研、⚙️ 环境、💬 讨论";

const rules = [
  ["🎨", /^(?:请|帮我)?\s*(?<goal>创作|绘制|写|设计|生成|制作)\s*(?:一(?:张|段|篇|首|个|部))?\s*(?<subject>[^，,]*?(?:插画|海报|短片|剧本|故事|分镜|视频|logo|壁纸|动画|文案|歌曲))$/iu],
  ["🎨", /^(?:请|帮我)?\s*(?<goal>创作|绘制)\s*(?<subject>.+)$/u],
  ["🎯", /(?:续跑|重跑|跑完|跑一下|开始|启动|监控|执行|完成)?\s*(?<subject>[^，。；\n]{2,36}?)\s*(?<goal>对照实验|消融实验|复现实验|训练实验|训练|评测|跑分|指标对比)(?=$|[，。；！\s])/u],
  ["📚", /^(?:请|帮我)?\s*(?<goal>精读|解读|检索|核对)\s*(?<subject>.+?)(?:的)?(?:论文|文献|引文)?$/u],
  ["📚", /^(?:请|帮我)?\s*(?<goal>找)\s*(?<subject>.+?)(?:的)?(?:论文|文献)$/u],
  ["✍️", /^(?:请|帮我)?\s*(?<goal>润色|撰写|审阅|重写|翻译)\s*(?<subject>.+)$/u],
  ["🧑‍💻", /^(?:请|帮我)?\s*(?<goal>修复|实现|新增|开发|优化|重构|排查)\s*(?<subject>.+)$/u],
  ["📅", /^(?:请|帮我)?\s*(?<goal>安排|预约|提醒我|预订)\s*(?<subject>.+)$/u],
  ["🧾", /^(?:请|帮我)?\s*(?<goal>整理|备份|清理|下载|导出|转换|填写|归档)\s*(?<subject>.+)$/u],
  ["🔎", /^(?:请|帮我)?\s*(?<goal>调研|比较|对比|查找)\s*(?<subject>.+)$/u],
  ["⚙️", /^(?:请|帮我)?\s*(?<goal>安装|升级|配置)\s*(?<subject>.+)$/u],
  ["💬", /^(?:聊聊|讨论一下|说说)\s*(?<subject>.+)$/u],
  ["🧑‍💻", /^(?<goal>fix|implement|refactor|debug|add)\s+(?<subject>.+)$/iu],
  ["📚", /^(?<goal>read|review|survey)\s+(?<subject>.+)$/iu],
  ["📅", /^(?<goal>schedule|book)\s+(?<subject>.+)$/iu],
];

const pivot = /^(?:换个话题[，,：:\s]*|接下来改做[，,：:\s]*|先放下这个[，,：:\s]*|new topic[,:\s]*)/iu;
const unsafe = /https?:\/\/|(?:^|[\s(])(?:~\/|\/|[a-z]:\\)|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b(?:sk-[\w-]+|ghp_[\w-]+|AKIA[A-Z0-9]{16})\b|(?:密码|密钥|password|token|api.key)\s*[:=]|\d(?:[ -]?\d){8,}|[\p{Cc}\p{Cf}<>|"']/iu;
const managedShape = /^(?:🎯|📚|✍️|🎨|🧑‍💻|📅|🧾|🔎|⚙️|💬) [^｜]+｜[^｜]+$/u;
const followup = /^(?:继续|然后|再补|补充|加个测试|补个测试|验证一下|跑一下测试|做个截图|提交|推送|谢谢|好的|收到|ok\b|thanks\b|continue\b|add (?:unit )?tests\b)/iu;

export function validTitle(title) {
  // managedShape guarantees the leading category icon is allowlisted; check unsafe on the body so ZWJ in 🧑‍💻 is permitted.
  return typeof title === "string" && managedShape.test(title) && !unsafe.test(title.slice(title.indexOf(" ") + 1))
    && [...title].length <= 42 && Buffer.byteLength(title) <= 110;
}

const secret = /[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b(?:sk-[\w-]+|ghp_[\w-]+|AKIA[A-Z0-9]{16})\b|(?:密码|密钥|password|token|api.key)\s*[:=]|\d(?:[ -]?\d){8,}/iu;

function cleanInput(raw) {
  const wrapped = raw.match(/<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/u);
  let line = (wrapped?.[1] ?? raw).trim().split(/[。！？!?\r\n；]/u, 1)[0].trim();
  if (!line || secret.test(line) || followup.test(line)
      || /^(?:你好|谢谢|嗨|你好啊|hello|hi|help|收到|好的)[，,. ]*$/iu.test(line)) return "";
  // Redact URLs and local paths to their trailing segment so questions mentioning links/paths can still be named,
  // while validTitle() continues to strictly block URLs/paths in the final title.
  line = line
    .replace(/https?:\/\/github\.com\/([\w.-]+\/[\w.-]+)\S*/giu, "$1")
    .replace(/https?:\/\/\S+/giu, "")
    .replace(/(^|[\s(])(?:~\/|\/|[a-z]:\\)[^\s)，,]+/giu, "$1")
    .replace(/[\p{Cc}\p{Cf}<>|"']/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  if (!line || line.length > 160) return "";
  return line;
}

export function modelInput(messages, {current = "", managed = false, locked = false} = {}) {
  if (locked) return [];
  const recent = messages.slice(-3).filter(value => typeof value === "string").map(value => value.trim());
  const index = recent.findLastIndex(value => pivot.test(value));
  if (managed && managedShape.test(current) && index < 0) return [];
  if (index >= 0) return [cleanInput(recent[index].replace(pivot, ""))].filter(Boolean);
  return recent.map(cleanInput).filter(Boolean);
}

function candidate(raw) {
  const line = cleanInput(raw);
  if (!line || line.length > 100) return null;
  for (const [icon, pattern] of rules) {
    const match = pattern.exec(line);
    if (!match || match.index !== 0) continue;
    const subject = match.groups.subject.trim().replace(/^[《「](.*)[》」]$/u, "$1");
    let goal = match.groups.goal ?? "讨论";
    if (goal === "找") goal = "文献检索";
    if (goal === "提醒我") goal = "提醒";
    if (/^[a-z]+$/iu.test(goal)) goal = goal[0].toUpperCase() + goal.slice(1);
    if (/^(?:一下|这个|那个|它|这篇|相关)?(?:论文|会话|文件|测试|问题|功能)?$/u.test(subject)) continue;
    const title = `${icon} ${subject}｜${goal}`;
    if (validTitle(title)) return title;
  }
  return null;
}

export function propose(messages, {current = "", managed = false, locked = false} = {}) {
  if (locked) return {action: "keep", title: current, reason: "手动标题已固定"};
  const existing = managed && managedShape.test(current);
  for (const message of messages.slice(-6).reverse()) {
    if (typeof message !== "string") continue;
    const explicitPivot = pivot.test(message.trim());
    if (existing && !explicitPivot) continue;
    const title = candidate(message.trim().replace(pivot, ""));
    if (title && title !== current) return {action: "rename", title, reason: explicitPivot ? "明确切换话题" : "识别到具体对象和目标"};
    if (explicitPivot) break;
  }
  return {action: "keep", title: current, reason: existing ? "沿用当前话题" : "命名依据不足"};
}
