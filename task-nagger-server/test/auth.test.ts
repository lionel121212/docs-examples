import assert from "node:assert/strict";
import worker from "../src/index";
import { makeD1 } from "./d1-sqlite";

const env = { ANTHROPIC_API_KEY: "x", ACCESS_CODES: "vip1", DB: makeD1() };
const call = async (
  path: string,
  init: { method?: string; body?: unknown; token?: string; headers?: Record<string, string> } = {},
) => {
  const res = await worker.fetch(
    new Request("https://x" + path, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: { ...(init.token ? { authorization: `Bearer ${init.token}` } : {}), ...(init.headers ?? {}) },
      body: init.body === undefined ? undefined : typeof init.body === "string" ? init.body : JSON.stringify(init.body),
    }),
    env,
  );
  return { status: res.status, json: (await res.json()) as any };
};
const creds = (device: string, extra: object = {}) => ({
  email: "Lio@Example.com",
  password: "correct horse",
  deviceId: device,
  deviceName: device,
  ...extra,
});

// register + validation
assert.equal(
  (await call("/auth/register", { body: { ...creds("A"), password: "short" } })).json.error,
  "weak_password",
);
assert.equal((await call("/auth/register", { body: { ...creds("A"), email: "nope" } })).json.error, "invalid_email");
const reg = await call("/auth/register", { body: creds("phone-A") });
assert.equal(reg.status, 200);
assert.equal(reg.json.user.email, "lio@example.com");
const tokenA = reg.json.token as string;
assert.equal((await call("/auth/register", { body: creds("phone-A") })).json.error, "email_taken");

// sync from device A
assert.equal((await call("/sync", { token: tokenA })).json.data, null);
const put = await call("/sync", {
  method: "PUT",
  token: tokenA,
  body: { data: { tasks: [{ id: "t1" }], lang: "he" } },
});
assert.equal(put.status, 200);

// wrong password
assert.equal((await call("/auth/login", { body: { ...creds("phone-B"), password: "wrong password" } })).status, 401);

// device B: another device is logged in -> 409 with its name, no session created
const conflict = await call("/auth/login", { body: creds("phone-B") });
assert.equal(conflict.status, 409);
assert.equal(conflict.json.error, "other_device");
assert.equal(conflict.json.device, "phone-A");
assert.equal((await call("/sync", { token: tokenA })).status, 200, "A still logged in after a declined attempt");

// forcing still needs the right password
assert.equal(
  (await call("/auth/login", { body: { ...creds("phone-B", { force: true }), password: "bad password!" } })).status,
  401,
);
const forced = await call("/auth/login", { body: creds("phone-B", { force: true }) });
assert.equal(forced.status, 200);
const tokenB = forced.json.token as string;

// A is signed out, B sees A's data
const aAfter = await call("/sync", { token: tokenA });
assert.equal(aAfter.status, 401);
assert.equal(aAfter.json.error, "session_revoked");
const bData = await call("/sync", { token: tokenB });
assert.deepEqual(bData.json.data, { tasks: [{ id: "t1" }], lang: "he" });

// same device logging in again: no conflict
assert.equal((await call("/auth/login", { body: creds("phone-B") })).status, 200);

// Premium follows the account
const tokenB2 = (await call("/auth/login", { body: creds("phone-B") })).json.token as string;
assert.equal(
  (await call("/redeem", { method: "POST", token: tokenB2, headers: { "x-access-code": "nope" } })).status,
  403,
);
assert.equal(
  (await call("/redeem", { method: "POST", token: tokenB2, headers: { "x-access-code": "vip1" } })).status,
  200,
);
assert.deepEqual((await call("/me", { token: tokenB2 })).json, { premium: true });
const tokenC = (await call("/auth/login", { body: creds("phone-C", { force: true }) })).json.token as string;
assert.deepEqual((await call("/me", { token: tokenC })).json, { premium: true }, "premium on the new phone too");
assert.equal((await call("/sync", { token: tokenC })).json.premium, true);

// logout frees the account: next device logs in without a conflict
await call("/auth/logout", { method: "POST", token: tokenC });
assert.equal((await call("/sync", { token: tokenC })).status, 401);
assert.equal((await call("/auth/login", { body: creds("phone-D") })).status, 200);

// oversized sync is rejected
const big = "x".repeat(600 * 1024);
const tokenD = (await call("/auth/login", { body: creds("phone-D") })).json.token as string;
assert.equal((await call("/sync", { method: "PUT", token: tokenD, body: { data: { big } } })).status, 413);

console.log("accounts + single device + sync + premium: ok");

// ---- forgot / reset password
const mailEnv = { ...env, RESEND_API_KEY: "re_test", MAIL_FROM: "noreply@example.com" };
let lastMail: any = null as any;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, init: any) => {
  if (String(url).includes("api.resend.com")) {
    lastMail = JSON.parse(init.body);
    return new Response("{}", { status: 200 });
  }
  return realFetch(url, init);
}) as typeof fetch;
const callM = async (path: string, body: unknown) => {
  const r = await worker.fetch(
    new Request("https://x" + path, { method: "POST", body: JSON.stringify(body) }),
    mailEnv,
  );
  return { status: r.status, json: (await r.json()) as any };
};
assert.equal(
  (await call("/auth/forgot", { body: { email: "lio@example.com" } })).json.error,
  "mail_unavailable",
  "no mail config -> clear error",
);
assert.equal(
  (await callM("/auth/forgot", { email: "nobody@example.com" })).json.sent,
  true,
  "unknown email: same answer",
);
assert.equal(lastMail, null, "but no mail is sent");
assert.equal((await callM("/auth/forgot", { email: "LIO@example.com", lang: "he" })).status, 200);
assert.deepEqual((lastMail as any).to, ["lio@example.com"]);
const code = /letter-spacing:6px">(\d{6})</.exec((lastMail as any).html)![1];
assert.equal(
  (
    await callM("/auth/reset", {
      email: "lio@example.com",
      code: "000000",
      password: "brand new pass",
      deviceId: "phone-E",
    })
  ).json.error,
  "bad_code",
);
const reset = await callM("/auth/reset", {
  email: "lio@example.com",
  code,
  password: "brand new pass",
  deviceId: "phone-E",
  deviceName: "phone-E",
});
assert.equal(reset.status, 200);
assert.ok(reset.json.token, "signed in after reset");
assert.equal(
  (await callM("/auth/reset", { email: "lio@example.com", code, password: "another pass!", deviceId: "phone-E" }))
    .status,
  401,
  "code works once",
);
assert.equal((await call("/sync", { token: tokenD })).status, 401, "old devices signed out");
assert.equal((await call("/auth/login", { body: creds("phone-E") })).status, 401, "old password no longer works");
assert.equal((await call("/auth/login", { body: { ...creds("phone-E"), password: "brand new pass" } })).status, 200);
globalThis.fetch = realFetch;
console.log("password reset: ok");
