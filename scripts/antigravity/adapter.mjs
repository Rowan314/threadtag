import {createReadStream} from "node:fs";
import {mkdir, readFile, rename, writeFile} from "node:fs/promises";
import {createInterface} from "node:readline";
import {randomUUID} from "node:crypto";
import {dirname, join} from "node:path";
import {homedir} from "node:os";
import {sessionId} from "../host-state.mjs";
import {findConversation} from "./connection.mjs";

function unescapePbtxtString(raw) {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== "\\" || i + 1 >= raw.length) {
      out += raw[i];
      continue;
    }
    const next = raw[++i];
    if (next === "n") out += "\n";
    else if (next === "r") out += "\r";
    else if (next === "t") out += "\t";
    else if (next === "\"" || next === "'" || next === "\\") out += next;
    else out += next;
  }
  return out;
}

function escapePbtxtString(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"").replaceAll("\n", "\\n").replaceAll("\r", "\\r");
}

function parsePbtxt(text) {
  const titleMatch = text.match(/(?:^|\s)title:\s*"((?:[^"\\]|\\.)*)"/u);
  const title = titleMatch ? unescapePbtxtString(titleMatch[1]) : "";
  const archived = /(?:^|\s)archived:\s*true\b/u.test(text);
  const pinned = /(?:^|\s)pinned:\s*true\b/u.test(text);
  return {title, skip: archived || pinned};
}

async function writePbtxtTitle(pbtxtPath, title) {
  let content = "";
  try { content = await readFile(pbtxtPath, "utf8"); }
  catch (error) { if (error.code !== "ENOENT") throw error; }

  const field = `title:"${escapePbtxtString(title)}"`;
  const updated = /(?:^|\s)title:\s*"(?:[^"\\]|\\.)*"/u.test(content)
    ? content.replace(/(^|\s)title:\s*"(?:[^"\\]|\\.)*"/u, (_, space) => space + field)
    : content ? `${field}  ${content}` : `${field}\n`;

  await mkdir(dirname(pbtxtPath), {recursive: true});
  const temp = join(dirname(pbtxtPath), `.${randomUUID()}.tmp`);
  await writeFile(temp, updated, "utf8");
  await rename(temp, pbtxtPath);
}

export async function withAntigravitySession(rawId, operation) {
  const id = sessionId(rawId);
  const root = process.env.THREADTAG_AGY_DATA || join(homedir(), ".gemini/antigravity");
  const path = join(root, "brain", id, ".system_generated/logs/transcript.jsonl");
  const pbtxtPath = join(root, "annotations", `${id}.pbtxt`);
  const live = await findConversation(root, id);
  let initial = live?.conversation;

  return operation({
    id,
    backend: live ? "conversation_service" : "pbtxt_fallback",
    async read() {
      if (live) {
        const value = initial ?? await live.call("GetConversation");
        initial = undefined;
        return {
          path,
          title: value.annotations?.title || "",
          skip: Boolean(value.annotations?.archived || value.annotations?.pinned || value.metadata?.parentConversationId),
        };
      }
      let content = "";
      try { content = await readFile(pbtxtPath, "utf8"); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      const parsed = parsePbtxt(content);
      return {path, title: parsed.title, skip: parsed.skip};
    },
    async messages() {
      const messages = [];
      let stream;
      try { stream = createReadStream(path); }
      catch { return messages; }
      const lines = createInterface({input: stream});
      try {
        for await (const line of lines) {
          let entry;
          try { entry = JSON.parse(line); } catch { continue; }
          if (entry.type === "USER_INPUT" && (!entry.source || ["USER_EXPLICIT", "USER"].includes(entry.source))
              && typeof entry.content === "string") {
            messages.push(entry.content);
            if (messages.length > 6) messages.shift();
          }
        }
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      return messages;
    },
    async rename(title) {
      if (live) {
        const value = await live.call("UpdateConversation", {annotations: {title}});
        if (value.annotations?.title !== title) throw new Error("Antigravity 返回的标题不一致");
        return;
      }
      await writePbtxtTitle(pbtxtPath, title);
    },
  });
}
