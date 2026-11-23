import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ALL_DAYS, DAY_LABELS, Task } from './types';

type Props = {
  task: Task | null; // null = closed
  isNew: boolean;
  onSave: (t: Task) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

function Stepper({ value, onChange, min, max, suffix }: { value: number; onChange: (n: number) => void; min: number; max: number; suffix: string }) {
  return (
    <View style={s.stepper}>
      <Pressable style={s.stepBtn} onPress={() => onChange(Math.max(min, value - 1))}>
        <Text style={s.stepTxt}>−</Text>
      </Pressable>
      <Text style={s.stepVal}>
        {value} {suffix}
      </Text>
      <Pressable style={s.stepBtn} onPress={() => onChange(Math.min(max, value + 1))}>
        <Text style={s.stepTxt}>+</Text>
      </Pressable>
    </View>
  );
}

export function TaskEditor({ task, isNew, onSave, onDelete, onClose }: Props) {
  return (
    <Modal visible={!!task} animationType="slide" onRequestClose={onClose}>
      {task && <Form key={task.id} task={task} isNew={isNew} onSave={onSave} onDelete={onDelete} onClose={onClose} />}
    </Modal>
  );
}

function Form({ task, isNew, onSave, onDelete, onClose }: Omit<Props, 'task'> & { task: Task }) {
  const [draft, setDraft] = useState<Task>(task);
  const [showPicker, setShowPicker] = useState(false);
  const set = (p: Partial<Task>) => setDraft((d) => ({ ...d, ...p }));

  const [hh, mm] = draft.time.split(':').map(Number);
  const pickerDate = new Date();
  pickerDate.setHours(hh, mm, 0, 0);

  const toggleDay = (d: number) =>
    set({ days: draft.days.includes(d) ? draft.days.filter((x) => x !== d) : [...draft.days, d].sort() });

  const save = () => {
    if (!draft.title.trim()) return Alert.alert('חסר שם', 'תן שם למשימה');
    if (draft.days.length === 0) return Alert.alert('חסרים ימים', 'בחר לפחות יום אחד');
    onSave({ ...draft, title: draft.title.trim() });
  };

  const confirmDelete = () =>
    Alert.alert('למחוק?', `למחוק את "${draft.title}"?`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: () => onDelete(draft.id) },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.form}>
        <Text style={s.h1}>{isNew ? 'משימה חדשה' : 'עריכת משימה'}</Text>

        <Text style={s.label}>שם</Text>
        <View style={s.row}>
          <TextInput style={[s.input, { width: 64, textAlign: 'center' }]} value={draft.emoji} onChangeText={(emoji) => set({ emoji })} maxLength={4} />
          <TextInput style={[s.input, { flex: 1 }]} value={draft.title} onChangeText={(title) => set({ title })} placeholder="למשל: לשטוף פנים" />
        </View>

        <Text style={s.label}>שעה</Text>
        <Pressable style={s.timeBtn} onPress={() => setShowPicker(true)}>
          <Text style={s.timeTxt}>{draft.time}</Text>
        </Pressable>
        {showPicker && (
          <DateTimePicker
            value={pickerDate}
            mode="time"
            is24Hour
            onChange={(e, d) => {
              setShowPicker(Platform.OS === 'ios');
              if (e.type === 'set' && d) {
                set({ time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` });
              }
            }}
          />
        )}

        <Text style={s.label}>ימים</Text>
        <View style={s.days}>
          {ALL_DAYS.map((d) => (
            <Pressable key={d} onPress={() => toggleDay(d)} style={[s.day, draft.days.includes(d) && s.dayOn]}>
              <Text style={[s.dayTxt, draft.days.includes(d) && { color: '#fff' }]}>{DAY_LABELS[d]}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>אם לא עשיתי — להציק כל</Text>
        <Stepper value={draft.nagEveryMin} onChange={(n) => set({ nagEveryMin: n })} min={1} max={60} suffix="דקות" />

        <Text style={s.label}>כמה תזכורות נוספות</Text>
        <Stepper value={draft.nagCount} onChange={(n) => set({ nagCount: n })} min={0} max={20} suffix="פעמים" />

        <View style={[s.row, { justifyContent: 'space-between', marginTop: 16 }]}>
          <Text style={s.label}>פעילה</Text>
          <Switch value={draft.enabled} onValueChange={(enabled) => set({ enabled })} />
        </View>

        <Pressable style={s.save} onPress={save}>
          <Text style={s.saveTxt}>שמור</Text>
        </Pressable>
        <Pressable style={s.cancel} onPress={onClose}>
          <Text style={s.cancelTxt}>ביטול</Text>
        </Pressable>
        {!isNew && (
          <Pressable style={s.cancel} onPress={confirmDelete}>
            <Text style={[s.cancelTxt, { color: '#d00' }]}>מחק משימה</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  form: { padding: 20, paddingTop: 56, backgroundColor: '#fff', flexGrow: 1 },
  h1: { fontSize: 26, fontWeight: '700', marginBottom: 12 },
  label: { fontSize: 15, color: '#555', marginTop: 16, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 12, fontSize: 18 },
  timeBtn: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 12, alignItems: 'center' },
  timeTxt: { fontSize: 32, fontWeight: '600', letterSpacing: 2 },
  days: { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  day: { flex: 1, aspectRatio: 1, borderRadius: 100, borderWidth: 1, borderColor: '#bbb', alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  dayTxt: { fontSize: 15, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#ccc', borderRadius: 10 },
  stepBtn: { padding: 12, width: 60, alignItems: 'center' },
  stepTxt: { fontSize: 26 },
  stepVal: { fontSize: 18, fontWeight: '600' },
  save: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 28 },
  saveTxt: { color: '#fff', fontSize: 18, fontWeight: '700' },
  cancel: { padding: 14, alignItems: 'center' },
  cancelTxt: { fontSize: 16, color: '#555' },
});
