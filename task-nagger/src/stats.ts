import { dateKey, doneKey } from './dates';
import { DoneMap, Task } from './types';

export type DayInfo = { date: Date; scheduled: Task[]; doneTasks: Task[] };

/**
 * Does this task count on this day?
 * On the day a task was created it only counts if it was done, or if its time hasn't come yet,
 * so a task added in the evening for 07:00 doesn't show up as "missed" on day one.
 */
export function isScheduled(t: Task, d: Date, done: DoneMap, now: Date = new Date()): boolean {
  const key = dateKey(d);
  if (!t.enabled || !t.days.includes(d.getDay()) || key < t.createdAt) return false;
  if (key > t.createdAt) return true;
  if (done[doneKey(t.id, d)]) return true;
  if (key !== dateKey(now)) return false;
  const [h, m] = t.time.split(':').map(Number);
  return now.getHours() * 60 + now.getMinutes() < h * 60 + m;
}

export function dayInfo(date: Date, tasks: Task[], done: DoneMap): DayInfo {
  const scheduled = tasks.filter((t) => isScheduled(t, date, done));
  const doneTasks = scheduled.filter((t) => done[doneKey(t.id, date)]);
  return { date, scheduled, doneTasks };
}

export function summarize(year: number, tasks: Task[], done: DoneMap, today = new Date()) {
  const todayKey = dateKey(today);
  let perfect = 0;
  let missed = 0;
  let doneTotal = 0;
  let schedTotal = 0;
  for (let d = new Date(year, 0, 1); d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
    if (dateKey(d) > todayKey) break;
    const info = dayInfo(d, tasks, done);
    if (!info.scheduled.length) continue;
    // today still has time left, so only count it once something is done
    if (dateKey(d) === todayKey && !info.doneTasks.length) continue;
    schedTotal += info.scheduled.length;
    doneTotal += info.doneTasks.length;
    if (info.doneTasks.length === info.scheduled.length) perfect++;
    else missed++;
  }
  // streak of perfect days counted backwards from today (empty days are skipped)
  let streak = 0;
  const d = new Date(today);
  for (let i = 0; i < 800; i++) {
    const info = dayInfo(d, tasks, done);
    if (info.scheduled.length) {
      const full = info.doneTasks.length === info.scheduled.length;
      if (full) streak++;
      else if (dateKey(d) !== todayKey) break;
    }
    d.setDate(d.getDate() - 1);
  }
  return { perfect, missed, percent: schedTotal ? Math.round((doneTotal / schedTotal) * 100) : 0, streak };
}
