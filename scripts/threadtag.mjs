#!/usr/bin/env node
import {readFileSync, writeFileSync} from "node:fs";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import {nativeGenerator} from "./native-cli.mjs";
import {suggest} from "./model.mjs";
import {getState, modelMode, paused, save, setManaged} from "./host-state.mjs";
import {withCodexSession} from "./codex/adapter.mjs";
import {withAntigravitySession} from "./antigravity/adapter.mjs";
import {withClaudeSession} from "./claude/adapter.mjs";

const hosts = {codex: withCodexSession, antigravity: withAntigravitySession, claude: withClaudeSession};
const [command, host, id, ...args] = process.argv.slice(2);
const print = data => console.log(JSON.stringify(data, null, 2));
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

async function update(session, automatic, replacement) {
  const before = await session.read();
  if (before.skip) return {action: "keep", title: before.title, reason: "此会话不参与命名"};
  const messages = await session.messages(before.path);
  const owned = Boolean(before.title) && before.title === (await getState(host, session.id)).title;
  const result = replacement ? {action: "rename", title: replacement, reason: "显式指定标题"}
    : await suggest(messages, {current: before.title, managed: owned,
        locked: automatic && Boolean(before.title) && !owned && before.title !== messages[0]}, nativeGenerator(host));
  if (command === "preview-session" || result.action === "keep") return result;

  const latest = await session.read();
  if (!same(latest, before) || (!replacement && !same(await session.messages(latest.path), messages))
      || (automatic && await paused())) {
    return {action: "keep", title: latest.title, reason: "会话状态已变化或已暂停"};
  }

  await session.rename(result.title);
  // Explicit titles are owned by the user. Only successful automatic writes are tracked.
  await setManaged(host, session.id, automatic ? result.title : "");
  return result;
}

async function main() {
  if (command === "preview") {
    const input = [host, id, ...args].filter(value => value !== undefined);
    print(await suggest(input.length ? input : [readFileSync(0, "utf8")]));
    return;
  }
  if (command === "model") {
    if (host === "local" || host === "native") await save("model.json", {mode: host});
    else if (host) throw new Error("用法：model [local|native]");
    print({mode: await modelMode()});
    return;
  }
  if (command === "pause" || command === "resume") {
    await save("settings.json", {paused: command === "pause"});
    print({paused: await paused()});
    return;
  }
  if (command === "hook-config" && (host === "codex" || host === "claude")) {
    const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
    const invocation = [process.execPath, fileURLToPath(import.meta.url), "hook", host].map(quote).join(" ");
    const entry = host === "claude"
      ? {matcher: "", hooks: [{type: "command", command: invocation, timeout: 10}]}
      : {hooks: [{type: "command", command: invocation, timeout: 10}]};
    print({hooks: {Stop: [entry]}});
    return;
  }
  if (command === "hook" && hosts[host]) {
    const payload = JSON.parse(readFileSync(0, "utf8") || "{}");
    const target = host === "antigravity" ? payload.conversationId : payload.session_id;
    const stopped = (payload.hook_event_name ?? payload.hookEventName ?? "Stop") === "Stop";
    if (target && stopped && !payload.stop_hook_active && !payload.continuationActive
        && payload.fullyIdle !== false && !["USER_CANCELED", "ERROR", "TERMINAL_CUSTOM_HOOK"].includes(payload.terminationReason)) {
      const worker = spawn(process.execPath, [fileURLToPath(import.meta.url), "worker", host, target],
        {detached: true, stdio: "ignore"});
      worker.on("error", () => {});
      worker.unref();
    }
    console.log("{}");
    return;
  }
  if (command === "deepseek-patch") {
    const provider = fileURLToPath(new URL("./deepseek/provider.mjs", import.meta.url));
    const template = readFileSync(new URL("./deepseek/cordis.patch.yml", import.meta.url), "utf8");
    writeFileSync(1, template.replace("THREADTAG_PROVIDER_ABSOLUTE_PATH", JSON.stringify(provider)));
    return;
  }
  if (Object.hasOwn(hosts, host) && ["worker", "preview-session", "rename"].includes(command)) {
    if (command === "worker" && await paused()) return;
    const replacement = command === "rename" ? args.join(" ").trim() : "";
    if (command === "rename" && (!replacement || [...replacement].length > 48 || /[\p{Cc}\p{Cf}]/u.test(replacement.replace(/^🧑‍💻 /, "")))) {
      throw new Error("请提供 1–48 字的单行标题");
    }
    print(await hosts[host](id, session => update(session, command === "worker", replacement)));
    return;
  }
  throw new Error("用法：preview [需求 …] | preview-session <宿主> <UUID> | rename <宿主> <UUID> <标题> | pause | resume | model [local|native] | hook-config <codex|claude> | deepseek-patch");
}

main().catch(error => {
  if (command === "hook") {
    console.log("{}");
    return;
  }
  console.error(error.message);
  process.exitCode = 1;
});
