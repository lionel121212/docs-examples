/**
 * Accounts with one active device per account.
 * Passwords: PBKDF2-SHA256 (WebCrypto) with a per-user salt. Session tokens: 32 random bytes,
 * only their SHA-256 is stored. Logging in while another device holds the session returns 409
 * `other_device`; the client asks the user, then repeats the login with `force: true`
 * (password required again), which revokes the old session.
 */
import type { Env } from "./entitlement";
import { underLimit } from "./ratelimit";

const ITERATIONS = 100_000;
const MAX_BLOB = 512 * 1024;
const enc = new TextEncoder();

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const randomId = (bytes = 16) =>
  b64(crypto.getRandomValues(new Uint8Array(bytes))).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]!);

async function sha256(s: string): Promise<string> {
  return b64(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: ITERATIONS },
    key,
    256,
  );
  return b64(bits);
}

function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type User = {
  id: string;
  email: string;
  pass_hash: string;
  salt: string;
  premium: number;
  active_session: string | null;
};
type Session = { id: string; user_id: string; device_id: string; device_name: string; last_seen: number };

export type AuthedUser = { user: User; session: Session };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

function db(env: Env): D1Database {
  if (!env.DB) throw new Error("DB binding missing");
  return env.DB;
}

async function createSession(env: Env, user: User, deviceId: string, deviceName: string) {
  const token = randomId(32);
  const id = randomId();
  const now = Date.now();
  // one device per account: drop every other session of this user
  await db(env).batch([
    db(env).prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
    db(env)
      .prepare(
        "INSERT INTO sessions (id, user_id, token_hash, device_id, device_name, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(id, user.id, await sha256(token), deviceId, deviceName, now, now),
    db(env).prepare("UPDATE users SET active_session = ? WHERE id = ?").bind(id, user.id),
  ]);
  return { token, user: { id: user.id, email: user.email, premium: user.premium === 1 } };
}

/** Resolves the bearer token. null = not logged in; "revoked" = this device was signed out by another login. */
export async function authenticate(req: Request, env: Env): Promise<AuthedUser | null | "revoked"> {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ") || !env.DB) return null;
  const session = await db(env)
    .prepare("SELECT id, user_id, device_id, device_name, last_seen FROM sessions WHERE token_hash = ?")
    .bind(await sha256(header.slice(7)))
    .first<Session>();
  if (!session) return "revoked";
  const user = await db(env).prepare("SELECT * FROM users WHERE id = ?").bind(session.user_id).first<User>();
  if (!user || user.active_session !== session.id) return "revoked";
  if (Date.now() - session.last_seen > 60_000) {
    await db(env).prepare("UPDATE sessions SET last_seen = ? WHERE id = ?").bind(Date.now(), session.id).run();
  }
  return { user, session };
}

type Body = { email?: unknown; password?: unknown; deviceId?: unknown; deviceName?: unknown; force?: unknown };

function readCreds(b: Body) {
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";
  const deviceId = typeof b.deviceId === "string" ? b.deviceId.slice(0, 80) : "";
  const deviceName = typeof b.deviceName === "string" ? b.deviceName.slice(0, 60) : "Device";
  return { email, password, deviceId, deviceName, force: b.force === true };
}

const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;

export async function handleAuth(req: Request, env: Env, path: string): Promise<Response> {
  if (!env.DB) return json(503, { error: "accounts_unavailable" });
  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";

  if (path === "/auth/logout" && req.method === "POST") {
    const me = await authenticate(req, env);
    if (me && me !== "revoked") {
      await db(env).batch([
        db(env).prepare("DELETE FROM sessions WHERE id = ?").bind(me.session.id),
        db(env)
          .prepare("UPDATE users SET active_session = NULL WHERE id = ? AND active_session = ?")
          .bind(me.user.id, me.session.id),
      ]);
    }
    return json(200, { ok: true });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "bad_json" });
  }
  const { email, password, deviceId, deviceName, force } = readCreds(body);
  if (!validEmail(email)) return json(400, { error: "invalid_email" });
  if (password.length < 8 || password.length > 200) return json(400, { error: "weak_password" });
  if (!deviceId) return json(400, { error: "no_device" });

  // brute-force protection (per email and per IP, per day)
  if (!(await underLimit(env.LIMITS, `auth:${email}`, 20)) || !(await underLimit(env.LIMITS, `authip:${ip}`, 60))) {
    return json(429, { error: "too_many_attempts" });
  }

  if (path === "/auth/register" && req.method === "POST") {
    const exists = await db(env).prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (exists) return json(409, { error: "email_taken" });
    const salt = randomId();
    const user: User = {
      id: randomId(),
      email,
      pass_hash: await hashPassword(password, salt),
      salt,
      premium: 0,
      active_session: null,
    };
    await db(env)
      .prepare("INSERT INTO users (id, email, pass_hash, salt, premium, created_at) VALUES (?, ?, ?, ?, 0, ?)")
      .bind(user.id, email, user.pass_hash, salt, Date.now())
      .run();
    return json(200, await createSession(env, user, deviceId, deviceName));
  }

  if (path === "/auth/login" && req.method === "POST") {
    const user = await db(env).prepare("SELECT * FROM users WHERE email = ?").bind(email).first<User>();
    // same work whether or not the user exists, so timing doesn't reveal accounts
    const check = await hashPassword(password, user?.salt ?? "no-user-salt");
    if (!user || !sameString(check, user.pass_hash)) return json(401, { error: "wrong_credentials" });

    if (user.active_session && !force) {
      const other = await db(env)
        .prepare("SELECT device_id, device_name, last_seen FROM sessions WHERE id = ?")
        .bind(user.active_session)
        .first<{ device_id: string; device_name: string; last_seen: number }>();
      if (other && other.device_id !== deviceId) {
        return json(409, { error: "other_device", device: other.device_name, lastSeen: other.last_seen });
      }
    }
    return json(200, await createSession(env, user, deviceId, deviceName));
  }

  return json(404, { error: "not_found" });
}

/** GET / PUT the user's synced app data (one JSON blob, last write wins). */
export async function handleSync(req: Request, env: Env): Promise<Response> {
  const me = await authenticate(req, env);
  if (me === "revoked") return json(401, { error: "session_revoked" });
  if (!me) return json(401, { error: "login_required" });
  if (req.method === "GET") {
    const row = await db(env)
      .prepare("SELECT blob, updated_at FROM user_data WHERE user_id = ?")
      .bind(me.user.id)
      .first<{ blob: string; updated_at: number }>();
    return json(200, {
      data: row ? JSON.parse(row.blob) : null,
      updatedAt: row?.updated_at ?? 0,
      premium: me.user.premium === 1,
    });
  }
  if (req.method === "PUT") {
    const text = await req.text();
    if (text.length > MAX_BLOB) return json(413, { error: "too_large" });
    let parsed: { data?: unknown };
    try {
      parsed = JSON.parse(text);
    } catch {
      return json(400, { error: "bad_json" });
    }
    if (!parsed.data || typeof parsed.data !== "object") return json(400, { error: "no_data" });
    const now = Date.now();
    await db(env)
      .prepare(
        "INSERT INTO user_data (user_id, blob, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET blob = excluded.blob, updated_at = excluded.updated_at",
      )
      .bind(me.user.id, JSON.stringify(parsed.data), now)
      .run();
    return json(200, { updatedAt: now });
  }
  return json(405, { error: "method" });
}

/** A tester code redeemed while logged in makes the whole account Premium (on every device). */
export async function redeemCode(req: Request, env: Env): Promise<Response> {
  const me = await authenticate(req, env);
  if (me === "revoked") return json(401, { error: "session_revoked" });
  if (!me) return json(401, { error: "login_required" });
  const code = req.headers.get("x-access-code")?.trim() ?? "";
  const codes = (env.ACCESS_CODES ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (!code || !codes.includes(code)) return json(403, { error: "bad_code" });
  await db(env).prepare("UPDATE users SET premium = 1 WHERE id = ?").bind(me.user.id).run();
  return json(200, { premium: true });
}
