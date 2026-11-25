import { dateKey } from './dates';
import { Lang, StrKey, translate } from './i18n';
import { authHeaders } from './account';
import { PLANNER_URL } from './server';
import { Task } from './types';

export { PLANNER_URL };

export type Life = 'school' | 'uni' | 'work' | 'army' | 'parent' | 'other';
export type Struggle = 'procrast' | 'forget' | 'motivation' | 'time' | 'sleep' | 'phone' | 'focus';
export type Goal = 'fitness' | 'study' | 'sleep' | 'health' | 'food' | 'projects' | 'reading' | 'mind' | 'hobby';
export type Nag = 'soft' | 'norm' | 'hard';

export type Profile = {
  life: Life;
  wake: string;
  sleep: string;
  busyFrom: string | null;
  busyTo: string | null;
  struggles: Struggle[];
  goals: Goal[];
  freeMinutes: number;
  nag: Nag;
};

export type PlannedTask = { title: string; category: string; time: string; days: number[]; exercises: { name: string; detail: string }[] };
export type Analysis = { insight: string; recommendations: string[]; plan: PlannedTask[]; fromAI: boolean };

export const NAG_SETTINGS: Record<Nag, { nagEveryMin: number; nagCount: number }> = {
  soft: { nagEveryMin: 10, nagCount: 2 },
  norm: { nagEveryMin: 5, nagCount: 6 },
  hard: { nagEveryMin: 2, nagCount: 15 },
};

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const toHHMM = (min: number) => {
  const m = (((Math.round(min / 5) * 5) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

const ALL = [0, 1, 2, 3, 4, 5, 6];

/** Rule-based analysis: works offline and is what the free plan is built from. */
export function localAnalysis(p: Profile, lang: Lang): Analysis {
  const t = (k: StrKey, v?: Record<string, string | number>) => translate(lang, k, v);
  const goalNames = p.goals.slice(0, 3).map((g) => t(`g_${g}` as StrKey).toLowerCase());
  const insight = [t(`ins_life_${p.life}` as StrKey), goalNames.length ? t('ins_goals', { goals: goalNames.join(', ') }) : '']
    .filter(Boolean)
    .join(' ');
  const recs = p.struggles.slice(0, 3).map((s) => t(`rec_${s}` as StrKey));
  while (recs.length < 3) {
    const extra = (['rec_default', 'rec_motivation', 'rec_time'] as StrKey[]).map((k) => t(k)).find((r) => !recs.includes(r));
    if (!extra) break;
    recs.push(extra);
  }
  return { insight, recommendations: recs, plan: localPlan(p, lang), fromAI: false };
}

/** A small starter routine from the goals, placed around wake, busy and sleep hours. */
export function localPlan(p: Profile, lang: Lang): PlannedTask[] {
  const t = (k: StrKey) => translate(lang, k);
  const wake = toMin(p.wake);
  const sleep = toMin(p.sleep) < wake ? toMin(p.sleep) + 1440 : toMin(p.sleep);
  const afternoon = p.busyTo ? toMin(p.busyTo) + 30 : wake + 120;
  const weekdays = p.life === 'school' || p.life === 'uni' ? [0, 1, 2, 3, 4] : ALL;
  const out: PlannedTask[] = [];
  const add = (key: StrKey, category: string, at: number, days: number[], exercises: PlannedTask['exercises'] = []) =>
    out.push({ title: t(key), category, time: toHHMM(at), days, exercises });

  if (p.goals.includes('food')) add('tk_food', 'health', wake + 15, ALL);
  if (p.goals.includes('health')) add('tk_health', 'health', wake + 5, ALL);

  // afternoon blocks share the free time
  const blocks = (['study', 'fitness', 'projects', 'hobby'] as Goal[]).filter((g) => p.goals.includes(g));
  const blockLen = Math.max(30, Math.min(90, Math.floor(p.freeMinutes / Math.max(1, blocks.length))));
  let cursor = afternoon;
  for (const g of blocks) {
    if (g === 'study') add('tk_study', 'study', cursor, weekdays);
    if (g === 'fitness')
      add(
        'tk_fitness',
        'sport',
        cursor,
        [0, 2, 4],
        [
          { name: t('ex_pushups'), detail: '3×15' },
          { name: t('ex_situps'), detail: '3×20' },
          { name: t('ex_plank'), detail: t('ex_minute') },
        ],
      );
    if (g === 'projects') add('tk_projects', 'study', cursor, [0, 1, 3, 5]);
    if (g === 'hobby') add('tk_hobby', 'gaming', cursor, [1, 3, 5]);
    cursor += blockLen + 15;
  }

  if (p.goals.includes('reading')) add('tk_reading', 'study', sleep - 60, ALL);
  if (p.goals.includes('mind')) add('tk_mind', 'health', sleep - 45, ALL);
  if (p.goals.includes('sleep') || p.struggles.includes('sleep')) add('tk_sleep', 'health', sleep - 30, ALL);
  if (!out.length) add('tk_health', 'health', wake + 5, ALL);
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

/** AI analysis from the server; falls back to the local one on any problem. */
export async function analyze(p: Profile, lang: Lang): Promise<Analysis> {
  const local = localAnalysis(p, lang);
  if (!PLANNER_URL) return local;
  try {
    const { nag: _nag, ...profile } = p;
    const res = await fetch(`${PLANNER_URL}/onboard`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ profile, lang }),
    });
    if (!res.ok) return local;
    const j = (await res.json()) as { insight: string; recommendations: string[]; plan: { tasks: PlannedTask[] } };
    if (!j.plan?.tasks?.length) return local;
    return { insight: j.insight, recommendations: j.recommendations, plan: j.plan.tasks, fromAI: true };
  } catch {
    return local;
  }
}

/** Checks a tester code / subscription with the server. */
export async function checkPremium(code: string): Promise<boolean> {
  if (!PLANNER_URL) return false;
  try {
    const res = await fetch(`${PLANNER_URL}/me`, {
      headers: { ...(await authHeaders()), ...(code ? { 'x-access-code': code } : {}) },
    });
    return res.ok && ((await res.json()) as { premium: boolean }).premium === true;
  } catch {
    return false;
  }
}

export function toTasks(plan: PlannedTask[], nag: Nag, colorFor: (category: string, i: number) => string): Task[] {
  const createdAt = dateKey(new Date());
  const stamp = Date.now();
  return plan.map((pt, i) => ({
    id: `t${stamp}${i}`,
    title: pt.title,
    categoryId: pt.category,
    color: colorFor(pt.category, i),
    icon: 'auto' as const,
    time: pt.time,
    days: pt.days,
    ...NAG_SETTINGS[nag],
    enabled: true,
    createdAt,
    exercises: pt.exercises.map((e, j) => ({ id: `e${stamp}${i}${j}`, name: e.name, detail: e.detail })),
  }));
}
