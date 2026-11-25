import assert from "node:assert/strict";
import worker from "../src/index";
import { makeD1 } from "./d1-sqlite";

const env = { ANTHROPIC_API_KEY: "x", DB: makeD1() };
const call = async (path: string, token: string | null, method = "GET", body?: unknown) => {
  const r = await worker.fetch(
    new Request("https://x" + path, {
      method,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  );
  return { status: r.status, json: (await r.json()) as any };
};
const reg = async (email: string) =>
  (await call("/auth/register", null, "POST", { email, password: "password123", deviceId: email, deviceName: "x" }))
    .json.token as string;

const lio = await reg("lio@example.com");
const dani = await reg("dani@example.com");
assert.equal((await call("/buddy", null)).status, 401);
assert.equal((await call("/buddy/request", lio, "POST", { email: "nobody@example.com" })).status, 404);
assert.equal((await call("/buddy/request", lio, "POST", { email: "lio@example.com" })).status, 400);
assert.equal((await call("/buddy/request", lio, "POST", { email: "dani@example.com" })).status, 200);

// pending: dani sees an incoming request, lio can't accept his own request
let d = (await call("/buddy?today=2026-11-25&yesterday=2026-11-24", dani)).json.buddies;
assert.equal(d.length, 1);
assert.equal(d[0].incoming, true);
assert.equal(d[0].name, "lio");
await call("/buddy/accept", lio, "POST", { id: d[0].id });
assert.equal((await call("/buddy", lio)).json.buddies[0].status, "pending", "requester cannot accept");
await call("/buddy/accept", dani, "POST", { id: d[0].id });

// reports are only visible once accepted
await call("/report", lio, "PUT", {
  days: [
    { day: "2026-11-24", done: 2, total: 5 },
    { day: "2026-11-25", done: 1, total: 4 },
    { day: "bad", done: 1, total: 1 },
  ],
});
d = (await call("/buddy?today=2026-11-25&yesterday=2026-11-24", dani)).json.buddies;
assert.equal(d[0].status, "accepted");
assert.deepEqual(d[0].today, { done: 1, total: 4 });
assert.deepEqual(d[0].yesterday, { done: 2, total: 5 });

// remove
await call("/buddy/remove", dani, "POST", { id: d[0].id });
assert.equal((await call("/buddy", lio)).json.buddies.length, 0);
console.log("buddies: ok");
