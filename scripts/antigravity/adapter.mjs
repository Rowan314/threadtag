import {createReadStream} from "node:fs";
import {createInterface} from "node:readline";
import {join} from "node:path";
import {homedir} from "node:os";
import {sessionId} from "../host-state.mjs";

export async function withAntigravitySession(rawId, operation) {
  const id = sessionId(rawId);
  const address = process.env.ANTIGRAVITY_LS_ADDRESS || "";
  const token = process.env.ANTIGRAVITY_CSRF_TOKEN;
  if (!token || !/^(?:127\.0\.0\.1|localhost|\[::1\]):\d+$/u.test(address)) {
    throw new Error("缺少 Antigravity 本机 Stop Hook 连接信息");
  }
  const root = process.env.THREADTAG_AGY_DATA || join(homedir(), ".gemini/antigravity");
  const path = join(root, "brain", id, ".system_generated/logs/transcript.jsonl");

  async function rpc(method, body) {
    const response = await fetch(`http://${address}/product.v1.ConversationService/${method}`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(6000),
      headers: {"Content-Type": "application/json", "Connect-Protocol-Version": "1", "x-antigravity-csrf-token": token},
      body: JSON.stringify({conversationId: id, ...body}),
    });
    if (!response.ok) throw new Error(`Antigravity RPC 错误 ${response.status}`);
    return response.json();
  }

  return operation({
    id,
    async read() {
      const value = await rpc("GetConversation");
      return {path, title: value.annotations?.title || "",
        skip: Boolean(value.annotations?.archived || value.annotations?.pinned || value.metadata?.parentConversationId)};
    },
    async messages() {
      const messages = [];
      const lines = createInterface({input: createReadStream(path)});
      for await (const line of lines) {
        let entry;
        try { entry = JSON.parse(line); } catch { continue; }
        if (entry.type === "USER_INPUT" && (!entry.source || ["USER_EXPLICIT", "USER"].includes(entry.source))
            && typeof entry.content === "string") {
          messages.push(entry.content);
          if (messages.length > 6) messages.shift();
        }
      }
      return messages;
    },
    async rename(title) {
      const value = await rpc("UpdateConversation", {annotations: {title}});
      if (value.annotations?.title !== title) throw new Error("Antigravity 返回的标题不一致");
    },
  });
}
