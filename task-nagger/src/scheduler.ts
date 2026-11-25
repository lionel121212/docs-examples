import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { dateKey, doneKey } from './dates';
import { Lang, StrKey, translate } from './i18n';
import { DoneMap, Task } from './types';

export const CHANNEL_ID = 'nag-v1';
/** days ahead that we pre-schedule (the app re-schedules every time it opens) */
const WINDOW_DAYS = 7;
/** Android keeps alarms in AlarmManager; stay well under typical OEM limits */
const MAX_SCHEDULED = 400;

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
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  return status === 'granted';
}

function lineFor(lang: Lang, title: string, step: number): string {
  return translate(lang, `nag${Math.min(step, 6)}` as StrKey, { t: title });
}

type Planned = { id: string; at: Date; title: string; body: string; taskId: string };

export function planNotifications(tasks: Task[], done: DoneMap, lang: Lang, now: Date = new Date()): Planned[] {
  const planned: Planned[] = [];
  for (const task of tasks) {
    if (!task.enabled) continue;
    const [h, m] = task.time.split(':').map(Number);
    for (let i = 0; i < WINDOW_DAYS; i++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, h, m, 0, 0);
      if (!task.days.includes(day.getDay())) continue;
      if (done[doneKey(task.id, day)]) continue;
      for (let step = 0; step <= task.nagCount; step++) {
        const at = new Date(day.getTime() + step * task.nagEveryMin * 60_000);
        if (at.getTime() <= now.getTime() + 2_000) continue;
        planned.push({
          id: `${task.id}|${dateKey(day)}|${step}`,
          at,
          taskId: task.id,
          title: task.title,
          body: lineFor(lang, task.title, step),
        });
      }
    }
  }
  planned.sort((a, b) => a.at.getTime() - b.at.getTime());
  return planned.slice(0, MAX_SCHEDULED);
}

/** Cancels everything and re-schedules from scratch based on current tasks + what's done. */
export async function rescheduleAll(tasks: Task[], done: DoneMap, lang: Lang): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const planned = planNotifications(tasks, done, lang);
  for (const p of planned) {
    await Notifications.scheduleNotificationAsync({
      identifier: p.id,
      content: {
        title: p.title,
        body: p.body,
        sound: 'default',
        vibrate: [0, 800, 300, 800, 300, 1200],
        priority: 'max',
        color: '#FF3B30',
        data: { taskId: p.taskId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: p.at,
        channelId: CHANNEL_ID,
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
    all
      .filter((n) => n.identifier.startsWith(prefix))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  // also clear any already-delivered notification still sitting in the tray
  const shown = await Notifications.getPresentedNotificationsAsync();
  await Promise.all(
    shown
      .filter((n) => n.request.content.data?.taskId === taskId)
      .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
  );
}
