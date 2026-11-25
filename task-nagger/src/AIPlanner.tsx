import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { dateKey } from './dates';
import { TaskIcon } from './TaskIcon';
import { useI18n } from './i18n';
import { Category, PALETTE, Task } from './types';

const PLANNER_URL: string = (Constants.expoConfig?.extra as any)?.plannerUrl ?? '';

type PlannedTask = { title: string; category: string; time: string; days: number[]; exercises: { name: string; detail: string }[] };
type Plan = { summary: string; tasks: PlannedTask[] };

async function getUserId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem('userId');
    if (existing) return existing;
    const id = 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    await AsyncStorage.setItem('userId', id);
    return id;
  } catch {
    return 'anonymous';
  }
}

function daysLabel(days: number[], names: string[], everyDay: string) {
  return days.length === 7 ? everyDay : days.map((d) => names[d]).join(' ');
}

type Props = {
  visible: boolean;
  categories: Category[];
  onClose: () => void;
  onAdd: (tasks: Task[], replace: boolean) => void;
};

export function AIPlanner({ visible, categories, onClose, onAdd }: Props) {
  const { t, lang, days, dir } = useI18n();
  const EXAMPLES = [t('planner_ex1'), t('planner_ex2')];
  const [text, setText] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [picked, setPicked] = useState<boolean[]>([]);

  useEffect(() => {
    AsyncStorage.getItem('accessCode')
      .then((c) => c && setCode(c))
      .catch(() => {});
  }, []);

  const reset = () => {
    setPlan(null);
    setError(null);
    setPaywall(false);
  };

  const ask = async () => {
    if (!text.trim()) return;
    if (!PLANNER_URL) {
      setError(t('not_configured'));
      return;
    }
    reset();
    setLoading(true);
    try {
      AsyncStorage.setItem('accessCode', code.trim()).catch(() => {});
      const res = await fetch(`${PLANNER_URL.replace(/\/$/, '')}/plan`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-app-user-id': await getUserId(),
          ...(code.trim() ? { 'x-access-code': code.trim() } : {}),
        },
        body: JSON.stringify({ request: text.trim(), today: new Date().toDateString(), lang }),
      });
      if (res.status === 402) {
        setPaywall(true);
        return;
      }
      if (!res.ok) {
        setError(res.status === 503 || res.status === 429 ? t('server_busy') : t('went_wrong'));
        return;
      }
      const p = (await res.json()) as Plan;
      setPlan(p);
      setPicked(p.tasks.map(() => true));
    } catch {
      setError(t('offline'));
    } finally {
      setLoading(false);
    }
  };

  const toTasks = (): Task[] => {
    const createdAt = dateKey(new Date());
    return (plan?.tasks ?? [])
      .filter((_, i) => picked[i])
      .map((pt, i) => {
        const cat = categories.find((c) => c.id === pt.category);
        return {
          id: `ai${Date.now()}${i}`,
          title: pt.title,
          categoryId: pt.category,
          color: cat?.color ?? PALETTE[i % PALETTE.length],
          icon: 'auto' as const,
          time: pt.time,
          days: pt.days,
          nagEveryMin: 5,
          nagCount: 6,
          enabled: true,
          createdAt,
          exercises: pt.exercises.map((e, j) => ({ id: `e${Date.now()}${i}${j}`, ...e })),
        };
      });
  };

  const count = picked.filter(Boolean).length;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#fff', direction: dir }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
          <Text style={s.h1}>{t('planner_title')}</Text>
          <Text style={s.sub}>{t('planner_sub')}</Text>

          <TextInput style={s.input} multiline value={text} onChangeText={setText} placeholder={t('planner_ph')} textAlignVertical="top" />
          <ScrollView
            horizontal
            style={{ flexGrow: 0 }}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 8, alignItems: 'flex-start' }}
          >
            {EXAMPLES.map((e) => (
              <Pressable key={e} style={s.example} onPress={() => setText(e)}>
                <Text style={s.exampleTxt} numberOfLines={2}>
                  {e}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable style={[s.go, (!text.trim() || loading) && { opacity: 0.5 }]} disabled={!text.trim() || loading} onPress={ask}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.goTxt}>{t('plan_btn')}</Text>}
          </Pressable>
          {loading && <Text style={s.wait}>{t('thinking')}</Text>}

          {error && <Text style={s.error}>{error}</Text>}

          {paywall && (
            <View style={s.paywall}>
              <Text style={s.payTitle}>{t('premium_title')}</Text>
              <Text style={s.payTxt}>{t('premium_text')}</Text>
              <TextInput
                style={[s.input, { minHeight: 0, marginTop: 8 }]}
                value={code}
                onChangeText={setCode}
                placeholder={t('code_ph')}
                autoCapitalize="none"
              />
            </View>
          )}

          {plan && (
            <View style={{ marginTop: 16 }}>
              <Text style={s.summary}>{plan.summary}</Text>
              {plan.tasks.map((pt, i) => {
                const cat = categories.find((c) => c.id === pt.category);
                const color = cat?.color ?? PALETTE[i % PALETTE.length];
                return (
                  <Pressable
                    key={i}
                    style={[s.row, !picked[i] && { opacity: 0.4 }]}
                    onPress={() => setPicked(picked.map((p, j) => (j === i ? !p : p)))}
                  >
                    <View style={[s.check, { borderColor: color }, picked[i] && { backgroundColor: color }]}>
                      {picked[i] && <Text style={s.tick}>✓</Text>}
                    </View>
                    <TaskIcon task={{ title: pt.title, icon: 'auto', color }} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.title}>{pt.title}</Text>
                      <Text style={s.meta}>
                        {pt.time} · {daysLabel(pt.days, days, t('every_day'))}
                        {pt.exercises.length ? ` · ${t('exercises_n', { n: pt.exercises.length })}` : ''}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              <Pressable
                style={[s.go, { marginTop: 12 }, !count && { opacity: 0.5 }]}
                disabled={!count}
                onPress={() => {
                  onAdd(toTasks(), false);
                  setPlan(null);
                  setText('');
                }}
              >
                <Text style={s.goTxt}>{t('add_n', { n: count })}</Text>
              </Pressable>
              <Pressable
                style={s.secondary}
                disabled={!count}
                onPress={() => {
                  onAdd(toTasks(), true);
                  setPlan(null);
                  setText('');
                }}
              >
                <Text style={s.secondaryTxt}>{t('replace_all')}</Text>
              </Pressable>
            </View>
          )}

          <Pressable style={s.secondary} onPress={onClose}>
            <Text style={s.secondaryTxt}>{t('close')}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, paddingTop: 52, flexGrow: 1 },
  h1: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  sub: { fontSize: 15, color: '#64748b', marginTop: 6, marginBottom: 14 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 14, padding: 14, fontSize: 17, minHeight: 130 },
  example: { backgroundColor: '#eef2ff', borderRadius: 12, padding: 10, width: 230, alignSelf: 'flex-start' },
  exampleTxt: { fontSize: 13, color: '#4338ca' },
  go: { backgroundColor: '#4f46e5', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  goTxt: { color: '#fff', fontSize: 18, fontWeight: '800' },
  wait: { textAlign: 'center', color: '#64748b', marginTop: 8 },
  error: { backgroundColor: '#fef2f2', color: '#b91c1c', padding: 12, borderRadius: 12, marginTop: 12 },
  paywall: { backgroundColor: '#fefce8', borderRadius: 14, padding: 14, marginTop: 12 },
  payTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  payTxt: { fontSize: 14, color: '#555' },
  summary: { fontSize: 15, color: '#334155', backgroundColor: '#f1f5f9', padding: 12, borderRadius: 12, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#fff', fontWeight: '900' },
  title: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13, color: '#64748b' },
  secondary: { padding: 14, alignItems: 'center' },
  secondaryTxt: { color: '#475569', fontSize: 15 },
});
