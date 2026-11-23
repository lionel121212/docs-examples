import AsyncStorage from '@react-native-async-storage/async-storage';
import { dateKey } from './dates';
import { ALL_DAYS, Category, DoneMap, Task } from './types';

const TASKS_KEY = 'tasks.v2';
const OLD_TASKS_KEY = 'tasks.v1';
const CATS_KEY = 'categories.v1';
const DONE_KEY = 'done.v1';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'health', name: 'בריאות והיגיינה', color: '#14b8a6' },
  { id: 'sport', name: 'ספורט', color: '#f97316' },
  { id: 'gaming', name: 'סימולטור', color: '#8b5cf6' },
];

function defaults(): Task[] {
  const createdAt = dateKey(new Date());
  const base = { icon: 'auto' as const, nagEveryMin: 5, nagCount: 6, enabled: true, createdAt };
  return [
    { ...base, id: 'face-am', title: 'לשטוף פנים', categoryId: 'health', color: '#14b8a6', time: '07:00', days: ALL_DAYS, nagEveryMin: 3 },
    { ...base, id: 'sim', title: 'אימון בסימולטור', categoryId: 'gaming', color: '#8b5cf6', time: '17:00', days: [0, 1, 2, 3, 4] },
    { ...base, id: 'bike', title: 'אימון אופניים', categoryId: 'sport', color: '#f97316', time: '18:30', days: [0, 2, 4] },
    { ...base, id: 'workout', title: 'אימון כושר', categoryId: 'sport', color: '#ef4444', time: '20:00', days: [1, 3, 5] },
    { ...base, id: 'face-pm', title: 'לשטוף פנים לפני השינה', categoryId: 'health', color: '#3b82f6', time: '23:00', days: ALL_DAYS, nagEveryMin: 3 },
  ];
}

export async function loadTasks(): Promise<Task[]> {
  try {
    const raw = await AsyncStorage.getItem(TASKS_KEY);
    if (raw) return JSON.parse(raw) as Task[];
    const old = await AsyncStorage.getItem(OLD_TASKS_KEY);
    if (old) {
      const createdAt = dateKey(new Date());
      return (JSON.parse(old) as any[]).map((t) => ({
        ...t,
        categoryId: 'health',
        color: '#3b82f6',
        icon: 'auto',
        createdAt,
      }));
    }
  } catch {}
  return defaults();
}

export const saveTasks = (t: Task[]) => AsyncStorage.setItem(TASKS_KEY, JSON.stringify(t));

export async function loadCategories(): Promise<Category[]> {
  try {
    const raw = await AsyncStorage.getItem(CATS_KEY);
    if (raw) return JSON.parse(raw) as Category[];
  } catch {}
  return DEFAULT_CATEGORIES;
}
export const saveCategories = (c: Category[]) => AsyncStorage.setItem(CATS_KEY, JSON.stringify(c));

export async function loadDone(): Promise<DoneMap> {
  try {
    const raw = await AsyncStorage.getItem(DONE_KEY);
    if (raw) return JSON.parse(raw) as DoneMap;
  } catch {}
  return {};
}
export const saveDone = (d: DoneMap) => AsyncStorage.setItem(DONE_KEY, JSON.stringify(d));
