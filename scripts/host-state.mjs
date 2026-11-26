import {mkdir, readFile, rename, writeFile} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {homedir} from "node:os";
import {join} from "node:path";

export function home() {
  return process.env.THREADTAG_HOME || join(homedir(), ".local/state/threadtag");
}

export function sessionId(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("需要有效的会话 UUID");
  }
  return value.toLowerCase();
}

async function read(path) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

export async function paused() {
  return (await read(join(home(), "settings.json"))).paused === true;
}

export async function modelMode() {
  return (await read(join(home(), "model.json"))).mode === "native" ? "native" : "local";
}

export function getState(host, id) {
  return read(join(home(), `${host}-${sessionId(id)}.json`));
}

export async function save(name, value) {
  await mkdir(home(), {recursive: true, mode: 0o700});
  const temp = join(home(), `.${randomUUID()}.tmp`);
  await writeFile(temp, JSON.stringify(value), {mode: 0o600, flag: "wx"});
  await rename(temp, join(home(), name));
}

export function setManaged(host, id, title) {
  return save(`${host}-${sessionId(id)}.json`, {title});
}
