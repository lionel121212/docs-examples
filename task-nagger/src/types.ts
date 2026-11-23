export type IconKey =
  | 'face' | 'tooth' | 'simulator' | 'bike' | 'dumbbell' | 'run' | 'moon' | 'sun'
  | 'book' | 'drop' | 'pill' | 'laptop' | 'apple' | 'check';

export type Exercise = { id: string; name: string; detail: string };

export type Category = { id: string; name: string; color: string };

export type Task = {
  id: string;
  title: string;
  categoryId: string;
  /** accent color of the task */
  color: string;
  /** 'auto' = pick an illustration from the title */
  icon: IconKey | 'auto';
  /** optional photo (local file uri); overrides the illustration */
  imageUri?: string;
  /** "HH:MM" 24h */
  time: string;
  /** 0 = Sunday ... 6 = Saturday */
  days: number[];
  nagEveryMin: number;
  nagCount: number;
  enabled: boolean;
  /** optional checklist inside the task (e.g. workout exercises) */
  exercises?: Exercise[];
  /** YYYY-MM-DD: the yearly table only counts days from here on */
  createdAt: string;
};

/** key: `${taskId}|${YYYY-MM-DD}` */
export type DoneMap = Record<string, true>;

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const DAY_LABELS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
export const PALETTE = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'];
