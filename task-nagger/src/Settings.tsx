import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { redeem } from './account';
import { checkPremium } from './analysis';
import { LANGS, useI18n } from './i18n';
import { FREE_TASK_LIMIT, savePremium } from './premium';

type Props = {
  visible: boolean;
  premium: boolean;
  taskCount: number;
  onPremium: () => void;
  onClose: () => void;
  onRedoQuiz: () => void;
  accountEmail: string | null;
  onAccount: () => void;
  onUpgrade: () => void;
};

export function Settings({ visible, premium, taskCount, onPremium, onClose, onRedoQuiz, accountEmail, onAccount, onUpgrade }: Props) {
  const { t, lang, setLang, dir } = useI18n();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [bad, setBad] = useState(false);
  const unlock = async () => {
    setBusy(true);
    setBad(false);
    // logged in: the code upgrades the account (all devices); otherwise just this phone
    const ok = accountEmail ? await redeem(code.trim()) : await checkPremium(code.trim());
    setBusy(false);
    if (!ok) return setBad(true);
    await savePremium(code.trim());
    onPremium();
  };
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={[s.wrap, { direction: dir }]}>
        <Text style={s.h1}>⚙️ {t('settings')}</Text>
        <View style={[s.plan, premium && s.planOn]}>
          <Text style={[s.planTxt, premium && { color: '#1e1b4b' }]}>
            {premium ? t('plan_premium') : t('plan_free', { used: Math.min(taskCount, FREE_TASK_LIMIT), n: FREE_TASK_LIMIT })}
          </Text>
          {!premium && (
            <Pressable style={s.upgrade} onPress={onUpgrade}>
              <Text style={s.upgradeTxt}>{t('prem_cta')}</Text>
            </Pressable>
          )}
        </View>
        <Pressable style={s.row} onPress={onAccount}>
          <Text style={s.flag}>👤</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{t('account')}</Text>
            <Text style={{ color: '#64748b', fontSize: 13 }}>
              {accountEmail ? t('logged_in_as', { email: accountEmail }) : t('account_hint')}
            </Text>
          </View>
        </Pressable>
        <View style={{ height: 12 }} />
        <Text style={s.label}>{t('language')}</Text>
        {LANGS.map((l) => (
          <Pressable key={l.code} onPress={() => setLang(l.code)} style={[s.row, lang === l.code && s.rowOn]}>
            <Text style={s.flag}>{l.flag}</Text>
            <Text style={[s.name, lang === l.code && { color: '#4f46e5' }]}>{l.name}</Text>
            {lang === l.code && <Text style={s.check}>✓</Text>}
          </Pressable>
        ))}
        <View style={{ height: 20 }} />
        <Pressable style={s.row} onPress={onRedoQuiz}>
          <Text style={s.flag}>📝</Text>
          <Text style={s.name}>{t('redo_quiz')}</Text>
        </Pressable>
        <Pressable style={s.close} onPress={onClose}>
          <Text style={s.closeTxt}>{t('close')}</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, paddingTop: 52, backgroundColor: '#f8fafc', flexGrow: 1 },
  h1: { fontSize: 28, fontWeight: '900', color: '#0f172a', marginBottom: 16 },
  plan: { backgroundColor: '#1e1b4b', borderRadius: 18, padding: 16, marginBottom: 20 },
  upgrade: { backgroundColor: '#facc15', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  upgradeTxt: { color: '#1e1b4b', fontWeight: '900', fontSize: 16 },
  planOn: { backgroundColor: '#facc15' },
  planTxt: { color: '#fff', fontSize: 17, fontWeight: '900' },
  planSub: { color: '#c7d2fe', marginTop: 10 },
  codeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  codeInput: { flex: 1, minWidth: 0, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  codeBtn: { backgroundColor: '#facc15', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  codeBtnTxt: { color: '#1e1b4b', fontWeight: '900' },
  bad: { color: '#fca5a5', marginTop: 6 },
  label: { fontSize: 15, fontWeight: '800', color: '#64748b', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  rowOn: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
  flag: { fontSize: 24 },
  name: { flex: 1, fontSize: 17, fontWeight: '700', color: '#0f172a' },
  check: { fontSize: 18, color: '#4f46e5', fontWeight: '900' },
  close: { padding: 16, alignItems: 'center', marginTop: 12 },
  closeTxt: { fontSize: 16, color: '#475569', fontWeight: '700' },
});
