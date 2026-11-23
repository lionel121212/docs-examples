import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_DAYS, DoneMap, Task } from './types';

const TASKS_KEY = 'tasks.v1';
const DONE_KEY = 'done.v1';

export const DEFAULT_TASKS: Task[] = [
  { id: 'face-am', title: 'לשטוף פנים', emoji: '🧼', time: '07:00', days: ALL_DAYS, nagEveryMin: 3, nagCount: 6, enabled: true },
  { id: 'sim', title: 'אימון בסימולטור', emoji: '🏎️', time: '17:00', days: [0, 1, 2, 3, 4], nagEveryMin: 5, nagCount: 6, enabled: true },
  { id: 'bike', title: 'אימון אופניים', emoji: '🚴', time: '18:30', days: [0, 2, 4], nagEveryMin: 5, nagCount: 6, enabled: true },
  { id: 'workout', title: 'אימון כללי', emoji: '💪', time: '20:00', days: [1, 3, 5], nagEveryMin: 5, nagCount: 6, enabled: true },
  { id: 'face-pm', title: 'לשטוף פנים לפני השינה', emoji: '🌙', time: '23:00', days: ALL_DAYS, nagEveryMin: 3, nagCount: 6, enabled: true },
];

export async function loadTasks(): Promise<Task[]> {
  try {
    const raw = await AsyncStorage.getItem(TASKS_KEY);
    if (raw) return JSON.parse(raw) as Task[];
  } catch {}
  return DEFAULT_TASKS;
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

export async function loadDone(): Promise<DoneMap> {
  try {
    const raw = await AsyncStorage.getItem(DONE_KEY);
    if (raw) return JSON.parse(raw) as DoneMap;
  } catch {}
  return {};
}

export async function saveDone(done: DoneMap): Promise<void> {
  await AsyncStorage.setItem(DONE_KEY, JSON.stringify(done));
}
