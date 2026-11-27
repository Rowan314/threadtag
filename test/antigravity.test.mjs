import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createServer} from "node:http";
import {mkdtemp, mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {setTimeout} from "node:timers/promises";
import {test} from "node:test";
import {fileURLToPath} from "node:url";

const script = fileURLToPath(new URL("../scripts/threadtag.mjs", import.meta.url));
const id = "11111111-2222-4333-8444-555555555555";
const defaultTitle = "Repair browser title refresh";
const autoTitle = "🧑‍💻 PaperCompass 标题同步｜修复";
const pbtxt = `title:"${defaultTitle}"  last_user_view_time:{seconds:1}\n`;

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "threadtag-agy-"));
  t.after(() => rm(root, {recursive: true, force: true}));
  const state = join(root, "threadtag");
  const annotation = join(root, "annotations", `${id}.pbtxt`);
  const logs = join(root, "brain", id, ".system_generated/logs");
  const daemon = join(root, "daemon");
  for (const dir of [join(root, "annotations"), logs, daemon]) await mkdir(dir, {recursive: true});
  await writeFile(annotation, pbtxt);
  await writeFile(join(logs, "transcript.jsonl"), JSON.stringify({type: "USER_INPUT", source: "USER_EXPLICIT", content: "修复 PaperCompass 标题同步"}) + "\n");
  const env = {...process.env, THREADTAG_AGY_DATA: root, THREADTAG_HOME: state};
  delete env.ANTIGRAVITY_LS_ADDRESS;
  delete env.ANTIGRAVITY_CSRF_TOKEN;
  return {state, annotation, daemon, env};
}

async function run(env, args, input = "") {
  const child = spawn(process.execPath, [script, ...args], {env, stdio: ["pipe", "pipe", "pipe"]});
  child.stdin.end(input);
  let out = "";
  let err = "";
  child.stdout.setEncoding("utf8").on("data", chunk => {out += chunk;});
  child.stderr.setEncoding("utf8").on("data", chunk => {err += chunk;});
  const code = await new Promise((resolve, reject) => child.on("close", resolve).on("error", reject));
  assert.equal(code, 0, err);
  return JSON.parse(out);
}

async function hub(t, daemon, handler, mode = 0o600) {
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    const result = handler(req.url.split("/").at(-1), req.headers["x-antigravity-csrf-token"], body);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result));
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const {port} = server.address();
  await writeFile(join(daemon, `hub_${port}.json`), JSON.stringify({httpPort: port, csrfToken: "test-token"}), {mode});
}

async function lastEvent(state) {
  const deadline = Date.now() + 5000;
  do {
    try {
      const lines = await readFile(join(state, "events.jsonl"), "utf8");
      return JSON.parse(lines.trim().split("\n").at(-1));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await setTimeout(25);
  } while (Date.now() < deadline);
  assert.fail("Stop Hook did not produce a worker event");
}

test("Stop Hook updates a conversation through its private desktop hub without injected environment", async t => {
  const {state, annotation, daemon, env} = await fixture(t);
  const calls = [];
  let title = defaultTitle;
  await hub(t, daemon, (method, token, body) => {
    calls.push([method, token, body.conversationId]);
    if (method === "UpdateConversation") title = body.annotations.title;
    return {id, annotations: {title}};
  });

  assert.deepEqual(await run(env, ["hook", "antigravity"], JSON.stringify({conversationId: id, fullyIdle: true})), {});
  const event = await lastEvent(state);
  assert.deepEqual([event.action, event.backend, event.title], ["rename", "conversation_service", autoTitle]);
  assert.deepEqual(calls, ["GetConversation", "GetConversation", "UpdateConversation"].map(method => [method, "test-token", id]));
  assert.equal(title, autoTitle);
  assert.equal(await readFile(annotation, "utf8"), pbtxt);
});

test("falls back if a local hub does not recognize the target conversation", async t => {
  const {annotation, daemon, env} = await fixture(t);
  const calls = [];
  await hub(t, daemon, method => {
    calls.push(method);
    return {id: "other-conversation"};
  });

  const title = "🧑‍💻 regex $&｜修复";
  const result = await run(env, ["rename", "antigravity", id, title]);
  assert.deepEqual(calls, ["GetConversation"]);
  assert.equal(result.backend, "pbtxt_fallback");
  assert.equal(await readFile(annotation, "utf8"), pbtxt.replace(defaultTitle, () => title));
});

test("ignores a hub descriptor readable by other users on POSIX", {skip: process.platform === "win32"}, async t => {
  const {daemon, env} = await fixture(t);
  const calls = [];
  await hub(t, daemon, method => {calls.push(method); return {id};}, 0o644);

  const result = await run(env, ["worker", "antigravity", id]);
  assert.deepEqual([result.action, result.backend], ["rename", "pbtxt_fallback"]);
  assert.deepEqual(calls, []);
});

test("preserves archived, pinned, and child conversations discovered through the desktop hub", async t => {
  const {annotation, daemon, env} = await fixture(t);
  const calls = [];
  let flags = {};
  let parentConversationId;
  await hub(t, daemon, method => {
    calls.push(method);
    return {id, annotations: {title: defaultTitle, ...flags}, metadata: {parentConversationId}};
  });

  for (const protectedState of [{archived: true}, {pinned: true}, {}]) {
    flags = protectedState;
    parentConversationId = Object.keys(flags).length ? undefined : "parent";
    const result = await run(env, ["worker", "antigravity", id]);
    assert.deepEqual([result.action, result.title], ["keep", defaultTitle]);
  }
  assert.deepEqual(calls, Array(3).fill("GetConversation"));
  assert.equal(await readFile(annotation, "utf8"), pbtxt);
});
