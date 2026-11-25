import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { doneKey } from './src/dates';
import { cancelTodaysNags, rescheduleAll, setupNotifications } from './src/scheduler';
import { loadCategories, loadDone, loadTasks, saveCategories, saveDone, saveTasks } from './src/storage';
import { TaskEditor } from './src/TaskEditor';
import { Category, DoneMap, PALETTE, Task } from './src/types';
import { dateKey } from './src/dates';
import { AIPlanner } from './src/AIPlanner';
import { WeekTable } from './src/WeekTable';
import { Row, Status, TodayView } from './src/TodayView';
import { summarize } from './src/stats';
import { YearView } from './src/YearView';


function statusFor(t: Task, done: DoneMap, now: Date): Status {
  if (!t.enabled || !t.days.includes(now.getDay())) return 'none';
  if (done[doneKey(t.id, now)]) return 'done';
  const [h, m] = t.time.split(':').map(Number);
  return now >= new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m) ? 'late' : 'pending';
}

function newTask(categoryId: string): Task {
  return {
    id: String(Date.now()), title: '', categoryId, color: PALETTE[5], icon: 'auto', time: '09:00',
    days: [0, 1, 2, 3, 4, 5, 6], nagEveryMin: 5, nagCount: 6, enabled: true, createdAt: dateKey(new Date()),
  };
}

function Main() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'today' | 'table' | 'year'>('today');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [done, setDone] = useState<DoneMap>({});
  const [ready, setReady] = useState(false);
  const [granted, setGranted] = useState(true);
  const [editing, setEditing] = useState<{ task: Task; isNew: boolean } | null>(null);
  const [now, setNow] = useState(new Date());
  const [planner, setPlanner] = useState(false);
  const latest = useRef({ tasks, done });
  latest.current = { tasks, done };

  const resync = useCallback(async (t: Task[], d: DoneMap) => {
    try { await rescheduleAll(t, d); } catch (e) { console.warn('schedule failed', e); }
  }, []);

  useEffect(() => {
    (async () => {
      setGranted(await setupNotifications());
      const [t, d, c] = await Promise.all([loadTasks(), loadDone(), loadCategories()]);
      setTasks(t); setDone(d); setCategories(c); setReady(true);
      await resync(t, d);
    })();
  }, [resync]);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30_000);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') { setNow(new Date()); resync(latest.current.tasks, latest.current.done); }
    });
    return () => { clearInterval(tick); sub.remove(); };
  }, [resync]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => { setNow(new Date()); setTab('today'); });
    return () => sub.remove();
  }, []);

  const persistTasks = async (next: Task[]) => {
    setTasks(next);
    await saveTasks(next);
    await resync(next, latest.current.done);
  };

  const addCategory = async (name: string, color: string) => {
    const c: Category = { id: 'c' + Date.now(), name, color };
    const next = [...categories, c];
    setCategories(next);
    await saveCategories(next);
    return c;
  };

  const commitDone = async (next: DoneMap, task: Task, date: Date, value: boolean) => {
    setDone(next);
    await saveDone(next);
    if (dateKey(date) === dateKey(new Date())) {
      if (value) await cancelTodaysNags(task.id);
      else await resync(latest.current.tasks, next);
    }
  };

  /** Mark a whole task done / not done for a given day (also ticks every exercise). */
  const setTaskDone = async (t: Task, date: Date, value: boolean) => {
    if (value) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const next = { ...latest.current.done };
    const set = (k: string) => (value ? (next[k] = true) : delete next[k]);
    set(doneKey(t.id, date));
    (t.exercises ?? []).forEach((e) => set(doneKey(`${t.id}#${e.id}`, date)));
    await commitDone(next, t, date, value);
  };

  /** Tick one exercise; when all are ticked the whole task counts as done. */
  const toggleExercise = async (t: Task, exId: string) => {
    const date = new Date();
    const next = { ...latest.current.done };
    const k = doneKey(`${t.id}#${exId}`, date);
    const wasOn = !!next[k];
    if (wasOn) delete next[k]; else next[k] = true;
    const all = (t.exercises ?? []).every((e) => next[doneKey(`${t.id}#${e.id}`, date)]);
    if (all) next[doneKey(t.id, date)] = true; else delete next[doneKey(t.id, date)];
    if (all) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    else Haptics.selectionAsync().catch(() => {});
    await commitDone(next, t, date, all);
  };

  const rows: Row[] = useMemo(
    () => tasks.map((t) => ({ ...t, status: statusFor(t, done, now) })).sort((a, b) => a.time.localeCompare(b.time)),
    [tasks, done, now],
  );
  const streak = useMemo(() => summarize(now.getFullYear(), tasks, done, now).streak, [tasks, done, now]);

  if (!ready) return <View style={s.center}><Text>טוען…</Text></View>;

  return (
    <View style={[s.root, { paddingTop: insets.top + 10 }]}>
      <StatusBar style="dark" />
      {tab === 'today' ? (
        <TodayView
          rows={rows}
          tasks={tasks}
          categories={categories}
          done={done}
          now={now}
          streak={streak}
          granted={granted}
          onDone={(t, v) => setTaskDone(t, now, v)}
          onToggleExercise={toggleExercise}
          onEdit={(t) => setEditing({ task: t, isNew: false })}
          onAdd={() => setEditing({ task: newTask(categories[0]?.id ?? 'health'), isNew: true })}
          onAI={() => setPlanner(true)}
        />
      ) : tab === 'table' ? (
        <WeekTable
          tasks={tasks}
          done={done}
          categories={categories}
          onToggle={(t, d) => setTaskDone(t, d, !done[doneKey(t.id, d)])}
          onEdit={(t) => setEditing({ task: t, isNew: false })}
        />
      ) : (
        <YearView tasks={tasks} done={done} categories={categories} />
      )}

      {tab === 'table' && (
        <Pressable style={[s.fab, { bottom: insets.bottom + 84 }]} onPress={() => setEditing({ task: newTask(categories[0]?.id ?? 'health'), isNew: true })}>
          <Text style={s.fabTxt}>＋ משימה</Text>
        </Pressable>
      )}

      <View style={[s.tabs, { paddingBottom: insets.bottom + 8 }]}>
        <Pressable style={s.tab} onPress={() => setTab('today')}>
          <Text style={[s.tabTxt, tab === 'today' && s.tabOn]}>📋 היום</Text>
        </Pressable>
        <Pressable style={s.tab} onPress={() => setTab('table')}>
          <Text style={[s.tabTxt, tab === 'table' && s.tabOn]}>🗓️ טבלה</Text>
        </Pressable>
        <Pressable style={s.tab} onPress={() => setTab('year')}>
          <Text style={[s.tabTxt, tab === 'year' && s.tabOn]}>📅 שנה</Text>
        </Pressable>
      </View>

      <AIPlanner
        visible={planner}
        categories={categories}
        onClose={() => setPlanner(false)}
        onAdd={async (added, replace) => {
          setPlanner(false);
          if (added.some((t) => t.categoryId === 'other') && !categories.some((c) => c.id === 'other')) {
            const next = [...categories, { id: 'other', name: 'כללי', color: '#64748b' }];
            setCategories(next);
            await saveCategories(next);
          }
          await persistTasks(replace ? added : [...tasks, ...added]);
        }}
      />
      <TaskEditor
        task={editing?.task ?? null}
        isNew={editing?.isNew ?? false}
        categories={categories}
        onAddCategory={addCategory}
        onClose={() => setEditing(null)}
        onSave={async (t) => {
          setEditing(null);
          await persistTasks(tasks.some((x) => x.id === t.id) ? tasks.map((x) => (x.id === t.id ? t : x)) : [...tasks, t]);
        }}
        onDelete={async (id) => { setEditing(null); await persistTasks(tasks.filter((x) => x.id !== id)); }}
      />
    </View>
  );
}

export default function App() {
  return <SafeAreaProvider><Main /></SafeAreaProvider>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f1f5f9', paddingHorizontal: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', alignSelf: 'center', backgroundColor: '#0f172a', paddingHorizontal: 26, paddingVertical: 14, borderRadius: 30, elevation: 6 },
  fabTxt: { color: '#fff', fontSize: 17, fontWeight: '700' },
  tabs: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', backgroundColor: '#fff', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabTxt: { fontSize: 15, color: '#94a3b8', fontWeight: '700' },
  tabOn: { color: '#0f172a' },
});
