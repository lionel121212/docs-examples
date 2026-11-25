import { getToken, SessionRevoked } from './account';
import { dateKey } from './dates';
import { PLANNER_URL } from './server';
import { dayInfo } from './stats';
import { DoneMap, Task } from './types';

export type Buddy = {
  id: string;
  name: string;
  status: 'pending' | 'accepted';
  incoming: boolean;
  today: { done: number; total: number } | null;
  yesterday: { done: number; total: number } | null;
};

async function call(path: string, method = 'GET', body?: unknown): Promise<Response | null> {
  const token = await getToken();
  if (!token || !PLANNER_URL) return null;
  const res = await fetch(`${PLANNER_URL}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) throw new SessionRevoked();
  return res;
}

const yesterdayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);

export async function listBuddies(): Promise<Buddy[]> {
  const now = new Date();
  try {
    const res = await call(`/buddy?today=${dateKey(now)}&yesterday=${dateKey(yesterdayOf(now))}`);
    if (!res?.ok) return [];
    return ((await res.json()) as { buddies: Buddy[] }).buddies;
  } catch (e) {
    if (e instanceof SessionRevoked) throw e;
    return [];
  }
}

export async function requestBuddy(email: string): Promise<'ok' | 'not_found' | 'error'> {
  try {
    const res = await call('/buddy/request', 'POST', { email });
    return res?.ok ? 'ok' : res?.status === 404 ? 'not_found' : 'error';
  } catch {
    return 'error';
  }
}

export const acceptBuddy = (id: string) => call('/buddy/accept', 'POST', { id }).catch(() => null);
export const removeBuddy = (id: string) => call('/buddy/remove', 'POST', { id }).catch(() => null);

/** Share today's and yesterday's progress with buddies. */
export async function reportProgress(tasks: Task[], done: DoneMap) {
  const now = new Date();
  const days = [yesterdayOf(now), now].map((d) => {
    const info = dayInfo(d, tasks, done);
    return { day: dateKey(d), done: info.doneTasks.length, total: info.scheduled.length };
  });
  try {
    await call('/report', 'PUT', { days });
  } catch (e) {
    if (e instanceof SessionRevoked) throw e;
  }
}
