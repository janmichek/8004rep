import type { Address, Hex } from 'viem'
import type { Feedback, FeedbackResponse, RegistrationFile, Service } from '../../src/data/types'

export type AgentRow = {
  chain_id: number
  token_id: string
  owner: string | null
  owner_block: string | null
  agent_wallet: string | null
  agent_uri: string | null
  created_at: number | null
  created_block: string | null
  name: string | null
  description: string | null
  image: string | null
  active: number | null
  x402: number | null
  services_json: string | null
  supported_trust_json: string | null
  raw_file_json: string | null
  file_fetched_at: number | null
  file_error: string | null
  file_next_try_at: number | null
  file_attempts: number
  detail_synced_at: number | null
  rpc_error: string | null
  rpc_checked_at: number | null
  score_attempts: number
  score_next_try_at: number | null
  needs_recompute: number
  updated_at: number | null
}

export type FeedbackRow = {
  chain_id: number
  token_id: string
  client: string
  feedback_index: number
  value_raw: string | null
  value_decimals: number | null
  value: number
  tag1: string | null
  tag2: string | null
  endpoint: string | null
  feedback_uri: string | null
  feedback_hash: string | null
  revoked: number
  revoked_block: string | null
  revoked_tx_hash: string | null
  block_number: string | null
  log_index: number | null
  tx_hash: string | null
  tx_from: string | null
  tx_to: string | null
  tx_fee_wei: string | null
  tx_feedback_count: number | null
  created_at: number | null
}

export type ResponseRow = {
  chain_id: number
  tx_hash: string
  log_index: number
  token_id: string
  client: string
  feedback_index: number
  responder: string
  response_uri: string | null
  block_number: string | null
  created_at: number | null
}

export type ScoreRow = {
  chain_id: number
  token_id: string
  formula_version: string
  filtered_score: number | null
  interval_lo: number | null
  interval_hi: number | null
  confidence: string | null
  unrated: number | null
  raw_score: number | null
  raw_ratings: number | null
  inflation_gap: number | null
  cost_to_fake: number | null
  total_feedback: number | null
  rated_rows: number | null
  wallets_count: number | null
  entities_count: number | null
  neff: number | null
  top1: number | null
  risk_level: string | null
  evidence_backed_share: number | null
  scan_score: number | null
  scan_json: string | null
  scan_fetched_at: number | null
  report_json: string | null
  stats_json: string | null
  trust_report_json: string | null
  computed_at: number | null
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function fileOfAgent(row: AgentRow): RegistrationFile | null {
  const services = parseJson<Service[]>(row.services_json, [])
  const supportedTrust = parseJson<string[]>(row.supported_trust_json, [])
  const raw = parseJson<unknown>(row.raw_file_json, undefined)
  if (!row.name && !row.description && !row.image && services.length === 0 && raw === undefined) return null
  return {
    ...(row.name ? { name: row.name } : {}),
    ...(row.description ? { description: row.description } : {}),
    ...(row.image ? { image: row.image } : {}),
    ...(row.active !== null ? { active: row.active === 1 } : {}),
    ...(row.x402 !== null ? { x402Support: row.x402 === 1 } : {}),
    services,
    supportedTrust,
    raw: raw ?? {},
  }
}

export function feedbackOfRows(rows: FeedbackRow[], responses: ResponseRow[]): Feedback[] {
  const byKey = new Map<string, FeedbackResponse[]>()
  for (const response of responses) {
    const key = `${response.client.toLowerCase()}:${response.feedback_index}`
    const list = byKey.get(key) ?? []
    list.push({
      responder: response.responder as Address,
      ...(response.response_uri ? { uri: response.response_uri } : {}),
      ...(response.created_at ? { createdAt: response.created_at } : {}),
      ...(response.tx_hash && /^0x[0-9a-f]{64}$/i.test(response.tx_hash) ? { txHash: response.tx_hash as Hex } : {}),
    })
    byKey.set(key, list)
  }
  return rows.map((row) => ({
    client: row.client as Address,
    index: row.feedback_index,
    value: row.value,
    ...(row.tag1 ? { tag1: row.tag1 } : {}),
    ...(row.tag2 ? { tag2: row.tag2 } : {}),
    ...(row.endpoint ? { endpoint: row.endpoint } : {}),
    ...(row.feedback_uri ? { feedbackURI: row.feedback_uri } : {}),
    revoked: row.revoked === 1,
    ...(row.created_at ? { createdAt: row.created_at } : {}),
    ...(row.tx_hash ? { txHash: row.tx_hash as Hex } : {}),
    ...(byKey.has(`${row.client.toLowerCase()}:${row.feedback_index}`)
      ? { responses: byKey.get(`${row.client.toLowerCase()}:${row.feedback_index}`) }
      : {}),
  }))
}

export function scoreJson(row: AgentRow, score: ScoreRow | undefined, feedbackCount: number): Record<string, unknown> {
  return {
    chainId: row.chain_id,
    tokenId: row.token_id,
    owner: row.owner,
    agentWallet: row.agent_wallet,
    agentURI: row.agent_uri,
    createdAt: row.created_at,
    totalFeedback: feedbackCount,
    name: row.name,
    description: row.description,
    image: row.image,
    active: row.active === null ? null : row.active === 1,
    x402: row.x402 === null ? null : row.x402 === 1,
    services: parseJson<Service[]>(row.services_json, []),
    supportedTrust: parseJson<string[]>(row.supported_trust_json, []),
    file: fileOfAgent(row),
    score: score?.filtered_score ?? null,
    rawScore: score?.raw_score ?? null,
    rawRatings: score?.raw_ratings ?? null,
    inflationGap: score?.inflation_gap ?? null,
    costToFake: score?.cost_to_fake ?? null,
    confidence: score?.confidence ?? null,
    unrated: score ? score.unrated === 1 : true,
    riskLevel: score?.risk_level ?? null,
    wallets: score?.wallets_count ?? null,
    neff: score?.neff ?? null,
    top1: score?.top1 ?? null,
    scanScore: score?.scan_score ?? null,
    fileFetchedAt: row.file_fetched_at,
    fileError: row.file_error,
  }
}
