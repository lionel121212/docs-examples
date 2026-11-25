import Anthropic from "@anthropic-ai/sdk";
import { Env, isAllowed } from "./entitlement";
import { makePlan, PlanError } from "./plan";

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
    if (req.method !== "POST" || url.pathname !== "/plan") return json(404, { error: "not_found" });

    if (!(await isAllowed(req, env))) return json(402, { error: "subscription_required" });

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
      const plan = await makePlan(client, { request: text, today });
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
