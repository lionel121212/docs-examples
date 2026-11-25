import Anthropic from "@anthropic-ai/sdk";
import { handleAuth, handleReset, handleSync, redeemCode } from "./auth";
import { Env, isAllowed } from "./entitlement";
import { makeCoach, WeekSchema } from "./coach";
import { makeOnboarding, ProfileSchema } from "./onboard";
import { makePlan, PlanError } from "./plan";
import { underLimit } from "./ratelimit";

const MAX_REQUEST_CHARS = 2000;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/") return json(200, { ok: true });
    if (req.method === "GET" && url.pathname === "/me") {
      return json(200, { premium: await isAllowed(req, env) });
    }
    if (req.method === "POST" && url.pathname === "/onboard") return onboard(req, env);
    if (req.method === "POST" && (url.pathname === "/auth/forgot" || url.pathname === "/auth/reset"))
      return handleReset(req, env, url.pathname);
    if (url.pathname.startsWith("/auth/")) return handleAuth(req, env, url.pathname);
    if (url.pathname === "/sync") return handleSync(req, env);
    if (req.method === "POST" && url.pathname === "/redeem") return redeemCode(req, env);
    if (req.method === "POST" && url.pathname === "/coach") return coach(req, env);
    if (req.method !== "POST" || url.pathname !== "/plan") return json(404, { error: "not_found" });

    if (!(await isAllowed(req, env))) return json(402, { error: "subscription_required" });
    // Premium has no task limit, but AI calls cost money: cap each user at 30 plans a day.
    const planUser = req.headers.get("x-app-user-id") ?? req.headers.get("cf-connecting-ip") ?? "unknown";
    if (!(await underLimit(env.LIMITS, `plan:${planUser}`, 30))) return json(429, { error: "daily_limit" });

    let body: { request?: unknown; today?: unknown };
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "bad_json" });
    }
    const text = typeof body.request === "string" ? body.request.trim() : "";
    if (!text) return json(400, { error: "empty_request" });
    if (text.length > MAX_REQUEST_CHARS) return json(400, { error: "request_too_long" });
    const today = typeof body.today === "string" ? body.today.slice(0, 40) : undefined;

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    try {
      const lang =
        typeof (body as { lang?: unknown }).lang === "string"
          ? String((body as { lang: string }).lang).slice(0, 5)
          : undefined;
      const plan = await makePlan(client, { request: text, today, lang });
      return json(200, plan);
    } catch (e) {
      if (e instanceof PlanError) return json(e.status, { error: e.code });
      if (e instanceof Anthropic.RateLimitError) return json(503, { error: "busy" });
      if (e instanceof Anthropic.APIError) {
        console.error("anthropic error", e.status, e.message);
        return json(502, { error: "ai_unavailable" });
      }
      console.error(e);
      return json(500, { error: "internal" });
    }
  },
};

/** Free questionnaire analysis (the funnel into Premium). Rate limited per IP and per device. */
async function onboard(req: Request, env: Env): Promise<Response> {
  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  const user = req.headers.get("x-app-user-id") ?? "none";
  if (!(await underLimit(env.LIMITS, `ip:${ip}`, 5)) || !(await underLimit(env.LIMITS, `u:${user}`, 3))) {
    return json(429, { error: "limit" });
  }
  let body: { profile?: unknown; lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "bad_json" });
  }
  const parsed = ProfileSchema.safeParse(body.profile);
  if (!parsed.success) return json(400, { error: "bad_profile" });
  const lang = typeof body.lang === "string" ? body.lang.slice(0, 5) : "en";
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    return json(200, await makeOnboarding(client, parsed.data, lang));
  } catch (e) {
    if (e instanceof PlanError) return json(e.status, { error: e.code });
    if (e instanceof Anthropic.RateLimitError) return json(503, { error: "busy" });
    if (e instanceof Anthropic.APIError) return json(502, { error: "ai_unavailable" });
    console.error(e);
    return json(500, { error: "internal" });
  }
}

/** Weekly AI coach (Premium). Shares the daily cap with /plan. */
async function coach(req: Request, env: Env): Promise<Response> {
  if (!(await isAllowed(req, env))) return json(402, { error: "subscription_required" });
  const who = req.headers.get("x-app-user-id") ?? req.headers.get("cf-connecting-ip") ?? "unknown";
  if (!(await underLimit(env.LIMITS, `plan:${who}`, 30))) return json(429, { error: "daily_limit" });
  let body: { week?: unknown; lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "bad_json" });
  }
  const week = WeekSchema.safeParse(body.week);
  if (!week.success) return json(400, { error: "bad_week" });
  const lang = typeof body.lang === "string" ? body.lang.slice(0, 5) : "en";
  try {
    return json(200, await makeCoach(new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }), week.data, lang));
  } catch (e) {
    if (e instanceof PlanError) return json(e.status, { error: e.code });
    if (e instanceof Anthropic.RateLimitError) return json(503, { error: "busy" });
    if (e instanceof Anthropic.APIError) return json(502, { error: "ai_unavailable" });
    console.error(e);
    return json(500, { error: "internal" });
  }
}
