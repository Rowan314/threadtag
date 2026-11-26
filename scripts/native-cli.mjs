import {spawn} from "node:child_process";
import {existsSync} from "node:fs";
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {homedir, tmpdir} from "node:os";
import {join} from "node:path";
import {codexBinary} from "./codex/rpc.mjs";
import {instructions} from "./model.mjs";

function run(binary, args, input, cwd, signal) {
  return new Promise((resolve, reject) => {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !/^ANTIGRAVITY_(?:LS_ADDRESS|CSRF_TOKEN|CONVERSATION_ID|TRAJECTORY_ID|PROJECT_ID|APP_DATA_DIR)$/.test(key)
      && !/^(?:OPENAI_API_KEY|OPENAI_BASE_URL|CODEX_API_KEY)$/.test(key)
      && !/^CODEX_(?:THREAD_ID|SESSION_ID|APP_TOOLS_PIPE_PATH)$/.test(key)
      && !/^CLAUDE(?:CODE|_CODE_ENTRYPOINT|_SESSION_ID)$/.test(key)));
    const child = spawn(binary, args, {cwd, env, signal, killSignal: "SIGKILL",
      stdio: ["pipe", "pipe", "ignore"]});
    let output = "";
    child.stdin.on("error", () => {});
    child.on("error", reject);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", chunk => {
      if (output.length + chunk.length > 262144) child.kill("SIGKILL");
      else output += chunk;
    });
    child.on("close", code => {
      if (code === 0) resolve(output);
      else reject(new Error("宿主模型未返回结果"));
    });
    child.stdin.end(input);
  });
}

async function codex(input, signal, cwd) {
  const schema = join(cwd, "schema.json");
  const output = join(cwd, "title.json");
  await writeFile(schema, JSON.stringify({type: "object", additionalProperties: false,
    properties: {title: {type: ["string", "null"]}}, required: ["title"]}));
  await run(codexBinary(), ["exec", "--ephemeral", "--ignore-user-config",
    "--skip-git-repo-check", "--sandbox", "read-only",
    "--disable", "hooks", "--disable", "shell_tool", "--disable", "plugins",
    "--disable", "apps", "--disable", "multi_agent", "-m", "gpt-6-luna",
    "-c", 'model_reasoning_effort="low"', "-c", 'web_search="disabled"',
    "-c", "project_doc_max_bytes=0", "--output-schema", schema,
    "--output-last-message", output, "-"], `${instructions}\n\n${input}`, cwd, signal);
  return readFile(output, "utf8");
}

async function antigravity(input, signal, cwd) {
  const local = join(homedir(), ".local/bin/agy");
  const binary = existsSync(local) ? local : "agy";
  const raw = await run(binary, ["--print", `${instructions}\n\n${input}`,
    "--model", "gemini-3.8-flash-low", "--effort", "low", "--mode", "plan",
    "--disable-slash-commands", "--sandbox", "--output-format", "json",
    "--print-timeout", "12s"], "", cwd, signal);
  const result = JSON.parse(raw);
  if (result.status !== "SUCCESS") throw new Error("Antigravity 命名失败");
  return result.response.trim().replace(/^\x60\x60\x60(?:json)?\s*|\s*\x60\x60\x60$/gu, "");
}

async function claude(input, signal, cwd) {
  const candidates = ["/opt/homebrew/bin/claude", "/usr/local/bin/claude"];
  const binary = candidates.find(existsSync) || "claude";
  const raw = await run(binary, ["-p", `${instructions}\n\n${input}`,
    "--model", "haiku", "--effort", "low",
    "--safe-mode", "--no-session-persistence",
    "--tools", "", "--output-format", "json"], "", cwd, signal);
  const result = JSON.parse(raw);
  if (result.is_error || typeof result.result !== "string") throw new Error("Claude Code 命名失败");
  return result.result.trim().replace(/^\x60\x60\x60(?:json)?\s*|\s*\x60\x60\x60$/gu, "");
}

export function nativeGenerator(host) {
  const generate = {codex, antigravity, claude}[host];
  if (!generate) return undefined;
  return async (input, signal) => {
    const cwd = await mkdtemp(join(tmpdir(), "threadtag-model-"));
    try { return await generate(input, signal, cwd); }
    finally { await rm(cwd, {recursive: true, force: true}); }
  };
}
