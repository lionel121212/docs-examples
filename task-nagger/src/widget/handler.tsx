import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { dateKey, doneKey } from '../dates';
import { LANGS, loadLang, translate, type Lang } from '../i18n';
import { cancelTodaysNags } from '../scheduler';
import { loadDone, loadTasks, saveDone } from '../storage';
import { isScheduled } from '../stats';
import { DoneMap, Task } from '../types';
import { NextTaskWidget, WidgetData } from './NextTaskWidget';

export const WIDGET_NAME = 'NextTask';

/** What the widget shows: the most overdue open task of today, otherwise the next one. */
export function widgetData(tasks: Task[], done: DoneMap, lang: Lang, now = new Date()): WidgetData {
  const today = tasks.filter((t) => isScheduled(t, now, done, now));
  const open = today.filter((t) => !done[doneKey(t.id, now)]).sort((a, b) => a.time.localeCompare(b.time));
  const mins = now.getHours() * 60 + now.getMinutes();
  const late = (t: Task) => {
    const [h, m] = t.time.split(':').map(Number);
    return h * 60 + m <= mins;
  };
  const focus = open.find(late) ?? open[0] ?? null;
  return {
    label: translate(lang, 'widget_next'),
    title: focus?.title ?? null,
    time: focus?.time ?? '',
    color: focus?.color ?? '#4f46e5',
    late: !!focus && late(focus),
    progress: `${today.length - open.length}/${today.length}`,
    doneLabel: translate(lang, 'notif_done').replace(/^✓\s*/, ''),
    emptyLabel: translate(lang, 'widget_none'),
    taskId: focus?.id ?? null,
    rtl: !!LANGS.find((l) => l.code === lang)?.rtl,
  };
}

async function render(): Promise<React.JSX.Element> {
  const [tasks, done, lang] = await Promise.all([loadTasks(), loadDone(), loadLang()]);
  return <NextTaskWidget {...widgetData(tasks ?? [], done, lang ?? 'he')} />;
}

export { render as renderNextTaskWidget };

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetAction === 'WIDGET_DELETED') return;
  if (props.widgetAction === 'WIDGET_CLICK' && props.clickAction === 'DONE') {
    const taskId = String(props.clickActionData?.taskId ?? '');
    const [tasks, done] = await Promise.all([loadTasks(), loadDone()]);
    const task = (tasks ?? []).find((t) => t.id === taskId);
    if (task) {
      const now = new Date();
      const next = { ...done, [doneKey(task.id, now)]: true as const };
      (task.exercises ?? []).forEach((e) => (next[doneKey(`${task.id}#${e.id}`, now)] = true));
      await saveDone(next);
      await cancelTodaysNags(task.id).catch(() => {});
    }
    void dateKey;
  }
  props.renderWidget(await render());
}
