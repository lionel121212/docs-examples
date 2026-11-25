import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { dateKey, doneKey } from './dates';
import { isScheduled } from './stats';
import { TaskIcon } from './TaskIcon';
import { useI18n } from './i18n';
import { Category, DoneMap, Task } from './types';

type Props = {
  tasks: Task[];
  done: DoneMap;
  categories: Category[];
  onToggle: (task: Task, date: Date) => void;
  onEdit: (task: Task) => void;
};

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay()); // Sunday
  return x;
}

/** Big weekly table: rows = tasks, columns = days. Tap a cell to tick it (today and past days). */
export function WeekTable({ tasks, done, categories, onToggle, onEdit }: Props) {
  const { t, days: dayNames, dir, rtl } = useI18n();
  const [offset, setOffset] = useState(0);
  const today = new Date();
  const todayKey = dateKey(today);
  const start = startOfWeek(today);
  start.setDate(start.getDate() + offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const title = `${days[0].getDate()}/${days[0].getMonth() + 1} – ${days[6].getDate()}/${days[6].getMonth() + 1}`;

  // a day's column header shows how many of that day's tasks are done
  const dayStats = days.map((d) => {
    const sched = tasks.filter((t) => isScheduled(t, d, done));
    return { sched: sched.length, ok: sched.filter((t) => done[doneKey(t.id, d)]).length };
  });

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
      <View style={s.nav}>
        <Pressable onPress={() => setOffset(offset - 1)} style={s.arrow}>
          <Text style={s.arrowTxt}>{rtl ? '›' : '‹'}</Text>
        </Pressable>
        <Pressable onPress={() => setOffset(0)}>
          <Text style={s.title}>{offset === 0 ? t('this_week') : title}</Text>
          {offset !== 0 && <Text style={s.back}>{t('back_to_week')}</Text>}
        </Pressable>
        <Pressable onPress={() => setOffset(offset + 1)} style={s.arrow}>
          <Text style={s.arrowTxt}>{rtl ? '‹' : '›'}</Text>
        </Pressable>
      </View>

      <View style={[s.table, { direction: dir }]}>
        <View style={[s.row, { direction: dir }]}>
          <View style={s.nameCol} />
          {days.map((d, i) => {
            const isToday = dateKey(d) === todayKey;
            return (
              <View key={i} style={[s.headCell, isToday && s.headToday]}>
                <Text style={[s.dayName, isToday && { color: '#fff' }]}>{dayNames[i]}</Text>
                <Text style={[s.dayNum, isToday && { color: '#fff' }]}>{d.getDate()}</Text>
                <Text style={[s.dayCount, isToday && { color: '#fff' }]}>
                  {dayStats[i].sched ? `${dayStats[i].ok}/${dayStats[i].sched}` : ''}
                </Text>
              </View>
            );
          })}
        </View>

        {categories.map((c) => {
          const list = tasks.filter((t) => t.categoryId === c.id).sort((a, b) => a.time.localeCompare(b.time));
          if (!list.length) return null;
          return (
            <View key={c.id}>
              <View style={s.catRow}>
                <View style={[s.dot, { backgroundColor: c.color }]} />
                <Text style={s.catTxt}>{c.name}</Text>
              </View>
              {list.map((t) => (
                <View key={t.id} style={[s.row, { direction: dir }]}>
                  <Pressable style={s.nameCol} onPress={() => onEdit(t)}>
                    <TaskIcon task={t} size={30} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.taskName} numberOfLines={2}>
                        {t.title}
                      </Text>
                      <Text style={s.taskTime}>{t.time}</Text>
                    </View>
                  </Pressable>
                  {days.map((d, i) => {
                    const key = dateKey(d);
                    const scheduled = isScheduled(t, d, done);
                    if (!scheduled)
                      return (
                        <View key={i} style={s.cell}>
                          <Text style={s.dash}>·</Text>
                        </View>
                      );
                    const ok = !!done[doneKey(t.id, d)];
                    const future = key > todayKey;
                    const missed = !ok && key < todayKey;
                    return (
                      <Pressable
                        key={i}
                        disabled={future}
                        onPress={() => onToggle(t, d)}
                        style={[
                          s.cell,
                          s.cellOn,
                          ok && { backgroundColor: t.color },
                          missed && { backgroundColor: '#fee2e2' },
                          !ok && !missed && { borderColor: t.color, borderWidth: 2, opacity: future ? 0.35 : 1 },
                        ]}
                      >
                        <Text style={[s.mark, ok && { color: '#fff' }, missed && { color: '#ef4444' }]}>
                          {ok ? '✓' : missed ? '✕' : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          );
        })}
      </View>
      <Text style={s.hint}>{t('table_hint')}</Text>
    </ScrollView>
  );
}

const NAME_W = 104;
const s = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28, marginBottom: 10 },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  back: { fontSize: 12, color: '#2563eb', textAlign: 'center' },
  arrow: { padding: 10 },
  arrowTxt: { fontSize: 32, color: '#2563eb' },
  table: { backgroundColor: '#fff', borderRadius: 16, padding: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  nameCol: { width: NAME_W, flexDirection: 'row', alignItems: 'center', gap: 6, paddingEnd: 4 },
  headCell: { flex: 1, alignItems: 'center', paddingVertical: 4, borderRadius: 10, marginHorizontal: 1 },
  headToday: { backgroundColor: '#0f172a' },
  dayName: { fontSize: 13, fontWeight: '800', color: '#334155' },
  dayNum: { fontSize: 11, color: '#64748b' },
  dayCount: { fontSize: 10, color: '#94a3b8', height: 12 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  catTxt: { fontWeight: '800', fontSize: 13, color: '#334155' },
  taskName: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  taskTime: { fontSize: 10, color: '#94a3b8' },
  cell: { flex: 1, aspectRatio: 1, borderRadius: 10, marginHorizontal: 1, alignItems: 'center', justifyContent: 'center', maxHeight: 44 },
  cellOn: { backgroundColor: '#f8fafc' },
  dash: { color: '#cbd5e1', fontSize: 18 },
  mark: { fontSize: 18, fontWeight: '900' },
  hint: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 10 },
});
