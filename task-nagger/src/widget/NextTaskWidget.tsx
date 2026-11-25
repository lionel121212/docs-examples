import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

export type WidgetData = {
  label: string; // "Next up"
  title: string | null; // null = nothing left today
  time: string;
  color: string;
  late: boolean;
  progress: string; // "3/7"
  doneLabel: string;
  emptyLabel: string;
  taskId: string | null;
  rtl: boolean;
};

const hex = (c: string) => (/^#[0-9a-fA-F]{6}$/.test(c) ? (c as `#${string}`) : '#4f46e5');

/** Home-screen widget: the next task of today with a "done" button. */
export function NextTaskWidget(d: WidgetData) {
  const align = d.rtl ? 'right' : 'left';
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        borderRadius: 24,
        padding: 14,
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundGradient: { from: d.late ? '#dc2626' : '#4338ca', to: d.late ? '#f97316' : '#7c3aed', orientation: 'TL_BR' },
      }}
    >
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between' }}>
        <TextWidget text={`🔔 ${d.label}`} style={{ fontSize: 13, color: '#e0e7ff', fontWeight: '700' }} />
        <TextWidget text={d.progress} style={{ fontSize: 13, color: '#ffffff', fontWeight: '900' }} />
      </FlexWidget>
      {d.title ? (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'column' }}>
          <TextWidget
            text={d.title}
            maxLines={2}
            truncate="END"
            style={{ fontSize: 20, color: '#ffffff', fontWeight: '900', textAlign: align }}
          />
          <TextWidget text={d.time} style={{ fontSize: 14, color: '#e0e7ff', fontWeight: '700', textAlign: align }} />
        </FlexWidget>
      ) : (
        <TextWidget text={d.emptyLabel} style={{ fontSize: 18, color: '#ffffff', fontWeight: '900', textAlign: align }} />
      )}
      {d.title && d.taskId ? (
        <FlexWidget
          clickAction="DONE"
          clickActionData={{ taskId: d.taskId }}
          style={{ width: 'match_parent', backgroundColor: '#ffffff', borderRadius: 14, padding: 8, alignItems: 'center' }}
        >
          <TextWidget text={`✓ ${d.doneLabel}`} style={{ fontSize: 15, color: hex(d.late ? '#dc2626' : d.color), fontWeight: '900' }} />
        </FlexWidget>
      ) : (
        <TextWidget text=" " style={{ fontSize: 4 }} />
      )}
    </FlexWidget>
  );
}
