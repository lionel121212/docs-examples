import { generateJson } from "./llm";
import { z } from "zod";
import { PlanSchema, sanitize } from "./plan";

const LANG_NAMES: Record<string, string> = { he: "Hebrew", en: "English", ar: "Arabic", ru: "Russian", es: "Spanish" };

export const ProfileSchema = z.object({
  life: z.string().max(40),
  wake: z.string().max(5),
  sleep: z.string().max(5),
  busyFrom: z.string().max(5).nullable(),
  busyTo: z.string().max(5).nullable(),
  struggles: z.array(z.string().max(40)).max(10),
  goals: z.array(z.string().max(40)).max(12),
  freeMinutes: z.number().int().min(0).max(600),
});
export type Profile = z.infer<typeof ProfileSchema>;

const OnboardSchema = z.object({
  insight: z.string().describe("2-3 warm, specific sentences about this person's situation and what will help most"),
  recommendations: z.array(z.string()).describe("Exactly 3 short, concrete tips tailored to their struggles"),
  plan: PlanSchema,
});
export type Onboard = z.infer<typeof OnboardSchema>;

const SYSTEM = `You are the onboarding coach of a habit and reminder app.
You get a short questionnaire about a person: what they do, their wake/sleep and busy hours, what they struggle with, what they want to improve, and their free time per day.
Return:
1. insight: 2-3 warm, specific sentences. Speak to them directly. No generic filler.
2. recommendations: exactly 3 short, concrete tips that address their struggles.
3. plan: a realistic weekly routine of recurring tasks that fits their hours and free time and covers their goals.
   - Never schedule during busy hours or after sleep time. Mornings only between wake time and busy start.
   - Respect the free time per day; prefer fewer, consistent tasks over many.
   - Use exercises (sets/reps/minutes) for workouts.
   - Days: 0=Sunday ... 6=Saturday. Times 24h HH:MM. Category ids: health, study, sport, gaming (hobbies), other.
Write every text field in the requested language.`;

export async function makeOnboarding(ai: Ai | undefined, profile: Profile, lang: string): Promise<Onboard> {
  const language = LANG_NAMES[lang] ?? "English";
  const out = await generateJson(
    ai,
    SYSTEM,
    `Language: ${language}\n<questionnaire>\n${JSON.stringify(profile)}\n</questionnaire>`,
    OnboardSchema,
    "onboarding",
  );
  return {
    insight: out.insight.slice(0, 800),
    recommendations: out.recommendations.slice(0, 3).map((r) => r.slice(0, 200)),
    plan: sanitize(out.plan),
  };
}
