import {createReadStream} from "node:fs";
import {createInterface} from "node:readline";
import {relative, resolve, basename} from "node:path";
import {homedir} from "node:os";
import {withCodex} from "./rpc.mjs";
import {sessionId} from "../host-state.mjs";

const injectedPrefix = /^(?:# AGENTS\.md instructions for |<(?:environment_context|permissions instructions|collaboration_mode|turn_aborted|INSTRUCTIONS|user_instructions)>)/u;

function extractCodexUserText(entry) {
  if (entry.type === "event_msg" && entry.payload?.type === "user_message"
      && typeof entry.payload.message === "string") {
    return entry.payload.message.trim();
  }
  if (entry.type === "response_item" && entry.payload?.type === "message"
      && entry.payload?.role === "user" && Array.isArray(entry.payload.content)) {
    const text = entry.payload.content
      .filter(part => part && (part.type === "input_text" || part.type === "text") && typeof part.text === "string")
      .map(part => part.text)
      .join("\n")
      .trim();
    if (!text || injectedPrefix.test(text)) return "";
    return text;
  }
  return "";
}

export async function readCodexMessages(path, id) {
  const folder = resolve(process.env.CODEX_HOME || resolve(homedir(), ".codex"), "sessions");
  const rel = relative(folder, resolve(path));
  if (rel.startsWith("..") || !basename(path).endsWith(`-${id}.jsonl`)) {
    throw new Error("会话记录路径和会话 ID 不一致");
  }
  const messages = [];
  const lines = createInterface({input: createReadStream(path)});
  for await (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    const text = extractCodexUserText(entry);
    if (text) {
      messages.push(text);
      if (messages.length > 6) messages.shift();
    }
  }
  return messages;
}

export function withCodexSession(rawId, operation) {
  const id = sessionId(rawId);
  return withCodex(call => operation({
    id,
    async read() {
      const {thread} = await call("thread/read", {threadId: id, includeTurns: false});
      return {title: thread.name || "", path: thread.path, skip: thread.ephemeral || Boolean(thread.parentThreadId)};
    },
    messages(path) { return path ? readCodexMessages(path, id) : []; },
    rename(title) { return call("thread/name/set", {threadId: id, name: title}); },
  }));
}
