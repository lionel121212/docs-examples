/**
 * Free AI through Cloudflare Workers AI (the `AI` binding, see wrangler.toml).
 * Gemma 4 (multilingual, incl. Hebrew/Arabic/Russian/Spanish) with JSON-schema output;
 * the answer is still validated with zod before anything uses it.
 */
import { z } from "zod";

export const MODEL = "@cf/google/gemma-4-26b-a4b-it";

export class AiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new AiError(502, "unparseable");
  }
}

export async function generateJson<T extends z.ZodType>(
  ai: Ai | undefined,
  system: string,
  user: string,
  schema: T,
  name: string,
): Promise<z.infer<T>> {
  if (!ai) throw new AiError(503, "ai_unavailable");
  let out: unknown;
  try {
    out = await ai.run(MODEL, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name, schema: z.toJSONSchema(schema) as Record<string, unknown>, strict: true },
      },
      max_tokens: 4096,
      temperature: 0.4,
    });
  } catch (e) {
    // e.g. the free daily allocation is used up
    console.error("workers ai error", e);
    throw new AiError(503, "busy");
  }
  const o = out as { choices?: { message?: { content?: unknown } }[]; response?: unknown };
  const content = o.choices?.[0]?.message?.content ?? o.response;
  const value = typeof content === "string" ? extractJson(content) : content;
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AiError(502, "unparseable");
  return parsed.data;
}
