import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aurora, Orbit, Shimmer } from './fx';
import { analyze, Analysis, Goal, Life, Nag, Profile, Struggle, toTasks } from './analysis';
import { LANGS, StrKey, useI18n } from './i18n';
import { FREE_TASK_LIMIT } from './premium';
import { TaskIcon } from './TaskIcon';
import { Category, PALETTE, Task } from './types';

const LIFE: [Life, string][] = [
  ['school', '🎒'],
  ['uni', '🎓'],
  ['work', '💼'],
  ['army', '🪖'],
  ['parent', '👨‍👧'],
  ['other', '✨'],
];
const STRUGGLES: [Struggle, string][] = [
  ['procrast', '🐢'],
  ['forget', '🧠'],
  ['motivation', '🔋'],
  ['time', '⏳'],
  ['sleep', '😴'],
  ['phone', '📱'],
  ['focus', '🎯'],
];
const GOALS: [Goal, string][] = [
  ['fitness', '💪'],
  ['study', '📚'],
  ['sleep', '🌙'],
  ['health', '🧼'],
  ['food', '🥗'],
  ['projects', '🚀'],
  ['reading', '📖'],
  ['mind', '🧘'],
  ['hobby', '🎨'],
];
const FREE: [number, StrKey, string][] = [
  [30, 'f_30', '⏱️'],
  [60, 'f_60', '🕐'],
  [120, 'f_120', '🕑'],
  [180, 'f_180', '🕒'],
];
const NAGS: [Nag, StrKey, StrKey, string][] = [
  ['soft', 'n_soft', 'n_soft_d', '🙂'],
  ['norm', 'n_norm', 'n_norm_d', '🔔'],
  ['hard', 'n_hard', 'n_hard_d', '🚨'],
];

type Step = 'lang' | 'welcome' | 'life' | 'schedule' | 'struggle' | 'goals' | 'free' | 'nag' | 'analyzing' | 'results';

type Props = {
  categories: Category[];
  askLanguage: boolean;
  onFinish: (tasks: Task[], premium: boolean) => void;
  onSignIn?: () => void;
  openPaywall: () => Promise<boolean>;
};

const INDIGO = '#4f46e5';
/** how many tasks of an AI plan a free user gets (and sees unlocked in the preview) */
const FREE_VISIBLE = FREE_TASK_LIMIT;

/* ---------- small animated building blocks ---------- */

function Option({
  emoji,
  label,
  desc,
  selected,
  onPress,
  delay,
}: {
  emoji: string;
  label: string;
  desc?: string;
  selected: boolean;
  onPress: () => void;
  delay: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const appear = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 350, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [appear, delay]);
  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.94, duration: 70, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 3, tension: 160, useNativeDriver: true }),
    ]).start();
    onPress();
  };
  return (
    <Animated.View
      style={{ opacity: appear, transform: [{ scale }, { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}
    >
      <Pressable onPress={press} style={[s.option, selected && s.optionOn]}>
        <Text style={s.optEmoji}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[s.optLabel, selected && { color: '#fff' }]}>{label}</Text>
          {desc ? <Text style={s.optDesc}>{desc}</Text> : null}
        </View>
        <View style={[s.radio, selected && { backgroundColor: '#818cf8', borderColor: '#c7d2fe' }]}>
          {selected && <Text style={s.radioTick}>✓</Text>}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function TimeStepper({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const step = (d: number) => {
    const [h, m] = value.split(':').map(Number);
    const t = (((h * 60 + m + d) % 1440) + 1440) % 1440;
    onChange(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  };
  return (
    <View style={s.timeRow}>
      <Text style={s.timeLabel}>{label}</Text>
      <View style={s.stepper}>
        <Pressable onPress={() => step(-15)} style={s.stepBtn}>
          <Text style={s.stepTxt}>−</Text>
        </Pressable>
        <Text style={s.timeVal}>{value}</Text>
        <Pressable onPress={() => step(15)} style={s.stepBtn}>
          <Text style={s.stepTxt}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FadeIn({ delay, children }: { delay: number; children: React.ReactNode }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 450, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [a, delay]);
  return (
    <Animated.View style={{ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

/* ---------- analyzing screen ---------- */

function Analyzing({ onDone, run }: { onDone: (a: Analysis) => void; run: () => Promise<Analysis> }) {
  const { t } = useI18n();
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [stage, setStage] = useState(0);
  useEffect(() => {
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    ).start();
    const timers = [900, 1900, 2900].map((ms, i) => setTimeout(() => setStage(i + 1), ms));
    const minWait = new Promise((r) => setTimeout(r, 3300));
    let alive = true;
    Promise.all([run(), minWait]).then(([a]) => alive && onDone(a));
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const lines: StrKey[] = ['an_1', 'an_2', 'an_3'];
  return (
    <View style={s.center}>
      <Animated.View
        style={[
          s.pulse,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] }) }],
          },
        ]}
      />
      <View style={s.orbitWrap}>
        <Orbit size={190} />
      </View>
      <Animated.Text
        style={[s.sparkle, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}
      >
        ✨
      </Animated.Text>
      <Text style={s.anTitle}>{t('an_title')}</Text>
      <View style={{ marginTop: 22, gap: 12, alignSelf: 'stretch' }}>
        {lines.map((k, i) => (
          <View key={k} style={[s.anLine, { opacity: stage >= i ? 1 : 0.3 }]}>
            <Text style={s.anIcon}>{stage > i ? '✅' : stage === i ? '⏳' : '◽'}</Text>
            <Text style={s.anTxt}>{t(k)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ---------- main flow ---------- */

export function Onboarding({ categories, askLanguage, onFinish, onSignIn, openPaywall }: Props) {
  const { t, lang, setLang, dir, rtl, days } = useI18n();
  const insets = useSafeAreaInsets();
  const order: Step[] = [
    ...(askLanguage ? (['lang'] as Step[]) : []),
    'welcome',
    'life',
    'schedule',
    'struggle',
    'goals',
    'free',
    'nag',
    'analyzing',
    'results',
  ];
  const [step, setStep] = useState<Step>(order[0]);
  const [p, setP] = useState<Profile>({
    life: 'school',
    wake: '07:00',
    sleep: '23:00',
    busyFrom: '08:00',
    busyTo: '14:30',
    struggles: [],
    goals: [],
    freeMinutes: 60,
    nag: 'norm',
  });
  const [lifeChosen, setLifeChosen] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);

  const idx = order.indexOf(step);
  const questionSteps: Step[] = order.filter((x) => !['lang', 'welcome', 'analyzing', 'results'].includes(x));
  const qIdx = questionSteps.indexOf(step);

  // slide + fade between steps
  const anim = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(progress, {
      toValue: qIdx < 0 ? (step === 'results' || step === 'analyzing' ? 1 : 0) : (qIdx + 1) / questionSteps.length,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => setStep(order[Math.min(idx + 1, order.length - 1)]);
  const back = () => idx > 0 && setStep(order[idx - 1]);
  const toggle = <K extends 'struggles' | 'goals'>(k: K, v: Profile[K][number]) =>
    setP((x) => ({ ...x, [k]: (x[k] as string[]).includes(v) ? (x[k] as string[]).filter((y) => y !== v) : [...(x[k] as string[]), v] }));

  const colorFor = (cat: string, i: number) => categories.find((c) => c.id === cat)?.color ?? PALETTE[i % PALETTE.length];
  const finish = async (premium: boolean) => {
    if (!result) return;
    try {
      await AsyncStorage.setItem('profile', JSON.stringify(p));
    } catch {}
    // free users keep only the starter part of an AI plan; Premium gets all of it
    const plan = premium ? result.plan : result.plan.slice(0, FREE_VISIBLE);
    onFinish(toTasks(plan, p.nag, colorFor), premium);
  };

  const canNext =
    step === 'life' ? lifeChosen : step === 'struggle' ? p.struggles.length > 0 : step === 'goals' ? p.goals.length > 0 : true;

  const slide = {
    opacity: anim,
    transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [rtl ? -40 : 40, 0] }) }],
  };

  return (
    <View style={[s.root, { direction: dir, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <Aurora intensity={step === 'analyzing' ? 1.25 : 1} />
      {step !== 'lang' && step !== 'welcome' && step !== 'analyzing' && (
        <View style={s.topBar}>
          {step !== 'results' ? (
            <Pressable onPress={back} hitSlop={10}>
              <Text style={s.backTxt}>
                {rtl ? '→' : '←'} {t('ob_back')}
              </Text>
            </Pressable>
          ) : (
            <View />
          )}
          <View style={s.track}>
            <Animated.View style={[s.trackFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
          </View>
        </View>
      )}

      <Animated.View style={[{ flex: 1 }, slide]}>
        {step === 'lang' && (
          <ScrollView contentContainerStyle={s.body}>
            <Text style={s.bigEmoji}>🌍</Text>
            <Text style={s.q}>{t('ob_pick_lang')}</Text>
            {LANGS.map((l, i) => (
              <Option
                key={l.code}
                emoji={l.flag}
                label={l.name}
                selected={lang === l.code}
                delay={i * 60}
                onPress={() => setLang(l.code)}
              />
            ))}
          </ScrollView>
        )}

        {step === 'welcome' && <Welcome />}

        {step === 'life' && (
          <ScrollView contentContainerStyle={s.body}>
            <Text style={s.q}>{t('q_life')}</Text>
            {LIFE.map(([k, e], i) => (
              <Option
                key={k}
                emoji={e}
                label={t(`life_${k}` as StrKey)}
                delay={i * 60}
                selected={lifeChosen && p.life === k}
                onPress={() => {
                  setLifeChosen(true);
                  setP((x) => ({
                    ...x,
                    life: k,
                    ...(k === 'parent' || k === 'other'
                      ? { busyFrom: null, busyTo: null }
                      : k === 'work'
                        ? { busyFrom: '09:00', busyTo: '17:00' }
                        : x.busyFrom
                          ? {}
                          : { busyFrom: '08:00', busyTo: '14:30' }),
                  }));
                }}
              />
            ))}
          </ScrollView>
        )}

        {step === 'schedule' && (
          <ScrollView contentContainerStyle={s.body}>
            <Text style={s.bigEmoji}>🕰️</Text>
            <Text style={s.q}>{t('q_schedule')}</Text>
            <FadeIn delay={0}>
              <TimeStepper label={'☀️ ' + t('wake_at')} value={p.wake} onChange={(wake) => setP({ ...p, wake })} />
            </FadeIn>
            <FadeIn delay={80}>
              <TimeStepper label={'🌙 ' + t('sleep_at')} value={p.sleep} onChange={(sleep) => setP({ ...p, sleep })} />
            </FadeIn>
            {p.busyFrom && p.busyTo ? (
              <FadeIn delay={160}>
                <TimeStepper label={'🏫 ' + t('busy_from')} value={p.busyFrom} onChange={(busyFrom) => setP({ ...p, busyFrom })} />
                <TimeStepper label={t('busy_to')} value={p.busyTo} onChange={(busyTo) => setP({ ...p, busyTo })} />
              </FadeIn>
            ) : null}
            <FadeIn delay={240}>
              <Option
                emoji="🤸"
                label={t('no_fixed')}
                selected={!p.busyFrom}
                delay={0}
                onPress={() =>
                  setP((x) => (x.busyFrom ? { ...x, busyFrom: null, busyTo: null } : { ...x, busyFrom: '08:00', busyTo: '14:30' }))
                }
              />
            </FadeIn>
          </ScrollView>
        )}

        {step === 'struggle' && (
          <ScrollView contentContainerStyle={s.body}>
            <Text style={s.q}>{t('q_struggle')}</Text>
            <Text style={s.hint}>{t('q_multi')}</Text>
            {STRUGGLES.map(([k, e], i) => (
              <Option
                key={k}
                emoji={e}
                label={t(`st_${k}` as StrKey)}
                delay={i * 50}
                selected={p.struggles.includes(k)}
                onPress={() => toggle('struggles', k)}
              />
            ))}
          </ScrollView>
        )}

        {step === 'goals' && (
          <ScrollView contentContainerStyle={s.body}>
            <Text style={s.q}>{t('q_goals')}</Text>
            <Text style={s.hint}>{t('q_multi')}</Text>
            <View style={s.grid}>
              {GOALS.map(([k, e], i) => (
                <GoalTile
                  key={k}
                  emoji={e}
                  label={t(`g_${k}` as StrKey)}
                  delay={i * 45}
                  selected={p.goals.includes(k)}
                  onPress={() => toggle('goals', k)}
                />
              ))}
            </View>
          </ScrollView>
        )}

        {step === 'free' && (
          <ScrollView contentContainerStyle={s.body}>
            <Text style={s.bigEmoji}>⏳</Text>
            <Text style={s.q}>{t('q_free')}</Text>
            {FREE.map(([m, k, e], i) => (
              <Option
                key={m}
                emoji={e}
                label={t(k)}
                delay={i * 60}
                selected={p.freeMinutes === m}
                onPress={() => setP({ ...p, freeMinutes: m })}
              />
            ))}
          </ScrollView>
        )}

        {step === 'nag' && (
          <ScrollView contentContainerStyle={s.body}>
            <Text style={s.bigEmoji}>📳</Text>
            <Text style={s.q}>{t('q_nag')}</Text>
            {NAGS.map(([k, l, d, e], i) => (
              <Option
                key={k}
                emoji={e}
                label={t(l)}
                desc={t(d)}
                delay={i * 60}
                selected={p.nag === k}
                onPress={() => setP({ ...p, nag: k })}
              />
            ))}
          </ScrollView>
        )}

        {step === 'analyzing' && (
          <Analyzing
            run={() => analyze(p, lang)}
            onDone={(a) => {
              setResult(a);
              setStep('results');
            }}
          />
        )}

        {step === 'results' && result && (
          <ScrollView contentContainerStyle={[s.body, { paddingBottom: 30 }]} showsVerticalScrollIndicator={false}>
            <FadeIn delay={0}>
              <Text style={s.resTitle}>{t('res_title')} ✨</Text>
              <View style={s.insight}>
                <Text style={s.insightTxt}>{result.insight}</Text>
              </View>
            </FadeIn>

            <FadeIn delay={250}>
              <Text style={s.section}>{t('res_recs')}</Text>
              {result.recommendations.map((r, i) => (
                <View key={i} style={s.rec}>
                  <View style={s.recNum}>
                    <Text style={s.recNumTxt}>{i + 1}</Text>
                  </View>
                  <Text style={s.recTxt}>{r}</Text>
                </View>
              ))}
            </FadeIn>

            <FadeIn delay={500}>
              <Text style={s.section}>{t('res_plan')}</Text>
              <View style={s.planCard}>
                {result.plan.map((pt, i) => {
                  const locked = i >= FREE_VISIBLE;
                  const color = colorFor(pt.category, i);
                  return (
                    <View key={i} style={[s.planRow, locked && { opacity: 0.28 }]}>
                      <Text style={s.planTime}>{locked ? '••:••' : pt.time}</Text>
                      <TaskIcon task={{ title: pt.title, icon: 'auto', color }} size={36} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.planTitle} numberOfLines={1}>
                          {locked ? '█████ ███' : pt.title}
                        </Text>
                        <Text style={s.planDays}>{pt.days.length === 7 ? t('every_day') : pt.days.map((d) => days[d]).join(' ')}</Text>
                      </View>
                      {locked && <Text style={{ fontSize: 16 }}>🔒</Text>}
                    </View>
                  );
                })}
                {result.plan.length > FREE_VISIBLE && (
                  <Text style={s.lockedNote}>🔒 {t('res_locked', { n: result.plan.length - FREE_VISIBLE })}</Text>
                )}
              </View>
            </FadeIn>

            <FadeIn delay={750}>
              <View style={s.premium}>
                <Text style={s.premTitle}>{t('prem_name')}</Text>
                {(['prem_b0', 'prem_b1', 'prem_b2', 'prem_b3', 'prem_b4'] as StrKey[]).map((k) => (
                  <Text key={k} style={s.premB}>
                    ✓ {t(k)}
                  </Text>
                ))}
                <Pressable
                  style={s.premBtn}
                  onPress={async () => {
                    if (await openPaywall()) finish(true);
                  }}
                >
                  <Text style={s.premBtnTxt}>{t('prem_cta')}</Text>
                  <Shimmer delay={300} every={1800} />
                </Pressable>
              </View>
              <Pressable style={s.freeBtn} onPress={() => finish(false)}>
                <Text style={s.freeTxt}>{t('free_cta')}</Text>
              </Pressable>
              <Text style={s.freeNote}>{t('free_note', { n: FREE_TASK_LIMIT })}</Text>
            </FadeIn>
          </ScrollView>
        )}
      </Animated.View>

      {(step === 'welcome' || step === 'lang') && onSignIn && (
        <Pressable onPress={onSignIn} style={s.signIn}>
          <Text style={s.signInTxt}>{t('have_account')}</Text>
        </Pressable>
      )}
      {step !== 'analyzing' && step !== 'results' && (
        <Pressable style={[s.cta, !canNext && { opacity: 0.4 }]} disabled={!canNext} onPress={next}>
          <Text style={s.ctaTxt}>
            {step === 'welcome' ? t('ob_start') : t('ob_next')} {rtl ? '←' : '→'}
          </Text>
          {canNext && <Shimmer />}
        </Pressable>
      )}
    </View>
  );
}

function GoalTile({
  emoji,
  label,
  selected,
  onPress,
  delay,
}: {
  emoji: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  delay: number;
}) {
  const scale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, delay, friction: 6, useNativeDriver: true }).start();
  }, [scale, delay]);
  const bump = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ width: '31%', transform: [{ scale: Animated.multiply(scale, bump) }] }}>
      <Pressable
        onPress={() => {
          Animated.sequence([
            Animated.timing(bump, { toValue: 0.9, duration: 70, useNativeDriver: true }),
            Animated.spring(bump, { toValue: 1, friction: 3, tension: 160, useNativeDriver: true }),
          ]).start();
          onPress();
        }}
        style={[s.tile, selected && s.tileOn]}
      >
        <Text style={s.tileEmoji}>{emoji}</Text>
        <Text style={[s.tileLabel, selected && { color: '#fff' }]} numberOfLines={2}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function Welcome() {
  const { t } = useI18n();
  const float = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
  }, [float, pop]);
  return (
    <View style={s.center}>
      <Animated.View
        style={[
          s.logo,
          {
            transform: [
              { scale: pop },
              { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
              { rotate: float.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] }) },
            ],
          },
        ]}
      >
        <Text style={{ fontSize: 64 }}>🔔</Text>
      </Animated.View>
      <FadeIn delay={200}>
        <Text style={s.welcomeT}>{t('ob_welcome_t')}</Text>
      </FadeIn>
      <FadeIn delay={400}>
        <Text style={s.welcomeS}>{t('ob_welcome_s')}</Text>
      </FadeIn>
    </View>
  );
}

const GLASS = 'rgba(255,255,255,0.07)';
const GLASS_BORDER = 'rgba(255,255,255,0.14)';
const ON_BG = 'rgba(129,140,248,0.28)';
const ON_BORDER = '#a5b4fc';
const glow = (color: string) => ({
  shadowColor: color,
  shadowOpacity: 0.9,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 0 },
  elevation: 10,
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#090d24', paddingHorizontal: 20 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8, height: 32 },
  backTxt: { color: '#a5b4fc', fontSize: 15, fontWeight: '600' },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  trackFill: { height: 8, borderRadius: 4, backgroundColor: '#a5b4fc' },
  body: { paddingTop: 12, paddingBottom: 20, gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  bigEmoji: { fontSize: 48, textAlign: 'center', marginBottom: 4 },
  q: {
    fontSize: 27,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
    textShadowColor: '#818cf8',
    textShadowRadius: 18,
  },
  hint: { fontSize: 14, color: '#a5b4fc', textAlign: 'center', marginTop: -4, marginBottom: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: GLASS,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: GLASS_BORDER,
  },
  optionOn: { borderColor: ON_BORDER, backgroundColor: ON_BG, ...glow('#818cf8') },
  optEmoji: { fontSize: 28 },
  optLabel: { fontSize: 17, fontWeight: '700', color: '#f1f5f9' },
  optDesc: { fontSize: 13, color: '#a5b4fc', marginTop: 2 },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioTick: { color: '#fff', fontWeight: '900', fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  tile: {
    backgroundColor: GLASS,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: GLASS_BORDER,
    paddingVertical: 16,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 6,
    minHeight: 104,
    justifyContent: 'center',
  },
  tileOn: { backgroundColor: 'rgba(99,102,241,0.55)', borderColor: ON_BORDER, ...glow('#818cf8') },
  tileEmoji: { fontSize: 30 },
  tileLabel: { fontSize: 13, fontWeight: '700', color: '#e0e7ff', textAlign: 'center' },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GLASS,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1.5,
    borderColor: GLASS_BORDER,
    marginBottom: 10,
  },
  timeLabel: { fontSize: 16, fontWeight: '700', color: '#f1f5f9', flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4, direction: 'ltr' },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTxt: { fontSize: 22, color: '#fff', fontWeight: '800' },
  timeVal: { fontSize: 22, fontWeight: '900', width: 74, textAlign: 'center', color: '#fff' },
  cta: {
    backgroundColor: INDIGO,
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 8,
    overflow: 'hidden',
    ...glow('#6366f1'),
  },
  ctaTxt: { color: '#fff', fontSize: 18, fontWeight: '900' },
  logo: {
    width: 132,
    height: 132,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    ...glow('#a78bfa'),
  },
  welcomeT: { fontSize: 30, fontWeight: '900', textAlign: 'center', color: '#fff', textShadowColor: '#a78bfa', textShadowRadius: 20 },
  welcomeS: { fontSize: 16, color: '#c7d2fe', textAlign: 'center', marginTop: 12, lineHeight: 23 },
  pulse: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#6366f1', top: '28%' },
  orbitWrap: { position: 'absolute', top: '28%', width: 190, height: 190, alignItems: 'center', justifyContent: 'center', marginTop: -5 },
  sparkle: { fontSize: 70, marginBottom: 24 },
  anTitle: { fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 30 },
  anLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 14,
    padding: 14,
  },
  anIcon: { fontSize: 18 },
  anTxt: { fontSize: 16, fontWeight: '600', color: '#e0e7ff' },
  resTitle: { fontSize: 27, fontWeight: '900', color: '#fff', marginBottom: 10, textShadowColor: '#818cf8', textShadowRadius: 18 },
  insight: {
    backgroundColor: 'rgba(99,102,241,0.55)',
    borderWidth: 1,
    borderColor: '#a5b4fc',
    borderRadius: 20,
    padding: 18,
    ...glow('#6366f1'),
  },
  insightTxt: { color: '#fff', fontSize: 16, lineHeight: 24, fontWeight: '600' },
  section: { fontSize: 17, fontWeight: '900', color: '#fff', marginTop: 18, marginBottom: 8 },
  rec: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  recNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(165,180,252,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recNumTxt: { color: '#e0e7ff', fontWeight: '900' },
  recTxt: { flex: 1, fontSize: 15, color: '#e2e8f0', lineHeight: 21 },
  planCard: { backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 18, padding: 10 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  planTime: { width: 46, fontWeight: '800', color: '#64748b', fontSize: 13, textAlign: 'center' },
  planTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  planDays: { fontSize: 12, color: '#94a3b8' },
  lockedNote: { textAlign: 'center', color: INDIGO, fontWeight: '800', paddingTop: 8 },
  premium: {
    backgroundColor: 'rgba(30,27,75,0.92)',
    borderWidth: 1.5,
    borderColor: '#facc15',
    borderRadius: 22,
    padding: 18,
    marginTop: 18,
    ...glow('#facc15'),
  },
  premTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 8 },
  premB: { color: '#e0e7ff', fontSize: 15, marginVertical: 3, fontWeight: '600' },
  premBtn: { backgroundColor: '#facc15', borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 14, overflow: 'hidden' },
  premBtnTxt: { color: '#1e1b4b', fontSize: 17, fontWeight: '900' },
  premSoon: { color: '#c7d2fe', fontSize: 14, lineHeight: 20 },
  codeRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  codeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#4338ca',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
  },
  codeBtn: { backgroundColor: '#facc15', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  codeBtnTxt: { color: '#1e1b4b', fontWeight: '900' },
  codeErr: { color: '#fca5a5', marginTop: 6 },
  signIn: { paddingVertical: 12, alignItems: 'center' },
  signInTxt: { color: '#c7d2fe', fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
  freeBtn: { paddingVertical: 16, alignItems: 'center', marginTop: 6 },
  freeTxt: { color: '#e0e7ff', fontSize: 16, fontWeight: '800', textDecorationLine: 'underline' },
  freeNote: { color: '#a5b4fc', fontSize: 12, textAlign: 'center' },
});
