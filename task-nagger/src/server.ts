import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export const PLANNER_URL: string = ((Constants.expoConfig?.extra as any)?.plannerUrl ?? '').replace(/\/$/, '');

export async function getUserId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem('userId');
    if (existing) return existing;
    const id = 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    await AsyncStorage.setItem('userId', id);
    return id;
  } catch {
    return 'anonymous';
  }
}
