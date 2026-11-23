import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Illustration, ICON_KEYS, pickIcon } from './illustrations';
import { TaskIcon } from './TaskIcon';
import { ALL_DAYS, Category, DAY_LABELS, PALETTE, Task } from './types';

type Props = {
  task: Task | null; // null = closed
  isNew: boolean;
  categories: Category[];
  onAddCategory: (name: string, color: string) => Promise<Category>;
  onSave: (t: Task) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

function Stepper({ value, onChange, min, max, suffix }: { value: number; onChange: (n: number) => void; min: number; max: number; suffix: string }) {
  return (
    <View style={s.stepper}>
      <Pressable style={s.stepBtn} onPress={() => onChange(Math.max(min, value - 1))}><Text style={s.stepTxt}>−</Text></Pressable>
      <Text style={s.stepVal}>{value} {suffix}</Text>
      <Pressable style={s.stepBtn} onPress={() => onChange(Math.min(max, value + 1))}><Text style={s.stepTxt}>+</Text></Pressable>
    </View>
  );
}

export function TaskEditor(props: Props) {
  const { task, onClose } = props;
  return (
    <Modal visible={!!task} animationType="slide" onRequestClose={onClose}>
      {task && <Form key={task.id} {...props} task={task} />}
    </Modal>
  );
}

function Form({ task, isNew, categories, onAddCategory, onSave, onDelete, onClose }: Omit<Props, 'task'> & { task: Task }) {
  const [draft, setDraft] = useState<Task>(task);
  const [showPicker, setShowPicker] = useState(false);
  const [newCat, setNewCat] = useState<string | null>(null);
  const set = (p: Partial<Task>) => setDraft((d) => ({ ...d, ...p }));

  const [hh, mm] = draft.time.split(':').map(Number);
  const pickerDate = new Date();
  pickerDate.setHours(hh, mm, 0, 0);

  const toggleDay = (d: number) => set({ days: draft.days.includes(d) ? draft.days.filter((x) => x !== d) : [...draft.days, d].sort() });

  const choosePhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (r.canceled || !r.assets[0]) return;
    // copy into the app's own folder so the photo survives cache cleaning
    const dest = `${FileSystem.documentDirectory}task-${draft.id}-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: r.assets[0].uri, to: dest });
    set({ imageUri: dest });
  };

  const addCategory = async () => {
    const name = (newCat ?? '').trim();
    setNewCat(null);
    if (!name) return;
    const c = await onAddCategory(name, draft.color);
    set({ categoryId: c.id });
  };

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

  const autoKind = pickIcon(draft.title);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
        <View style={s.preview}>
          <TaskIcon task={draft} size={92} />
          <Text style={[s.previewTitle, { color: draft.color }]}>{draft.title || 'משימה חדשה'}</Text>
        </View>

        <Text style={s.label}>שם המשימה</Text>
        <TextInput style={s.input} value={draft.title} onChangeText={(title) => set({ title })} placeholder="למשל: סימולטור, לשטוף פנים, אופניים…" />
        <Text style={s.hint}>האיור נבחר אוטומטית לפי השם.</Text>

        <Text style={s.label}>קטגוריה</Text>
        <View style={s.wrap}>
          {categories.map((c) => (
            <Pressable key={c.id} onPress={() => set({ categoryId: c.id })} style={[s.chip, { borderColor: c.color }, draft.categoryId === c.id && { backgroundColor: c.color }]}>
              <Text style={[s.chipTxt, draft.categoryId === c.id && { color: '#fff' }]}>{c.name}</Text>
            </Pressable>
          ))}
          {newCat === null ? (
            <Pressable onPress={() => setNewCat('')} style={[s.chip, { borderColor: '#94a3b8', borderStyle: 'dashed' }]}>
              <Text style={s.chipTxt}>＋ קטגוריה חדשה</Text>
            </Pressable>
          ) : (
            <TextInput autoFocus style={[s.input, { minWidth: 150, paddingVertical: 6 }]} value={newCat} onChangeText={setNewCat} onSubmitEditing={addCategory} onBlur={addCategory} placeholder="שם הקטגוריה" returnKeyType="done" />
          )}
        </View>

        <Text style={s.label}>צבע</Text>
        <View style={s.wrap}>
          {PALETTE.map((c) => (
            <Pressable key={c} onPress={() => set({ color: c })} style={[s.swatch, { backgroundColor: c }, draft.color === c && s.swatchOn]} />
          ))}
        </View>

        <Text style={s.label}>איור</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          <Pressable onPress={() => set({ icon: 'auto', imageUri: undefined })} style={[s.iconBox, draft.icon === 'auto' && !draft.imageUri && { borderColor: draft.color, borderWidth: 2 }]}>
            <Illustration kind={autoKind} color={draft.color} size={36} />
            <Text style={s.iconLbl}>אוטומטי</Text>
          </Pressable>
          {ICON_KEYS.map((k) => (
            <Pressable key={k} onPress={() => set({ icon: k, imageUri: undefined })} style={[s.iconBox, draft.icon === k && !draft.imageUri && { borderColor: draft.color, borderWidth: 2 }]}>
              <Illustration kind={k} color={draft.color} size={36} />
            </Pressable>
          ))}
          <Pressable onPress={choosePhoto} style={[s.iconBox, draft.imageUri && { borderColor: draft.color, borderWidth: 2 }]}>
            <Text style={{ fontSize: 26 }}>🖼️</Text>
            <Text style={s.iconLbl}>תמונה שלי</Text>
          </Pressable>
        </ScrollView>

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
              if (e.type === 'set' && d) set({ time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` });
            }}
          />
        )}

        <Text style={s.label}>ימים</Text>
        <View style={s.days}>
          {ALL_DAYS.map((d) => (
            <Pressable key={d} onPress={() => toggleDay(d)} style={[s.day, draft.days.includes(d) && { backgroundColor: draft.color, borderColor: draft.color }]}>
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

        <Pressable style={[s.save, { backgroundColor: draft.color }]} onPress={save}><Text style={s.saveTxt}>שמור</Text></Pressable>
        <Pressable style={s.cancel} onPress={onClose}><Text style={s.cancelTxt}>ביטול</Text></Pressable>
        {!isNew && (
          <Pressable style={s.cancel} onPress={confirmDelete}><Text style={[s.cancelTxt, { color: '#d00' }]}>מחק משימה</Text></Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  form: { padding: 20, paddingTop: 48, flexGrow: 1 },
  preview: { alignItems: 'center', gap: 8, marginBottom: 8 },
  previewTitle: { fontSize: 22, fontWeight: '800' },
  label: { fontSize: 15, color: '#555', marginTop: 18, marginBottom: 6, fontWeight: '600' },
  hint: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 12, fontSize: 18 },
  chip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  chipTxt: { fontWeight: '600', fontSize: 14 },
  swatch: { width: 38, height: 38, borderRadius: 19 },
  swatchOn: { borderWidth: 4, borderColor: '#0f172a33' },
  iconBox: { width: 64, height: 64, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  iconLbl: { fontSize: 10, color: '#64748b', marginTop: 1 },
  timeBtn: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 12, alignItems: 'center' },
  timeTxt: { fontSize: 32, fontWeight: '600', letterSpacing: 2 },
  days: { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  day: { flex: 1, aspectRatio: 1, borderRadius: 100, borderWidth: 1, borderColor: '#bbb', alignItems: 'center', justifyContent: 'center' },
  dayTxt: { fontSize: 15, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#ccc', borderRadius: 10 },
  stepBtn: { padding: 12, width: 60, alignItems: 'center' },
  stepTxt: { fontSize: 26 },
  stepVal: { fontSize: 18, fontWeight: '600' },
  save: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 28 },
  saveTxt: { color: '#fff', fontSize: 18, fontWeight: '700' },
  cancel: { padding: 14, alignItems: 'center' },
  cancelTxt: { fontSize: 16, color: '#555' },
});
