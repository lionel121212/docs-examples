import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { dateKey, doneKey } from './dates';
import { Lang, StrKey, translate } from './i18n';
import { DEFAULT_PREFS, Prefs, SnoozeMap } from './prefs';
import { DoneMap, Task } from './types';

export const CHANNEL_ID = 'nag-v1';
export const ALARM_CHANNEL_ID = 'alarm-v1';
export const TASK_CATEGORY = 'task';
/** days ahead that we pre-schedule (the app re-schedules every time it opens) */
const WINDOW_DAYS = 7;
/** Android keeps alarms in AlarmManager; stay well under typical OEM limits */
const MAX_SCHEDULED = 400;
/** "come back" reminder if the app isn't opened for this long (the schedule only covers WINDOW_DAYS) */
const COMEBACK_AFTER_DAYS = 5;

export { dateKey, doneKey };

export async function setupNotifications(lang: Lang): Promise<boolean> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: translate(lang, 'notif_channel'),
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 800, 300, 800, 300, 1200],
      enableVibrate: true,
      lightColor: '#FF3B30',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
    });
    // alarm mode: plays at alarm volume and gets through Do Not Disturb
    await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
      name: translate(lang, 'alarm_mode'),
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 1500, 500, 1500, 500, 1500],
      enableVibrate: true,
      lightColor: '#FF0000',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      sound: 'default',
      audioAttributes: { usage: Notifications.AndroidAudioUsage.ALARM },
    });
  }
  // "✓ Done" / "⏰ 10 min" buttons on every task notification
  await Notifications.setNotificationCategoryAsync(TASK_CATEGORY, [
    { identifier: 'done', buttonTitle: translate(lang, 'notif_done'), options: { opensAppToForeground: true } },
    { identifier: 'snooze', buttonTitle: translate(lang, 'notif_snooze'), options: { opensAppToForeground: true } },
  ]).catch(() => {});

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  return status === 'granted';
}

function lineFor(lang: Lang, title: string, step: number): string {
  return translate(lang, `nag${Math.min(step, 6)}` as StrKey, { t: title });
}

type Planned = { id: string; at: Date; title: string; body: string; taskId: string; alarm?: boolean; category?: string };

export type PlanOptions = {
  prefs?: Prefs;
  snooze?: SnoozeMap;
};

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Quiet hours window (may wrap midnight). */
function inQuiet(d: Date, prefs: Prefs): boolean {
  if (!prefs.quiet.enabled) return false;
  const m = d.getHours() * 60 + d.getMinutes();
  const from = minutesOf(prefs.quiet.from);
  const to = minutesOf(prefs.quiet.to);
  return from <= to ? m >= from && m < to : m >= from || m < to;
}

/** Friday 18:00 until Saturday 20:00. */
function inShabbat(d: Date, prefs: Prefs): boolean {
  if (!prefs.shabbat) return false;
  const m = d.getHours() * 60 + d.getMinutes();
  return (d.getDay() === 5 && m >= 18 * 60) || (d.getDay() === 6 && m < 20 * 60);
}

export function planNotifications(tasks: Task[], done: DoneMap, lang: Lang, now: Date = new Date(), opts: PlanOptions = {}): Planned[] {
  const prefs = opts.prefs ?? DEFAULT_PREFS;
  const snooze = opts.snooze ?? {};
  const planned: Planned[] = [];
  for (const task of tasks) {
    if (!task.enabled) continue;
    const [h, m] = task.time.split(':').map(Number);
    for (let i = 0; i < WINDOW_DAYS; i++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, h, m, 0, 0);
      if (!task.days.includes(day.getDay())) continue;
      if (done[doneKey(task.id, day)]) continue;
      const snoozedUntil = snooze[`${task.id}|${dateKey(day)}`] ?? 0;
      const steps: { step: number; at: Date }[] = [];
      for (let step = 0; step <= task.nagCount; step++) {
        steps.push({ step, at: new Date(day.getTime() + step * task.nagEveryMin * 60_000) });
      }
      // snoozed: nothing until the snooze ends, then one reminder and the remaining nags after it
      if (snoozedUntil > now.getTime()) {
        const after = steps.filter((x) => x.at.getTime() > snoozedUntil);
        steps.splice(0, steps.length, { step: 1, at: new Date(snoozedUntil) }, ...after);
      }
      for (const { step, at } of steps) {
        if (at.getTime() <= now.getTime() + 2_000) continue;
        if (inShabbat(at, prefs)) continue;
        if (step > 0 && inQuiet(at, prefs)) continue; // quiet hours: the first reminder still comes, the nagging doesn't
        planned.push({
          id: `${task.id}|${dateKey(day)}|${step}`,
          at,
          taskId: task.id,
          title: task.title,
          body: lineFor(lang, task.title, step),
          alarm: !!task.alarm,
          category: TASK_CATEGORY,
        });
      }
    }
  }
  planned.sort((a, b) => a.at.getTime() - b.at.getTime());
  const out = planned.slice(0, MAX_SCHEDULED - 2);

  // weekly summary: next Friday 12:00
  const fri = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((5 - now.getDay() + 7) % 7), 12, 0, 0, 0);
  if (fri.getTime() <= now.getTime()) fri.setDate(fri.getDate() + 7);
  if (tasks.length && !inShabbat(fri, prefs)) {
    out.push({
      id: `weekly|${dateKey(fri)}|0`,
      at: fri,
      taskId: '',
      title: translate(lang, 'weekly_title'),
      body: translate(lang, 'weekly_body'),
    });
  }
  // come back: the schedule only reaches WINDOW_DAYS ahead
  const back = new Date(now.getFullYear(), now.getMonth(), now.getDate() + COMEBACK_AFTER_DAYS, 18, 30, 0, 0);
  if (tasks.length) {
    out.push({
      id: `comeback|${dateKey(back)}|0`,
      at: back,
      taskId: '',
      title: translate(lang, 'comeback_title'),
      body: translate(lang, 'comeback_body'),
    });
  }
  return out;
}

/** Short stable hash, so a change in title/time/language produces a new notification id. */
function hash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const OUR_ID = /^[^|]+\|\d{4}-\d{2}-\d{2}\|\d+\|/;
let queue: Promise<unknown> = Promise.resolve();

/**
 * Brings the scheduled notifications in line with the plan: cancels what is no longer wanted
 * and schedules only what is missing. Calls are serialized so overlapping syncs can't duplicate.
 */
export function rescheduleAll(tasks: Task[], done: DoneMap, lang: Lang, opts: PlanOptions = {}): Promise<number> {
  const run = queue.then(() => syncNow(tasks, done, lang, opts));
  queue = run.catch(() => {});
  return run;
}

async function syncNow(tasks: Task[], done: DoneMap, lang: Lang, opts: PlanOptions): Promise<number> {
  const planned = planNotifications(tasks, done, lang, new Date(), opts).map((p) => ({
    ...p,
    id: `${p.id}|${hash(p.title + p.body + p.at.getTime() + (p.alarm ? 'A' : ''))}`,
  }));
  const wanted = new Set(planned.map((p) => p.id));
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const have = new Set<string>();
  for (const n of existing) {
    if (wanted.has(n.identifier)) have.add(n.identifier);
    else if (OUR_ID.test(n.identifier) || !n.identifier.includes('|')) await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
  for (const p of planned) {
    if (have.has(p.id)) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: p.id,
      content: {
        title: p.title,
        body: p.body,
        sound: 'default',
        vibrate: [0, 800, 300, 800, 300, 1200],
        priority: 'max',
        color: '#FF3B30',
        data: { taskId: p.taskId, kind: p.taskId ? 'task' : p.id.split('|')[0] },
        ...(p.category ? { categoryIdentifier: p.category } : {}),
        ...(p.alarm ? { sticky: true } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: p.at,
        channelId: p.alarm ? ALARM_CHANNEL_ID : CHANNEL_ID,
      },
    });
  }
  return planned.length;
}

/** Stops today's remaining nags for a task (called when the user marks it done). */
export async function cancelTodaysNags(taskId: string): Promise<void> {
  const prefix = `${taskId}|${dateKey(new Date())}|`;
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all.filter((n) => n.identifier.startsWith(prefix)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  // also clear any already-delivered notification still sitting in the tray
  const shown = await Notifications.getPresentedNotificationsAsync();
  await Promise.all(
    shown.filter((n) => n.request.content.data?.taskId === taskId).map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
  );
}
