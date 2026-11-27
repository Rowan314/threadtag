import {lstat, readdir, readFile} from "node:fs/promises";
import {join} from "node:path";

function endpoint(address, token) {
  if (!/^(?:127\.0\.0\.1|localhost|\[::1\]):\d{1,5}$/u.test(address)
      || typeof token !== "string" || !token) return null;
  return {address, token};
}

async function localHubs(root) {
  const dir = join(root, "daemon");
  let files;
  try { files = await readdir(dir); }
  catch { return []; }

  const hubs = await Promise.all(files.filter(name => /^hub_\d+\.json$/u.test(name)).map(async name => {
    const path = join(dir, name);
    try {
      const info = await lstat(path);
      if (!info.isFile() || info.size > 4096) return null;
      if (process.platform !== "win32" && (info.uid !== process.getuid() || (info.mode & 0o077))) return null;
      const data = JSON.parse(await readFile(path, "utf8"));
      if (!Number.isInteger(data.httpPort) || data.httpPort < 1 || data.httpPort > 65535) return null;
      const hub = endpoint(`127.0.0.1:${data.httpPort}`, data.csrfToken);
      return hub && {...hub, mtime: info.mtimeMs};
    } catch { return null; }
  }));
  return hubs.filter(Boolean).sort((a, b) => b.mtime - a.mtime);
}

export async function findConversation(root, id) {
  const fromHook = endpoint(process.env.ANTIGRAVITY_LS_ADDRESS, process.env.ANTIGRAVITY_CSRF_TOKEN);
  const candidates = [fromHook, ...await localHubs(root)].filter(Boolean);
  for (const {address, token} of candidates) {
    async function call(method, body = {}, timeout = 6000) {
      const response = await fetch(`http://${address}/product.v1.ConversationService/${method}`, {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(timeout),
        headers: {"Content-Type": "application/json", "Connect-Protocol-Version": "1", "x-antigravity-csrf-token": token},
        body: JSON.stringify({conversationId: id, ...body}),
      });
      if (!response.ok) throw new Error(`Antigravity RPC 错误 ${response.status}`);
      return response.json();
    }

    // Several hubs can be left on disk. A live hub must recognize this exact conversation.
    try {
      const conversation = await call("GetConversation", {}, 1500);
      if (conversation.id === id) return {call, conversation};
    } catch {}
  }
  return null;
}
