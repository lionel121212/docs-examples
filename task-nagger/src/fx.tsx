/**
 * Visual effects: soft moving "aurora" lights, a light sweep for buttons,
 * a glow pulse, and a confetti burst. Plain Animated + react-native-svg,
 * so they run in Expo without extra native modules.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

/* ---------- aurora: big blurred orbs drifting around ---------- */

function Orb({
  color,
  size,
  from,
  to,
  duration,
}: {
  color: string;
  size: number;
  from: [number, number];
  to: [number, number];
  duration: number;
}) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a, duration]);
  const id = useMemo(() => 'orb' + Math.random().toString(36).slice(2, 8), []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        left: from[0] - size / 2,
        top: from[1] - size / 2,
        transform: [
          { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, to[0] - from[0]] }) },
          { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, to[1] - from[1]] }) },
          { scale: a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.15, 0.95] }) },
        ],
      }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.75} />
            <Stop offset="0.45" stopColor={color} stopOpacity={0.28} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

export function Aurora({
  colors = ['#7c3aed', '#2563eb', '#db2777', '#06b6d4'],
  intensity = 1,
}: {
  colors?: string[];
  intensity?: number;
}) {
  const base = 420 * intensity;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <Orb color={colors[0]} size={base} from={[40, 120]} to={[300, 260]} duration={7000} />
      <Orb color={colors[1]} size={base * 0.9} from={[360, 40]} to={[80, 380]} duration={9000} />
      <Orb color={colors[2]} size={base * 0.8} from={[320, 700]} to={[60, 520]} duration={8000} />
      <Orb color={colors[3]} size={base * 0.6} from={[80, 820]} to={[300, 640]} duration={10000} />
    </View>
  );
}

/* ---------- light sweep across a button ---------- */

export function Shimmer({ width = 400, delay = 600, every = 2600 }: { width?: number; delay?: number; every?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(a, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(every),
        Animated.timing(a, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a, delay, every]);
  const band = 90;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 18 }]}>
      <Animated.View
        style={{
          position: 'absolute',
          top: -20,
          bottom: -20,
          width: band,
          transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [-band * 1.5, width + band] }) }, { rotate: '18deg' }],
        }}
      >
        <Svg width={band} height="100%">
          <Defs>
            <LinearGradient id="sh" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#fff" stopOpacity={0} />
              <Stop offset="0.5" stopColor="#fff" stopOpacity={0.55} />
              <Stop offset="1" stopColor="#fff" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width={band} height="100%" fill="url(#sh)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/* ---------- pulsing glow ring (late task, selected option) ---------- */

export function GlowPulse({ color, radius = 22, style }: { color: string; radius?: number; style?: ViewStyle }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: radius,
          borderWidth: 3,
          borderColor: color,
          opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
          transform: [
            { scaleX: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
            { scaleY: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) },
          ],
        },
        style,
      ]}
    />
  );
}

/* ---------- confetti burst ---------- */

const CONFETTI_COLORS = ['#facc15', '#22c55e', '#3b82f6', '#ec4899', '#f97316', '#a855f7', '#14b8a6'];

function Piece({ i, origin }: { i: number; origin: { x: number; y: number } }) {
  const a = useRef(new Animated.Value(0)).current;
  const angle = (Math.PI * 2 * i) / 28 + Math.random() * 0.4;
  const dist = 110 + Math.random() * 150;
  const dx = Math.cos(angle) * dist;
  const dy = Math.sin(angle) * dist - 90;
  const spin = (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540);
  useEffect(() => {
    Animated.timing(a, {
      toValue: 1,
      duration: 1300 + Math.random() * 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [a]);
  const w = 6 + (i % 3) * 3;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: origin.x,
        top: origin.y,
        width: w,
        height: w * (i % 2 ? 2.2 : 1),
        borderRadius: i % 4 === 0 ? w : 2,
        backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        opacity: a.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
        transform: [
          { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
          // up first, then gravity pulls it down
          { translateY: a.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, dy, dy + 260] }) },
          { rotate: a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${spin}deg`] }) },
        ],
      }}
    />
  );
}

/** Renders a burst every time `burstKey` changes (0 = nothing). */
export function Confetti({ burstKey, origin }: { burstKey: number; origin: { x: number; y: number } }) {
  if (!burstKey) return null;
  return (
    <View key={burstKey} pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 28 }, (_, i) => (
        <Piece key={i} i={i} origin={origin} />
      ))}
    </View>
  );
}

/* ---------- orbiting sparks (analyzing screen) ---------- */

export function Orbit({ size = 200, color = '#a5b4fc' }: { size?: number; color?: string }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [a]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size }}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Animated.View
          key={i}
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                { rotate: a.interpolate({ inputRange: [0, 1], outputRange: [`${i * 60}deg`, `${i * 60 + (i % 2 ? -360 : 360)}deg`] }) },
              ],
            },
          ]}
        >
          <View
            style={{
              position: 'absolute',
              top: i % 2 ? size * 0.12 : 0,
              left: size / 2 - 5,
              width: i % 3 === 0 ? 12 : 8,
              height: i % 3 === 0 ? 12 : 8,
              borderRadius: 6,
              backgroundColor: i % 2 ? '#f0abfc' : color,
              shadowColor: color,
              shadowOpacity: 1,
              shadowRadius: 8,
              elevation: 4,
            }}
          />
        </Animated.View>
      ))}
    </View>
  );
}
