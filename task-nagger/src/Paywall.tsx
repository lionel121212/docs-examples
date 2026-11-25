import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { redeem } from './account';
import { checkPremium } from './analysis';
import { billingAvailable, buy, getPlans, Plan, Plans, restore, yearlySaving } from './billing';
import { Aurora, Shimmer } from './fx';
import { StrKey, useI18n } from './i18n';
import { savePremium } from './premium';

type Props = {
  visible: boolean;
  accountEmail: string | null;
  onClose: () => void;
  onPremium: () => void;
};

const BENEFITS: StrKey[] = ['prem_b0', 'prem_b1', 'prem_b2', 'prem_b3', 'prem_b4'];

export function Paywall({ visible, accountEmail, onClose, onPremium }: Props) {
  const { t, dir } = useI18n();
  const [plans, setPlans] = useState<Plans | null>(null);
  const [choice, setChoice] = useState<'annual' | 'monthly'>('annual');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!visible) return;
    setMsg(null);
    setPlans(null);
    getPlans().then((p) => {
      setPlans(p);
      setChoice(p.annual ? 'annual' : 'monthly');
    });
  }, [visible]);

  const done = (text: string) => {
    setMsg(text);
    setTimeout(onPremium, 900);
  };

  const purchase = async (plan: Plan) => {
    setBusy(true);
    setMsg(null);
    const r = await buy(plan);
    setBusy(false);
    if (r === 'ok') done(t('pw_success'));
    else if (r === 'error') setMsg(t('pw_failed'));
  };

  const doRestore = async () => {
    setBusy(true);
    const ok = await restore();
    setBusy(false);
    ok ? done(t('pw_success')) : setMsg(t('pw_none'));
  };

  const useCode = async () => {
    setBusy(true);
    const ok = accountEmail ? await redeem(code.trim()) : await checkPremium(code.trim());
    setBusy(false);
    if (!ok) return setMsg(t('prem_bad_code'));
    await savePremium(code.trim());
    done(t('pw_success'));
  };

  const saving = plans ? yearlySaving(plans) : 0;
  const hasPlans = !!plans && !!(plans.monthly || plans.annual);
  const selected = plans ? (choice === 'annual' ? plans.annual : plans.monthly) : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.root, { direction: dir }]}>
        <Aurora />
        <ScrollView contentContainerStyle={s.wrap}>
          <Text style={s.title}>{t('prem_name')}</Text>
          <View style={s.benefits}>
            {BENEFITS.map((k) => (
              <Text key={k} style={s.benefit}>
                ✓ {t(k)}
              </Text>
            ))}
          </View>

          {plans === null ? (
            <ActivityIndicator color="#fff" style={{ marginTop: 30 }} />
          ) : hasPlans ? (
            <>
              {plans.annual && (
                <PlanCard
                  on={choice === 'annual'}
                  onPress={() => setChoice('annual')}
                  name={t('pw_yearly')}
                  price={t('pw_per_year', { price: plans.annual.price })}
                  sub={plans.annual.perMonth ? t('pw_per_month', { price: plans.annual.perMonth }) : null}
                  badge={saving > 0 ? t('pw_save', { n: saving }) : null}
                />
              )}
              {plans.monthly && (
                <PlanCard
                  on={choice === 'monthly'}
                  onPress={() => setChoice('monthly')}
                  name={t('pw_monthly')}
                  price={t('pw_per_month', { price: plans.monthly.price })}
                  sub={null}
                  badge={null}
                />
              )}
              <Pressable
                style={[s.buy, busy && { opacity: 0.6 }]}
                disabled={busy || !selected}
                onPress={() => selected && purchase(selected)}
              >
                {busy ? <ActivityIndicator color="#1e1b4b" /> : <Text style={s.buyTxt}>{t('pw_buy')}</Text>}
                {!busy && <Shimmer delay={300} every={1800} />}
              </Pressable>
              <Pressable onPress={doRestore} disabled={busy} style={s.link}>
                <Text style={s.linkTxt}>{t('pw_restore')}</Text>
              </Pressable>
              <Text style={s.legal}>{t('pw_legal')}</Text>
            </>
          ) : (
            <Text style={s.unavailable}>{billingAvailable() ? t('went_wrong') : t('pw_unavailable')}</Text>
          )}

          {msg && <Text style={s.msg}>{msg}</Text>}

          {/* tester codes keep working next to real payments */}
          <View style={s.codeRow}>
            <TextInput
              style={s.codeInput}
              value={code}
              onChangeText={setCode}
              placeholder={t('pw_have_code')}
              placeholderTextColor="#818cf8"
              autoCapitalize="none"
            />
            <Pressable style={[s.codeBtn, (!code.trim() || busy) && { opacity: 0.5 }]} disabled={!code.trim() || busy} onPress={useCode}>
              <Text style={s.codeBtnTxt}>{t('prem_check')}</Text>
            </Pressable>
          </View>

          <Pressable onPress={onClose} style={s.link}>
            <Text style={s.closeTxt}>{t('close')}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

function PlanCard({
  on,
  onPress,
  name,
  price,
  sub,
  badge,
}: {
  on: boolean;
  onPress: () => void;
  name: string;
  price: string;
  sub: string | null;
  badge: string | null;
}) {
  return (
    <Pressable onPress={onPress} style={[s.plan, on && s.planOn]}>
      <View style={[s.radio, on && s.radioOn]}>{on && <Text style={s.radioTick}>✓</Text>}</View>
      <View style={{ flex: 1 }}>
        <Text style={s.planName}>{name}</Text>
        {sub && <Text style={s.planSub}>{sub}</Text>}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {badge && (
          <View style={s.badge}>
            <Text style={s.badgeTxt}>{badge}</Text>
          </View>
        )}
        <Text style={s.planPrice}>{price}</Text>
      </View>
    </Pressable>
  );
}

const glow = (c: string) => ({
  shadowColor: c,
  shadowOpacity: 0.9,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 0 },
  elevation: 10,
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#090d24' },
  wrap: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  title: { fontSize: 34, fontWeight: '900', color: '#fff', textAlign: 'center', textShadowColor: '#facc15', textShadowRadius: 20 },
  benefits: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 18,
    padding: 16,
    marginTop: 18,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  benefit: { color: '#e0e7ff', fontSize: 15, fontWeight: '600' },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  planOn: { borderColor: '#facc15', backgroundColor: 'rgba(250,204,21,0.12)', ...glow('#facc15') },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: '#facc15', borderColor: '#facc15' },
  radioTick: { color: '#1e1b4b', fontWeight: '900' },
  planName: { color: '#fff', fontSize: 18, fontWeight: '900' },
  planSub: { color: '#c7d2fe', fontSize: 13, marginTop: 2 },
  planPrice: { color: '#fff', fontSize: 16, fontWeight: '800' },
  badge: { backgroundColor: '#22c55e', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 },
  badgeTxt: { color: '#fff', fontSize: 12, fontWeight: '900' },
  buy: {
    backgroundColor: '#facc15',
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 20,
    overflow: 'hidden',
    ...glow('#facc15'),
  },
  buyTxt: { color: '#1e1b4b', fontSize: 18, fontWeight: '900' },
  link: { paddingVertical: 14, alignItems: 'center' },
  linkTxt: { color: '#c7d2fe', fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
  legal: { color: '#818cf8', fontSize: 12, textAlign: 'center', lineHeight: 17 },
  unavailable: { color: '#e0e7ff', fontSize: 16, textAlign: 'center', marginTop: 24, lineHeight: 22 },
  msg: { color: '#fde68a', fontSize: 16, fontWeight: '800', textAlign: 'center', marginTop: 16 },
  codeRow: { flexDirection: 'row', gap: 8, marginTop: 26 },
  codeInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: '#4338ca',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
  },
  codeBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  codeBtnTxt: { color: '#fff', fontWeight: '800' },
  closeTxt: { color: '#a5b4fc', fontSize: 15, fontWeight: '700' },
});
