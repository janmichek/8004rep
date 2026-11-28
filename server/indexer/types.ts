import type { Hex } from 'viem';

export type CursorStatus = 'idle' | 'syncing' | 'ok' | 'error';

export type Cursor = {
  chainId: number;
  lastIndexedBlock: bigint;
  lastIndexedHash: string | null;
  headBlock: bigint | null;
  status: CursorStatus;
  lastError: string | null;
};

export type BlockRef = { number: bigint; hash: string; timestamp: bigint };

/** The raw log shape the decoder reads; viem logs are mapped onto it at the edge. */
export type RawLog = {
  data: Hex;
  topics: readonly Hex[];
  blockNumber?: bigint | null | undefined;
  logIndex?: number | null | undefined;
  transactionHash?: Hex | null | undefined;
};

export type ChainRpc = {
  getBlockNumber(): Promise<bigint>;
  getBlock(blockNumber: bigint): Promise<BlockRef | null>;
  getLogs(args: {
    address: readonly `0x${string}`[];
    fromBlock: bigint;
    toBlock: bigint;
  }): Promise<RawLog[]>;
};

type MutationBase = {
  blockNumber: bigint;
  blockTimestamp: bigint;
  logIndex: number;
  txHash: string;
};

export type TransferMutation = MutationBase & {
  kind: 'transfer';
  tokenId: bigint;
  from: string;
  to: string;
};

export type RegisteredMutation = MutationBase & {
  kind: 'registered';
  tokenId: bigint;
  owner: string;
  agentUri: string;
};

export type UriUpdatedMutation = MutationBase & {
  kind: 'uri-updated';
  tokenId: bigint;
  agentUri: string;
};

export type MetadataSetMutation = MutationBase & {
  kind: 'metadata-set';
  tokenId: bigint;
  key: string;
  valueHex: string;
  /** Decoded wallet when the key is `agentWallet` and the bytes are a valid address. */
  wallet: string | null;
};

export type FeedbackMutation = MutationBase & {
  kind: 'feedback';
  tokenId: bigint;
  client: string;
  feedbackIndex: bigint;
  valueRaw: string;
  valueDecimals: number;
  valueScaled: number;
  tag1: string;
  tag2: string;
  tagKey: string;
  endpoint: string;
  feedbackUri: string;
  feedbackHash: string;
};

export type FeedbackRevokedMutation = MutationBase & {
  kind: 'feedback-revoked';
  tokenId: bigint;
  client: string;
  feedbackIndex: bigint;
};

export type ResponseAppendedMutation = MutationBase & {
  kind: 'response-appended';
  tokenId: bigint;
  client: string;
  feedbackIndex: bigint;
  responder: string;
  responseUri: string;
  responseHash: string;
};

export type Mutation =
  | TransferMutation
  | RegisteredMutation
  | UriUpdatedMutation
  | MetadataSetMutation
  | FeedbackMutation
  | FeedbackRevokedMutation
  | ResponseAppendedMutation;

export type CursorWrite = {
  chainId: number;
  block: bigint;
  hash: string | null;
  headBlock: bigint | null;
  status: CursorStatus;
  error: string | null;
};

export type ApplyChunk = {
  chainId: number;
  mutations: readonly Mutation[];
  cursor: CursorWrite;
};

export type IndexerStore = {
  getCursor(chainId: number): Promise<Cursor | null>;
  applyChunk(chunk: ApplyChunk): Promise<void>;
  writeCursor(cursor: CursorWrite): Promise<void>;
  /** Deletes rows strictly above `aboveBlock`, then moves the cursor back. */
  unwind(chainId: number, aboveBlock: bigint, cursor: CursorWrite): Promise<void>;
};
