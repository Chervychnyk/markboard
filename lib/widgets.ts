// Widget registry: label (an i18n key) and config fields for the form dialog. Views are in components/widgets/.
import type { FormField } from './dialogs.svelte.ts';
import { t } from './i18n.ts';
import type { Widget } from './types.ts';

const label = (w: Widget): FormField => ({ name: 'label', label: t('Label'), value: w.label });

export const WIDGETS: Record<string, { label: string; fields?: (w: Widget) => FormField[] }> = {
  clock: {
    label: 'Date & time',
    fields: (w) => [
      label(w),
      { name: 'tz', label: t('Time zone'), type: 'select', value: w.tz ?? '', options: [['', t('Local time')], ...Intl.supportedValuesOf('timeZone').map((z): [string] => [z])] },
      { name: 'hours', label: t('Format'), type: 'select', value: w.hours ?? '', options: [['', t('Automatic')], ['24', t('24-hour')], ['12', t('12-hour')]] },
    ],
  },
  countdown: {
    label: 'Countdown',
    fields: (w) => [label(w), { name: 'to', label: t('Count down to'), type: 'datetime-local', value: w.to, required: true }],
  },
  timer: { label: 'Timer', fields: (w) => [label(w)] },
  pomodoro: { label: 'Pomodoro' },
  counter: {
    label: 'Counter',
    fields: (w) => [
      label(w),
      { name: 'goal', label: t('Goal (optional)'), type: 'number', value: w.goal },
      { name: 'reset', label: t('Reset to zero'), type: 'select', value: w.reset ?? '',
        options: [['', t('Never')], ['day', t('Every day')], ['week', t('Every week (Monday)')], ['month', t('Every month')]] },
    ],
  },
  snippet: {
    label: 'Snippet',
    fields: (w) => [label(w), { name: 'text', label: t('Text'), type: 'textarea', value: w.text }],
  },
  // A chosen file is stored on the widget as a data: URL under the field's name.
  photo: {
    label: 'Photo frame',
    fields: (w) => [label(w), { name: 'image', label: t('Photo'), type: 'file', accept: 'image/*' }],
  },
};
