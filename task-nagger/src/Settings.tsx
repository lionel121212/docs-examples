import React from 'react';
import * as IntentLauncher from 'expo-intent-launcher';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { LANGS, useI18n } from './i18n';
import { FREE_TASK_LIMIT } from './premium';
import { Prefs } from './prefs';
import { Palette, useStyles } from './theme';

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
  prefs: Prefs;
  onPrefs: (p: Prefs) => void;
  onBuddy: () => void;
};

export function Settings({
  visible,
  premium,
  taskCount,
  onPremium,
  onClose,
  onRedoQuiz,
  accountEmail,
  onAccount,
  onUpgrade,
  prefs,
  onPrefs,
  onBuddy,
}: Props) {
  const s = useStyles(makeStyles);
  const { t, lang, setLang, dir } = useI18n();
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
        <Pressable style={s.row} onPress={onBuddy}>
          <Text style={s.flag}>🤝</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{t('buddy')}</Text>
            <Text style={s.sub}>{t('buddy_hint')}</Text>
          </View>
        </Pressable>
        <View style={{ height: 12 }} />
        <Text style={s.label}>{t('notifications')}</Text>
        <View style={s.box}>
          <View style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>🌙 {t('quiet_hours')}</Text>
              <Text style={s.sub}>{t('quiet_hint')}</Text>
            </View>
            <Switch value={prefs.quiet.enabled} onValueChange={(v) => onPrefs({ ...prefs, quiet: { ...prefs.quiet, enabled: v } })} />
          </View>
          {prefs.quiet.enabled && (
            <View style={s.timesRow}>
              <MiniTime
                label={t('from_time')}
                value={prefs.quiet.from}
                onChange={(from) => onPrefs({ ...prefs, quiet: { ...prefs.quiet, from } })}
              />
              <MiniTime
                label={t('to_time')}
                value={prefs.quiet.to}
                onChange={(to) => onPrefs({ ...prefs, quiet: { ...prefs.quiet, to } })}
              />
            </View>
          )}
          <View style={s.divider} />
          <View style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>🕯️ {t('shabbat')}</Text>
              <Text style={s.sub}>{t('shabbat_hint')}</Text>
            </View>
            <Switch value={prefs.shabbat} onValueChange={(v) => onPrefs({ ...prefs, shabbat: v })} />
          </View>
          {Platform.OS === 'android' && (
            <>
              <View style={s.divider} />
              <Text style={s.name}>⏱️ {t('exact_alarms')}</Text>
              <Text style={s.sub}>{t('exact_hint')}</Text>
              <Pressable
                style={s.smallBtn}
                onPress={() =>
                  IntentLauncher.startActivityAsync('android.settings.REQUEST_SCHEDULE_EXACT_ALARM', {
                    data: 'package:com.tasknagger.app',
                  }).catch(() =>
                    IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, {
                      data: 'package:com.tasknagger.app',
                    }).catch(() => {}),
                  )
                }
              >
                <Text style={s.smallBtnTxt}>{t('open_settings')}</Text>
              </Pressable>
            </>
          )}
        </View>

        <Text style={s.label}>{t('theme')}</Text>
        <View style={s.segment}>
          {(['system', 'light', 'dark'] as const).map((k) => (
            <Pressable key={k} style={[s.segBtn, prefs.theme === k && s.segOn]} onPress={() => onPrefs({ ...prefs, theme: k })}>
              <Text style={[s.segTxt, prefs.theme === k && s.segTxtOn]}>
                {t(k === 'system' ? 'theme_system' : k === 'light' ? 'theme_light' : 'theme_dark')}
              </Text>
            </Pressable>
          ))}
        </View>
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

function MiniTime({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const s = useStyles(makeStyles);
  const step = (d: number) => {
    const [h, m] = value.split(':').map(Number);
    const x = (((h * 60 + m + d) % 1440) + 1440) % 1440;
    onChange(`${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`);
  };
  return (
    <View style={s.mini}>
      <Text style={s.sub}>{label}</Text>
      <View style={s.miniRow}>
        <Pressable onPress={() => step(-30)} style={s.miniBtn}>
          <Text style={s.miniBtnTxt}>−</Text>
        </Pressable>
        <Text style={s.miniVal}>{value}</Text>
        <Pressable onPress={() => step(30)} style={s.miniBtn}>
          <Text style={s.miniBtnTxt}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    box: { backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 20, borderWidth: 2, borderColor: C.border },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    sub: { color: C.muted, fontSize: 13, marginTop: 2 },
    divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },
    timesRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
    mini: { flex: 1, backgroundColor: C.bg, borderRadius: 12, padding: 8, alignItems: 'center' },
    miniRow: { flexDirection: 'row', alignItems: 'center', gap: 6, direction: 'ltr', marginTop: 4 },
    miniBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' },
    miniBtnTxt: { color: '#4f46e5', fontSize: 18, fontWeight: '800' },
    miniVal: { fontSize: 18, fontWeight: '900', color: C.text, minWidth: 58, textAlign: 'center' },
    smallBtn: {
      alignSelf: 'flex-start',
      backgroundColor: C.soft,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginTop: 8,
    },
    smallBtnTxt: { color: '#4f46e5', fontWeight: '800' },
    segment: { flexDirection: 'row', backgroundColor: C.border, borderRadius: 14, padding: 4 },
    segBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11 },
    segOn: { backgroundColor: C.card },
    segTxt: { fontWeight: '700', color: C.muted },
    segTxtOn: { color: '#4f46e5' },
    wrap: { padding: 20, paddingTop: 52, backgroundColor: C.bg, flexGrow: 1 },
    h1: { fontSize: 28, fontWeight: '900', color: C.text, marginBottom: 16 },
    plan: { backgroundColor: '#1e1b4b', borderRadius: 18, padding: 16, marginBottom: 20 },
    upgrade: { backgroundColor: '#facc15', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
    upgradeTxt: { color: '#1e1b4b', fontWeight: '900', fontSize: 16 },
    planOn: { backgroundColor: '#facc15' },
    planTxt: { color: '#fff', fontSize: 17, fontWeight: '900' },
    planSub: { color: '#c7d2fe', marginTop: 10 },
    codeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    codeInput: {
      flex: 1,
      minWidth: 0,
      backgroundColor: C.card,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: C.text,
    },
    codeBtn: { backgroundColor: '#facc15', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
    codeBtnTxt: { color: '#1e1b4b', fontWeight: '900' },
    bad: { color: '#fca5a5', marginTop: 6 },
    label: { fontSize: 15, fontWeight: '800', color: C.muted, marginBottom: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 8,
      borderWidth: 2,
      borderColor: C.border,
    },
    rowOn: { borderColor: '#4f46e5', backgroundColor: C.soft },
    flag: { fontSize: 24, color: C.text },
    name: { flex: 1, fontSize: 17, fontWeight: '700', color: C.text },
    check: { fontSize: 18, color: '#4f46e5', fontWeight: '900' },
    close: { padding: 16, alignItems: 'center', marginTop: 12 },
    closeTxt: { fontSize: 16, color: C.text2, fontWeight: '700' },
  });
