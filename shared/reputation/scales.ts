import type { Scale } from './spec';

export type TagScale = { scale: Scale; span: number };

const SIGNED_SPANS = [1, 5, 10, 100] as const;

function unbounded(): TagScale {
  return { scale: 'unbounded', span: 0 };
}

function spanCovering(reach: number): number | null {
  for (const span of SIGNED_SPANS) {
    if (reach <= span) return span;
  }

  return null;
}

function scaleForSpan(span: number): Scale {
  if (span === 5) return 'five';

  if (span === 10) return 'ten';

  return 'hundred';
}

/** One repeated value cannot tell 1/5 from 1/100; use the narrowest non-binary scale. */
function inferRepeated(value: number): TagScale {
  if (value < 0) {
    const span = spanCovering(Math.abs(value));

    return span === null ? unbounded() : { scale: 'signed', span };
  }

  if (value <= 5) return { scale: 'five', span: 5 };

  if (value <= 10) return { scale: 'ten', span: 10 };

  if (value <= 100) return { scale: 'hundred', span: 100 };

  return unbounded();
}

function isBinary(value: number): boolean {
  return value === 0 || value === 1;
}

function countNegatives(values: readonly number[]): number {
  let count = 0;

  for (const value of values) {
    if (value < 0) count++;
  }

  return count;
}

/** Read a signed scale off the bulk of the absolute values (80th percentile). */
function inferSigned(values: readonly number[]): TagScale {
  const abs = values.map(Math.abs).toSorted((a, b) => a - b);
  const at = (abs.length - 1) * 0.8;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  const lower = abs[lo] ?? 0;
  const upper = abs[hi] ?? lower;
  const span = spanCovering(lower + (upper - lower) * (at - lo));

  return span === null ? unbounded() : { scale: 'signed', span };
}

/** With only a handful of values there is no bulk to read: use the widest. */
function widestFit(values: readonly number[]): TagScale {
  for (const span of [1, 5, 10, 100]) {
    if (values.every((value) => value >= 0 && value <= span)) {
      return { scale: span === 1 ? 'unit' : scaleForSpan(span), span };
    }
  }

  return unbounded();
}

/** A single wild value must not redefine the tag: 20% may fall out of range. */
function bulkFit(values: readonly number[]): TagScale {
  const allowed = Math.max(1, Math.floor(values.length * 0.2));
  const required = Math.max(1, values.length - allowed);

  for (const span of [1, 5, 10, 100]) {
    if (values.filter((value) => value >= 0 && value <= span).length >= required) {
      return { scale: span === 1 ? 'unit' : scaleForSpan(span), span };
    }
  }

  return unbounded();
}

/**
 * Scale from the observed values: {0,1} is a pass/fail, negatives make a
 * signed scale (±1, ±5, ±10 or ±100), else the narrowest of 0–1, 0–5, 0–10,
 * 0–100 that holds them. Anything wider is no rating scale.
 */
export function inferScale(values: readonly number[]): TagScale {
  const first = values[0];

  if (first === undefined) return unbounded();
  const distinct = new Set(values);

  if (distinct.size === 1) return inferRepeated(first);

  // A pass/fail scale is only evident when both outcomes are present.
  if (values.every(isBinary)) return { scale: 'binary', span: 1 };

  if (countNegatives(values) / values.length > 0.2) return inferSigned(values);

  if (values.length < 5) return widestFit(values);

  return bulkFit(values);
}

function unitValue(value: number): number | null {
  return value >= 0 && value <= 1 ? value : null;
}

function boundedValue(value: number, span: number): number | null {
  return value >= 0 && value <= span ? value / span : null;
}

function signedValue(value: number, span: number): number | null {
  return Math.abs(value) <= span ? (value + span) / (2 * span) : null;
}

/** Value read on its scale, in [0,1]; null when it fits no rating scale. */
export function normalize(value: number, scale: Scale, span: number): number | null {
  if (scale === 'binary' || scale === 'unit') return unitValue(value);

  if (scale === 'unbounded') return null;

  if (scale === 'signed') return signedValue(value, span);

  return boundedValue(value, span);
}
