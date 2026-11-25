import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Achievement } from './achievements';
import { Confetti } from './fx';
import { StrKey, useI18n } from './i18n';

export function achievementName(t: ReturnType<typeof useI18n>['t'], a: Achievement) {
  const key: StrKey = a.kind === 'streak' ? 'ach_streak' : a.kind === 'done' ? 'ach_done' : 'ach_perfect_week';
  return t(key, { n: a.n });
}

/** Big celebration when a new achievement is earned. */
export function AchievementPopup({ achievement, onClose }: { achievement: Achievement | null; onClose: () => void }) {
  const { t } = useI18n();
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!achievement) return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }).start();
  }, [achievement, pop]);
  if (!achievement) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Animated.View
          style={[
            s.card,
            { transform: [{ scale: pop }, { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }) }] },
          ]}
        >
          <Text style={s.kicker}>{t('ach_new')}</Text>
          <View style={s.medal}>
            <Text style={s.emoji}>{achievement.emoji}</Text>
          </View>
          <Text style={s.name}>{achievementName(t, achievement)}</Text>
          <Pressable style={s.ok} onPress={onClose}>
            <Text style={s.okTxt}>{t('ok')}</Text>
          </Pressable>
        </Animated.View>
        <Confetti burstKey={achievement.id.length + 1} origin={{ x: 190, y: 360 }} />
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(9,13,36,0.75)', alignItems: 'center', justifyContent: 'center' },
  card: {
    width: 300,
    backgroundColor: '#1e1b4b',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#facc15',
    shadowColor: '#facc15',
    shadowOpacity: 0.9,
    shadowRadius: 24,
    elevation: 16,
  },
  kicker: { color: '#facc15', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  medal: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(250,204,21,0.15)',
    borderWidth: 3,
    borderColor: '#facc15',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
  },
  emoji: { fontSize: 60 },
  name: { color: '#fff', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  ok: { backgroundColor: '#facc15', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 40, marginTop: 20 },
  okTxt: { color: '#1e1b4b', fontWeight: '900', fontSize: 16 },
});
