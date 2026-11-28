import { describe, expect, it } from 'vitest';
import type { ReputationReport, TagScale } from '../../shared/reputation';
import { buildReputationReport } from '../../shared/reputation';
import { runScorer, type ScorableAgent, type ScoreFeedbackRow, type ScorerStore } from './scorer';

const OWNER = '0x1111111111111111111111111111111111111111';
const SELF = '0x2222222222222222222222222222222222222222';
const CLIENT = '0x3333333333333333333333333333333333333333';

function feedback(overrides: Partial<ScoreFeedbackRow> = {}): ScoreFeedbackRow {
  return {
    chainId: 8453,
    tokenId: '7',
    client: CLIENT,
    feedbackIndex: '0',
    endpoint: null,
    feedbackUri: null,
    value: 5,
    tag1: 'starred',
    tag2: null,
    revoked: false,
    createdAt: 1_700_000_000,
    txHash: '0xabc',
    responses: [],
    ...overrides,
  };
}

type State = {
  scales: { chainId: number; scales: ReadonlyMap<string, TagScale> }[];
  scores: { chainId: number; tokenId: string; report: ReputationReport; scoredAt: number }[];
  cleared: string[];
};

function fakeStore(options: {
  dirtyChains: number[];
  chainRows: (ScoreFeedbackRow & { owner: string | null; agentWallet: string | null })[];
  dirty: ScorableAgent[];
  agentRows: ScoreFeedbackRow[];
  stale: ScorableAgent[];
}): ScorerStore & { state: State } {
  const state: State = { scales: [], scores: [], cleared: [] };
  let dirtyCalls = 0;
  let staleCalls = 0;

  const store: ScorerStore & { state: State } = {
    state,
    async chainsWithDirtyAgents() {
      return options.dirtyChains;
    },
    async chainFeedback() {
      return options.chainRows;
    },
    async dirtyAgents() {
      dirtyCalls++;

      return dirtyCalls === 1 ? options.dirty : [];
    },
    async feedbackForAgent() {
      return options.agentRows;
    },
    async saveTagScales(chainId, scales) {
      state.scales.push({ chainId, scales });
    },
    async saveScore(chainId, tokenId, report, scoredAt) {
      state.scores.push({ chainId, tokenId, report, scoredAt });
    },
    async clearDirty(chainId, tokenId) {
      state.cleared.push(`${chainId}:${tokenId}`);
    },
    async staleAgents() {
      staleCalls++;

      return staleCalls === 1 ? options.stale : [];
    },
  };

  return store;
}

describe('scorer', () => {
  it('rebuilds chain scales, scores dirty agents, and sweeps stale ones', async () => {
    const dirty = { chainId: 8453, tokenId: '7', owner: OWNER, agentWallet: SELF };

    const store = fakeStore({
      dirtyChains: [8453],
      chainRows: [
        { ...feedback({ client: CLIENT }), owner: OWNER, agentWallet: SELF },
        { ...feedback({ client: SELF, value: 1 }), owner: OWNER, agentWallet: SELF },
        {
          ...feedback({ client: '0x4444444444444444444444444444444444444444' }),
          owner: OWNER,
          agentWallet: SELF,
        },
      ],
      dirty: [dirty],
      agentRows: [
        feedback({
          tag2: 'second',
          endpoint: 'https://endpoint.example',
          feedbackUri: 'https://file.example',
          responses: [
            {
              responder: OWNER,
              uri: 'https://reply.example',
              createdAt: 1_700_000_100,
              txHash: '0xdef',
            },
          ],
        }),
      ],
      stale: [dirty],
    });

    const result = await runScorer({ store, now: 2_000_000, batchSize: 2 });

    expect(result).toEqual({ chains: 1, agents: 1, stale: 1, tags: 1 });
    expect(store.state.scales[0]?.scales.has('starred')).toBe(true);
    expect(store.state.scores).toHaveLength(2);
    expect(store.state.scores[0]?.report.formulaVersion).toBe('rep-1.0');
    expect(store.state.cleared).toEqual(['8453:7', '8453:7']);
  });

  it('logs and stops a chain when one dirty agent fails', async () => {
    const dirty = { chainId: 8453, tokenId: '7', owner: OWNER, agentWallet: SELF };

    const store = fakeStore({
      dirtyChains: [8453],
      chainRows: [],
      dirty: [dirty],
      agentRows: [feedback()],
      stale: [],
    });

    store.saveScore = async () => {
      throw new Error('boom');
    };

    const logs: string[] = [];

    const result = await runScorer({ store, now: 0, log: (message) => logs.push(message) });

    expect(result.agents).toBe(0);
    expect(logs[0]).toContain('score failed 8453:7: boom');
  });

  it('logs and stops the stale sweep when one agent fails', async () => {
    const stale = { chainId: 8453, tokenId: '8', owner: OWNER, agentWallet: SELF };

    const store = fakeStore({
      dirtyChains: [],
      chainRows: [],
      dirty: [],
      agentRows: [feedback()],
      stale: [stale],
    });

    store.saveScore = async () => {
      throw new Error('stale boom');
    };

    const logs: string[] = [];

    await runScorer({ store, now: 0, log: (message) => logs.push(message) });

    expect(logs[0]).toContain('stale score failed 8453:8: stale boom');
  });

  it('handles an empty queue and a real report', async () => {
    const report = buildReputationReport([], { now: 0 });
    expect(report.unrated).toBe(true);

    const store = fakeStore({
      dirtyChains: [],
      chainRows: [],
      dirty: [],
      agentRows: [],
      stale: [],
    });

    const result = await runScorer({ store, now: 0 });
    expect(result).toEqual({ chains: 0, agents: 0, stale: 0, tags: 0 });
  });

  it('rebuilds scales for a stale chain outside the dirty set', async () => {
    const dirty = { chainId: 8453, tokenId: '7', owner: OWNER, agentWallet: SELF };

    const store = fakeStore({
      dirtyChains: [],
      chainRows: [],
      dirty: [],
      agentRows: [feedback()],
      stale: [dirty],
    });

    const result = await runScorer({ store, now: 0, batchSize: 1 });
    expect(result.stale).toBe(1);
    expect(store.state.scores).toHaveLength(1);
  });

  it('reuses a chain scale for stale agents on the same chain', async () => {
    const dirty = { chainId: 8453, tokenId: '7', owner: OWNER, agentWallet: SELF };

    const store = fakeStore({
      dirtyChains: [8453],
      chainRows: [],
      dirty: [dirty],
      agentRows: [],
      stale: [dirty],
    });

    await runScorer({ store, now: 0, batchSize: 1 });
    expect(store.state.scales).toHaveLength(1);
  });
});
