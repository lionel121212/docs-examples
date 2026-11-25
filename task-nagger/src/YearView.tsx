import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { dateKey } from './dates';
import { dayInfo, summarize } from './stats';
import { TaskIcon } from './TaskIcon';
import { achievementName } from './AchievementPopup';
import { achievements } from './achievements';
import { useI18n } from './i18n';
import { Category, DoneMap, Task } from './types';
import { Palette, useStyles, useTheme } from './theme';

const CELL = 15;
const GAP = 3;

function colorFor(ratio: number | null, future: boolean, dark = false): string {
  if (future) return dark ? '#1b2238' : '#eef0f3';
  if (ratio === null) return dark ? '#151b2c' : '#f6f7f9';
  if (ratio === 1) return '#16a34a';
  if (ratio >= 0.5) return '#86efac';
  if (ratio > 0) return '#fde68a';
  return '#fca5a5';
}

export function YearView({
  tasks,
  done,
  categories,
  onSummary,
}: {
  tasks: Task[];
  done: DoneMap;
  categories: Category[];
  onSummary: () => void;
}) {
  const s = useStyles(makeStyles);
  const C = useTheme();
  const { t, locale, days, rtl } = useI18n();
  const MONTHS = useMemo(
    () => Array.from({ length: 12 }, (_, m) => new Date(2026, m, 1).toLocaleDateString(locale, { month: 'short' })),
    [locale],
  );
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Date | null>(today);
  const scroller = useRef<any>(null);

  const visible = useMemo(
    () => tasks.filter((t) => (!catFilter || t.categoryId === catFilter) && (!taskFilter || t.id === taskFilter)),
    [tasks, catFilter, taskFilter],
  );

  const { columns, monthStarts } = useMemo(() => {
    const first = new Date(year, 0, 1);
    const cols: (Date | null)[][] = [];
    let col: (Date | null)[] = Array(first.getDay()).fill(null);
    const months: { col: number; m: number }[] = [{ col: 0, m: 0 }];
    for (let d = new Date(year, 0, 1); d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
      if (d.getDate() === 1 && d.getMonth() > 0) months.push({ col: cols.length + (col.length === 7 ? 1 : 0), m: d.getMonth() });
      col.push(new Date(d));
      if (col.length === 7) {
        cols.push(col);
        col = [];
      }
    }
    if (col.length) cols.push(col);
    return { columns: cols, monthStarts: months };
  }, [year]);

  useEffect(() => {
    // jump near "today" when viewing the current year
    const idx = year === today.getFullYear() ? Math.floor((Date.now() - new Date(year, 0, 1).getTime()) / 864e5 / 7) : 0;
    setTimeout(() => scroller.current?.scrollTo({ x: Math.max(0, idx * (CELL + GAP) - 120), animated: false }), 50);
  }, [year]);

  const achs = useMemo(() => achievements(tasks, done), [tasks, done]);
  const stats = useMemo(() => summarize(year, visible, done, today), [year, visible, done]);
  const sel = selected ? dayInfo(selected, visible, done) : null;
  const todayKey = dateKey(today);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.yearRow}>
          <Pressable onPress={() => setYear(year - 1)} style={s.arrow}>
            <Text style={s.arrowTxt}>{rtl ? '›' : '‹'}</Text>
          </Pressable>
          <Text style={s.year}>{year}</Text>
          <Pressable onPress={() => setYear(year + 1)} style={s.arrow}>
            <Text style={s.arrowTxt}>{rtl ? '‹' : '›'}</Text>
          </Pressable>
        </View>

        <Pressable style={s.summaryBtn} onPress={onSummary}>
          <Text style={s.summaryTxt}>{t('ws_open')}</Text>
        </Pressable>
        <Text style={s.achTitle}>🏅 {t('achievements')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
          {achs.map((a) => (
            <View key={a.id} style={[s.ach, !a.earned && { opacity: 0.45 }]}>
              <Text style={{ fontSize: 26 }}>{a.earned ? a.emoji : '🔒'}</Text>
              <Text style={s.achName} numberOfLines={2}>
                {achievementName(t, a)}
              </Text>
              {!a.earned && (
                <Text style={s.achProg}>
                  {a.progress}/{a.n}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
        <View style={s.stats}>
          <Stat n={String(stats.streak)} label={t('st_streak')} />
          <Stat n={String(stats.perfect)} label={t('st_perfect')} />
          <Stat n={String(stats.missed)} label={t('st_missed')} />
          <Stat n={stats.percent + '%'} label={t('st_success')} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          <Chip
            label={t('all')}
            on={!catFilter && !taskFilter}
            onPress={() => {
              setCatFilter(null);
              setTaskFilter(null);
            }}
            color="#334155"
          />
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              color={c.color}
              on={catFilter === c.id}
              onPress={() => {
                setCatFilter(catFilter === c.id ? null : c.id);
                setTaskFilter(null);
              }}
            />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {tasks
            .filter((t) => !catFilter || t.categoryId === catFilter)
            .map((t) => (
              <Chip
                key={t.id}
                label={t.title}
                color={t.color}
                on={taskFilter === t.id}
                onPress={() => setTaskFilter(taskFilter === t.id ? null : t.id)}
              />
            ))}
        </ScrollView>

        <View style={s.gridCard}>
          {/* grid is always drawn left-to-right (Jan -> Dec) */}
          <View style={{ flexDirection: 'row', direction: 'ltr' }}>
            <View style={{ marginTop: 20 }}>
              {days.map((d, i) => (
                <Text key={i} style={s.dow}>
                  {i % 2 === 0 ? d : ''}
                </Text>
              ))}
            </View>
            <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={{ height: 20, flexDirection: 'row', direction: 'ltr' }}>
                  {monthStarts.map(({ col, m }) => (
                    <Text key={m} style={[s.month, { left: col * (CELL + GAP) }]}>
                      {MONTHS[m]}
                    </Text>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', direction: 'ltr', gap: GAP }}>
                  {columns.map((col, ci) => (
                    <View key={ci} style={{ gap: GAP }}>
                      {Array.from({ length: 7 }).map((_, ri) => {
                        const d = col[ri];
                        if (!d) return <View key={ri} style={{ width: CELL, height: CELL }} />;
                        const info = dayInfo(d, visible, done);
                        const future = dateKey(d) > todayKey;
                        const ratio = info.scheduled.length ? info.doneTasks.length / info.scheduled.length : null;
                        const isSel = selected && dateKey(selected) === dateKey(d);
                        const isToday = dateKey(d) === todayKey;
                        return (
                          <Pressable
                            key={ri}
                            onPress={() => setSelected(d)}
                            style={[
                              s.cell,
                              { backgroundColor: colorFor(isToday && ratio === 0 ? null : ratio, future, C.dark) },
                              isToday && { borderWidth: 2, borderColor: '#2563eb' },
                              isSel && { borderWidth: 2, borderColor: '#0f172a' },
                            ]}
                          />
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
          <View style={s.legend}>
            <Text style={s.legTxt}>{t('legend_miss')}</Text>
            {['#fca5a5', '#fde68a', '#86efac', '#16a34a'].map((c) => (
              <View key={c} style={[s.legCell, { backgroundColor: c }]} />
            ))}
            <Text style={s.legTxt}>{t('legend_all')}</Text>
          </View>
        </View>

        {sel && selected && (
          <View style={s.detail}>
            <Text style={s.detailTitle}>{selected.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
            {sel.scheduled.length === 0 && <Text style={s.none}>{t('no_tasks_day')}</Text>}
            {sel.scheduled.map((t) => {
              const ok = sel.doneTasks.includes(t);
              const future = dateKey(selected) > todayKey;
              return (
                <View key={t.id} style={s.detailRow}>
                  <TaskIcon task={t} size={36} />
                  <Text style={s.detailName}>{t.title}</Text>
                  <Text style={{ fontSize: 20 }}>{ok ? '✅' : future ? '⏳' : '❌'}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.stat}>
      <Text style={s.statN}>{n}</Text>
      <Text style={s.statL}>{label}</Text>
    </View>
  );
}

function Chip({ label, color, on, onPress }: { label: string; color: string; on: boolean; onPress: () => void }) {
  const s = useStyles(makeStyles);
  return (
    <Pressable onPress={onPress} style={[s.chip, { borderColor: color }, on && { backgroundColor: color }]}>
      <Text style={[s.chipTxt, on && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    summaryBtn: { backgroundColor: '#4f46e5', borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginBottom: 12 },
    summaryTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },
    achTitle: { fontSize: 15, fontWeight: '800', color: C.text2, marginBottom: 6 },
    ach: {
      width: 96,
      backgroundColor: C.card,
      borderRadius: 16,
      padding: 10,
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: C.border,
    },
    achName: { fontSize: 11, fontWeight: '800', color: C.text, textAlign: 'center' },
    achProg: { fontSize: 10, color: C.faint },
    yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 8 },
    year: { fontSize: 30, fontWeight: '800', color: C.text },
    arrow: { padding: 10 },
    arrowTxt: { fontSize: 32, color: '#2563eb' },
    stats: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    stat: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 10, alignItems: 'center' },
    statN: { fontSize: 22, fontWeight: '800', color: C.text },
    statL: { fontSize: 11, color: C.muted, marginTop: 2, textAlign: 'center' },
    chips: { gap: 8, paddingVertical: 4 },
    chip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
    chipTxt: { fontWeight: '600', fontSize: 14, color: C.text },
    gridCard: { backgroundColor: C.card, borderRadius: 16, padding: 12, marginTop: 8 },
    cell: { width: CELL, height: CELL, borderRadius: 4 },
    dow: { height: CELL + GAP, fontSize: 10, color: C.faint, width: 20, textAlign: 'center', lineHeight: CELL },
    month: { position: 'absolute', fontSize: 11, color: C.muted, top: 0 },
    legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 10 },
    legCell: { width: 14, height: 14, borderRadius: 4 },
    legTxt: { fontSize: 11, color: C.muted, marginHorizontal: 4 },
    detail: { backgroundColor: C.card, borderRadius: 16, padding: 14, marginTop: 12 },
    detailTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8, color: C.text },
    none: { color: C.faint, paddingVertical: 8 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    detailName: { flex: 1, fontSize: 16, color: C.text },
  });
