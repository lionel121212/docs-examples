/** Tiny per-key daily counter on Workers KV. Without a LIMITS binding it allows everything. */
export async function underLimit(kv: KVNamespace | undefined, key: string, max: number): Promise<boolean> {
  if (!kv) return true;
  const day = new Date().toISOString().slice(0, 10);
  const k = `${key}:${day}`;
  const n = Number((await kv.get(k)) ?? "0");
  if (n >= max) return false;
  await kv.put(k, String(n + 1), { expirationTtl: 60 * 60 * 26 });
  return true;
}
