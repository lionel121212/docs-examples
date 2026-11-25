/** Accountability buddies: friends see each other's daily progress. */
import { authenticate } from "./auth";
import type { Env } from "./entitlement";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

const pair = (x: string, y: string) => (x < y ? [x, y] : [y, x]);
const MAX_BUDDIES = 10;
const dayRe = /^\d{4}-\d{2}-\d{2}$/;

export async function handleBuddy(req: Request, env: Env, path: string): Promise<Response> {
  if (!env.DB) return json(503, { error: "accounts_unavailable" });
  const me = await authenticate(req, env);
  if (me === "revoked") return json(401, { error: "session_revoked" });
  if (!me) return json(401, { error: "login_required" });
  const db = env.DB;
  const uid = me.user.id;

  if (path === "/report" && req.method === "PUT") {
    const b = (await req.json().catch(() => ({}))) as { days?: { day: string; done: number; total: number }[] };
    const days = (b.days ?? [])
      .filter(
        (d) =>
          dayRe.test(d.day) &&
          Number.isInteger(d.done) &&
          Number.isInteger(d.total) &&
          d.total >= 0 &&
          d.done >= 0 &&
          d.done <= d.total &&
          d.total <= 200,
      )
      .slice(0, 3);
    for (const d of days) {
      await db
        .prepare(
          "INSERT INTO daily_reports (user_id, day, done, total) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, day) DO UPDATE SET done = excluded.done, total = excluded.total",
        )
        .bind(uid, d.day, d.done, d.total)
        .run();
    }
    return json(200, { ok: true });
  }

  if (path === "/buddy" && req.method === "GET") {
    const url = new URL(req.url);
    const today = url.searchParams.get("today") ?? "";
    const yesterday = url.searchParams.get("yesterday") ?? "";
    const rows = await db
      .prepare("SELECT user_a, user_b, status, requested_by FROM buddies WHERE user_a = ? OR user_b = ?")
      .bind(uid, uid)
      .all<{ user_a: string; user_b: string; status: string; requested_by: string }>();
    const out = [];
    for (const r of rows.results ?? []) {
      const other = r.user_a === uid ? r.user_b : r.user_a;
      const u = await db.prepare("SELECT email FROM users WHERE id = ?").bind(other).first<{ email: string }>();
      if (!u) continue;
      const report = async (day: string) =>
        r.status === "accepted" && dayRe.test(day)
          ? await db
              .prepare("SELECT done, total FROM daily_reports WHERE user_id = ? AND day = ?")
              .bind(other, day)
              .first<{ done: number; total: number }>()
          : null;
      out.push({
        id: other,
        name: u.email.split("@")[0],
        status: r.status,
        incoming: r.status === "pending" && r.requested_by !== uid,
        today: await report(today),
        yesterday: await report(yesterday),
      });
    }
    return json(200, { buddies: out });
  }

  if (req.method !== "POST") return json(405, { error: "method" });
  const b = (await req.json().catch(() => ({}))) as { email?: string; id?: string };

  if (path === "/buddy/request") {
    const email = (b.email ?? "").trim().toLowerCase();
    const other = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>();
    if (!other) return json(404, { error: "not_found" });
    if (other.id === uid) return json(400, { error: "self" });
    const count = await db
      .prepare("SELECT COUNT(*) AS n FROM buddies WHERE user_a = ? OR user_b = ?")
      .bind(uid, uid)
      .first<{ n: number }>();
    if ((count?.n ?? 0) >= MAX_BUDDIES) return json(429, { error: "too_many" });
    const [a, c] = pair(uid, other.id);
    await db
      .prepare(
        "INSERT OR IGNORE INTO buddies (user_a, user_b, status, requested_by, created_at) VALUES (?, ?, 'pending', ?, ?)",
      )
      .bind(a, c, uid, Date.now())
      .run();
    return json(200, { ok: true });
  }

  const other = typeof b.id === "string" ? b.id : "";
  const [a, c] = pair(uid, other);
  if (path === "/buddy/accept") {
    // only the person who received the request can accept it
    await db
      .prepare("UPDATE buddies SET status = 'accepted' WHERE user_a = ? AND user_b = ? AND requested_by != ?")
      .bind(a, c, uid)
      .run();
    return json(200, { ok: true });
  }
  if (path === "/buddy/remove") {
    await db.prepare("DELETE FROM buddies WHERE user_a = ? AND user_b = ?").bind(a, c).run();
    return json(200, { ok: true });
  }
  return json(404, { error: "not_found" });
}
