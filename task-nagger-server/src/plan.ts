import { AiError, generateJson } from "./llm";
import { z } from "zod";

export const CATEGORY_IDS = ["health", "study", "sport", "gaming", "other"] as const;

const PlannedTask = z.object({
  title: z.string().describe("Short task name in the user's language, e.g. 'אימון כושר'"),
  category: z.enum(CATEGORY_IDS),
  time: z.string().describe("Start time, 24h HH:MM"),
  days: z.array(z.number().int()).describe("Days of week, 0=Sunday ... 6=Saturday"),
  exercises: z
    .array(z.object({ name: z.string(), detail: z.string() }))
    .describe("Optional checklist inside the task (sets, reps, minutes). Empty if not relevant."),
});

export const PlanSchema = z.object({
  summary: z.string().describe("1-2 friendly sentences explaining the plan, in the user's language"),
  tasks: z.array(PlannedTask),
});
export type Plan = z.infer<typeof PlanSchema>;

const SYSTEM = `You plan daily routines for a reminder app. The user describes, in their own words (usually Hebrew), how they want to organise their days.
Turn it into a concrete list of recurring tasks with a start time and the weekdays each one happens.

Rules:
- Respect fixed commitments the user mentions (school, work, sleep). Never schedule tasks during them.
- Spread tasks realistically, leave breaks, avoid two tasks at the same time on the same day.
- "N times a week" means exactly N days, spread out (not consecutive when possible).
- Use exercises only for tasks that naturally have sub-steps (workouts, routines); keep the given numbers exactly.
- Write titles, details and the summary in the same language the user wrote in.
- Days: 0=Sunday, 1=Monday ... 6=Saturday. Times: 24h HH:MM.
- Keep it to what the user asked for; at most 15 tasks.`;

export type PlanRequest = { request: string; today?: string; lang?: string };

/** Ask the model for a structured plan. */
export async function makePlan(ai: Ai | undefined, req: PlanRequest): Promise<Plan> {
  const user = `${req.today ? `Today is ${req.today}.\n` : ""}${req.lang ? `App language: ${req.lang}\n` : ""}<request>\n${req.request}\n</request>`;
  return sanitize(await generateJson(ai, SYSTEM, user, PlanSchema, "plan"));
}

/** Clean up anything the schema can't express (time format, day range, limits). */
export function sanitize(plan: Plan): Plan {
  const tasks = plan.tasks
    .map((t) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(t.time.trim());
      if (!m) return null;
      const h = Number(m[1]);
      const min = Number(m[2]);
      if (h > 23 || min > 59) return null;
      const days = [...new Set(t.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
      if (!days.length || !t.title.trim()) return null;
      return {
        ...t,
        title: t.title.trim().slice(0, 60),
        time: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
        days,
        exercises: t.exercises.filter((e) => e.name.trim()).slice(0, 12),
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null)
    .slice(0, 15);
  return { summary: plan.summary.slice(0, 500), tasks };
}
