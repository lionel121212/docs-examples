/** Account login, single-device sessions and cloud sync (talks to task-nagger-server). */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { getUserId, PLANNER_URL } from './server';
import { Category, DoneMap, Task } from './types';

const TOKEN_KEY = 'authToken';
const EMAIL_KEY = 'accountEmail';
const ID_KEY = 'accountId';

export type SyncData = { tasks: Task[]; categories: Category[]; done: DoneMap; lang?: string };

export type AuthResult =
  | { ok: true; token: string; email: string; id: string; premium: boolean }
  | { ok: false; error: 'other_device'; device: string }
  | {
      ok: false;
      error: 'wrong_credentials' | 'invalid_email' | 'weak_password' | 'email_taken' | 'too_many_attempts' | 'unavailable' | 'offline';
    };

/** Thrown by sync calls when another device took over the account. */
export class SessionRevoked extends Error {}

let memToken: string | null = null;

export async function getToken(): Promise<string | null> {
  if (memToken) return memToken;
  try {
    memToken = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    memToken = null;
  }
  return memToken;
}

export async function getEmail(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(EMAIL_KEY);
  } catch {
    return null;
  }
}

async function saveLogin(token: string, email: string, id: string) {
  memToken = token;
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await AsyncStorage.multiSet([
      [EMAIL_KEY, email],
      [ID_KEY, id],
    ]);
  } catch {}
}

export async function getAccountId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ID_KEY);
  } catch {
    return null;
  }
}

export async function clearLogin() {
  memToken = null;
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await AsyncStorage.multiRemove([EMAIL_KEY, ID_KEY, 'lastSyncAt']);
  } catch {}
}

/** Headers for any server call: device id, and the session token when logged in. */
export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return { 'x-app-user-id': await getUserId(), ...(token ? { authorization: `Bearer ${token}` } : {}) };
}

function deviceName(): string {
  return [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || Device.deviceName || 'Phone';
}

export async function authenticate(mode: 'login' | 'register', email: string, password: string, force = false): Promise<AuthResult> {
  if (!PLANNER_URL) return { ok: false, error: 'unavailable' };
  try {
    const res = await fetch(`${PLANNER_URL}/auth/${mode}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, deviceId: await getUserId(), deviceName: deviceName(), force }),
    });
    const j = (await res.json().catch(() => ({}))) as any;
    if (res.ok && j.token) {
      await saveLogin(j.token, j.user.email, j.user.id);
      return { ok: true, token: j.token, email: j.user.email, id: j.user.id, premium: !!j.user.premium };
    }
    if (j.error === 'other_device') return { ok: false, error: 'other_device', device: j.device || '?' };
    if (res.status === 503 || res.status === 404) return { ok: false, error: 'unavailable' };
    const known = ['wrong_credentials', 'invalid_email', 'weak_password', 'email_taken', 'too_many_attempts'];
    return { ok: false, error: known.includes(j.error) ? j.error : 'unavailable' };
  } catch {
    return { ok: false, error: 'offline' };
  }
}

export async function logout() {
  const token = await getToken();
  if (token && PLANNER_URL) {
    fetch(`${PLANNER_URL}/auth/logout`, { method: 'POST', headers: { authorization: `Bearer ${token}` } }).catch(() => {});
  }
  await clearLogin();
}

/** Server copy of the data. null = nothing stored yet. Throws SessionRevoked. */
export async function pullSync(): Promise<{ data: SyncData | null; updatedAt: number; premium: boolean } | null> {
  const token = await getToken();
  if (!token || !PLANNER_URL) return null;
  try {
    const res = await fetch(`${PLANNER_URL}/sync`, { headers: { authorization: `Bearer ${token}` } });
    if (res.status === 401) throw new SessionRevoked();
    if (!res.ok) return null;
    return (await res.json()) as { data: SyncData | null; updatedAt: number; premium: boolean };
  } catch (e) {
    if (e instanceof SessionRevoked) throw e;
    return null;
  }
}

/** Upload the current data (last write wins). Throws SessionRevoked. */
export async function pushSync(data: SyncData): Promise<number | null> {
  const token = await getToken();
  if (!token || !PLANNER_URL) return null;
  try {
    const res = await fetch(`${PLANNER_URL}/sync`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ data }),
    });
    if (res.status === 401) throw new SessionRevoked();
    if (!res.ok) return null;
    const j = (await res.json()) as { updatedAt: number };
    await AsyncStorage.setItem('lastSyncAt', String(j.updatedAt)).catch(() => {});
    return j.updatedAt;
  } catch (e) {
    if (e instanceof SessionRevoked) throw e;
    return null;
  }
}

export async function lastSyncAt(): Promise<number> {
  try {
    return Number((await AsyncStorage.getItem('lastSyncAt')) ?? '0');
  } catch {
    return 0;
  }
}

export async function markSynced(at: number) {
  await AsyncStorage.setItem('lastSyncAt', String(at)).catch(() => {});
}

/** Redeem a tester code on the account (Premium on every device of this account). */
export async function redeem(code: string): Promise<boolean> {
  const token = await getToken();
  if (!token || !PLANNER_URL) return false;
  try {
    const res = await fetch(`${PLANNER_URL}/redeem`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'x-access-code': code },
    });
    return res.ok;
  } catch {
    return false;
  }
}
