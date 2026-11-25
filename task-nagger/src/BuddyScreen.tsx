import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { acceptBuddy, Buddy, listBuddies, removeBuddy, requestBuddy } from './buddies';
import { useI18n } from './i18n';
import { Palette, useStyles, useTheme } from './theme';

type Props = { visible: boolean; loggedIn: boolean; onClose: () => void; onSignIn: () => void };

export function BuddyScreen({ visible, loggedIn, onClose, onSignIn }: Props) {
  const { t, dir } = useI18n();
  const s = useStyles(makeStyles);
  const C = useTheme();
  const [list, setList] = useState<Buddy[] | null>(null);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    listBuddies()
      .then(setList)
      .catch(() => setList([]));
  useEffect(() => {
    if (visible && loggedIn) refresh();
  }, [visible, loggedIn]);

  const send = async () => {
    setBusy(true);
    const r = await requestBuddy(email.trim().toLowerCase());
    setBusy(false);
    setMsg(r === 'ok' ? t('buddy_sent') : r === 'not_found' ? t('buddy_not_found') : t('went_wrong'));
    if (r === 'ok') {
      setEmail('');
      refresh();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView
        style={{ backgroundColor: C.bg }}
        contentContainerStyle={[s.wrap, { direction: dir }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.h1}>🤝 {t('buddy')}</Text>
        <Text style={s.hint}>{t('buddy_hint')}</Text>
        {!loggedIn ? (
          <>
            <Text style={s.note}>{t('buddy_need_login')}</Text>
            <Pressable style={s.primary} onPress={onSignIn}>
              <Text style={s.primaryTxt}>{t('login_btn')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={s.addRow}>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder={t('buddy_email')}
                placeholderTextColor={C.faint}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Pressable
                style={[s.addBtn, (!email.includes('@') || busy) && { opacity: 0.5 }]}
                disabled={!email.includes('@') || busy}
                onPress={send}
              >
                <Text style={s.addTxt}>{t('buddy_add')}</Text>
              </Pressable>
            </View>
            {msg && <Text style={s.note}>{msg}</Text>}
            {list === null ? (
              <ActivityIndicator style={{ marginTop: 20 }} />
            ) : (
              list.map((b) => (
                <View key={b.id} style={s.card}>
                  <Text style={s.avatar}>{b.name.slice(0, 1).toUpperCase()}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{b.name}</Text>
                    <Text style={s.sub}>
                      {b.status === 'pending'
                        ? b.incoming
                          ? t('buddy_requests')
                          : t('buddy_pending')
                        : b.today
                          ? t('buddy_today', { name: b.name, done: b.today.done, total: b.today.total })
                          : '—'}
                    </Text>
                  </View>
                  {b.incoming && (
                    <Pressable style={s.accept} onPress={() => acceptBuddy(b.id).then(refresh)}>
                      <Text style={s.acceptTxt}>{t('buddy_accept')}</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => removeBuddy(b.id).then(refresh)} hitSlop={8}>
                    <Text style={s.remove}>{t('buddy_remove')}</Text>
                  </Pressable>
                </View>
              ))
            )}
          </>
        )}
        <Pressable style={s.close} onPress={onClose}>
          <Text style={s.closeTxt}>{t('close')}</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    wrap: { padding: 20, paddingTop: 52, flexGrow: 1 },
    h1: { fontSize: 28, fontWeight: '900', color: C.text },
    hint: { fontSize: 15, color: C.muted, marginTop: 6, marginBottom: 16, lineHeight: 21 },
    note: { color: C.muted, marginVertical: 8 },
    addRow: { flexDirection: 'row', gap: 8 },
    input: {
      flex: 1,
      minWidth: 0,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border2,
      borderRadius: 12,
      padding: 12,
      fontSize: 16,
      color: C.text,
    },
    addBtn: { backgroundColor: '#4f46e5', borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
    addTxt: { color: '#fff', fontWeight: '800' },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.card,
      borderRadius: 16,
      padding: 14,
      marginTop: 10,
      borderWidth: 1,
      borderColor: C.border,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: C.soft,
      color: '#4f46e5',
      fontWeight: '900',
      fontSize: 18,
      textAlign: 'center',
      lineHeight: 40,
      overflow: 'hidden',
    },
    name: { fontSize: 16, fontWeight: '800', color: C.text },
    sub: { fontSize: 13, color: C.muted, marginTop: 2 },
    accept: { backgroundColor: '#16a34a', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
    acceptTxt: { color: '#fff', fontWeight: '800' },
    remove: { color: '#dc2626', fontWeight: '700', fontSize: 13 },
    primary: { backgroundColor: '#4f46e5', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
    primaryTxt: { color: '#fff', fontWeight: '900', fontSize: 16 },
    close: { paddingVertical: 16, alignItems: 'center' },
    closeTxt: { color: C.muted, fontWeight: '700', fontSize: 15 },
  });
