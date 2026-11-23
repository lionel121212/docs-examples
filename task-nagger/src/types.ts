export type Task = {
  id: string;
  title: string;
  emoji: string;
  /** "HH:MM" 24h */
  time: string;
  /** 0 = Sunday ... 6 = Saturday */
  days: number[];
  /** minutes between nag reminders */
  nagEveryMin: number;
  /** how many nag reminders after the first one */
  nagCount: number;
  enabled: boolean;
};

/** key: `${taskId}|${YYYY-MM-DD}` */
export type DoneMap = Record<string, true>;

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const DAY_LABELS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
