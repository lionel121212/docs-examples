import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { dateKey, doneKey } from './dates';
import { TaskIcon } from './TaskIcon';
import { Category, DAY_LABELS, DoneMap, Task } from './types';

export type Status = 'done' | 'late' | 'pending' | 'none';
export type Row = Task & { status: Status };

type Props = {
  rows: Row[];
  tasks: Task[];
  categories: Category[];
  done: DoneMap;
  now: Date;
  streak: number;
  granted: boolean;
  onDone: (t: Task, value: boolean) => void;
  onToggleExercise: (t: Task, exId: string) => void;
  onEdit: (t: Task) => void;
  onAdd: () => void;
  onAI: () => void;
};

function minutesUntil(t: Task, now: Date) {
  const [h, m] = t.time.split(':').map(Number);
  return h * 60 + m - (now.getHours() * 60 + now.getMinutes());
}

function relTime(min: number) {
  const a = Math.abs(min);
  const txt = a < 60 ? `${a} דק׳` : `${Math.floor(a / 60)} ש׳${a % 60 ? ` ו-${a % 60} דק׳` : ''}`;
  return min < 0 ? `באיחור של ${txt}` : min === 0 ? 'עכשיו' : `בעוד ${txt}`;
}

function greeting(d: Date) {
  const h = d.getHours();
  return h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 18 ? 'צהריים טובים' : h < 22 ? 'ערב טוב' : 'לילה טוב';
}

function Ring({ pct, size = 76 }: { pct: number; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#ffffff33" strokeWidth={8} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r} stroke="#fff" strokeWidth={8} fill="none" strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`} rotation={-90} origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>{Math.round(pct * 100)}%</Text>
    </View>
  );
}

function WeekStrip({ tasks, done, now }: { tasks: Task[]; done: DoneMap; now: Date }) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const todayK = dateKey(now);
  return (
    <View style={s.week}>
      {Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const k = dateKey(d);
        const sched = tasks.filter((t) => t.enabled && t.days.includes(i) && t.createdAt <= k);
        const ok = sched.filter((t) => done[doneKey(t.id, d)]).length;
        const ratio = sched.length ? ok / sched.length : 0;
        const future = k > todayK;
        const isToday = k === todayK;
        const missed = !future && !isToday && sched.length > 0 && ratio < 1;
        const empty = !sched.length;
        return (
          <View key={i} style={s.weekDay}>
            <Text style={[s.weekLbl, isToday && { color: '#fff', fontWeight: '900' }]}>{DAY_LABELS[i]}</Text>
            <View style={[s.weekDot, missed && { backgroundColor: '#f8717166' }, isToday && { borderWidth: 2, borderColor: '#fff' }, (future || empty) && { opacity: 0.35 }]}>
              <View style={[s.weekFill, { height: `${Math.round(ratio * 100)}%` }, ratio === 1 && { backgroundColor: '#4ade80' }]} />
              {ratio === 1 && <Text style={s.weekTick}>✓</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Exercises({ t, done, now, onToggle, light }: { t: Task; done: DoneMap; now: Date; onToggle: (id: string) => void; light?: boolean }) {
  if (!t.exercises?.length) return null;
  return (
    <View style={{ marginTop: 10, gap: 2 }}>
      {t.exercises.map((e) => {
        const on = !!done[doneKey(`${t.id}#${e.id}`, now)];
        return (
          <Pressable key={e.id} style={s.exRow} onPress={() => onToggle(e.id)}>
            <View style={[s.check, { borderColor: light ? '#fff' : t.color }, on && { backgroundColor: light ? '#fff' : t.color }]}>
              {on && <Text style={[s.tick, light && { color: t.color }]}>✓</Text>}
            </View>
            <Text style={[s.exName, light && { color: '#fff' }, on && s.exDone]}>{e.name}</Text>
            <Text style={[s.exDetail, light && { color: '#ffffffcc' }]}>{e.detail}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function TodayView({ rows, tasks, categories, done, now, streak, granted, onDone, onToggleExercise, onEdit, onAdd, onAI }: Props) {
  const [showDone, setShowDone] = useState(false);
  const today = rows.filter((r) => r.status !== 'none');
  const open = today.filter((r) => r.status !== 'done');
  const finished = today.filter((r) => r.status === 'done');
  const pct = today.length ? finished.length / today.length : 0;
  // "now" = the most overdue open task, otherwise the next one coming up
  const focus = open.find((r) => r.status === 'late') ?? open[0];
  const rest = open.filter((r) => r !== focus);
  const cat = (id: string) => categories.find((c) => c.id === id);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
      <View style={s.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.hi}>{greeting(now)} 👋 · {now.toLocaleDateString('he-IL', { weekday: 'long' })}</Text>
          <Text style={s.h1} numberOfLines={1} adjustsFontSizeToFit>{now.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}</Text>
        </View>
        <Pressable style={s.aiPill} onPress={onAI}><Text style={s.aiPillTxt}>✨ תכנון AI</Text></Pressable>
        <Pressable style={s.iconBtn} onPress={onAdd}><Text style={s.iconBtnTxt}>＋</Text></Pressable>
      </View>

      <View style={s.heroCard}>
        <View style={s.hero}>
          <Ring pct={pct} />
          <View style={{ flex: 1 }}>
            <Text style={s.heroBig}>{finished.length} מתוך {today.length}</Text>
            <Text style={s.heroSmall}>{pct === 1 && today.length ? 'סיימת הכול להיום! 🎉' : `נשארו ${open.length} משימות להיום`}</Text>
          </View>
          <View style={s.streak}>
            <Text style={s.streakN}>🔥 {streak}</Text>
            <Text style={s.streakL}>{streak ? 'ימים ברצף' : 'התחל רצף'}</Text>
          </View>
        </View>
        <WeekStrip tasks={tasks} done={done} now={now} />
      </View>

      {!granted && <Text style={s.warn}>⚠️ אין הרשאת התראות. הפעל אותה בהגדרות הטלפון, אחרת התזכורות לא יעבדו.</Text>}

      {focus && (
        <>
          <Text style={s.section}>{focus.status === 'late' ? '⏰ עכשיו' : '⏭️ הבא בתור'}</Text>
          <Pressable onPress={() => onEdit(focus)} style={[s.focus, { backgroundColor: focus.status === 'late' ? '#dc2626' : focus.color }]}>
            <View style={s.row}>
              <View style={s.focusIcon}><TaskIcon task={{ ...focus, color: '#ffffff' }} size={58} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.focusTitle}>{focus.title}</Text>
                <Text style={s.focusMeta}>{focus.time} · {relTime(minutesUntil(focus, now))}</Text>
              </View>
            </View>
            <Exercises t={focus} done={done} now={now} onToggle={(id) => onToggleExercise(focus, id)} light />
            {focus.status === 'late' && <Text style={s.nag}>🔔 הטלפון ימשיך להזכיר עד שתסמן</Text>}
            <Pressable style={s.focusBtn} onPress={() => onDone(focus, true)}>
              <Text style={[s.focusBtnTxt, { color: focus.status === 'late' ? '#dc2626' : focus.color }]}>✓ סיימתי</Text>
            </Pressable>
          </Pressable>
        </>
      )}

      {rest.length > 0 && <Text style={s.section}>בהמשך היום</Text>}
      {rest.map((r) => (
        <Pressable key={r.id} onPress={() => onEdit(r)} style={[s.card, r.status === 'late' && s.cardLate]}>
          <View style={s.row}>
            <Text style={[s.time, r.status === 'late' && { color: '#dc2626' }]}>{r.time}</Text>
            <View style={[s.line, { backgroundColor: r.color }]} />
            <TaskIcon task={r} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{r.title}</Text>
              <Text style={[s.meta, r.status === 'late' && { color: '#dc2626', fontWeight: '700' }]}>
                {cat(r.categoryId)?.name ?? ''} · {relTime(minutesUntil(r, now))}
              </Text>
            </View>
            <Pressable onPress={() => onDone(r, true)} hitSlop={8} style={[s.circle, { borderColor: r.color }]} />
          </View>
          <Exercises t={r} done={done} now={now} onToggle={(id) => onToggleExercise(r, id)} />
        </Pressable>
      ))}

      {!today.length && <Text style={s.empty}>אין משימות היום. יום חופש! 🏖️</Text>}

      {finished.length > 0 && (
        <Pressable onPress={() => setShowDone(!showDone)} style={s.doneHead}>
          <Text style={s.section}>✅ הושלמו ({finished.length})</Text>
          <Text style={s.chev}>{showDone ? '▾' : '◂'}</Text>
        </Pressable>
      )}
      {showDone && finished.map((r) => (
        <View key={r.id} style={[s.card, { opacity: 0.6 }]}>
          <View style={s.row}>
            <Text style={s.time}>{r.time}</Text>
            <View style={[s.line, { backgroundColor: r.color }]} />
            <TaskIcon task={r} size={36} />
            <Text style={[s.title, { flex: 1, textDecorationLine: 'line-through' }]}>{r.title}</Text>
            <Pressable onPress={() => onDone(r, false)} hitSlop={8} style={[s.circle, { borderColor: r.color, backgroundColor: r.color, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={s.tick}>✓</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  hi: { fontSize: 15, color: '#64748b' },
  h1: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  aiPill: { height: 44, borderRadius: 22, paddingHorizontal: 14, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center' },
  aiPillTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  iconBtnTxt: { fontSize: 20, color: '#4f46e5', fontWeight: '800' },
  heroCard: { backgroundColor: '#4f46e5', borderRadius: 22, padding: 16, gap: 14 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  week: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#ffffff26', paddingTop: 12 },
  weekDay: { alignItems: 'center', gap: 5, flex: 1 },
  weekLbl: { color: '#c7d2fe', fontSize: 12, fontWeight: '700' },
  weekDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#ffffff22', overflow: 'hidden', justifyContent: 'flex-end', alignItems: 'center' },
  weekFill: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#a5b4fc' },
  weekTick: { position: 'absolute', top: 5, color: '#14532d', fontWeight: '900', fontSize: 13 },
  nag: { color: '#fff', fontSize: 13, marginTop: 12, fontWeight: '700', opacity: 0.9 },
  heroBig: { color: '#fff', fontSize: 22, fontWeight: '900' },
  heroSmall: { color: '#e0e7ff', fontSize: 14, marginTop: 2 },
  streak: { alignItems: 'center', backgroundColor: '#ffffff22', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8 },
  streakN: { color: '#fff', fontSize: 18, fontWeight: '900' },
  streakL: { color: '#e0e7ff', fontSize: 11 },
  warn: { backgroundColor: '#fef3c7', padding: 12, borderRadius: 10, marginTop: 12 },
  section: { fontSize: 15, fontWeight: '800', color: '#334155', marginTop: 20, marginBottom: 8 },
  focus: { borderRadius: 22, padding: 16 },
  focusIcon: { backgroundColor: '#ffffff26', borderRadius: 20 },
  focusTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  focusMeta: { color: '#ffffffd9', fontSize: 14, marginTop: 2, fontWeight: '600' },
  focusBtn: { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 14 },
  focusBtnTxt: { fontSize: 17, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 8 },
  cardLate: { backgroundColor: '#fff5f5' },
  time: { width: 42, fontSize: 13, fontWeight: '800', color: '#64748b', textAlign: 'center' },
  line: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  title: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  meta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  circle: { width: 30, height: 30, borderRadius: 15, borderWidth: 2.5 },
  doneHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chev: { fontSize: 16, color: '#94a3b8', marginTop: 12 },
  empty: { textAlign: 'center', fontSize: 18, marginTop: 30 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#fff', fontWeight: '900', fontSize: 14 },
  exName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#0f172a' },
  exDone: { textDecorationLine: 'line-through', opacity: 0.7 },
  exDetail: { fontSize: 13, color: '#64748b' },
});
