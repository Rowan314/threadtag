import {suggest} from "../model.mjs";
import {harnessGenerator} from "./native-model.mjs";
import {paused} from "../host-state.mjs";

export const name = "threadtag";
export const inject = ["sessionTitle", "llm"];

function messageText(message) {
  if (typeof message.text === "string") return message.text;
  const content = message.content ?? message.message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter(block => block.type === "text").map(block => block.text).join("\n");
}

export function apply(ctx) {
  ctx.sessionTitle.register({
    id: name,
    automatic: "all-prompts",
    async generate(request) {
      const messages = request.messages.slice(-6);
      const current = request.currentTitle;
      const locked = current?.source?.kind === "user" || await paused();
      const messageSeqs = messages.map(message => message.seq);
      const result = await suggest(messages.map(messageText), {
        current: current?.title,
        locked,
        signal: request.signal,
        managed: current?.source?.kind === "provider" && current.source.provider === name,
      }, harnessGenerator(ctx, request, messageSeqs));
      return {
        // Preserve the existing visible title when evidence is sparse or naming is paused.
        title: result.title,
        messageSeqs,
      };
    },
  });
}
