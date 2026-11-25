import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { authenticate, AuthResult } from './account';
import { StrKey, useI18n } from './i18n';
import { Palette, useStyles, useTheme } from './theme';

type Props = {
  visible: boolean;
  email: string | null; // logged-in email, null when signed out
  onClose: () => void;
  onLoggedIn: (r: Extract<AuthResult, { ok: true }>) => void;
  onLogout: () => void;
};

const ERRORS: Record<string, StrKey> = {
  wrong_credentials: 'err_wrong',
  invalid_email: 'err_email',
  weak_password: 'err_weak',
  email_taken: 'err_taken',
  too_many_attempts: 'err_many',
  unavailable: 'err_unavailable',
  offline: 'offline',
};

export function AccountScreen({ visible, email, onClose, onLoggedIn, onLogout }: Props) {
  const s = useStyles(makeStyles);
  const C = useTheme();
  const { t, dir } = useI18n();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [mail, setMail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // set when another device holds the account: we ask before kicking it out
  const [conflict, setConflict] = useState<string | null>(null);
  const [confirmPassword, setConfirmPassword] = useState('');

  const reset = () => {
    setPassword('');
    setConfirmPassword('');
    setConflict(null);
    setError(null);
  };

  const submit = async (force = false) => {
    setBusy(true);
    setError(null);
    const r = await authenticate(mode, mail.trim(), force ? confirmPassword : password, force);
    setBusy(false);
    if (r.ok) {
      reset();
      onLoggedIn(r);
      return;
    }
    if (r.error === 'other_device') {
      // ask first; the password has to be typed again to confirm
      setConflict(r.device);
      setConfirmPassword('');
      return;
    }
    setError(t(ERRORS[r.error] ?? 'went_wrong'));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: C.bg, direction: dir }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
          <Text style={s.h1}>👤 {t('account')}</Text>

          {email ? (
            <>
              <View style={s.card}>
                <Text style={s.me}>{t('logged_in_as', { email })}</Text>
                <Text style={s.note}>{t('synced')}</Text>
                <Text style={s.note}>{t('one_device_note')}</Text>
              </View>
              <Pressable
                style={s.logout}
                onPress={() => {
                  reset();
                  onLogout();
                }}
              >
                <Text style={s.logoutTxt}>{t('logout')}</Text>
              </Pressable>
            </>
          ) : conflict ? (
            <View style={[s.card, s.warnCard]}>
              <Text style={s.warnTitle}>📱 {t('other_device_title')}</Text>
              <Text style={s.warnBody}>{t('other_device_body', { device: conflict })}</Text>
              <Text style={s.label}>{t('reenter_password')}</Text>
              <TextInput
                style={s.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoFocus
                placeholder={t('password')}
                autoCapitalize="none"
              />
              {error && <Text style={s.error}>{error}</Text>}
              <Pressable
                style={[s.danger, (confirmPassword.length < 8 || busy) && { opacity: 0.5 }]}
                disabled={confirmPassword.length < 8 || busy}
                onPress={() => submit(true)}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.dangerTxt}>{t('disconnect_login')}</Text>}
              </Pressable>
              <Pressable style={s.secondary} onPress={reset}>
                <Text style={s.secondaryTxt}>{t('cancel')}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={s.hint}>{t('account_hint')}</Text>
              <View style={s.tabs}>
                {(['login', 'register'] as const).map((m) => (
                  <Pressable key={m} style={[s.tab, mode === m && s.tabOn]} onPress={() => (setMode(m), setError(null))}>
                    <Text style={[s.tabTxt, mode === m && s.tabTxtOn]}>{t(m === 'login' ? 'login_tab' : 'register_tab')}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={s.label}>{t('email')}</Text>
              <TextInput
                style={s.input}
                value={mail}
                onChangeText={setMail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <Text style={s.label}>{t('password')}</Text>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete={mode === 'login' ? 'password' : 'new-password'}
              />
              {mode === 'register' && <Text style={s.small}>{t('password_hint')}</Text>}
              {error && <Text style={s.error}>{error}</Text>}
              <Pressable
                style={[s.primary, (!mail.trim() || password.length < 8 || busy) && { opacity: 0.5 }]}
                disabled={!mail.trim() || password.length < 8 || busy}
                onPress={() => submit(false)}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.primaryTxt}>{t(mode === 'login' ? 'login_btn' : 'register_btn')}</Text>
                )}
              </Pressable>
              <Text style={[s.note, { textAlign: 'center', marginTop: 10 }]}>{t('one_device_note')}</Text>
            </>
          )}

          <Pressable style={s.secondary} onPress={onClose}>
            <Text style={s.secondaryTxt}>{t('close')}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    wrap: { padding: 20, paddingTop: 52, flexGrow: 1 },
    h1: { fontSize: 28, fontWeight: '900', color: C.text, marginBottom: 12 },
    hint: { fontSize: 15, color: C.text2, marginBottom: 16, lineHeight: 21 },
    tabs: { flexDirection: 'row', backgroundColor: C.border, borderRadius: 14, padding: 4, marginBottom: 8 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11 },
    tabOn: { backgroundColor: C.card },
    tabTxt: { fontWeight: '700', color: C.muted },
    tabTxtOn: { color: '#4f46e5' },
    label: { fontSize: 14, fontWeight: '700', color: C.text2, marginTop: 14, marginBottom: 6 },
    input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border2, borderRadius: 12, padding: 13, fontSize: 17, color: C.text },
    small: { fontSize: 12, color: C.faint, marginTop: 4 },
    error: { color: '#dc2626', marginTop: 10, fontWeight: '600' },
    primary: { backgroundColor: '#4f46e5', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 18 },
    primaryTxt: { color: '#fff', fontSize: 17, fontWeight: '900' },
    card: { backgroundColor: C.card, borderRadius: 18, padding: 16, gap: 6, borderWidth: 1, borderColor: C.border },
    me: { fontSize: 17, fontWeight: '800', color: C.text },
    note: { fontSize: 13, color: C.muted },
    logout: { marginTop: 16, borderWidth: 1.5, borderColor: '#dc2626', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    logoutTxt: { color: '#dc2626', fontWeight: '800', fontSize: 16 },
    warnCard: { borderColor: '#f59e0b', backgroundColor: '#fffbeb' },
    warnTitle: { fontSize: 18, fontWeight: '900', color: '#92400e' },
    warnBody: { fontSize: 15, color: '#78350f', lineHeight: 21 },
    danger: { backgroundColor: '#dc2626', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
    dangerTxt: { color: '#fff', fontSize: 16, fontWeight: '900' },
    secondary: { paddingVertical: 14, alignItems: 'center' },
    secondaryTxt: { color: C.text2, fontSize: 15, fontWeight: '700' },
  });
