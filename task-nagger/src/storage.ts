import AsyncStorage from '@react-native-async-storage/async-storage';
import { dateKey } from './dates';
import { Lang, translate } from './i18n';
import { Category, DoneMap, Task } from './types';

const TASKS_KEY = 'tasks.v2';
const OLD_TASKS_KEY = 'tasks.v1';
const CATS_KEY = 'categories.v1';
const DONE_KEY = 'done.v1';

/** Base categories for a new user, named in their language. */
export function defaultCategories(lang: Lang): Category[] {
  return [
    { id: 'health', name: translate(lang, 'cat_health'), color: '#14b8a6' },
    { id: 'study', name: translate(lang, 'cat_study'), color: '#3b82f6' },
    { id: 'sport', name: translate(lang, 'cat_sport'), color: '#f97316' },
    { id: 'gaming', name: translate(lang, 'cat_hobby'), color: '#8b5cf6' },
    { id: 'other', name: translate(lang, 'cat_other'), color: '#64748b' },
  ];
}

/** null = nothing stored yet (first launch -> questionnaire). */
export async function loadTasks(): Promise<Task[] | null> {
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
  return null;
}

export const saveTasks = (t: Task[]) => AsyncStorage.setItem(TASKS_KEY, JSON.stringify(t));

export async function loadCategories(lang: Lang): Promise<Category[]> {
  try {
    const raw = await AsyncStorage.getItem(CATS_KEY);
    if (raw) return JSON.parse(raw) as Category[];
  } catch {}
  return defaultCategories(lang);
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
