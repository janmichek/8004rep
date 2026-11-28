import { readFileSync } from 'node:fs';
import { getAddress } from 'viem';
import { z } from 'zod';
import {
  calibrateAgents,
  type CalibrationAgent,
  type CalibrationConfig,
} from '../src/shared/lib/explorer/data/calibration';
import type { Feedback } from '../src/shared/lib/explorer/data/types';

const DAY = 86_400;
const NOW = 1_767_225_600; // 2026-01-01T00:00:00Z, fixed so the demo is reproducible.
const OWNER = '0x00000000000000000000000000000000000000aa' as const;

function addr(n: number) {
  return getAddress(`0x${n.toString(16).padStart(40, '0')}`);
}

function row(client: `0x${string}`, value: number, daysAgo: number, tag1 = 'quality'): Feedback {
  return {
    client,
    value,
    tag1,
    revoked: false,
    createdAt: NOW - daysAgo * DAY,
  };
}

/** Deterministic demo data; replace it with a real export when one exists. */
function demoAgents(): CalibrationAgent[] {
  const agents: CalibrationAgent[] = [];
  const clean = [82, 88, 74, 91, 68, 79];

  clean.forEach((score, a) => {
    const feedback = Array.from({ length: 8 + (a % 4) }, (_, i) =>
      row(addr(100 + a * 20 + i), Math.max(0, Math.min(100, score + ((i % 5) - 2) * 6)), 2 + i * 4)
    );

    agents.push({ id: `clean-${a + 1}`, feedback });
  });

  agents.push({
    id: 'thin-1',
    feedback: [row(addr(900), 92, 2), row(addr(901), 90, 9)],
  });
  agents.push({ id: 'thin-2', feedback: [row(addr(902), 15, 4)] });

  agents.push({
    id: 'sybil-burst',
    feedback: Array.from({ length: 12 }, (_, i) => row(addr(1000 + i), 96, 3)),
  });
  agents.push({
    id: 'sybil-flat',
    feedback: Array.from({ length: 10 }, (_, i) => row(addr(1100 + i), 88, 20 + i * 3)),
  });

  agents.push({
    id: 'self-inflated',
    feedback: [
      row(OWNER, 100, 1),
      row(OWNER, 100, 2),
      ...Array.from({ length: 6 }, (_, i) => row(addr(1200 + i), 72 + (i % 3) * 5, 10 + i * 12)),
    ],
  });

  agents.push({
    id: 'declining',
    feedback: [
      ...Array.from({ length: 8 }, (_, i) => row(addr(1300 + i), 92 - (i % 3) * 4, 100 + i * 5)),
      ...Array.from({ length: 5 }, (_, i) => row(addr(1400 + i), 38 + (i % 3) * 6, 5 + i * 3)),
    ],
  });

  agents.push({
    id: 'polarized',
    feedback: Array.from({ length: 10 }, (_, i) =>
      row(addr(1500 + i), i % 2 === 0 ? 8 : 96, 15 + i * 4)
    ),
  });

  agents.push({
    id: 'telemetry-only',
    feedback: Array.from({ length: 6 }, (_, i) => row(addr(1600 + i), 99, 2 + i, 'uptime')),
  });

  return agents;
}

const feedbackSchema = z
  .object({
    client: z.string().regex(/^0x[0-9a-f]{40}$/i),
    value: z.number(),
    tag1: z.string().optional(),
    revoked: z.boolean().optional(),
    createdAt: z.number().optional(),
  })
  .passthrough();

const agentSchema = z.object({
  id: z.string().optional(),
  feedback: z.array(feedbackSchema),
});

const inputSchema = z.union([z.array(agentSchema), z.object({ agents: z.array(agentSchema) })]);

type ParsedFeedback = z.infer<typeof feedbackSchema>;

function toFeedback(value: ParsedFeedback): Feedback {
  const feedback: Feedback = {
    client: getAddress(value.client),
    value: value.value,
    revoked: value.revoked ?? false,
  };

  if (value.tag1 !== undefined) feedback.tag1 = value.tag1;

  if (value.createdAt !== undefined) feedback.createdAt = value.createdAt;

  return feedback;
}

function loadAgents(path: string): CalibrationAgent[] {
  const parsed = inputSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
  const agents = Array.isArray(parsed) ? parsed : parsed.agents;

  return agents.map((agent, index) => ({
    id: agent.id ?? `agent-${index + 1}`,
    feedback: agent.feedback.map(toFeedback),
  }));
}

const CONFIGS: CalibrationConfig[] = [
  { id: 'current', label: 'Current (α=3, 90d, 30d)', options: {} },
  { id: 'fast', label: 'Fast decay (30d)', options: { halfLifeDays: 30 } },
  { id: 'slow', label: 'Slow decay (180d)', options: { halfLifeDays: 180 } },
  { id: 'strong-prior', label: 'Strong prior (α=5)', options: { alpha0: 5 } },
  { id: 'weak-prior', label: 'Weak prior (α=1)', options: { alpha0: 1 } },
  { id: 'short-window', label: 'Short unit window (7d)', options: { unitWindowDays: 7 } },
  { id: 'long-window', label: 'Long unit window (90d)', options: { unitWindowDays: 90 } },
];

const input = process.argv[2];
const agents = input ? loadAgents(input) : demoAgents();
const rows = calibrateAgents(agents, CONFIGS);

const source = input
  ? `Calibration over ${agents.length} agents from ${input}.`
  : `Calibration over ${agents.length} synthetic demo agents (pass a JSON export to use real data).`;

console.log(source);

console.log('');

console.log('| Config | Trusted | Fair | Flagged | Spearman ρ |');

console.log('| --- | ---: | ---: | ---: | ---: |');

for (const result of rows) {
  console.log(
    `| ${result.config.label} | ${result.trusted} | ${result.fair} | ${result.flagged} | ${result.rho.toFixed(4)} |`
  );
}
