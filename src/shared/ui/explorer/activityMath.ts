export const DAY = 86400;

export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Sunday-first weekday labels, empty where GitHub leaves them blank. */
export const DAY_ROWS = [
  { key: 'sun', label: '' },
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: '' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: '' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: '' },
];

export type ActivityCell = { day: number; date: string; count: number; level: number };

export function cellTitle(cell: ActivityCell): string {
  return `${cell.date} · ${cell.count} feedback${cell.count === 1 ? '' : 's'}`;
}
