import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, useColorScheme, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { dateKey, doneKey } from './src/dates';
import {
  SessionRevoked,
  SyncData,
  clearLogin,
  getAccountId,
  getEmail,
  getToken,
  lastSyncAt,
  logout,
  markSynced,
  pullSync,
  pushSync,
} from './src/account';
import { AccountScreen } from './src/AccountScreen';
import { Buddy, listBuddies, reportProgress } from './src/buddies';
import { BuddyScreen } from './src/BuddyScreen';
import { identify, initBilling } from './src/billing';
import { AchievementPopup } from './src/AchievementPopup';
import { Achievement, achievements, loadEarned, saveEarned } from './src/achievements';
import { Paywall } from './src/Paywall';
import { WeeklySummary } from './src/WeeklySummary';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { renderNextTaskWidget, WIDGET_NAME } from './src/widget/handler';
import { Platform } from 'react-native';
import { getUserId } from './src/server';
import { I18nProvider, Lang, LANGS, translate, useI18n } from './src/i18n';
import { Onboarding } from './src/Onboarding';
import { FREE_TASK_LIMIT, loadPremium, roomFor } from './src/premium';
import { DEFAULT_PREFS, loadPrefs, loadSnooze, Prefs, savePrefs, saveSnooze, SnoozeMap } from './src/prefs';
import { cancelTodaysNags, rescheduleAll, setupNotifications } from './src/scheduler';
import { Settings } from './src/Settings';
import { defaultCategories, loadCategories, loadDone, loadTasks, saveCategories, saveDone, saveTasks } from './src/storage';
import { TaskEditor } from './src/TaskEditor';
import { Category, DoneMap, PALETTE, Task } from './src/types';
import { AIPlanner } from './src/AIPlanner';
import { WeekTable } from './src/WeekTable';
import { Row, Status, TodayView } from './src/TodayView';
import { summarize } from './src/stats';
import { YearView } from './src/YearView';
import { DARK, LIGHT, Palette, ThemeProvider } from './src/theme';

function statusFor(t: Task, done: DoneMap, now: Date): Status {
  if (!t.enabled || !t.days.includes(now.getDay())) return 'none';
  if (done[doneKey(t.id, now)]) return 'done';
  const [h, m] = t.time.split(':').map(Number);
  const due = now >= new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  // a task created today whose time already passed starts tomorrow, it isn't "late" on day one
  if (due && t.createdAt === dateKey(now)) return 'none';
  return due ? 'late' : 'pending';
}

function newTask(categoryId: string): Task {
  return {
    id: String(Date.now()),
    title: '',
    categoryId,
    color: PALETTE[5],
    icon: 'auto',
    time: '09:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    nagEveryMin: 5,
    nagCount: 6,
    enabled: true,
    createdAt: dateKey(new Date()),
  };
}

const DEFAULT_CAT_KEYS = { health: 'cat_health', study: 'cat_study', sport: 'cat_sport', gaming: 'cat_hobby', other: 'cat_other' } as const;

function Main() {
  const systemScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { t, lang, dir, setLang } = useI18n();
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [onboarding, setOnboarding] = useState<null | { first: boolean }>(null);
  const [settings, setSettings] = useState(false);
  const [premium, setPremium] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const paywallDone = useRef<((ok: boolean) => void) | null>(null);
  /** Opens the paywall; resolves true when the user ends up Premium. */
  const openPaywall = () =>
    new Promise<boolean>((resolve) => {
      paywallDone.current = resolve;
      setPaywall(true);
    });
  const closePaywall = (ok: boolean) => {
    setPaywall(false);
    paywallDone.current?.(ok);
    paywallDone.current = null;
  };
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

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const C = prefs.theme === 'dark' || (prefs.theme === 'system' && systemScheme === 'dark') ? DARK : LIGHT;
  const s = useMemo(() => makeStyles(C), [C]);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const snoozeRef = useRef<SnoozeMap>({});
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [newAch, setNewAch] = useState<Achievement | null>(null);
  const [buddyOpen, setBuddyOpen] = useState(false);
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const earnedRef = useRef<string[] | null>(null);
  const langRef = useRef(lang);
  langRef.current = lang;
  const resync = useCallback(async (list: Task[], d: DoneMap) => {
    try {
      await rescheduleAll(list, d, langRef.current, { prefs: prefsRef.current, snooze: snoozeRef.current });
    } catch (e) {
      console.warn('schedule failed', e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const [stored, d, c, prem, pr, sn] = await Promise.all([
        loadTasks(),
        loadDone(),
        loadCategories(langRef.current),
        loadPremium(),
        loadPrefs(),
        loadSnooze(),
      ]);
      setPrefs(pr);
      prefsRef.current = pr;
      snoozeRef.current = sn;
      setDone(d);
      setCategories(c);
      setPremium(prem);
      if (stored === null) {
        setOnboarding({ first: true }); // first launch -> questionnaire
      } else {
        setTasks(stored);
        setGranted(await setupNotifications(langRef.current));
        await resync(stored, d);
      }
      if ((await getToken()) && (await getEmail())) {
        setAccountEmail(await getEmail());
        pullIfNewer();
      }
      // store subscriptions: identity = account id when logged in, else this device
      const storeId = (await getAccountId()) ?? (await getUserId());
      if (await initBilling(storeId, (p) => p && setPremium(true))) setPremium(true);
      setReady(true);
    })();
  }, [resync]); // eslint-disable-line react-hooks/exhaustive-deps

  // language switch: rename the built-in categories and re-send notifications in the new language
  const prevLang = useRef(lang);
  useEffect(() => {
    if (!ready || prevLang.current === lang) return;
    const old = prevLang.current;
    prevLang.current = lang;
    const renamed = categories.map((c) => {
      const key = DEFAULT_CAT_KEYS[c.id as keyof typeof DEFAULT_CAT_KEYS];
      return key && LANGS.some((l) => translate(l.code, key) === c.name) ? { ...c, name: translate(lang, key) } : c;
    });
    setCategories(renamed);
    saveCategories(renamed).catch(() => {});
    setupNotifications(lang).catch(() => {});
    resync(latest.current.tasks, latest.current.done);
    void old;
  }, [lang, ready]); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    const handle = (r: Notifications.NotificationResponse | null) => {
      if (!r) return;
      setNow(new Date());
      const data = (r.notification.request.content.data ?? {}) as { taskId?: string; kind?: string };
      if (data.kind === 'weekly') {
        setSummaryOpen(true);
        return;
      }
      setTab('today');
      const task = latest.current.tasks.find((x) => x.id === data.taskId);
      if (!task) return;
      if (r.actionIdentifier === 'done') {
        setTaskDone(task, new Date(), true);
      } else if (r.actionIdentifier === 'snooze') {
        const key = doneKey(task.id, new Date());
        snoozeRef.current = { ...snoozeRef.current, [key]: Date.now() + 10 * 60_000 };
        saveSnooze(snoozeRef.current);
        Notifications.dismissNotificationAsync(r.notification.request.identifier).catch(() => {});
        resync(latest.current.tasks, latest.current.done);
      }
    };
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    // the app may have been started by tapping a button on a notification
    if (ready) handle(Notifications.getLastNotificationResponse());
    return () => sub.remove();
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // detect newly earned achievements (the first run only records what is already earned)
  useEffect(() => {
    if (!ready || onboarding) return;
    (async () => {
      if (earnedRef.current === null)
        earnedRef.current =
          (await loadEarned()) ??
          achievements(tasks, done)
            .filter((a) => a.earned)
            .map((a) => a.id);
      const earned = achievements(tasks, done).filter((a) => a.earned);
      const fresh = earned.find((a) => !earnedRef.current!.includes(a.id));
      if (fresh) setNewAch(fresh);
      earnedRef.current = earned.map((a) => a.id);
      saveEarned(earnedRef.current);
    })();
  }, [done, tasks, ready, onboarding]); // eslint-disable-line react-hooks/exhaustive-deps

  // keep the home-screen widget in step with the app
  useEffect(() => {
    if (!ready || Platform.OS !== 'android') return;
    requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: renderNextTaskWidget }).catch(() => {});
  }, [tasks, done, lang, ready]);

  const updatePrefs = (p: Prefs) => {
    setPrefs(p);
    prefsRef.current = p;
    savePrefs(p);
    resync(latest.current.tasks, latest.current.done);
  };

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
    if (wasOn) delete next[k];
    else next[k] = true;
    const all = (t.exercises ?? []).every((e) => next[doneKey(`${t.id}#${e.id}`, date)]);
    if (all) next[doneKey(t.id, date)] = true;
    else delete next[doneKey(t.id, date)];
    if (all) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    else Haptics.selectionAsync().catch(() => {});
    await commitDone(next, t, date, all);
  };

  /* ---------- account + cloud sync ---------- */
  const applying = useRef(false);
  const accountRef = useRef(accountEmail);
  accountRef.current = accountEmail;

  const onRevoked = async () => {
    await clearLogin();
    setAccountEmail(null);
    setPremium(await loadPremium());
    Alert.alert(t('revoked_title'), t('revoked_body'));
  };

  /** Replace local data with the account's copy (used after login on a new phone). */
  const applyRemote = async (d: SyncData) => {
    applying.current = true;
    setTasks(d.tasks);
    setCategories(d.categories);
    setDone(d.done);
    await Promise.all([saveTasks(d.tasks), saveCategories(d.categories), saveDone(d.done)]);
    if (d.lang && LANGS.some((l) => l.code === d.lang)) setLang(d.lang as Lang);
    await resync(d.tasks, d.done);
    setTimeout(() => (applying.current = false), 3500);
  };

  async function pullIfNewer() {
    listBuddies()
      .then(setBuddies)
      .catch(() => {});
    try {
      const r = await pullSync();
      if (!r) return;
      if (r.premium) setPremium(true);
      if (r.data && r.updatedAt > (await lastSyncAt())) {
        await applyRemote(r.data);
        await markSynced(r.updatedAt);
      }
    } catch (e) {
      if (e instanceof SessionRevoked) onRevoked();
    }
  }

  // push local changes (debounced) while logged in
  useEffect(() => {
    if (!accountEmail || !ready || onboarding || applying.current) return;
    const timer = setTimeout(() => {
      reportProgress(tasks, done).catch(() => {});
      pushSync({ tasks, categories, done, lang }).catch((e) => {
        if (e instanceof SessionRevoked) onRevoked();
      });
    }, 2500);
    return () => clearTimeout(timer);
  }, [tasks, categories, done, lang, accountEmail, ready, onboarding]); // eslint-disable-line react-hooks/exhaustive-deps

  const onLoggedIn = async (email: string, accountId: string, isPremium: boolean) => {
    setAccountEmail(email);
    setAccountOpen(false);
    if (isPremium || (await identify(accountId))) setPremium(true);
    try {
      const r = await pullSync();
      if (r?.data && r.data.tasks?.length) {
        // switching phones: the account's tasks win
        await applyRemote(r.data);
        await markSynced(r.updatedAt);
        setOnboarding(null);
      } else if (!onboarding) {
        await pushSync({ tasks: latest.current.tasks, categories, done: latest.current.done, lang });
      }
    } catch (e) {
      if (e instanceof SessionRevoked) onRevoked();
    }
  };

  const paywallScreen = (
    <Paywall
      visible={paywall}
      accountEmail={accountEmail}
      onClose={() => closePaywall(false)}
      onPremium={() => {
        setPremium(true);
        closePaywall(true);
      }}
    />
  );

  const accountScreen = (
    <AccountScreen
      visible={accountOpen}
      email={accountEmail}
      onClose={() => setAccountOpen(false)}
      onLoggedIn={(r) => onLoggedIn(r.email, r.id, r.premium)}
      onLogout={async () => {
        await logout();
        setAccountEmail(null);
        setPremium((await loadPremium()) || (await identify(await getUserId())));
        setAccountOpen(false);
      }}
    />
  );

  /** Free users keep up to FREE_TASK_LIMIT tasks; returns false (and explains) when there is no room. */
  const ensureRoom = (adding = 1) => {
    if (roomFor(premium, tasks.length) >= adding) return true;
    Alert.alert(t('limit_title'), t('limit_body', { n: FREE_TASK_LIMIT }), [
      { text: t('ok'), style: 'cancel' },
      { text: t('go_premium'), onPress: () => openPaywall() },
    ]);
    return false;
  };
  const openNewTask = () => {
    if (ensureRoom()) setEditing({ task: newTask(categories[0]?.id ?? 'health'), isNew: true });
  };

  const rows: Row[] = useMemo(
    () => tasks.map((t) => ({ ...t, status: statusFor(t, done, now) })).sort((a, b) => a.time.localeCompare(b.time)),
    [tasks, done, now],
  );
  const streak = useMemo(() => summarize(now.getFullYear(), tasks, done, now).streak, [tasks, done, now]);

  if (!ready)
    return (
      <View style={s.center}>
        <Text>{t('loading')}</Text>
      </View>
    );

  if (onboarding) {
    const cats = categories.length ? categories : defaultCategories(lang);
    return (
      <>
        <Onboarding
          categories={cats}
          askLanguage={onboarding.first}
          onSignIn={onboarding.first ? () => setAccountOpen(true) : undefined}
          openPaywall={openPaywall}
          onFinish={async (added, isPremium) => {
            const prem = premium || isPremium;
            setPremium(prem);
            // first run: start from the base categories in the chosen language
            const nextCats = onboarding.first ? defaultCategories(lang) : cats;
            setCategories(nextCats);
            await saveCategories(nextCats);
            setOnboarding(null);
            setTab('today');
            setGranted(await setupNotifications(lang));
            await persistTasks(onboarding.first ? added : [...tasks, ...added.slice(0, roomFor(prem, tasks.length))]);
          }}
        />
        {accountScreen}
        {paywallScreen}
      </>
    );
  }

  return (
    <ThemeProvider mode={prefs.theme}>
      <View style={[s.root, { paddingTop: insets.top + 10, direction: dir }]}>
        <StatusBar style={C.dark ? 'light' : 'dark'} />
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
            onAdd={openNewTask}
            onAI={() => setPlanner(true)}
            onSettings={() => setSettings(true)}
            buddyLines={buddies
              .filter((b) => b.status === 'accepted')
              .map((b) =>
                b.yesterday && b.yesterday.done < b.yesterday.total
                  ? t('buddy_missed', { name: b.name, n: b.yesterday.total - b.yesterday.done })
                  : b.today
                    ? t('buddy_today', { name: b.name, done: b.today.done, total: b.today.total })
                    : '',
              )
              .filter(Boolean)}
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
          <YearView tasks={tasks} done={done} categories={categories} onSummary={() => setSummaryOpen(true)} />
        )}

        {tab === 'table' && (
          <Pressable
            style={[s.fab, { bottom: insets.bottom + 84 }]}
            onPress={openNewTask}
            accessibilityRole="button"
            accessibilityLabel={t('a11y_add')}
          >
            <Text style={s.fabTxt}>{t('add_task')}</Text>
          </Pressable>
        )}

        <View style={[s.tabs, { paddingBottom: insets.bottom + 8 }]}>
          <Pressable style={s.tab} onPress={() => setTab('today')}>
            <Text style={[s.tabTxt, tab === 'today' && s.tabOn]}>{t('tab_today')}</Text>
          </Pressable>
          <Pressable style={s.tab} onPress={() => setTab('table')}>
            <Text style={[s.tabTxt, tab === 'table' && s.tabOn]}>{t('tab_table')}</Text>
          </Pressable>
          <Pressable style={s.tab} onPress={() => setTab('year')}>
            <Text style={[s.tabTxt, tab === 'year' && s.tabOn]}>{t('tab_year')}</Text>
          </Pressable>
        </View>

        <Settings
          prefs={prefs}
          onPrefs={updatePrefs}
          onBuddy={() => {
            setSettings(false);
            setBuddyOpen(true);
          }}
          onUpgrade={() => {
            setSettings(false);
            openPaywall();
          }}
          visible={settings}
          premium={premium}
          taskCount={tasks.length}
          onPremium={() => setPremium(true)}
          accountEmail={accountEmail}
          onAccount={() => {
            setSettings(false);
            setAccountOpen(true);
          }}
          onClose={() => setSettings(false)}
          onRedoQuiz={() => {
            setSettings(false);
            setOnboarding({ first: false });
          }}
        />
        {accountScreen}
        {paywallScreen}
        <WeeklySummary
          visible={summaryOpen}
          tasks={tasks}
          done={done}
          premium={premium}
          onClose={() => setSummaryOpen(false)}
          onUpgrade={() => {
            setSummaryOpen(false);
            openPaywall();
          }}
        />
        <AchievementPopup achievement={newAch} onClose={() => setNewAch(null)} />
        <BuddyScreen
          visible={buddyOpen}
          loggedIn={!!accountEmail}
          onClose={() => {
            setBuddyOpen(false);
            listBuddies()
              .then(setBuddies)
              .catch(() => {});
          }}
          onSignIn={() => {
            setBuddyOpen(false);
            setAccountOpen(true);
          }}
        />
        <AIPlanner
          onUpgrade={() => {
            setPlanner(false);
            openPaywall();
          }}
          visible={planner}
          categories={categories}
          onClose={() => setPlanner(false)}
          onAdd={async (added, replace) => {
            setPlanner(false);
            setPremium(true); // the planner only answers Premium users
            AsyncStorage.setItem('premium', '1').catch(() => {});
            if (added.some((x) => x.categoryId === 'other') && !categories.some((c) => c.id === 'other')) {
              const next = [...categories, { id: 'other', name: t('cat_other'), color: '#64748b' }];
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
          onDelete={async (id) => {
            setEditing(null);
            await persistTasks(tasks.filter((x) => x.id !== id));
          }}
        />
      </View>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <Main />
      </I18nProvider>
    </SafeAreaProvider>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    fab: {
      position: 'absolute',
      alignSelf: 'center',
      backgroundColor: '#4f46e5',
      paddingHorizontal: 26,
      paddingVertical: 14,
      borderRadius: 30,
      elevation: 6,
    },
    fabTxt: { color: '#fff', fontSize: 17, fontWeight: '700' },
    tabs: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      backgroundColor: C.card,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
    tabTxt: { fontSize: 15, color: C.faint, fontWeight: '700' },
    tabOn: { color: C.text },
  });
