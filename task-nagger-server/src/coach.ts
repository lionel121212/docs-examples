import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { PlanError } from "./plan";

const LANG_NAMES: Record<string, string> = { he: "Hebrew", en: "English", ar: "Arabic", ru: "Russian", es: "Spanish" };

export const WeekSchema = z.object({
  done: z.number().int().min(0).max(1000),
  total: z.number().int().min(0).max(1000),
  lastWeekRate: z.number().int().min(0).max(100).nullable(),
  streak: z.number().int().min(0).max(10000),
  tasks: z
    .array(
      z.object({
        title: z.string().max(60),
        time: z.string().max(5),
        done: z.number().int().min(0).max(7),
        total: z.number().int().min(0).max(7),
      }),
    )
    .max(40),
});
export type Week = z.infer<typeof WeekSchema>;

const CoachSchema = z.object({
  headline: z.string().describe("One short, warm sentence about the week"),
  tips: z.array(z.string()).describe("Exactly 3 concrete suggestions, each one sentence, about specific tasks"),
});
export type Coach = z.infer<typeof CoachSchema>;

const SYSTEM = `You are a friendly habit coach inside a reminder app. You get one week of stats: each recurring task with its time and how many of its scheduled days were done.
Give a short headline and exactly 3 concrete, specific tips (name the task, suggest a time change, splitting it, fewer days, or celebrating a win).
Be encouraging and honest. No generic advice. Write in the requested language.`;

export async function makeCoach(client: Anthropic, week: Week, lang: string): Promise<Coach> {
  const response = await client.messages.parse({
    model: "claude-haiku-5-5",
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: "low", format: zodOutputFormat(CoachSchema) },
    messages: [
      { role: "user", content: `Language: ${LANG_NAMES[lang] ?? "English"}\n<week>\n${JSON.stringify(week)}\n</week>` },
    ],
  });
  if (response.stop_reason === "refusal") throw new PlanError(422, "refused");
  const out = response.parsed_output;
  if (!out) throw new PlanError(502, "unparseable");
  return { headline: out.headline.slice(0, 300), tips: out.tips.slice(0, 3).map((t) => t.slice(0, 300)) };
}
