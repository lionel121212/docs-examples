import Anthropic from "@anthropic-ai/sdk";
import assert from "node:assert/strict";
import worker from "../src/index";
import { makePlan } from "../src/plan";

const fakePlan = {
  summary: "תוכנית לשבוע",
  tasks: [
    { title: "אימון כושר", category: "sport", time: "17:00", days: [0, 2, 4], exercises: [{ name: "שכיבות סמיכה", detail: "80" }] },
    { title: "שעה לא חוקית", category: "other", time: "25:99", days: [1], exercises: [] },
    { title: "ימים לא חוקיים", category: "other", time: "9:05", days: [9, 3, 3], exercises: [] },
  ],
};

let sentBody: any;
const fakeFetch = (async (_url: any, init: any) => {
  sentBody = JSON.parse(init.body);
  return new Response(
    JSON.stringify({
      id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5",
      content: [{ type: "text", text: JSON.stringify(fakePlan) }],
      stop_reason: "end_turn", stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}) as typeof fetch;

const client = new Anthropic({ apiKey: "test", fetch: fakeFetch });
const plan = await makePlan(client, { request: "אני רוצה להתאמן 3 פעמים בשבוע", today: "2026-11-25" });

assert.equal(sentBody.model, "claude-opus-5-5");
assert.equal(sentBody.fallbacks, "default");
assert.equal(sentBody.output_config.effort, "medium");
assert.equal(sentBody.output_config.format.type, "json_schema");
assert.equal(plan.tasks.length, 2, "invalid time dropped");
assert.deepEqual(plan.tasks[1].days, [3], "days cleaned + deduped");
assert.equal(plan.tasks[1].time, "09:05", "time padded");
console.log("makePlan: ok");

// HTTP layer: no subscription -> 402, tester code -> passes the gate
const env = { ANTHROPIC_API_KEY: "test", ACCESS_CODES: "abc123" };
const post = (headers: Record<string, string>, body: unknown) =>
  new Request("https://x/plan", { method: "POST", headers, body: JSON.stringify(body) });
assert.equal((await worker.fetch(post({}, { request: "hi" }), env)).status, 402);
assert.equal((await worker.fetch(post({ "x-access-code": "wrong" }, { request: "hi" }), env)).status, 402);
assert.equal((await worker.fetch(post({ "x-access-code": "abc123" }, { request: "" }), env)).status, 400);
assert.equal((await worker.fetch(post({ "x-access-code": "abc123" }, { request: "x".repeat(3000) }), env)).status, 400);
console.log("http gate: ok");
