import { keccak256, toBytes } from 'viem'
import { normalizeRegistrationFile } from '../../src/data/metadata'
import type { Feedback } from '../../src/data/types'
import { ENRICH_BATCH } from './config'
import { all, run } from './db'
import { fetchText } from './httpFetch'

/** First retry delay; doubles per failure up to six hours. */
const RETRY_BASE_SECONDS = Number(process.env.ENRICH_RETRY_SECONDS ?? 300)

function retryAt(attempts: number): number {
  return Math.floor(Date.now() / 1000) + Math.min(6 * 3600, RETRY_BASE_SECONDS * 2 ** Math.min(attempts, 8))
}

async function pool<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results = new Array<T>(tasks.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) {
      const current = next++
      results[current] = await tasks[current]!()
    }
  })
  await Promise.all(workers)
  return results
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    )
  }
  return value
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(stable(value))
}

function textOf(json: unknown): string | undefined {
  if (!isRecord(json)) return undefined
  for (const key of ['text', 'comment', 'reasoning'] as const) {
    const value = json[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function paymentOf(json: unknown): { txHash?: string; chainId?: number } {
  if (!isRecord(json) || !isRecord(json.proofOfPayment)) return {}
  const proof = json.proofOfPayment
  const tx = [proof.transactionHash, proof.txHash, proof.transaction_hash, proof.hash].find(
    (value): value is string => typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value),
  )
  const chainId = [proof.chainId, proof.chain_id].find((value): value is number => typeof value === 'number')
  return { ...(tx ? { txHash: tx } : {}), ...(chainId ? { chainId } : {}) }
}

async function enrichAgent(row: {
  chain_id: number
  token_id: string
  agent_uri: string
  file_attempts: number
}): Promise<void> {
  try {
    const json = JSON.parse(await fetchText(row.agent_uri)) as unknown
    const file = normalizeRegistrationFile(json)
    if (!file) throw new Error('Not a registration object')
    // Only apply the result if the URI still matches the one that was fetched:
    // a fresher URI must not be overwritten by an in-flight old request.
    run(
      `UPDATE agents SET name = ?, description = ?, image = ?, active = ?, x402 = ?,
         services_json = ?, supported_trust_json = ?, raw_file_json = ?,
         file_fetched_at = ?, file_error = NULL, file_next_try_at = NULL, file_attempts = 0,
         needs_recompute = 1, updated_at = ?
       WHERE chain_id = ? AND token_id = ? AND agent_uri = ?`,
      file.name ?? null,
      file.description ?? null,
      file.image ?? null,
      file.active === undefined ? null : file.active ? 1 : 0,
      file.x402Support === undefined ? null : file.x402Support ? 1 : 0,
      JSON.stringify(file.services),
      JSON.stringify(file.supportedTrust),
      JSON.stringify(file.raw),
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000),
      row.chain_id,
      row.token_id,
      row.agent_uri,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    run(
      `UPDATE agents SET file_fetched_at = NULL, file_error = ?, file_attempts = file_attempts + 1,
         file_next_try_at = ? WHERE chain_id = ? AND token_id = ? AND agent_uri = ?`,
      message.slice(0, 300),
      retryAt(row.file_attempts),
      row.chain_id,
      row.token_id,
      row.agent_uri,
    )
  }
}

export async function enrichAgents(): Promise<number> {
  const now = Math.floor(Date.now() / 1000)
  const rows = all<{ chain_id: number; token_id: string; agent_uri: string; file_attempts: number }>(
    `SELECT chain_id, token_id, agent_uri, file_attempts FROM agents
     WHERE agent_uri IS NOT NULL AND agent_uri <> '' AND file_fetched_at IS NULL
       AND (file_next_try_at IS NULL OR file_next_try_at <= ?)
     ORDER BY created_at DESC LIMIT ?`,
    now,
    ENRICH_BATCH,
  )
  if (!rows.length) return 0
  await pool(rows.map((row) => () => enrichAgent(row)), 4)
  return rows.length
}

async function enrichFeedbackFile(uri: string, attempts: number): Promise<void> {
  try {
    const text = await fetchText(uri)
    const json = JSON.parse(text) as unknown
    const payment = paymentOf(json)
    const scheme = uri.startsWith('ipfs://') ? 'ipfs' : uri.startsWith('data:') ? 'data' : 'https'
    run(
      `INSERT INTO feedback_files (uri, scheme, content_hash, canonical_hash, comment_text,
         payment_tx_hash, payment_chain_id, payment_verified, raw_json, fetched_at, error, attempts, next_try_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL, 0, NULL)
       ON CONFLICT(uri) DO UPDATE SET
         content_hash = excluded.content_hash,
         canonical_hash = excluded.canonical_hash,
         comment_text = excluded.comment_text,
         payment_tx_hash = excluded.payment_tx_hash,
         payment_chain_id = excluded.payment_chain_id,
         raw_json = excluded.raw_json,
         fetched_at = excluded.fetched_at,
         error = NULL,
         attempts = 0,
         next_try_at = NULL`,
      uri,
      scheme,
      keccak256(toBytes(text)),
      canonicalJson(json) ? keccak256(toBytes(canonicalJson(json))) : null,
      textOf(json) ?? null,
      payment.txHash ?? null,
      payment.chainId ?? null,
      JSON.stringify(json).slice(0, 100_000),
      Math.floor(Date.now() / 1000),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    run(
      `INSERT INTO feedback_files (uri, fetched_at, error, attempts, next_try_at)
       VALUES (?, NULL, ?, 1, ?)
       ON CONFLICT(uri) DO UPDATE SET
         fetched_at = NULL,
         error = excluded.error,
         attempts = feedback_files.attempts + 1,
         next_try_at = excluded.next_try_at`,
      uri,
      message.slice(0, 300),
      retryAt(attempts),
    )
  }
}

export async function enrichFeedback(): Promise<number> {
  const now = Math.floor(Date.now() / 1000)
  const rows = all<{ feedback_uri: string; attempts: number }>(
    `SELECT f.feedback_uri, COALESCE(ff.attempts, 0) AS attempts, MAX(f.created_at) AS newest
     FROM feedback f LEFT JOIN feedback_files ff ON ff.uri = f.feedback_uri
     WHERE f.feedback_uri IS NOT NULL AND f.feedback_uri <> ''
       AND (ff.uri IS NULL OR (ff.error IS NOT NULL AND (ff.next_try_at IS NULL OR ff.next_try_at <= ?)))
     GROUP BY f.feedback_uri ORDER BY newest DESC LIMIT ?`,
    now,
    ENRICH_BATCH,
  )
  if (!rows.length) return 0
  await pool(rows.map((row) => () => enrichFeedbackFile(row.feedback_uri, row.attempts)), 4)
  return rows.length
}

export async function enrichOnce(): Promise<{ agents: number; feedback: number }> {
  const [agents, feedback] = await Promise.all([enrichAgents(), enrichFeedback()])
  return { agents, feedback }
}

export function commentForUri(uri: string | null | undefined): string | undefined {
  if (!uri) return undefined
  const row = all<{ comment_text: string | null }>('SELECT comment_text FROM feedback_files WHERE uri = ?', uri)[0]
  return row?.comment_text ?? undefined
}

export function feedbackComment(row: Feedback): string | undefined {
  return commentForUri(row.feedbackURI)
}
