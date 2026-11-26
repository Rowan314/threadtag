import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {instructions} from "../model.mjs";

const packageName = "@deepseek-ai/dsh-session-title-llm";

async function nativeExecutor() {
  try {
    return (await import(packageName)).executeSessionTitleLlm;
  } catch (error) {
    // Desktop bundles the SDK under app.asar while the provider lives outside it.
    if (!process.resourcesPath || error.code !== "ERR_MODULE_NOT_FOUND") throw error;
    const sdk = join(process.resourcesPath, "app.asar/dsh/node_modules", packageName, "lib/index.js");
    return (await import(pathToFileURL(sdk).href)).executeSessionTitleLlm;
  }
}

export function harnessGenerator(ctx, request, messageSeqs, execute = nativeExecutor) {
  return async (input, signal) => {
    const run = await execute();
    const result = await run(ctx, {
      provider: "deepseek-official", model: "deepseek-flash",
      maxInputBytes: 2048, maxOutputTokens: 96, timeoutMs: 14000,
    }, {...request, signal}, "threadtag", {
      system: instructions, input, messageSeqs,
      selectReasoningEffort: model => model.reasoning?.efforts[0]?.id,
    });
    if (result.finish.kind !== "stop") throw new Error("Harness 命名未完成");
    return result.blocks.filter(block => block.type === "text").map(block => block.text).join("");
  };
}
