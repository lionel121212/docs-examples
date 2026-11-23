import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { cancelTodaysNags, doneKey, rescheduleAll, setupNotifications } from './src/scheduler';
import { loadDone, loadTasks, saveDone, saveTasks } from './src/storage';
import { TaskEditor } from './src/TaskEditor';
import { DoneMap, Task } from './src/types';

type Row = Task & { todayStatus: 'done' | 'late' | 'pending' | 'none' };

function statusFor(t: Task, done: DoneMap, now: Date): Row['todayStatus'] {
  if (!t.enabled || !t.days.includes(now.getDay())) return 'none';
  if (done[doneKey(t.id, now)]) return 'done';
  const [h, m] = t.time.split(':').map(Number);
  const due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  return now >= due ? 'late' : 'pending';
}

function newTask(): Task {
  return { id: String(Date.now()), title: '', emoji: '✅', time: '09:00', days: [0, 1, 2, 3, 4, 5, 6], nagEveryMin: 5, nagCount: 6, enabled: true };
}

function Main() {
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [done, setDone] = useState<DoneMap>({});
  const [ready, setReady] = useState(false);
  const [granted, setGranted] = useState(true);
  const [editing, setEditing] = useState<{ task: Task; isNew: boolean } | null>(null);
  const [now, setNow] = useState(new Date());
  const latest = useRef({ tasks, done });
  latest.current = { tasks, done };

  const resync = useCallback(async (t: Task[], d: DoneMap) => {
    try {
      await rescheduleAll(t, d);
    } catch (e) {
      console.warn('schedule failed', e);
    }
  }, []);

  // initial load
  useEffect(() => {
    (async () => {
      setGranted(await setupNotifications());
      const [t, d] = await Promise.all([loadTasks(), loadDone()]);
      setTasks(t);
      setDone(d);
      setReady(true);
      await resync(t, d);
    })();
  }, [resync]);

  // clock tick + reschedule whenever the app returns to the foreground
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30_000);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        setNow(new Date());
        resync(latest.current.tasks, latest.current.done);
      }
    });
    return () => {
      clearInterval(tick);
      sub.remove();
    };
  }, [resync]);

  // tapping a notification just opens the app (and refreshes the clock)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => setNow(new Date()));
    return () => sub.remove();
  }, []);

  const persistTasks = async (next: Task[]) => {
    setTasks(next);
    await saveTasks(next);
    await resync(next, latest.current.done);
  };

  const markDone = async (t: Task) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const next = { ...done, [doneKey(t.id)]: true as const };
    setDone(next);
    await saveDone(next);
    await cancelTodaysNags(t.id);
  };

  const undo = async (t: Task) => {
    const next = { ...done };
    delete next[doneKey(t.id)];
    setDone(next);
    await saveDone(next);
    await resync(tasks, next);
  };

  const rows: Row[] = useMemo(
    () =>
      tasks
        .map((t) => ({ ...t, todayStatus: statusFor(t, done, now) }))
        .sort((a, b) => a.time.localeCompare(b.time)),
    [tasks, done, now],
  );
  const today = rows.filter((r) => r.todayStatus !== 'none');
  const others = rows.filter((r) => r.todayStatus === 'none');
  const doneCount = today.filter((r) => r.todayStatus === 'done').length;

  const renderRow = (r: Row) => {
    const late = r.todayStatus === 'late';
    return (
      <Pressable key={r.id} onPress={() => setEditing({ task: r, isNew: false })} style={[s.card, late && s.cardLate, r.todayStatus === 'done' && s.cardDone]}>
        <Text style={s.emoji}>{r.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, r.todayStatus === 'done' && s.strike]}>{r.title}</Text>
          <Text style={s.sub}>
            {r.time}
            {late ? '  •  באיחור! 🔴' : r.todayStatus === 'pending' ? '  •  ממתין' : r.todayStatus === 'none' && !r.enabled ? '  •  כבויה' : ''}
          </Text>
        </View>
        {r.todayStatus === 'done' ? (
          <Pressable onPress={() => undo(r)} style={s.undo}>
            <Text style={s.undoTxt}>✅ בוצע</Text>
          </Pressable>
        ) : r.todayStatus !== 'none' ? (
          <Pressable onPress={() => markDone(r)} style={[s.doneBtn, late && { backgroundColor: '#dc2626' }]}>
            <Text style={s.doneTxt}>בוצע</Text>
          </Pressable>
        ) : null}
      </Pressable>
    );
  };

  if (!ready) return <View style={s.center}><Text>טוען…</Text></View>;

  return (
    <View style={[s.root, { paddingTop: insets.top + 12 }]}>
      <StatusBar style="dark" />
      <Text style={s.h1}>היום</Text>
      <Text style={s.progress}>
        {doneCount} מתוך {today.length} הושלמו
      </Text>
      {!granted && <Text style={s.warn}>⚠️ אין הרשאת התראות. הפעל אותה בהגדרות הטלפון, אחרת התזכורות לא יעבדו.</Text>}
      <FlatList
        data={[{ k: 'today' }, { k: 'others' }]}
        keyExtractor={(i) => i.k}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item }) =>
          item.k === 'today' ? (
            <View>{today.length ? today.map(renderRow) : <Text style={s.empty}>אין משימות להיום 🎉</Text>}</View>
          ) : others.length ? (
            <View>
              <Text style={s.section}>משימות אחרות</Text>
              {others.map(renderRow)}
            </View>
          ) : null
        }
      />
      <Pressable style={[s.fab, { bottom: insets.bottom + 20 }]} onPress={() => setEditing({ task: newTask(), isNew: true })}>
        <Text style={s.fabTxt}>＋ משימה</Text>
      </Pressable>
      <TaskEditor
        task={editing?.task ?? null}
        isNew={editing?.isNew ?? false}
        onClose={() => setEditing(null)}
        onSave={async (t) => {
          setEditing(null);
          await persistTasks(tasks.some((x) => x.id === t.id) ? tasks.map((x) => (x.id === t.id ? t : x)) : [...tasks, t]);
        }}
        onDelete={async (id) => {
          setEditing(null);
          await persistTasks(tasks.filter((x) => x.id !== id));
        }}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f5f7', paddingHorizontal: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 34, fontWeight: '800' },
  progress: { fontSize: 16, color: '#555', marginBottom: 12 },
  warn: { backgroundColor: '#fef3c7', padding: 12, borderRadius: 10, marginBottom: 12 },
  section: { fontSize: 16, color: '#666', marginTop: 20, marginBottom: 8, fontWeight: '600' },
  empty: { textAlign: 'center', fontSize: 18, marginTop: 30 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 14, borderRadius: 14, marginBottom: 10, borderWidth: 2, borderColor: 'transparent' },
  cardLate: { borderColor: '#dc2626', backgroundColor: '#fff5f5' },
  cardDone: { opacity: 0.6 },
  emoji: { fontSize: 30 },
  title: { fontSize: 18, fontWeight: '700' },
  strike: { textDecorationLine: 'line-through' },
  sub: { fontSize: 14, color: '#666', marginTop: 2 },
  doneBtn: { backgroundColor: '#16a34a', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  doneTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  undo: { paddingHorizontal: 10, paddingVertical: 8 },
  undoTxt: { color: '#16a34a', fontWeight: '700' },
  fab: { position: 'absolute', alignSelf: 'center', backgroundColor: '#2563eb', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 30, elevation: 6 },
  fabTxt: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
