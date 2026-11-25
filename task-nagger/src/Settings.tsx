import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LANGS, useI18n } from './i18n';

export function Settings({ visible, onClose, onRedoQuiz }: { visible: boolean; onClose: () => void; onRedoQuiz: () => void }) {
  const { t, lang, setLang, dir } = useI18n();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={[s.wrap, { direction: dir }]}>
        <Text style={s.h1}>⚙️ {t('settings')}</Text>
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
  label: { fontSize: 15, fontWeight: '800', color: '#64748b', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 8, borderWidth: 2, borderColor: '#e2e8f0' },
  rowOn: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
  flag: { fontSize: 24 },
  name: { flex: 1, fontSize: 17, fontWeight: '700', color: '#0f172a' },
  check: { fontSize: 18, color: '#4f46e5', fontWeight: '900' },
  close: { padding: 16, alignItems: 'center', marginTop: 12 },
  closeTxt: { fontSize: 16, color: '#475569', fontWeight: '700' },
});
