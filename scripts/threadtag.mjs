#!/usr/bin/env node
import {existsSync, readFileSync, writeFileSync} from "node:fs";
import {spawn} from "node:child_process";
import {homedir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {nativeGenerator} from "./native-cli.mjs";
import {suggest} from "./model.mjs";
import {getState, home, modelMode, paused, recentEvents, recordEvent, save, setManaged, trackedCount} from "./host-state.mjs";
import {withCodexSession} from "./codex/adapter.mjs";
import {withAntigravitySession} from "./antigravity/adapter.mjs";
import {withClaudeSession} from "./claude/adapter.mjs";

const hosts = {codex: withCodexSession, antigravity: withAntigravitySession, claude: withClaudeSession};
const [command, host, id, ...args] = process.argv.slice(2);
const print = data => console.log(JSON.stringify(data, null, 2));
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function update(session, automatic, replacement) {
  const before = await session.read();
  if (before.skip) return {action: "keep", title: before.title, reason: "此会话不参与命名", backend: session.backend};
  const messages = await session.messages(before.path);
  const owned = Boolean(before.title) && before.title === (await getState(host, session.id)).title;
  const result = replacement ? {action: "rename", title: replacement, reason: "显式指定标题"}
    : await suggest(messages, {current: before.title, managed: owned,
        locked: automatic && Boolean(before.title) && !owned && before.title !== messages[0]}, nativeGenerator(host));
  if (command === "preview-session" || result.action === "keep") return {...result, backend: session.backend};

  const latest = await session.read();
  if (!same(latest, before) || (!replacement && !same(await session.messages(latest.path), messages))
      || (automatic && await paused())) {
    return {action: "keep", title: latest.title, reason: "会话状态已变化或已暂停", backend: session.backend};
  }

  await session.rename(result.title);
  // Explicit titles are owned by the user. Only successful automatic writes are tracked.
  await setManaged(host, session.id, automatic ? result.title : "");
  return {...result, backend: session.backend};
}

async function runDoctor() {
  const agyLocal = join(homedir(), ".local/bin/agy");
  const claudeBins = ["/opt/homebrew/bin/claude", "/usr/local/bin/claude"];
  const report = {
    node: process.version,
    plugin_root: pluginRoot,
    state_dir: home(),
    plugin_manifest_exists: existsSync(join(pluginRoot, "plugin.json")),
    hooks_file_exists: existsSync(join(pluginRoot, "hooks.json")),
    mode: await modelMode(),
    paused: await paused(),
    rpc_env_present: Boolean(process.env.ANTIGRAVITY_LS_ADDRESS && process.env.ANTIGRAVITY_CSRF_TOKEN),
    agy_bin_exists: existsSync(agyLocal),
    claude_bin_exists: claudeBins.some(existsSync),
  };
  if (process.env.ANTIGRAVITY_CONVERSATION_ID) {
    try {
      report.antigravity_session = await withAntigravitySession(process.env.ANTIGRAVITY_CONVERSATION_ID, async session => {
        const meta = await session.read();
        const messages = await session.messages(meta.path);
        return {id: session.id, backend: session.backend, title: meta.title, skip: meta.skip, message_count: messages.length};
      });
    } catch (error) {
      report.antigravity_session = {error: error.message};
    }
  }
  print(report);
}

async function main() {
  if (command === "doctor") {
    await runDoctor();
    return;
  }
  if (command === "status") {
    print({
      plugin_root: pluginRoot,
      state_dir: home(),
      mode: await modelMode(),
      paused: await paused(),
      tracked_sessions: await trackedCount(),
      recent_events: await recentEvents(5),
    });
    return;
  }
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
    try {
      const result = await hosts[host](id, session => update(session, command === "worker", replacement));
      if (command === "worker") {
        await recordEvent({host, id, action: result.action, backend: result.backend, title: result.title, reason: result.reason});
      }
      print(result);
    } catch (error) {
      if (command === "worker") {
        await recordEvent({host, id, action: "error", reason: error.message});
      }
      throw error;
    }
    return;
  }
  throw new Error("用法：doctor | status | preview [需求 …] | preview-session <宿主> <UUID> | rename <宿主> <UUID> <标题> | pause | resume | model [local|native] | hook-config <codex|claude> | deepseek-patch");
}

main().catch(error => {
  if (command === "hook") {
    console.log("{}");
    return;
  }
  console.error(error.message);
  process.exitCode = 1;
});
