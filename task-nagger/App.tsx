import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { doneKey } from './src/dates';
import { cancelTodaysNags, rescheduleAll, setupNotifications } from './src/scheduler';
import { loadCategories, loadDone, loadTasks, saveCategories, saveDone, saveTasks } from './src/storage';
import { TaskEditor } from './src/TaskEditor';
import { TaskIcon } from './src/TaskIcon';
import { Category, DoneMap, PALETTE, Task } from './src/types';
import { dateKey } from './src/dates';
import { YearView } from './src/YearView';

type Status = 'done' | 'late' | 'pending' | 'none';
type Row = Task & { status: Status };

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

function greeting(d: Date) {
  const h = d.getHours();
  return h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 18 ? 'צהריים טובים' : h < 22 ? 'ערב טוב' : 'לילה טוב';
}

function Main() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'today' | 'year'>('today');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [done, setDone] = useState<DoneMap>({});
  const [ready, setReady] = useState(false);
  const [granted, setGranted] = useState(true);
  const [editing, setEditing] = useState<{ task: Task; isNew: boolean } | null>(null);
  const [now, setNow] = useState(new Date());
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
    () => tasks.map((t) => ({ ...t, status: statusFor(t, done, now) })).sort((a, b) => a.time.localeCompare(b.time)),
    [tasks, done, now],
  );
  const today = rows.filter((r) => r.status !== 'none');
  const others = rows.filter((r) => r.status === 'none');
  const doneCount = today.filter((r) => r.status === 'done').length;
  const pct = today.length ? doneCount / today.length : 0;

  const card = (r: Row) => {
    const late = r.status === 'late';
    return (
      <Pressable key={r.id} onPress={() => setEditing({ task: r, isNew: false })}
        style={[s.card, { borderLeftColor: r.color }, late && s.cardLate, r.status === 'done' && { opacity: 0.55 }]}>
        <TaskIcon task={r} size={58} />
        <View style={{ flex: 1 }}>
          <Text style={[s.title, r.status === 'done' && { textDecorationLine: 'line-through' }]}>{r.title}</Text>
          <Text style={[s.sub, late && { color: '#dc2626', fontWeight: '700' }]}>
            {r.time}{late ? '  •  באיחור!' : r.status === 'pending' ? '  •  ממתין' : !r.enabled ? '  •  כבויה' : ''}
          </Text>
        </View>
        {r.status === 'done' ? (
          <Pressable onPress={() => undo(r)} style={s.undo}><Text style={s.undoTxt}>✅</Text></Pressable>
        ) : r.status !== 'none' ? (
          <Pressable onPress={() => markDone(r)} style={[s.doneBtn, { backgroundColor: late ? '#dc2626' : r.color }]}>
            <Text style={s.doneTxt}>בוצע</Text>
          </Pressable>
        ) : null}
      </Pressable>
    );
  };

  const section = (list: Row[]) =>
    categories
      .map((c) => ({ c, items: list.filter((r) => r.categoryId === c.id) }))
      .filter((g) => g.items.length)
      .map((g) => (
        <View key={g.c.id} style={{ marginBottom: 6 }}>
          <View style={s.secHead}>
            <View style={[s.dot, { backgroundColor: g.c.color }]} />
            <Text style={s.secTxt}>{g.c.name}</Text>
            <Text style={s.secCount}>{g.items.filter((i) => i.status === 'done').length}/{g.items.length}</Text>
          </View>
          {g.items.map(card)}
        </View>
      ));

  if (!ready) return <View style={s.center}><Text>טוען…</Text></View>;

  return (
    <View style={[s.root, { paddingTop: insets.top + 10 }]}>
      <StatusBar style="dark" />
      {tab === 'today' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 170 }} showsVerticalScrollIndicator={false}>
          <Text style={s.hi}>{greeting(now)} 👋</Text>
          <Text style={s.h1}>{now.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          <View style={s.bar}><View style={[s.barFill, { width: `${pct * 100}%` }]} /></View>
          <Text style={s.progress}>{doneCount} מתוך {today.length} הושלמו{pct === 1 && today.length ? ' 🎉' : ''}</Text>
          {!granted && <Text style={s.warn}>⚠️ אין הרשאת התראות. הפעל אותה בהגדרות הטלפון, אחרת התזכורות לא יעבדו.</Text>}
          {today.length ? section(today) : <Text style={s.empty}>אין משימות להיום 🎉</Text>}
          {others.length > 0 && (
            <View style={{ marginTop: 14 }}>
              <Text style={s.others}>לא להיום</Text>
              {section(others)}
            </View>
          )}
        </ScrollView>
      ) : (
        <YearView tasks={tasks} done={done} categories={categories} />
      )}

      {tab === 'today' && (
        <Pressable style={[s.fab, { bottom: insets.bottom + 84 }]} onPress={() => setEditing({ task: newTask(categories[0]?.id ?? 'health'), isNew: true })}>
          <Text style={s.fabTxt}>＋ משימה</Text>
        </Pressable>
      )}

      <View style={[s.tabs, { paddingBottom: insets.bottom + 8 }]}>
        <Pressable style={s.tab} onPress={() => setTab('today')}>
          <Text style={[s.tabTxt, tab === 'today' && s.tabOn]}>📋 היום</Text>
        </Pressable>
        <Pressable style={s.tab} onPress={() => setTab('year')}>
          <Text style={[s.tabTxt, tab === 'year' && s.tabOn]}>📅 השנה שלי</Text>
        </Pressable>
      </View>

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
  hi: { fontSize: 16, color: '#64748b' },
  h1: { fontSize: 28, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
  bar: { height: 10, backgroundColor: '#e2e8f0', borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, backgroundColor: '#16a34a', borderRadius: 5 },
  progress: { fontSize: 14, color: '#475569', marginTop: 6, marginBottom: 14 },
  warn: { backgroundColor: '#fef3c7', padding: 12, borderRadius: 10, marginBottom: 12 },
  empty: { textAlign: 'center', fontSize: 18, marginTop: 30 },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  secTxt: { fontSize: 16, fontWeight: '800', color: '#334155', flex: 1 },
  secCount: { fontSize: 13, color: '#94a3b8', fontWeight: '700' },
  others: { fontSize: 14, color: '#94a3b8', fontWeight: '700', marginBottom: 2 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 12, borderRadius: 18,
    marginBottom: 10, borderLeftWidth: 6, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardLate: { backgroundColor: '#fff5f5' },
  title: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  sub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  doneBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12 },
  doneTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  undo: { paddingHorizontal: 12, paddingVertical: 6 },
  undoTxt: { fontSize: 26 },
  fab: { position: 'absolute', alignSelf: 'center', backgroundColor: '#0f172a', paddingHorizontal: 26, paddingVertical: 14, borderRadius: 30, elevation: 6 },
  fabTxt: { color: '#fff', fontSize: 17, fontWeight: '700' },
  tabs: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', backgroundColor: '#fff', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabTxt: { fontSize: 15, color: '#94a3b8', fontWeight: '700' },
  tabOn: { color: '#0f172a' },
});
