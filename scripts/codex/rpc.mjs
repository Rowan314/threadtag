import {spawn} from "node:child_process";
import {createInterface} from "node:readline";
import {existsSync} from "node:fs";
import {homedir} from "node:os";
import {join} from "node:path";

export function codexBinary() {
  const local = join(homedir(), ".local/bin/codex");
  return process.env.THREADTAG_CODEX_BIN || (existsSync(local) ? local : "codex");
}

export async function withCodex(operation) {
  const child = spawn(codexBinary(), ["app-server", "--disable", "hooks"], {
    stdio: ["pipe", "pipe", "ignore"],
  });
  let nextId = 0;
  const pending = new Map();
  const lines = createInterface({input: child.stdout});
  const abort = () => {
    for (const respond of pending.values()) respond.reject(new Error("Codex App Server 已断开"));
    pending.clear();
  };
  child.on("error", abort);
  child.on("exit", abort);
  child.stdin.on("error", abort);
  lines.on("line", line => {
    let reply;
    try { reply = JSON.parse(line); } catch { return; }
    const respond = pending.get(reply.id);
    if (!respond) return;
    pending.delete(reply.id);
    if (reply.error) respond.reject(new Error(`Codex RPC 错误 ${reply.error.code}`));
    else respond.resolve(reply.result);
  });

  const send = value => child.stdin.write(JSON.stringify(value) + "\n");
  const call = (method, params) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Codex RPC 超时 ${method}`));
    }, 8000);
    pending.set(id, {
      resolve: value => { clearTimeout(timer); resolve(value); },
      reject: error => { clearTimeout(timer); reject(error); },
    });
    send({id, method, params});
  });

  try {
    await call("initialize", {clientInfo: {name: "threadtag", version: "0.1.0"}});
    send({method: "initialized"});
    return await operation(call);
  } finally {
    lines.close();
    child.stdin.end();
    child.kill();
    abort();
  }
}
