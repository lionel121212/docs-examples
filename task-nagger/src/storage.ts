import AsyncStorage from '@react-native-async-storage/async-storage';
import { dateKey } from './dates';
import { ALL_DAYS, Category, DoneMap, Task } from './types';

const TASKS_KEY = 'tasks.v2';
const OLD_TASKS_KEY = 'tasks.v1';
const CATS_KEY = 'categories.v1';
const DONE_KEY = 'done.v1';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'health', name: 'בריאות והיגיינה', color: '#14b8a6' },
  { id: 'study', name: 'לימודים ופרויקטים', color: '#3b82f6' },
  { id: 'sport', name: 'ספורט', color: '#f97316' },
  { id: 'gaming', name: 'סימולטור', color: '#8b5cf6' },
];

/**
 * Daily plan. School ends at 14:30, so everything after school starts at 15:00 or later.
 * Everything here can be edited or deleted inside the app.
 */
function defaults(): Task[] {
  const createdAt = dateKey(new Date());
  const base = { icon: 'auto' as const, nagEveryMin: 5, nagCount: 6, enabled: true, createdAt };
  return [
    { ...base, id: 'breakfast', title: 'ארוחת בוקר', categoryId: 'health', color: '#22c55e', time: '07:00', days: ALL_DAYS },
    { ...base, id: 'face-am', title: 'לשטוף פנים', categoryId: 'health', color: '#14b8a6', time: '07:15', days: ALL_DAYS, nagEveryMin: 3 },
    { ...base, id: 'homework', title: 'שיעורי בית והכנה לבית ספר', categoryId: 'study', color: '#3b82f6', time: '15:00', days: ALL_DAYS },
    { ...base, id: 'bike', title: 'אימון אופניים', categoryId: 'sport', color: '#f97316', time: '16:00', days: [0, 2, 5] },
    {
      ...base, id: 'workout', title: 'אימון כושר', categoryId: 'sport', color: '#ef4444', time: '17:00', days: ALL_DAYS,
      exercises: [
        { id: 'ex-weights', name: 'הרמת משקולות', detail: '10 הרמות × 3 סטים · 6 ק״ג' },
        { id: 'ex-pushups', name: 'שכיבות סמיכה', detail: '80' },
        { id: 'ex-situps', name: 'כפיפות בטן', detail: '50' },
        { id: 'ex-plank', name: 'פלנק', detail: 'דקה אחת' },
      ],
    },
    { ...base, id: 'sim', title: 'אימון בסימולטור', categoryId: 'gaming', color: '#8b5cf6', time: '18:00', days: ALL_DAYS },
    { ...base, id: 'claude', title: 'לעבוד על פרויקטים בקלוד', categoryId: 'study', color: '#ec4899', time: '19:30', days: ALL_DAYS },
    { ...base, id: 'face-pm', title: 'לשטוף פנים לפני השינה', categoryId: 'health', color: '#0ea5e9', time: '22:30', days: ALL_DAYS, nagEveryMin: 3 },
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
