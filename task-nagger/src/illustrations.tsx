import React from 'react';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { IconKey } from './types';

/** Keyword -> illustration. Order matters: the first match wins (most specific first). */
const RULES: [IconKey, string[]][] = [
  ['face', ['פנים', 'פרצוף', 'לרחוץ', 'להתרחץ', 'מקלחת', 'face', 'wash', 'shower', 'cara', 'лицо', 'умы', 'وجه', 'استحمام', 'ducha', 'душ']],
  ['tooth', ['שיניים', 'שן', 'לצחצח', 'צחצוח', 'teeth', 'tooth', 'brush', 'dientes', 'зуб', 'أسنان', 'فرشاة']],
  ['moon', ['שינה', 'לישון', 'לילה', 'sleep', 'night', 'bed', 'dormir', 'acostar', 'сон', 'спать', 'ночь', 'نوم', 'النوم', 'ليل']],
  ['simulator', ['סימולטור', 'הגה', 'מירוץ', 'מרוץ', 'sim', 'race', 'racing', 'f1', 'drive', 'נהיגה', 'симулятор', 'руль', 'гонк', 'simulador', 'carrera', 'محاكي', 'سباق', 'قيادة']],
  ['bike', ['אופניים', 'אופנים', 'אופניי', 'רכיבה', 'bike', 'cycl', 'bici', 'cicl', 'велосипед', 'دراجة']],
  ['dumbbell', ['כושר', 'משקולות', 'אימון', 'התאמן', 'gym', 'workout', 'train', 'lift', 'שרירים', 'entren', 'gimnasio', 'pesas', 'трениров', 'зал', 'гантел', 'تمرين', 'رياضة', 'نادي', 'أوزان']],
  ['run', ['ריצה', 'לרוץ', 'ג׳וגינג', "ג'וגינג", 'הליכה', 'run', 'jog', 'walk', 'correr', 'caminar', 'бег', 'ходьб', 'прогул', 'جري', 'مشي']],
  ['apple', ['אוכל', 'ארוחה', 'ארוחת', 'לאכול', 'תפוח', 'ירקות', 'meal', 'eat', 'food', 'comer', 'comida', 'desayuno', 'almuerzo', 'cena', 'еда', 'завтрак', 'обед', 'ужин', 'طعام', 'فطور', 'غداء', 'عشاء', 'أكل']],
  ['sun', ['להתעורר', 'קימה', 'לקום', 'בוקר', 'wake', 'morning', 'despertar', 'levantar', 'mañana', 'проснуться', 'встать', 'утро', 'استيقاظ', 'صباح']],
  ['book', ['ללמוד', 'לקרוא', 'ספר', 'קריאה', 'לימוד', 'שיעור', 'שיעורי', 'בית ספר', 'מבחן', 'study', 'read', 'book', 'estudi', 'leer', 'libro', 'deberes', 'колледж', 'учёб', 'учеб', 'урок', 'читать', 'книг', 'دراسة', 'قراءة', 'كتاب', 'واجب']],
  ['drop', ['מים', 'לשתות', 'שתייה', 'water', 'drink', 'agua', 'beber', 'вода', 'пить', 'ماء', 'شرب']],
  ['pill', ['תרופה', 'ויטמינ', 'כדור', 'pill', 'vitamin', 'med', 'pastilla', 'vitamina', 'medic', 'таблет', 'витамин', 'лекар', 'دواء', 'فيتامين']],
  ['laptop', ['עבודה', 'קלוד', 'claude', 'קוד', 'תכנות', 'מחשב', 'פרויקט', 'work', 'code', 'laptop', 'trabajo', 'proyecto', 'código', 'работ', 'проект', 'код', 'عمل', 'مشروع', 'برمجة']],
];

export function pickIcon(title: string): IconKey {
  const t = title.toLowerCase();
  for (const [key, words] of RULES) if (words.some((w) => t.includes(w))) return key;
  return 'check';
}

export const ICON_KEYS: IconKey[] = ['face', 'tooth', 'simulator', 'bike', 'dumbbell', 'run', 'moon', 'sun', 'book', 'drop', 'pill', 'laptop', 'apple', 'check'];

type P = { c: string };
const sw = { strokeWidth: 3.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

function Shape({ kind, c }: { kind: IconKey } & P) {
  const soft = c + '33';
  switch (kind) {
    case 'simulator': // steering wheel: thick rim, hub, 3 spokes, centre marker at the top
      return (
        <G stroke={c} {...sw}>
          <Circle cx={32} cy={32} r={24} fill={soft} strokeWidth={5} />
          <Path d="M9 30 Q20 38 27 36 M55 30 Q44 38 37 36 M32 41 L32 56" strokeWidth={5} />
          <Circle cx={32} cy={34} r={8} fill={c} />
          <Path d="M28 9 H36" stroke="#fff" strokeWidth={4} />
        </G>
      );
    case 'bike':
      return (
        <G stroke={c} {...sw}>
          <Circle cx={15} cy={42} r={10} fill={soft} />
          <Circle cx={49} cy={42} r={10} fill={soft} />
          <Path d="M15 42 L27 42 L37 24 L49 42 M27 42 L22 24 M17 24 L28 24 M37 24 L35 17 M31 17 L41 17" />
        </G>
      );
    case 'dumbbell':
      return (
        <G stroke={c} {...sw}>
          <Line x1={18} y1={32} x2={46} y2={32} />
          <Rect x={8} y={20} width={8} height={24} rx={3} fill={soft} />
          <Rect x={16} y={25} width={5} height={14} rx={2} fill={soft} />
          <Rect x={43} y={25} width={5} height={14} rx={2} fill={soft} />
          <Rect x={48} y={20} width={8} height={24} rx={3} fill={soft} />
        </G>
      );
    case 'face':
      return (
        <G stroke={c} {...sw}>
          <Circle cx={30} cy={36} r={20} fill={soft} />
          <Circle cx={23} cy={32} r={1.6} fill={c} />
          <Circle cx={37} cy={32} r={1.6} fill={c} />
          <Path d="M22 42 Q30 50 38 42" />
          <Path d="M52 6 C52 6 46 14 46 18 A6 6 0 0 0 58 18 C58 14 52 6 52 6Z" fill={soft} />
          <Circle cx={10} cy={14} r={4} />
          <Circle cx={18} cy={8} r={2.5} />
        </G>
      );
    case 'tooth':
      return (
        <G stroke={c} {...sw}>
          <Path d="M20 13 Q32 8 44 13 Q51 24 44 36 L42 53 Q38 57 36 48 Q32 42 28 48 Q26 57 22 53 L20 36 Q13 24 20 13Z" fill={soft} />
          <Path d="M25 20 Q28 17 32 18" />
        </G>
      );
    case 'run':
      return (
        <G stroke={c} {...sw}>
          <Circle cx={38} cy={12} r={5} fill={soft} />
          <Path d="M36 20 L30 36 M35 24 L46 30 M35 24 L25 28 M30 36 L40 46 L38 58 M30 36 L22 46 L12 52" />
        </G>
      );
    case 'moon':
      return (
        <G stroke={c} {...sw}>
          <Path d="M40 8 A24 24 0 1 0 56 40 A19 19 0 0 1 40 8 Z" fill={soft} />
          <Path d="M50 10 L50 18 M46 14 L54 14" strokeWidth={2.4} />
          <Circle cx={56} cy={28} r={1.5} fill={c} />
        </G>
      );
    case 'sun':
      return (
        <G stroke={c} {...sw}>
          <Circle cx={32} cy={32} r={11} fill={soft} />
          <Path d="M32 8 V15 M32 49 V56 M8 32 H15 M49 32 H56 M15 15 L20 20 M44 44 L49 49 M15 49 L20 44 M44 20 L49 15" />
        </G>
      );
    case 'book':
      return (
        <G stroke={c} {...sw}>
          <Path d="M7 14 L30 18 L30 52 L7 48 Z" fill={soft} />
          <Path d="M57 14 L34 18 L34 52 L57 48 Z" fill={soft} />
          <Path d="M12 24 L25 26 M12 32 L25 34 M39 26 L52 24 M39 34 L52 32" strokeWidth={2} />
        </G>
      );
    case 'drop':
      return (
        <G stroke={c} {...sw}>
          <Path d="M32 7 C32 7 14 28 14 40 A18 18 0 0 0 50 40 C50 28 32 7 32 7Z" fill={soft} />
          <Path d="M24 40 A9 9 0 0 0 31 49" />
        </G>
      );
    case 'pill':
      return (
        <G stroke={c} {...sw}>
          <G rotation={-35} origin="32, 32">
            <Rect x={10} y={23} width={44} height={18} rx={9} fill={soft} />
            <Line x1={32} y1={23} x2={32} y2={41} />
          </G>
        </G>
      );
    case 'laptop':
      return (
        <G stroke={c} {...sw}>
          <Rect x={11} y={14} width={42} height={29} rx={3} fill={soft} />
          <Path d="M5 50 H59" />
          <Path d="M24 26 L19 29 L24 32 M40 26 L45 29 L40 32 M35 24 L29 34" strokeWidth={2.4} />
        </G>
      );
    case 'apple':
      return (
        <G stroke={c} {...sw}>
          <Path d="M32 20 C20 13 9 24 14 39 C17 50 26 57 32 52 C38 57 47 50 50 39 C55 24 44 13 32 20Z" fill={soft} />
          <Path d="M32 20 Q32 10 41 7" />
        </G>
      );
    default:
      return (
        <G stroke={c} {...sw}>
          <Circle cx={32} cy={32} r={23} fill={soft} />
          <Path d="M21 33 L29 41 L44 24" />
        </G>
      );
  }
}

export function Illustration({ kind, color, size = 48 }: { kind: IconKey; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Shape kind={kind} c={color} />
    </Svg>
  );
}
