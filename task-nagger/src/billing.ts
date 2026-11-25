/**
 * Store subscriptions through RevenueCat (Google Play Billing / App Store).
 * The public SDK keys live in app.json -> extra.revenuecatAndroidKey / revenuecatIosKey.
 * The app user id is the account id when logged in, otherwise this device's id, so the
 * server can confirm the same subscription with RevenueCat.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

export const ENTITLEMENT = 'premium';

const extra = (Constants.expoConfig?.extra ?? {}) as { revenuecatAndroidKey?: string; revenuecatIosKey?: string };
const API_KEY = (Platform.OS === 'ios' ? extra.revenuecatIosKey : extra.revenuecatAndroidKey) ?? '';

let configured = false;
let currentId: string | null = null;

export const billingAvailable = () => !!API_KEY && Platform.OS !== 'web';

const isPremium = (info: CustomerInfo) => !!info.entitlements.active[ENTITLEMENT];

/** Call once at start. `onChange` fires whenever the subscription state changes. */
export async function initBilling(appUserID: string, onChange: (premium: boolean) => void): Promise<boolean> {
  if (!billingAvailable()) return false;
  try {
    if (!configured) {
      Purchases.configure({ apiKey: API_KEY, appUserID });
      Purchases.addCustomerInfoUpdateListener((info) => onChange(isPremium(info)));
      configured = true;
      currentId = appUserID;
    } else if (currentId !== appUserID) {
      await Purchases.logIn(appUserID);
      currentId = appUserID;
    }
    return isPremium(await Purchases.getCustomerInfo());
  } catch {
    return false;
  }
}

/** Switch the store identity (after login / logout). Returns whether that identity has Premium. */
export async function identify(appUserID: string): Promise<boolean> {
  if (!configured || currentId === appUserID) return false;
  try {
    const { customerInfo } = await Purchases.logIn(appUserID);
    currentId = appUserID;
    return isPremium(customerInfo);
  } catch {
    return false;
  }
}

export type Plan = { pkg: PurchasesPackage; price: string; perMonth: string | null; amount: number };
export type Plans = { monthly: Plan | null; annual: Plan | null };

export async function getPlans(): Promise<Plans> {
  if (!configured) return { monthly: null, annual: null };
  try {
    const current = (await Purchases.getOfferings()).current;
    const wrap = (pkg: PurchasesPackage | null): Plan | null =>
      pkg ? { pkg, price: pkg.product.priceString, perMonth: pkg.product.pricePerMonthString ?? null, amount: pkg.product.price } : null;
    return { monthly: wrap(current?.monthly ?? null), annual: wrap(current?.annual ?? null) };
  } catch {
    return { monthly: null, annual: null };
  }
}

/** Percentage saved by the yearly plan compared with 12 monthly payments. */
export function yearlySaving(p: Plans): number {
  if (!p.monthly || !p.annual || !p.monthly.amount) return 0;
  return Math.max(0, Math.round((1 - p.annual.amount / (p.monthly.amount * 12)) * 100));
}

export async function buy(plan: Plan): Promise<'ok' | 'cancelled' | 'error'> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(plan.pkg);
    return isPremium(customerInfo) ? 'ok' : 'error';
  } catch (e) {
    return (e as { userCancelled?: boolean }).userCancelled ? 'cancelled' : 'error';
  }
}

export async function restore(): Promise<boolean> {
  if (!configured) return false;
  try {
    return isPremium(await Purchases.restorePurchases());
  } catch {
    return false;
  }
}
