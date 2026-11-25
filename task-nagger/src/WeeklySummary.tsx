import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { authHeaders } from './account';
import { weekStats } from './achievements';
import { Aurora } from './fx';
import { useI18n } from './i18n';
import { PLANNER_URL } from './server';
import { summarize } from './stats';
import { TaskIcon } from './TaskIcon';
import { DoneMap, Task } from './types';

type Props = { visible: boolean; tasks: Task[]; done: DoneMap; premium: boolean; onClose: () => void; onUpgrade: () => void };

export function WeeklySummary({ visible, tasks, done, premium, onClose, onUpgrade }: Props) {
  const { t, lang, dir } = useI18n();
  const [coach, setCoach] = useState<{ headline: string; tips: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setCoach(null);
      setError(null);
    }
  }, [visible]);

  if (!visible) return null;
  const today = new Date();
  const week = weekStats(tasks, done, today, today);
  const last = weekStats(tasks, done, new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7), today);
  const diff = last.total ? week.rate - last.rate : null;
  const streak = summarize(today.getFullYear(), tasks, done, today).streak;

  const askCoach = async () => {
    if (!premium) return onUpgrade();
    if (!PLANNER_URL) return setError(t('not_configured'));
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${PLANNER_URL}/coach`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          lang,
          week: {
            done: week.done,
            total: week.total,
            lastWeekRate: last.total ? last.rate : null,
            streak,
            tasks: week.perTask.map((e) => ({ title: e.task.title, time: e.task.time, done: e.done, total: e.total })),
          },
        }),
      });
      if (res.status === 402) return onUpgrade();
      if (!res.ok) return setError(res.status === 503 || res.status === 429 ? t('server_busy') : t('went_wrong'));
      setCoach(await res.json());
    } catch {
      setError(t('offline'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[s.root, { direction: dir }]}>
        <Aurora />
        <ScrollView contentContainerStyle={s.wrap}>
          <Text style={s.title}>{t('ws_open')}</Text>
          <View style={s.big}>
            <Text style={s.bigN}>{week.rate}%</Text>
            <Text style={s.bigL}>{t('ws_rate')}</Text>
            {diff !== null && (
              <Text style={[s.diff, { color: diff > 0 ? '#4ade80' : diff < 0 ? '#fca5a5' : '#c7d2fe' }]}>
                {diff > 0 ? '+' : ''}
                {diff}% {diff > 0 ? '📈' : diff < 0 ? '📉' : ''} · {t('ws_vs_last')}
              </Text>
            )}
          </View>
          <View style={s.row}>
            <Stat n={week.done} label={t('ws_done')} />
            <Stat n={week.missed} label={t('ws_missed')} />
            <Stat n={streak} label={t('st_streak')} />
          </View>
          {week.best && <TaskLine label={t('ws_best')} task={week.best.task} done={week.best.done} total={week.best.total} />}
          {week.worst && week.worst.done < week.worst.total && (
            <TaskLine label={t('ws_worst')} task={week.worst.task} done={week.worst.done} total={week.worst.total} />
          )}

          {coach ? (
            <View style={s.coach}>
              <Text style={s.coachHead}>✨ {coach.headline}</Text>
              {coach.tips.map((tip, i) => (
                <Text key={i} style={s.tip}>
                  {i + 1}. {tip}
                </Text>
              ))}
            </View>
          ) : (
            <Pressable style={s.coachBtn} onPress={askCoach} disabled={loading}>
              {loading ? <ActivityIndicator color="#1e1b4b" /> : <Text style={s.coachBtnTxt}>{t('coach_btn')}</Text>}
            </Pressable>
          )}
          {loading && <Text style={s.note}>{t('coach_loading')}</Text>}
          {error && <Text style={s.err}>{error}</Text>}
          <Pressable onPress={onClose} style={s.close}>
            <Text style={s.closeTxt}>{t('close')}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statN}>{n}</Text>
      <Text style={s.statL}>{label}</Text>
    </View>
  );
}

function TaskLine({ label, task, done, total }: { label: string; task: Task; done: number; total: number }) {
  return (
    <View style={s.line}>
      <TaskIcon task={task} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={s.lineLabel}>{label}</Text>
        <Text style={s.lineTitle}>{task.title}</Text>
      </View>
      <Text style={s.lineN}>
        {done}/{total}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#090d24' },
  wrap: { padding: 20, paddingTop: 56, paddingBottom: 40, gap: 12 },
  title: { fontSize: 28, fontWeight: '900', color: '#fff', textAlign: 'center' },
  big: {
    alignItems: 'center',
    backgroundColor: 'rgba(99,102,241,0.35)',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#a5b4fc',
  },
  bigN: { fontSize: 56, fontWeight: '900', color: '#fff' },
  bigL: { color: '#c7d2fe', fontSize: 15, fontWeight: '700' },
  diff: { marginTop: 6, fontSize: 14, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 12, alignItems: 'center' },
  statN: { color: '#fff', fontSize: 24, fontWeight: '900' },
  statL: { color: '#a5b4fc', fontSize: 12 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 16, padding: 12 },
  lineLabel: { fontSize: 12, color: '#64748b', fontWeight: '700' },
  lineTitle: { fontSize: 16, color: '#0f172a', fontWeight: '800' },
  lineN: { fontSize: 18, fontWeight: '900', color: '#4f46e5' },
  coachBtn: { backgroundColor: '#facc15', borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  coachBtnTxt: { color: '#1e1b4b', fontWeight: '900', fontSize: 16 },
  coach: { backgroundColor: 'rgba(250,204,21,0.12)', borderColor: '#facc15', borderWidth: 1.5, borderRadius: 18, padding: 16, gap: 8 },
  coachHead: { color: '#fff', fontWeight: '900', fontSize: 17 },
  tip: { color: '#e0e7ff', fontSize: 15, lineHeight: 21 },
  note: { color: '#a5b4fc', textAlign: 'center' },
  err: { color: '#fca5a5', textAlign: 'center' },
  close: { paddingVertical: 14, alignItems: 'center' },
  closeTxt: { color: '#a5b4fc', fontWeight: '800', fontSize: 15 },
});
