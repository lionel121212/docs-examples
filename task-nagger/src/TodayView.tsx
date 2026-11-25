import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { dateKey, doneKey } from './dates';
import { isScheduled } from './stats';
import { TaskIcon } from './TaskIcon';
import { Aurora, Confetti, GlowPulse, Shimmer } from './fx';
import { useI18n } from './i18n';
import { Category, DoneMap, Task } from './types';
import { Palette, useStyles } from './theme';

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
  onSettings: () => void;
};

function minutesUntil(t: Task, now: Date) {
  const [h, m] = t.time.split(':').map(Number);
  return h * 60 + m - (now.getHours() * 60 + now.getMinutes());
}

type T = ReturnType<typeof useI18n>['t'];

/** "25 בנובמבר" / "Nov 25": the long month name only when it fits next to the buttons. */
function dateTitle(d: Date, locale: string) {
  const long = d.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  return long.length <= 10 ? long : d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function relTime(t: T, min: number) {
  const a = Math.abs(min);
  const h = Math.floor(a / 60);
  const m = a % 60;
  const x = a < 60 ? t('min_short', { m: a }) : m ? t('hours_min_short', { h, m }) : t('hours_short', { h });
  return min < 0 ? t('late_by', { x }) : min === 0 ? t('right_now') : t('in_time', { x });
}

function greeting(t: T, d: Date) {
  const h = d.getHours();
  return t(h < 5 ? 'gm_night' : h < 12 ? 'gm_morning' : h < 18 ? 'gm_noon' : h < 22 ? 'gm_evening' : 'gm_night');
}

function Ring({ pct, size = 76 }: { pct: number; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#ffffff33" strokeWidth={8} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#fff"
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>{Math.round(pct * 100)}%</Text>
    </View>
  );
}

function WeekStrip({ tasks, done, now }: { tasks: Task[]; done: DoneMap; now: Date }) {
  const s = useStyles(makeStyles);
  const { days } = useI18n();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const todayK = dateKey(now);
  return (
    <View style={s.week}>
      {Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const k = dateKey(d);
        const sched = tasks.filter((t) => isScheduled(t, d, done, now));
        const ok = sched.filter((t) => done[doneKey(t.id, d)]).length;
        const ratio = sched.length ? ok / sched.length : 0;
        const future = k > todayK;
        const isToday = k === todayK;
        const missed = !future && !isToday && sched.length > 0 && ratio < 1;
        const empty = !sched.length;
        return (
          <View key={i} style={s.weekDay}>
            <Text style={[s.weekLbl, isToday && { color: '#fff', fontWeight: '900' }]}>{days[i]}</Text>
            <View
              style={[
                s.weekDot,
                missed && { backgroundColor: '#f8717166' },
                isToday && { borderWidth: 2, borderColor: '#fff' },
                (future || empty) && { opacity: 0.35 },
              ]}
            >
              <View style={[s.weekFill, { height: `${Math.round(ratio * 100)}%` }, ratio === 1 && { backgroundColor: '#4ade80' }]} />
              {ratio === 1 && <Text style={s.weekTick}>✓</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Exercises({
  t,
  done,
  now,
  onToggle,
  light,
}: {
  t: Task;
  done: DoneMap;
  now: Date;
  onToggle: (id: string) => void;
  light?: boolean;
}) {
  const s = useStyles(makeStyles);
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

export function TodayView({
  rows,
  tasks,
  categories,
  done,
  now,
  streak,
  granted,
  onDone,
  onToggleExercise,
  onEdit,
  onAdd,
  onAI,
  onSettings,
}: Props) {
  const s = useStyles(makeStyles);
  const { t, locale, rtl } = useI18n();
  const [showDone, setShowDone] = useState(false);
  const [burst, setBurst] = useState(0);
  const celebrate = (task: Task) => {
    setBurst(Date.now());
    onDone(task, true);
  };
  const today = rows.filter((r) => r.status !== 'none');
  const open = today.filter((r) => r.status !== 'done');
  const finished = today.filter((r) => r.status === 'done');
  const pct = today.length ? finished.length / today.length : 0;
  // "now" = the most overdue open task, otherwise the next one coming up
  const focus = open.find((r) => r.status === 'late') ?? open[0];
  const rest = open.filter((r) => r !== focus);
  const cat = (id: string) => categories.find((c) => c.id === id);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <Text style={s.hi}>
          {greeting(t, now)} 👋 · {now.toLocaleDateString(locale, { weekday: 'long' })}
        </Text>
        <View style={s.topRow}>
          <Text style={[s.h1, { flex: 1 }]} numberOfLines={1} adjustsFontSizeToFit>
            {dateTitle(now, locale)}
          </Text>
          <Pressable style={s.aiPill} onPress={onAI} accessibilityRole="button">
            <Text style={s.aiPillTxt}>{t('ai_pill')}</Text>
          </Pressable>
          <Pressable style={s.iconBtn} onPress={onAdd} accessibilityRole="button" accessibilityLabel={t('a11y_add')}>
            <Text style={s.iconBtnTxt}>＋</Text>
          </Pressable>
          <Pressable style={s.iconBtn} onPress={onSettings} accessibilityRole="button" accessibilityLabel={t('a11y_settings')}>
            <Text style={[s.iconBtnTxt, { fontSize: 18 }]}>⚙️</Text>
          </Pressable>
        </View>

        <View style={s.heroCard}>
          <Aurora colors={['#a78bfa', '#60a5fa', '#f472b6', '#22d3ee']} intensity={0.55} />
          <View style={s.hero}>
            <Ring pct={pct} />
            <View style={{ flex: 1 }}>
              <Text style={s.heroBig}>{t('x_of_y', { a: finished.length, b: today.length })}</Text>
              <Text style={s.heroSmall}>{pct === 1 && today.length ? t('all_done_today') : t('left_today', { n: open.length })}</Text>
            </View>
            <View style={s.streak}>
              <Text style={s.streakN}>🔥 {streak}</Text>
              <Text style={s.streakL}>{streak ? t('streak_days') : t('streak_start')}</Text>
            </View>
          </View>
          <WeekStrip tasks={tasks} done={done} now={now} />
        </View>

        {!granted && <Text style={s.warn}>{t('no_permission')}</Text>}

        {focus && (
          <>
            <Text style={s.section}>{focus.status === 'late' ? t('now_label') : t('next_label')}</Text>
            <View>
              {focus.status === 'late' && <GlowPulse color="#ef4444" radius={22} />}
              <Pressable
                onPress={() => onEdit(focus)}
                style={[s.focus, { backgroundColor: focus.status === 'late' ? '#dc2626' : focus.color }]}
              >
                <View style={s.row}>
                  <View style={s.focusIcon}>
                    <TaskIcon task={{ ...focus, color: '#ffffff' }} size={58} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.focusTitle}>{focus.title}</Text>
                    <Text style={s.focusMeta}>
                      {focus.time} · {relTime(t, minutesUntil(focus, now))}
                    </Text>
                  </View>
                </View>
                <Exercises t={focus} done={done} now={now} onToggle={(id) => onToggleExercise(focus, id)} light />
                {focus.status === 'late' && <Text style={s.nag}>{t('nag_hint')}</Text>}
                <Pressable style={s.focusBtn} onPress={() => celebrate(focus)}>
                  <Text style={[s.focusBtnTxt, { color: focus.status === 'late' ? '#dc2626' : focus.color }]}>{t('done_btn')}</Text>
                  <Shimmer every={2200} />
                </Pressable>
              </Pressable>
            </View>
          </>
        )}

        {rest.length > 0 && <Text style={s.section}>{t('later_today')}</Text>}
        {rest.map((r) => (
          <Pressable key={r.id} onPress={() => onEdit(r)} style={[s.card, r.status === 'late' && s.cardLate]}>
            <View style={s.row}>
              <Text style={[s.time, r.status === 'late' && { color: '#dc2626' }]}>{r.time}</Text>
              <View style={[s.line, { backgroundColor: r.color }]} />
              <TaskIcon task={r} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{r.title}</Text>
                <Text style={[s.meta, r.status === 'late' && { color: '#dc2626', fontWeight: '700' }]}>
                  {cat(r.categoryId)?.name ?? ''} · {relTime(t, minutesUntil(r, now))}
                </Text>
              </View>
              <Pressable onPress={() => celebrate(r)} hitSlop={8} style={[s.circle, { borderColor: r.color }]} />
            </View>
            <Exercises t={r} done={done} now={now} onToggle={(id) => onToggleExercise(r, id)} />
          </Pressable>
        ))}

        {!today.length && <Text style={s.empty}>{t('free_day')}</Text>}

        {finished.length > 0 && (
          <Pressable onPress={() => setShowDone(!showDone)} style={s.doneHead}>
            <Text style={s.section}>{t('completed_n', { n: finished.length })}</Text>
            <Text style={s.chev}>{showDone ? '▾' : rtl ? '◂' : '▸'}</Text>
          </Pressable>
        )}
        {showDone &&
          finished.map((r) => (
            <View key={r.id} style={[s.card, { opacity: 0.6 }]}>
              <View style={s.row}>
                <Text style={s.time}>{r.time}</Text>
                <View style={[s.line, { backgroundColor: r.color }]} />
                <TaskIcon task={r} size={36} />
                <Text style={[s.title, { flex: 1, textDecorationLine: 'line-through' }]}>{r.title}</Text>
                <Pressable
                  onPress={() => onDone(r, false)}
                  hitSlop={8}
                  style={[s.circle, { borderColor: r.color, backgroundColor: r.color, alignItems: 'center', justifyContent: 'center' }]}
                >
                  <Text style={s.tick}>✓</Text>
                </Pressable>
              </View>
            </View>
          ))}
      </ScrollView>
      <Confetti burstKey={burst} origin={{ x: 190, y: 330 }} />
    </View>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
    hi: { fontSize: 15, color: C.muted },
    h1: { fontSize: 26, fontWeight: '800', color: C.text },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: C.card,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 2,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    aiPill: {
      height: 40,
      borderRadius: 20,
      paddingHorizontal: 14,
      backgroundColor: '#4f46e5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    aiPillTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
    iconBtnTxt: { fontSize: 20, color: '#4f46e5', fontWeight: '800' },
    heroCard: { backgroundColor: '#4338ca', borderRadius: 22, padding: 16, gap: 14, overflow: 'hidden' },
    hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    week: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#ffffff26', paddingTop: 12 },
    weekDay: { alignItems: 'center', gap: 5, flex: 1 },
    weekLbl: { color: '#c7d2fe', fontSize: 12, fontWeight: '700' },
    weekDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#ffffff22',
      overflow: 'hidden',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    weekFill: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#a5b4fc' },
    weekTick: { position: 'absolute', top: 5, color: '#14532d', fontWeight: '900', fontSize: 13 },
    nag: { color: '#fff', fontSize: 13, marginTop: 12, fontWeight: '700', opacity: 0.9 },
    heroBig: { color: '#fff', fontSize: 22, fontWeight: '900' },
    heroSmall: { color: '#e0e7ff', fontSize: 14, marginTop: 2 },
    streak: { alignItems: 'center', backgroundColor: '#ffffff22', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8 },
    streakN: { color: '#fff', fontSize: 18, fontWeight: '900' },
    streakL: { color: '#e0e7ff', fontSize: 11 },
    warn: { backgroundColor: '#fef3c7', padding: 12, borderRadius: 10, marginTop: 12 },
    section: { fontSize: 15, fontWeight: '800', color: C.text2, marginTop: 20, marginBottom: 8 },
    focus: { borderRadius: 22, padding: 16 },
    focusIcon: { backgroundColor: '#ffffff26', borderRadius: 20 },
    focusTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
    focusMeta: { color: '#ffffffd9', fontSize: 14, marginTop: 2, fontWeight: '600' },
    focusBtn: { backgroundColor: C.card, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 14, overflow: 'hidden' },
    focusBtnTxt: { fontSize: 17, fontWeight: '900', color: C.text },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 12, marginBottom: 8 },
    cardLate: { backgroundColor: '#fff5f5' },
    time: { width: 42, fontSize: 13, fontWeight: '800', color: C.muted, textAlign: 'center' },
    line: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
    title: { fontSize: 16, fontWeight: '700', color: C.text },
    meta: { fontSize: 12, color: C.muted, marginTop: 2 },
    circle: { width: 30, height: 30, borderRadius: 15, borderWidth: 2.5 },
    doneHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    chev: { fontSize: 16, color: C.faint, marginTop: 12 },
    empty: { textAlign: 'center', fontSize: 18, marginTop: 30, color: C.text },
    exRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    check: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    tick: { color: '#fff', fontWeight: '900', fontSize: 14 },
    exName: { flex: 1, fontSize: 15, fontWeight: '600', color: C.text },
    exDone: { textDecorationLine: 'line-through', opacity: 0.7 },
    exDetail: { fontSize: 13, color: C.muted },
  });
