import {createReadStream} from "node:fs";
import {appendFile, open, readdir, stat} from "node:fs/promises";
import {createInterface} from "node:readline";
import {basename, join, relative, resolve} from "node:path";
import {homedir} from "node:os";
import {sessionId} from "../host-state.mjs";

function claudeProjectsDir() {
  const base = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
  return resolve(base, "projects");
}

async function locateTranscript(id) {
  const root = claudeProjectsDir();
  const target = `${id}.jsonl`;
  let dirs;
  try { dirs = await readdir(root, {withFileTypes: true}); }
  catch (error) {
    if (error.code === "ENOENT") throw new Error("未找到 Claude Code 会话目录");
    throw error;
  }
  for (const entry of dirs) {
    if (!entry.isDirectory()) continue;
    const candidate = resolve(root, entry.name, target);
    const rel = relative(root, candidate);
    if (rel.startsWith("..") || basename(candidate) !== target) continue;
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {}
  }
  throw new Error(`未找到 Claude Code 会话记录：${id}`);
}

function extractUserText(entry) {
  const content = entry.message?.content;
  let text = "";
  if (typeof content === "string") text = content;
  else if (Array.isArray(content)) {
    text = content
      .filter(block => block && block.type === "text" && typeof block.text === "string")
      .map(block => block.text)
      .join("\n");
  }
  text = text.trim();
  if (!text || /^<(?:command-name|local-command-[a-z-]+)>/u.test(text)) return "";
  return text;
}

async function scanTranscript(path) {
  let title = "";
  let hasMainUser = false;
  let hasSidechainUser = false;
  const messages = [];
  const lines = createInterface({input: createReadStream(path)});
  for await (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (entry.type === "custom-title" && typeof entry.customTitle === "string") {
      title = entry.customTitle;
      continue;
    }
    if (entry.type !== "user" || entry.isMeta) continue;
    if (entry.isSidechain) {
      hasSidechainUser = true;
      continue;
    }
    hasMainUser = true;
    const text = extractUserText(entry);
    if (!text) continue;
    messages.push(text);
    if (messages.length > 6) messages.shift();
  }
  return {title, messages, skip: !hasMainUser && hasSidechainUser};
}

async function needsLeadingNewline(path) {
  const info = await stat(path);
  if (info.size === 0) return false;
  const handle = await open(path, "r");
  try {
    const buf = Buffer.alloc(1);
    await handle.read(buf, 0, 1, info.size - 1);
    return buf[0] !== 0x0a;
  } finally {
    await handle.close();
  }
}

export async function withClaudeSession(rawId, operation) {
  const id = sessionId(rawId);
  const path = await locateTranscript(id);
  return operation({
    id,
    async read() {
      const {title, skip} = await scanTranscript(path);
      return {path, title, skip};
    },
    async messages() {
      return (await scanTranscript(path)).messages;
    },
    async rename(title) {
      const prefix = (await needsLeadingNewline(path)) ? "\n" : "";
      const record = JSON.stringify({type: "custom-title", customTitle: title, sessionId: id});
      await appendFile(path, `${prefix}${record}\n`, "utf8");
    },
  });
}
