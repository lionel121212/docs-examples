import { dateKey, doneKey } from './dates';
import { DoneMap, Task } from './types';

export type DayInfo = { date: Date; scheduled: Task[]; doneTasks: Task[] };

export function dayInfo(date: Date, tasks: Task[], done: DoneMap): DayInfo {
  const key = dateKey(date);
  const scheduled = tasks.filter((t) => t.enabled && t.days.includes(date.getDay()) && t.createdAt <= key);
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
