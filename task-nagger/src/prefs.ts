import AsyncStorage from '@react-native-async-storage/async-storage';

/** Notification preferences (device-local). */
export type Prefs = {
  quiet: { enabled: boolean; from: string; to: string };
  shabbat: boolean;
  theme: 'system' | 'light' | 'dark';
};

export const DEFAULT_PREFS: Prefs = { quiet: { enabled: false, from: '23:00', to: '07:00' }, shabbat: false, theme: 'system' };

export async function loadPrefs(): Promise<Prefs> {
  try {
    const raw = await AsyncStorage.getItem('prefs');
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_PREFS;
}

export const savePrefs = (p: Prefs) => AsyncStorage.setItem('prefs', JSON.stringify(p)).catch(() => {});

/** taskId|YYYY-MM-DD -> snoozed until (ms) */
export type SnoozeMap = Record<string, number>;

export async function loadSnooze(): Promise<SnoozeMap> {
  try {
    const raw = await AsyncStorage.getItem('snooze');
    const all = raw ? (JSON.parse(raw) as SnoozeMap) : {};
    const now = Date.now();
    // drop old entries
    return Object.fromEntries(Object.entries(all).filter(([, until]) => until > now - 86_400_000));
  } catch {
    return {};
  }
}

export const saveSnooze = (s: SnoozeMap) => AsyncStorage.setItem('snooze', JSON.stringify(s)).catch(() => {});
