import { z } from 'zod';

/** Never ask an RPC for less than this many blocks. */
export const MIN_CHUNK = 50n;

/** Clean chunks needed before the window ramps back up. */
const RAMP_AFTER = 3;

/** Cap for exponential backoff on transient RPC failures. */
const MAX_BACKOFF_MS = 30_000;

export type ChunkState = {
  maxRange: bigint;
  window: bigint;
  clean: number;
};

function clampRange(range: bigint): bigint {
  return range < MIN_CHUNK ? MIN_CHUNK : range;
}

/** Starts at the registry's documented range or wider, but never below MIN_CHUNK. */
export function createChunkState(maxRange: bigint): ChunkState {
  return { maxRange: clampRange(maxRange), window: clampRange(maxRange), clean: 0 };
}

/** The number of blocks to request from `fromBlock` without passing the safe head. */
export function chunkLength(state: ChunkState, fromBlock: bigint, safeHead: bigint): bigint {
  const remaining = safeHead - fromBlock + 1n;

  if (remaining <= 0n) return 0n;

  return remaining < state.window ? remaining : state.window;
}

/** After RAMP_AFTER clean chunks the window doubles, capped at the configured maximum. */
export function onChunkSuccess(state: ChunkState): ChunkState {
  const clean = state.clean + 1;

  if (clean < RAMP_AFTER) return { ...state, clean };

  const doubled = state.window * 2n;
  const window = doubled > state.maxRange ? state.maxRange : doubled;

  return { ...state, window, clean: 0 };
}

/** A range rejection halves the window; layer-1 floors keep the next retry useful. */
export function onRangeError(state: ChunkState): ChunkState {
  const halved = state.window / 2n;

  return { ...state, window: clampRange(halved), clean: 0 };
}

/** Transient failures keep the window and reset the clean streak. */
export function onTransientError(state: ChunkState): ChunkState {
  return { ...state, clean: 0 };
}

/** Exponential backoff with jitter: one attempt retries after 0.5–1 s. */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
  const base = 500 * 2 ** Math.max(0, attempt);
  const capped = base > MAX_BACKOFF_MS ? MAX_BACKOFF_MS : base;

  return Math.round(capped * (0.5 + random() * 0.5));
}

export type RpcFailure = {
  kind: 'range' | 'transient' | 'fatal';
  message: string;
  status?: number;
};

const RANGE_PATTERNS = [/range too large/i, /query returned more than/i, /block range/i];

const TRANSIENT_PATTERNS = [
  /rate limit/i,
  /too many requests/i,
  /timeout/i,
  /timed out/i,
  /fetch failed/i,
  /econnreset/i,
  /socket hang up/i,
];

type RpcErrorFields = { message: string; code?: number | undefined; status?: number | undefined };

const RPC_ERROR = z.union([
  z.string().transform((message) => ({ message })),
  z
    .object({
      message: z.string().optional(),
      code: z.number().optional(),
      status: z.number().optional(),
    })
    .loose()
    .transform((value) => ({
      message: value.message ?? '',
      code: value.code,
      status: value.status,
    })),
]);

function readRpcError(cause: unknown): RpcErrorFields | null {
  const parsed = RPC_ERROR.safeParse(cause);

  return parsed.success ? parsed.data : null;
}

function isRangeFailure(error: RpcErrorFields | null, message: string): boolean {
  return (
    error?.code === -32_005 ||
    error?.status === 413 ||
    RANGE_PATTERNS.some((pattern) => pattern.test(message))
  );
}

function isTransientFailure(error: RpcErrorFields | null, message: string): boolean {
  return (
    error?.status === 429 ||
    error?.code === 429 ||
    TRANSIENT_PATTERNS.some((pattern) => pattern.test(message))
  );
}

/**
 * Classifies an RPC failure so the sync loop can halve a window, retry with
 * backoff, or stop. Unknown shapes are fatal rather than retried forever.
 */
export function rpcFailure(cause: unknown): RpcFailure {
  const error = readRpcError(cause);
  const message = error?.message ?? 'unknown rpc failure';
  let kind: RpcFailure['kind'] = 'fatal';

  if (isRangeFailure(error, message)) kind = 'range';
  else if (isTransientFailure(error, message)) kind = 'transient';

  const failure: RpcFailure = { kind, message };

  if (error?.status !== undefined) failure.status = error.status;

  return failure;
}
