import type { ReputationReport, TagScale } from '../../shared/reputation';

export type ScoreFeedbackRow = {
  chainId: number;
  tokenId: string;
  client: string;
  feedbackIndex: string;
  endpoint: string | null;
  feedbackUri: string | null;
  value: number;
  tag1: string | null;
  tag2: string | null;
  revoked: boolean;
  createdAt: number | null;
  txHash: string | null;
  responses: readonly {
    responder: string;
    uri: string | null;
    createdAt: number | null;
    txHash: string | null;
  }[];
};

/** The owner/agent-wallet pair whose rows never enter a score. */
export type SelfAddresses = { owner: string | null; agentWallet: string | null };

export type ScorableAgent = SelfAddresses & { chainId: number; tokenId: string };

export type ScorerStore = {
  chainsWithDirtyAgents(): Promise<number[]>;
  /** All feedback on a chain, joined with each agent's self addresses. */
  chainFeedback(chainId: number): Promise<(ScoreFeedbackRow & SelfAddresses)[]>;
  dirtyAgents(chainId: number, limit: number): Promise<ScorableAgent[]>;
  feedbackForAgent(chainId: number, tokenId: string): Promise<ScoreFeedbackRow[]>;
  saveTagScales(chainId: number, scales: ReadonlyMap<string, TagScale>): Promise<void>;
  saveScore(
    chainId: number,
    tokenId: string,
    report: ReputationReport,
    scoredAt: number
  ): Promise<void>;
  clearDirty(chainId: number, tokenId: string): Promise<void>;
  /** Agents whose last score is older than a day and that have feedback. */
  staleAgents(limit: number): Promise<ScorableAgent[]>;
};

export type ScorerOptions = {
  store: ScorerStore;
  /** Unix seconds. */
  now: number;
  batchSize?: number;
  log?: ((message: string) => void) | undefined;
};

export type DrainOptions = {
  store: ScorerStore;
  chainId: number;
  scales: ReadonlyMap<string, TagScale>;
  batchSize: number;
  now: number;
  log?: ((message: string) => void) | undefined;
};

export type ScorerResult = {
  chains: number;
  agents: number;
  stale: number;
  tags: number;
};
