import AsyncStorage from '@react-native-async-storage/async-storage';
import { dateKey } from './dates';
import { dayInfo } from './stats';
import { DoneMap, Task } from './types';

export type Achievement = { id: string; kind: 'streak' | 'done' | 'perfect_week'; n: number; emoji: string; progress: number };

const STREAKS = [3, 7, 14, 30, 100];
const DONE = [10, 50, 100, 500];

/** Walks the history once: best streak of perfect days, tasks done, perfect weeks. */
export function history(tasks: Task[], done: DoneMap, today = new Date()) {
  const ids = new Set(tasks.map((t) => t.id));
  const doneCount = Object.keys(done).filter((k) => {
    const id = k.split('|')[0];
    return !id.includes('#') && ids.has(id);
  }).length;
  const start = tasks.reduce((min, t) => (t.createdAt < min ? t.createdAt : min), dateKey(today));
  const [y, m, d] = start.split('-').map(Number);
  let best = 0;
  let run = 0;
  let perfectWeeks = 0;
  let weekOk = true;
  let weekHad = false;
  const todayKey = dateKey(today);
  for (let day = new Date(y, m - 1, d); dateKey(day) <= todayKey; day.setDate(day.getDate() + 1)) {
    const info = dayInfo(day, tasks, done);
    const isToday = dateKey(day) === todayKey;
    if (info.scheduled.length) {
      const full = info.doneTasks.length === info.scheduled.length;
      if (full) best = Math.max(best, ++run);
      else if (!isToday) run = 0;
      weekHad = true;
      if (!full && !isToday) weekOk = false;
    }
    if (day.getDay() === 6) {
      if (weekHad && weekOk && !isToday) perfectWeeks++;
      weekOk = true;
      weekHad = false;
    }
  }
  return { bestStreak: best, doneCount, perfectWeeks };
}

export function achievements(tasks: Task[], done: DoneMap, today = new Date()): (Achievement & { earned: boolean })[] {
  const h = history(tasks, done, today);
  return [
    ...STREAKS.map((n) => ({
      id: `streak${n}`,
      kind: 'streak' as const,
      n,
      emoji: n >= 30 ? '🏆' : '🔥',
      progress: Math.min(h.bestStreak, n),
      earned: h.bestStreak >= n,
    })),
    ...DONE.map((n) => ({
      id: `done${n}`,
      kind: 'done' as const,
      n,
      emoji: n >= 100 ? '💎' : '✅',
      progress: Math.min(h.doneCount, n),
      earned: h.doneCount >= n,
    })),
    {
      id: 'perfectweek',
      kind: 'perfect_week' as const,
      n: 1,
      emoji: '🌟',
      progress: Math.min(h.perfectWeeks, 1),
      earned: h.perfectWeeks >= 1,
    },
  ];
}

export async function loadEarned(): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem('achievements');
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

export const saveEarned = (ids: string[]) => AsyncStorage.setItem('achievements', JSON.stringify(ids)).catch(() => {});

/** Stats for one week (Sunday..Saturday) containing `anyDay`. */
export function weekStats(tasks: Task[], done: DoneMap, anyDay: Date, today = new Date()) {
  const start = new Date(anyDay.getFullYear(), anyDay.getMonth(), anyDay.getDate() - anyDay.getDay());
  const perTask = new Map<string, { task: Task; done: number; total: number }>();
  let doneN = 0;
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (dateKey(d) > dateKey(today)) break;
    const info = dayInfo(d, tasks, done);
    for (const t of info.scheduled) {
      const ok = info.doneTasks.includes(t);
      const e = perTask.get(t.id) ?? { task: t, done: 0, total: 0 };
      e.total++;
      if (ok) e.done++;
      perTask.set(t.id, e);
      total++;
      if (ok) doneN++;
    }
  }
  const list = [...perTask.values()].filter((e) => e.total > 0);
  list.sort((a, b) => b.done / b.total - a.done / a.total || b.total - a.total);
  return {
    done: doneN,
    total,
    missed: total - doneN,
    rate: total ? Math.round((doneN / total) * 100) : 0,
    best: list[0] ?? null,
    worst: list.length > 1 ? list[list.length - 1] : null,
    perTask: list,
  };
}
