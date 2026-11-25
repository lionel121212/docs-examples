import assert from "node:assert/strict";
import worker from "../src/index";
import { MODEL } from "../src/llm";

/** Fake Workers AI binding: records the request and answers with `reply`. */
function fakeAI(reply: unknown, asObject = false) {
  const calls: any[] = [];
  const ai = {
    run: async (model: string, input: any) => {
      calls.push({ model, input });
      const content = asObject ? reply : "```json\n" + JSON.stringify(reply) + "\n```";
      return { choices: [{ message: { content } }] };
    },
  } as unknown as Ai;
  return { ai, calls };
}

const post = (path: string, headers: Record<string, string>, body: unknown) =>
  new Request("https://x" + path, { method: "POST", headers, body: JSON.stringify(body) });

// ---- /plan: premium gate, validation, sanitizing
const planReply = {
  summary: "תוכנית לשבוע",
  tasks: [
    {
      title: "אימון כושר",
      category: "sport",
      time: "17:00",
      days: [0, 2, 4],
      exercises: [{ name: "שכיבות סמיכה", detail: "80" }],
    },
    { title: "שעה לא חוקית", category: "other", time: "25:99", days: [1], exercises: [] },
    { title: "ימים לא חוקיים", category: "other", time: "9:05", days: [9, 3, 3], exercises: [] },
  ],
};
let f = fakeAI(planReply);
const env: any = { AI: f.ai, ACCESS_CODES: "abc123" };
assert.equal((await worker.fetch(post("/plan", {}, { request: "hi" }), env)).status, 402);
assert.equal((await worker.fetch(post("/plan", { "x-access-code": "wrong" }, { request: "hi" }), env)).status, 402);
assert.equal((await worker.fetch(post("/plan", { "x-access-code": "abc123" }, { request: "" }), env)).status, 400);
assert.equal(
  (await worker.fetch(post("/plan", { "x-access-code": "abc123" }, { request: "x".repeat(3000) }), env)).status,
  400,
);
const plan = await worker.fetch(
  post("/plan", { "x-access-code": "abc123" }, { request: "3 אימונים בשבוע", lang: "he" }),
  env,
);
assert.equal(plan.status, 200);
const pj: any = await plan.json();
assert.equal(f.calls[0].model, MODEL);
assert.equal(f.calls[0].input.response_format.type, "json_schema");
assert.equal(pj.tasks.length, 2, "invalid time dropped");
assert.deepEqual(pj.tasks[1].days, [3], "days cleaned + deduped");
assert.equal(pj.tasks[1].time, "09:05", "time padded");
console.log("plan: ok");

// model answers with an object instead of a string -> still fine
env.AI = fakeAI(planReply, true).ai;
assert.equal((await worker.fetch(post("/plan", { "x-access-code": "abc123" }, { request: "x" }), env)).status, 200);
// garbage from the model -> 502, quota error -> 503
env.AI = fakeAI({ nope: true }).ai;
assert.equal((await worker.fetch(post("/plan", { "x-access-code": "abc123" }, { request: "x" }), env)).status, 502);
env.AI = {
  run: async () => {
    throw new Error("4006: daily free allocation exceeded");
  },
};
assert.equal((await worker.fetch(post("/plan", { "x-access-code": "abc123" }, { request: "x" }), env)).status, 503);
console.log("plan errors: ok");

// ---- /me
assert.deepEqual(
  await (await worker.fetch(new Request("https://x/me", { headers: { "x-access-code": "abc123" } }), env)).json(),
  { premium: true },
);
assert.deepEqual(await (await worker.fetch(new Request("https://x/me"), env)).json(), { premium: false });

// ---- /onboard (free)
f = fakeAI({
  insight: "תובנה",
  recommendations: ["א", "ב", "ג", "ד"],
  plan: { summary: "s", tasks: [{ title: "ריצה", category: "sport", time: "16:00", days: [0, 2, 4], exercises: [] }] },
});
env.AI = f.ai;
const profile = {
  life: "school",
  wake: "07:00",
  sleep: "23:00",
  busyFrom: "08:00",
  busyTo: "14:30",
  struggles: ["procrast"],
  goals: ["fitness"],
  freeMinutes: 120,
};
const ob = await worker.fetch(post("/onboard", {}, { profile, lang: "he" }), env);
assert.equal(ob.status, 200);
const oj: any = await ob.json();
assert.equal(oj.recommendations.length, 3, "capped at 3");
assert.equal(oj.plan.tasks.length, 1);
assert.match(f.calls[0].input.messages[1].content, /Language: Hebrew/);
assert.equal((await worker.fetch(post("/onboard", {}, { profile: { life: 1 } }), env)).status, 400);
console.log("onboard + me: ok");

// ---- /coach (premium only)
const week = {
  done: 9,
  total: 14,
  lastWeekRate: 50,
  streak: 2,
  tasks: [{ title: "ריצה", time: "06:00", done: 1, total: 4 }],
};
env.AI = fakeAI({ headline: "שבוע טוב", tips: ["א", "ב", "ג", "ד"] }).ai;
assert.equal((await worker.fetch(post("/coach", {}, { week }), env)).status, 402);
const co = await worker.fetch(post("/coach", { "x-access-code": "abc123" }, { week, lang: "he" }), env);
assert.equal(co.status, 200);
assert.equal(((await co.json()) as any).tips.length, 3);
console.log("coach: ok");
