import type { Column } from '../../lib/explorer/data/chartData';

export const PAD = { top: 10, right: 8, bottom: 22, left: 30 };
const GAP = 2;
const MAX_BAR = 24;

export type Part = { key: string; x: number; y: number; h: number; top: boolean };

export type Bar = { parts: Part[] };

export function yAt(value: number, top: number, plotH: number): number {
  return PAD.top + plotH - (value / top) * plotH;
}

export function ticksFor(max: number): number[] {
  const top = max <= 4 ? max : Math.ceil(max / 4) * 4;

  return top <= 1 ? [0, top] : [0, top / 2, top];
}

export function buildBars(columns: Column[], width: number, plotH: number, yTop: number) {
  const slot = (width - PAD.left - PAD.right) / Math.max(1, columns.length);
  const barW = Math.max(2, Math.min(MAX_BAR, slot - GAP));

  const bars = columns.map((column, index) => {
    const x = PAD.left + index * slot + (slot - barW) / 2;
    const visible = column.segments.filter((segment) => segment.value > 0);
    let base = 0;

    const parts: Part[] = visible.map((segment, k) => {
      const y0 = yAt(base, yTop, plotH);
      base += segment.value;
      const y1 = yAt(base, yTop, plotH);
      const h = Math.max(1, y0 - y1 - (k < visible.length - 1 ? GAP : 0));

      return { key: segment.key, x, y: y0 - h, h, top: k === visible.length - 1 };
    });

    return { parts };
  });

  return { slot, barW, bars };
}

/** Path of a column segment with a 4px rounded top and a square base. */
export function segmentPath(part: Part, w: number): string {
  const { x, y: top, h } = part;
  const r = part.top ? Math.min(4, w / 2, h) : 0;

  return `M${x},${top + h}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${top + h}Z`;
}
