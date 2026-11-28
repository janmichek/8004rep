import { describe, expect, it } from 'vitest';
import { buildReputationReport, type ReputationReport } from './report';
import type { FeedbackInput } from './types';
import { FORMULA_VERSION, KIND_INFO, KIND_ORDER, REP_SPEC, REPORT_STEPS } from './spec';
import {
  classify,
  inferScale,
  inferTagScales,
  kindOf,
  normalize,
  tagKey,
  type ScaleRow,
} from './kinds';
import { buildRatingLayer, median, UNIT_WINDOW_DAYS } from './units';
import { betaCdf, betaContinuedFraction, betaQuantile, filteredScore } from './score';
import { canonicalJson, hashEvidence, sha256Hex } from './contentHash';
import { responsivenessOf, sameTxShare, telemetryOf } from './analysis';
import { buildFindings, type Finding } from './findings';

const DAY = 86_400;
const NOW = 2_000_000_000;

function addr(n: number): string {
  return `0x${n.toString(16).padStart(40, '0')}`;
}

function row(client: string, value: number, extra: Partial<FeedbackInput> = {}): FeedbackInput {
  return { client, value, revoked: false, ...extra };
}

function scaleRow(client: string, value: number, tag1: string, revoked = false): ScaleRow {
  return { client, value, tag1, revoked };
}

function codes(report: ReputationReport): string[] {
  return report.findings.map((finding: Finding) => finding.code);
}

describe('published spec', () => {
  it('is the canonical rep-1.0 parameter set', () => {
    expect(FORMULA_VERSION).toBe('rep-1.0');
    expect(REP_SPEC.formulaVersion).toBe(FORMULA_VERSION);
    expect(REP_SPEC.params).toEqual({
      alpha0: 3,
      mu0: 0.5,
      unitWindowDays: 30,
      halfLifeDays: 90,
      fakeTarget: 0.9,
    });
    expect(REP_SPEC.confidenceRules.dominantShare).toBe(0.3);
    expect(REP_SPEC.kinds.map((kind) => kind.kind)).toEqual(KIND_ORDER);
    expect(REPORT_STEPS).toHaveLength(7);
    expect(KIND_INFO.rating.label).toBe('rating');
  });
});

describe('tag classification', () => {
  it('folds spelling and namespaces', () => {
    expect(tagKey('  Star-Rating ')).toBe('starrating');
    expect(tagKey(undefined)).toBe('');
    expect(kindOf(undefined)).toBe('unknown');
    expect(kindOf('STARRED')).toBe('rating');
    expect(kindOf('review:submission')).toBe('outcome');
    expect(kindOf('gfx:quality')).toBe('rating');
    expect(kindOf('somethingElse')).toBe('unknown');
  });

  it('infers the narrowest rating scale', () => {
    expect(inferScale([])).toEqual({ scale: 'unbounded', span: 0 });
    expect(inferScale([7, 7])).toEqual({ scale: 'ten', span: 10 });
    expect(inferScale([50, 50])).toEqual({ scale: 'hundred', span: 100 });
    expect(inferScale([0, 1, 0, 1])).toEqual({ scale: 'binary', span: 1 });
    expect(inferScale([200, 200])).toEqual({ scale: 'unbounded', span: 0 });
    expect(inferScale([-200, -200])).toEqual({ scale: 'unbounded', span: 0 });
    expect(inferScale([-1, -5, 2, 3, 4])).toEqual({ scale: 'signed', span: 5 });
    expect(inferScale([1, 2, 3, 4, 5, 100])).toEqual({ scale: 'five', span: 5 });
    expect(inferScale([200, 201, 202, 203, 204, 205])).toEqual({ scale: 'unbounded', span: 0 });
    expect(inferScale([0, 0.5, 2, 3])).toEqual({ scale: 'five', span: 5 });
    expect(inferScale([0, 0.5, 2])).toEqual({ scale: 'five', span: 5 });
  });

  it('normalizes every scale and refuses values out of range', () => {
    expect(normalize(1, 'binary', 1)).toBe(1);
    expect(normalize(2, 'unit', 1)).toBeNull();
    expect(normalize(0.5, 'unit', 1)).toBe(0.5);
    expect(normalize(3, 'five', 5)).toBeCloseTo(0.6);
    expect(normalize(11, 'ten', 10)).toBeNull();
    expect(normalize(50, 'hundred', 100)).toBe(0.5);
    expect(normalize(0, 'signed', 5)).toBe(0.5);
    expect(normalize(9, 'signed', 5)).toBeNull();
    expect(normalize(0.5, 'unbounded', 0)).toBeNull();
  });

  it('ignores revoked rows when inferring tag scales', () => {
    const scales = inferTagScales([
      scaleRow(addr(1), 3, 'quality'),
      scaleRow(addr(2), 4, 'quality'),
      scaleRow(addr(2), 100, 'quality', true),
    ]);

    expect(scales.get('quality')?.span).toBe(5);
  });

  it('lets a reviewer override the tag scale only with enough evidence', () => {
    const rows: ScaleRow[] = [
      ...Array.from({ length: 5 }, (_, i) => scaleRow(addr(1), i, 'quality')),
      scaleRow(addr(2), 0, 'quality'),
      scaleRow(addr(2), 20, 'quality'),
      scaleRow(addr(2), 40, 'quality'),
      scaleRow(addr(2), 60, 'quality'),
      scaleRow(addr(2), 100, 'quality'),
    ];

    const result = classify(rows);
    expect(result.tags[0]?.mixedScale).toBe(true);
    expect(result.rows[0]?.scale).toBe('five');
    expect(result.rows[5]?.scale).toBe('hundred');
  });

  it('supports a binary reviewer scale', () => {
    const rows: ScaleRow[] = [
      ...[0, 1, 0, 1, 0].map((value) => scaleRow(addr(1), value, 'quality')),
      ...[0, 20, 40, 60, 100].map((value) => scaleRow(addr(2), value, 'quality')),
    ];

    const result = classify(rows);
    expect(result.rows[0]?.scale).toBe('binary');
  });

  it('treats supplied chain-wide scales as authoritative', () => {
    const rows: ScaleRow[] = Array.from({ length: 5 }, (_, i) => scaleRow(addr(1), i, 'quality'));

    const supplied = new Map([['quality', { scale: 'unit' as const, span: 1 }]]);
    const result = classify(rows, { scales: supplied });
    expect(result.tags[0]?.mixedScale).toBe(false);
    expect(result.rows[0]?.scale).toBe('unit');
    expect(result.rows[0]?.r).toBe(0);
  });

  it('skips a reviewer with too few rows to judge its scale', () => {
    const rows: ScaleRow[] = [
      ...[0, 25, 50, 75, 100].map((value) => scaleRow(addr(1), value, 'quality')),
      ...[0, 1, 2].map((value) => scaleRow(addr(2), value, 'quality')),
    ];

    expect(classify(rows).tags[0]?.mixedScale).toBe(false);
  });

  it('ignores a reviewer whose values fit no scale', () => {
    const normal = Array.from({ length: 20 }, (_, i) => (i * 5) % 101);

    const rows: ScaleRow[] = [
      ...normal.map((value) => scaleRow(addr(1), value, 'quality')),
      ...[200, 201, 202, 203, 204].map((value) => scaleRow(addr(2), value, 'quality')),
    ];

    expect(classify(rows).tags[0]?.mixedScale).toBe(false);
  });
});

describe('rating layer', () => {
  it('returns an empty layer for no feedback', () => {
    const layer = buildRatingLayer([], { now: NOW });
    expect(median([])).toBeNull();
    expect(layer.units).toEqual([]);
    expect(layer.wallets).toEqual([]);
    expect(layer.counts.total).toBe(0);
  });

  it('counts every row kind and keeps non-ratings out of units', () => {
    const layer = buildRatingLayer(
      [
        row(addr(1), 5, { tag1: 'starred', createdAt: NOW }),
        row(addr(1), 1, { tag1: 'reachable', createdAt: NOW }),
        row(addr(1), 99, { tag1: 'uptime', createdAt: NOW }),
        row(addr(2), 1000, { tag1: 'revenue', createdAt: NOW }),
        row(addr(3), 4, { tag1: 'mystery', createdAt: NOW }),
        row(addr(4), 200, { tag1: 'starred', createdAt: NOW }),
        row(addr(5), 4, { tag1: 'starred', revoked: true, createdAt: NOW }),
        row(addr(6), 4, { tag1: 'starred', createdAt: NOW }),
      ],
      { now: NOW, self: [addr(6)] }
    );

    expect(layer.counts.rating).toBe(2);
    expect(layer.counts.outcome).toBe(1);
    expect(layer.counts.telemetry).toBe(1);
    expect(layer.counts.metric).toBe(1);
    expect(layer.counts.unknown).toBe(1);
    expect(layer.counts.outOfScale).toBe(2);
    expect(layer.counts.revoked).toBe(1);
    expect(layer.counts.self).toBe(1);
    expect(layer.units).toHaveLength(0);
  });

  it('uses a supplied chain-wide scale instead of this agent', () => {
    const scales = new Map([['starred', { scale: 'unit' as const, span: 1 }]]);

    const layer = buildRatingLayer([row(addr(1), 1, { tag1: 'starred', createdAt: NOW })], {
      now: NOW,
      scales,
    });

    expect(layer.classified[0]?.r).toBe(1);
  });

  it('uses a custom window and half-life', () => {
    const layer = buildRatingLayer(
      Array.from({ length: 5 }, (_, i) =>
        row(addr(1), 5, { tag1: 'starred', createdAt: NOW - i * DAY })
      ),
      { now: NOW, unitWindowDays: 1, halfLifeDays: 10 }
    );

    expect(UNIT_WINDOW_DAYS).toBe(30);
    expect(layer.units.length).toBeGreaterThan(1);
  });

  it('leaves undated rows at full weight', () => {
    const layer = buildRatingLayer([row(addr(1), 4, { tag1: 'starred' })], { now: NOW });
    expect(layer.units[0]?.ageDays).toBe(0);
    expect(layer.units[0]?.time).toBe(1);
  });
});

describe('score math', () => {
  it('handles beta boundaries', () => {
    expect(betaCdf(0, 2, 2)).toBe(0);
    expect(betaCdf(1, 2, 2)).toBe(1);
    expect(betaCdf(0.5, 0.2, 0.2)).toBeGreaterThan(0);
    expect(betaQuantile(0.5, 3, 3)).toBeCloseTo(0.5, 4);
  });

  it('exercises the continued-fraction guards', () => {
    expect(betaContinuedFraction(0.5, 1.5, 0.75)).toBeGreaterThan(0);
    expect(betaContinuedFraction(1, 2, 0.75)).toBeGreaterThan(0);
    expect(Number.isFinite(betaContinuedFraction(0.5, 2, 0.999999999))).toBe(true);
  });

  it('reports medium and high confidence', () => {
    const medium = filteredScore([
      { client: addr(1), units: [], r: 0.8, weight: 1, rows: 1 },
      { client: addr(2), units: [], r: 0.8, weight: 1, rows: 1 },
      { client: addr(3), units: [], r: 0.8, weight: 1, rows: 1 },
    ]);

    expect(medium.confidence).toBe('medium');

    const wallets = Array.from({ length: 12 }, (_, i) => ({
      client: addr(i + 1),
      units: [],
      r: 0.9,
      weight: 1,
      rows: 1,
    }));

    expect(filteredScore(wallets).confidence).toBe('high');
    expect(filteredScore([]).confidence).toBe('low');
  });
});

describe('analysis helpers', () => {
  it('handles missing rows and multiple response times', () => {
    const low = {
      kind: 'rating' as const,
      tag: 'starred',
      scale: 'five' as const,
      span: 5,
      r: 0.2,
    };

    expect(responsivenessOf([], [low], [0], [])).toEqual({
      lowRatings: 1,
      responded: 0,
      share: 0,
      medianLagDays: null,
      ownerReplies: 0,
      thirdPartyReplies: 0,
    });

    const answered = row(addr(1), 1, {
      tag1: 'starred',
      createdAt: NOW - 10 * DAY,
      responses: [
        { responder: addr(2), createdAt: NOW - 8 * DAY },
        { responder: addr(3), createdAt: NOW - 5 * DAY },
      ],
    });

    const feedback = [answered];
    expect(responsivenessOf(feedback, [low], [0], []).medianLagDays).toBe(2);
  });

  it('measures telemetry without dates', () => {
    const layer = buildRatingLayer(
      [row(addr(1), 99, { tag1: 'uptime' }), row(addr(1), 98, { tag1: 'uptime', createdAt: NOW })],
      { now: NOW }
    );

    const summary = telemetryOf(
      [row(addr(1), 99, { tag1: 'uptime' })],
      layer.classified.slice(0, 1)
    );

    expect(summary[0]?.latest).toBe(99);
  });

  it('measures same-transaction rows', () => {
    const feedback = [
      row(addr(1), 5, { tag1: 'starred', txHash: '0xaa' }),
      row(addr(2), 5, { tag1: 'starred', txHash: '0xaa' }),
      row(addr(3), 5, { tag1: 'starred', txHash: '0xbb' }),
      row(addr(4), 5, { tag1: 'starred' }),
    ];

    expect(sameTxShare(feedback, [0, 1, 2, 3])).toBeCloseTo(2 / 3);
    expect(sameTxShare([], [])).toBeNull();
  });
});

function ratingRows(count: number, value = 100): FeedbackInput[] {
  return Array.from({ length: count }, (_, i) =>
    row(addr(i + 1), value, { tag1: 'starred', createdAt: NOW })
  );
}

describe('findings', () => {
  it('flags a templated scale', () => {
    const report = buildReputationReport(ratingRows(5), { now: NOW });
    expect(codes(report)).toContain('template');
  });

  it('flags a repeated wallet', () => {
    const report = buildReputationReport(
      Array.from({ length: 6 }, () => row(addr(1), 5, { tag1: 'starred', createdAt: NOW })),
      { now: NOW }
    );

    expect(codes(report)).toContain('repeat');
  });

  it('flags same-transaction bursts', () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      row(addr(i + 1), 5, { tag1: 'starred', createdAt: NOW, txHash: '0xaa' })
    );

    rows.push(row(addr(9), 5, { tag1: 'starred', createdAt: NOW, txHash: '0xbb' }));
    const report = buildReputationReport(rows, { now: NOW });
    expect(codes(report)).toContain('same-tx');
  });

  it('flags a dated burst', () => {
    const rows = [
      ...Array.from({ length: 10 }, (_, i) =>
        row(addr(i + 1), 5, { tag1: 'starred', createdAt: NOW })
      ),
      ...Array.from({ length: 20 }, (_, i) =>
        row(addr(i + 11), 5, { tag1: 'starred', createdAt: NOW - (i + 1) * 2 * DAY })
      ),
    ];

    const report = buildReputationReport(rows, { now: NOW });
    expect(codes(report)).toContain('burst');
  });

  it('flags a review bomb', () => {
    const report = buildReputationReport(ratingRows(6, 0), { now: NOW });
    expect(codes(report)).toContain('review-bomb');
  });

  it('flags revocations', () => {
    const rows = [
      ...ratingRows(7),
      ...Array.from({ length: 3 }, (_, i) =>
        row(addr(i + 20), 5, { tag1: 'starred', revoked: true, createdAt: NOW })
      ),
    ];

    const report = buildReputationReport(rows, { now: NOW });
    expect(codes(report)).toContain('revocations');
  });

  it('returns nothing when the rows are clean', () => {
    const findings = buildFindings({
      feedback: [],
      classified: [],
      ratingIdx: [],
      counts: {
        total: 0,
        revoked: 0,
        rating: 0,
        outcome: 0,
        telemetry: 0,
        metric: 0,
        unknown: 0,
        outOfScale: 0,
        self: 0,
      },
      burst: { maxDayRows: 0, activeDays: 0, ratio: null, datedRows: 0 },
      sameTxShare: null,
    });

    expect(findings).toEqual([]);
  });
});

describe('report', () => {
  it('is unrated without ratings and still exposes a funnel', () => {
    const report = buildReputationReport([row(addr(1), 1, { tag1: 'uptime', createdAt: NOW })], {
      now: NOW,
    });

    expect(report.unrated).toBe(true);
    expect(report.score).toBeNull();
    expect(report.interval).toBeNull();
    expect(report.waterfall.at(-1)?.average).toBeNull();
    expect(report.telemetry[0]?.rows).toBe(1);
  });

  it('carries every published parameter into the report', () => {
    const report = buildReputationReport([], {
      alpha0: 4,
      mu0: 0.4,
      fakeTarget: 0.8,
      unitWindowDays: 15,
      halfLifeDays: 45,
    });

    expect(report.params).toEqual({
      unitWindowDays: 15,
      halfLifeDays: 45,
      alpha0: 4,
      mu0: 0.4,
      fakeTarget: 0.8,
    });
  });

  it('scores the same rows and emits the canonical waterfall', () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      row(addr(i + 1), 5, { tag1: 'starred', createdAt: NOW - i * DAY })
    );

    const report = buildReputationReport(rows, { now: NOW });
    expect(report.score).not.toBeNull();
    expect(report.waterfall.map((step) => step.id)).toEqual([
      'all',
      'revoked',
      'ratings',
      'self',
      'units',
      'cap',
      'prior',
    ]);
    expect(report.waterfall[0]?.delta).toBeNull();
    expect(report.waterfall[1]?.delta).toBe(0);
    expect(report.byKind[0]?.kind).toBe('rating');
    expect(report.contributions.length).toBe(12);
  });
});

describe('canonical hashing', () => {
  it('sorts keys recursively and matches the FIPS vector', async () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } })).toBe(
      '{"a":{"c":[3,{"e":5,"f":4}],"d":2},"b":1}'
    );
    await expect(sha256Hex('abc')).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    const a = await hashEvidence({ b: 1, a: 2 });
    const b = await hashEvidence({ a: 2, b: 1 });
    expect(a.value).toBe(b.value);
    expect(a.algorithm).toBe('sha256');
  });
});
