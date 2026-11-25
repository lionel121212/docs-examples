import AsyncStorage from '@react-native-async-storage/async-storage';

/** Free users can keep this many tasks; Premium has no limit. */
export const FREE_TASK_LIMIT = 5;

export async function loadPremium(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem('premium')) === '1';
  } catch {
    return false;
  }
}

export async function savePremium(code: string): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      ['premium', '1'],
      ['accessCode', code],
    ]);
  } catch {}
}

/** How many of `adding` new tasks still fit for a free user (Infinity for Premium). */
export function roomFor(premium: boolean, current: number): number {
  return premium ? Infinity : Math.max(0, FREE_TASK_LIMIT - current);
}
