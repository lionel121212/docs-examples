/**
 * Who may use the AI planner.
 * - Subscribers: checked with RevenueCat (set REVENUECAT_SECRET once store billing is connected).
 * - Testers: a code from ACCESS_CODES (comma separated), so the planner can be tried before the stores exist.
 */
export type Env = {
  ANTHROPIC_API_KEY: string;
  REVENUECAT_SECRET?: string;
  ENTITLEMENT_ID?: string; // defaults to "premium"
  ACCESS_CODES?: string;
  /** optional KV namespace for rate limits on the free onboarding analysis */
  LIMITS?: KVNamespace;
};

export async function isAllowed(req: Request, env: Env): Promise<boolean> {
  const code = req.headers.get("x-access-code")?.trim();
  if (code && env.ACCESS_CODES) {
    const codes = env.ACCESS_CODES.split(",").map((c) => c.trim()).filter(Boolean);
    if (codes.includes(code)) return true;
  }

  const userId = req.headers.get("x-app-user-id")?.trim();
  if (!userId || !env.REVENUECAT_SECRET) return false;
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${env.REVENUECAT_SECRET}` },
  });
  if (!res.ok) return false;
  const body = (await res.json()) as {
    subscriber?: { entitlements?: Record<string, { expires_date: string | null }> };
  };
  const ent = body.subscriber?.entitlements?.[env.ENTITLEMENT_ID || "premium"];
  if (!ent) return false;
  return ent.expires_date === null || Date.parse(ent.expires_date) > Date.now();
}
