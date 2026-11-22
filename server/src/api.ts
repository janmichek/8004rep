import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Address } from 'viem'
import { createRpcSource, createRpcClient } from '../../src/data/rpc'
import { createSubgraphSource } from '../../src/data/subgraph'
import type { ChainInfo } from '../../src/chains'
import { normalizeRegistrationFile } from '../../src/data/metadata'
import type { FeedbackEvent } from '../../src/data/types'
import { CORS_ORIGIN, STARTED_AT } from './config'
import { all, get } from './db'
import { chainById, enabledChains } from './chains'
import { fetchText } from './httpFetch'
import { fileOfAgent, feedbackOfRows, parseJson, scoreJson, type AgentRow, type FeedbackRow, type ResponseRow, type ScoreRow } from './rows'
import { networkSnapshot, scoreAgent, scoreJson as getScore } from './scorer'
import { coverage, upsertAgent, upsertFeedback } from './sync'

export const app = new Hono()

app.use('*', cors({ origin: CORS_ORIGIN, allowMethods: ['GET', 'OPTIONS'], maxAge: 86400 }))

function int(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.trunc(parsed)))
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

function serializeFeedback(row: FeedbackRow & { agent_name?: string | null; agent_owner?: string | null; comment_text?: string | null }) {
  return {
    chainId: row.chain_id,
    tokenId: row.token_id,
    agentName: row.agent_name ?? null,
    agentOwner: row.agent_owner ?? null,
    client: row.client,
    index: row.feedback_index,
    value: row.value,
    tag1: row.tag1,
    tag2: row.tag2,
    endpoint: row.endpoint,
    feedbackURI: row.feedback_uri,
    comment: row.comment_text ?? null,
    revoked: row.revoked === 1,
    createdAt: row.created_at,
    txHash: row.tx_hash,
  }
}

function serializeAgent(row: AgentRow, score: ScoreRow | undefined, feedbackCount: number, reports = false) {
  const base = scoreJson(row, score, feedbackCount)
  return {
    ...base,
    ...(reports
      ? {
          report: parseJson<unknown>(score?.report_json ?? null, null),
          stats: parseJson<unknown>(score?.stats_json ?? null, null),
          trust: parseJson<unknown>(score?.trust_report_json ?? null, null),
        }
      : {}),
  }
}

async function resolveFile(agentURI: string | null): Promise<{ file: ReturnType<typeof normalizeRegistrationFile>; error?: string }> {
  if (!agentURI) return { file: null }
  try {
    const json = JSON.parse(await fetchText(agentURI)) as unknown
    return { file: normalizeRegistrationFile(json) }
  } catch (error) {
    return { file: null, error: error instanceof Error ? error.message : String(error) }
  }
}

async function indexDetail(chainId: number, tokenId: string): Promise<boolean> {
  const chain = chainById(chainId)
  if (!chain) return false
  try {
    const source = chain.subgraphUrl
      ? createSubgraphSource({ ...(chain as unknown as ChainInfo), subgraphUrl: chain.subgraphUrl })
      : createRpcSource(chain as unknown as ChainInfo, createRpcClient(chain as unknown as ChainInfo))
    const detail = await source.getAgent(BigInt(tokenId))
    if (!detail) return false
    const resolved = await resolveFile(detail.agentURI)
    const file = resolved.file ?? detail.file ?? null
    upsertAgent(chainId, {
      tokenId,
      owner: detail.owner,
      agentWallet: detail.agentWallet,
      agentURI: detail.agentURI,
      createdAt: detail.createdAt ?? null,
      file,
      needsRecompute: true,
    })
    for (const row of detail.feedback) {
      upsertFeedback(chainId, {
        tokenId,
        client: row.client,
        index: row.index ?? 0,
        value: row.value,
        tag1: row.tag1 ?? null,
        tag2: row.tag2 ?? null,
        endpoint: row.endpoint ?? null,
        feedbackURI: row.feedbackURI ?? null,
        revoked: row.revoked,
        createdAt: row.createdAt ?? null,
        txHash: row.txHash ?? null,
      })
    }
    return true
  } catch (error) {
    console.error(`[api] detail ${chainId}:${tokenId}: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

app.get('/', (c) => c.json({ name: '8004rep indexer', docs: '/api/health' }))

app.get('/api/health', (c) => {
  const agents = get<{ n: number }>('SELECT COUNT(*) AS n FROM agents')?.n ?? 0
  const feedback = get<{ n: number }>('SELECT COUNT(*) AS n FROM feedback')?.n ?? 0
  const scores = get<{ n: number }>('SELECT COUNT(*) AS n FROM agent_scores')?.n ?? 0
  return c.json({
    ok: true,
    uptime: Math.floor((Date.now() - STARTED_AT) / 1000),
    version: '0.1.0',
    db: { agents, feedback, scores },
    chains: coverage(),
  })
})

app.get('/api/chains', (c) => {
  const rows = enabledChains().map((chain) => {
    const agents = get<{ n: number }>('SELECT COUNT(*) AS n FROM agents WHERE chain_id = ?', chain.chainId)?.n ?? 0
    const feedback = get<{ n: number }>('SELECT COUNT(*) AS n FROM feedback WHERE chain_id = ?', chain.chainId)?.n ?? 0
    const sync = get<{ last_block: string; head_block: string | null; last_error: string | null; updated_at: number | null }>(
      "SELECT last_block, head_block, last_error, updated_at FROM sync_state WHERE chain_id = ? AND stream = 'logs'",
      chain.chainId,
    )
    return {
      chainId: chain.chainId,
      name: chain.name,
      shortName: chain.shortName,
      slug: chain.slug,
      testnet: chain.testnet,
      explorerUrl: chain.explorerUrl,
      scanUrl: chain.scanUrl,
      indexed: true,
      agents,
      feedback,
      coverage: { agentLimit: chain.agentLimit, feedbackLimit: chain.feedbackLimit },
      sync: sync ?? null,
    }
  })
  return c.json({ items: rows })
})

app.get('/api/agents', (c) => {
  const chainId = c.req.query('chainId') ? Number(c.req.query('chainId')) : undefined
  const page = int(c.req.query('page'), 0, 0, 1_000_000)
  const limit = int(c.req.query('limit'), 25, 1, 100)
  const q = c.req.query('q')?.trim() ?? ''
  const sort = c.req.query('sort') ?? 'createdAt'
  const order = c.req.query('order') === 'asc' ? 'asc' : 'desc'
  const rated = c.req.query('rated') === '1'
  const where: string[] = []
  const params: Array<string | number> = []
  if (chainId !== undefined) {
    where.push('a.chain_id = ?')
    params.push(chainId)
  }
  if (q) {
    if (/^\d+$/.test(q)) {
      where.push('(a.token_id = ? OR a.name LIKE ? ESCAPE \'\\\' COLLATE NOCASE)')
      params.push(q, `%${escapeLike(q)}%`)
    } else {
      where.push("(a.name LIKE ? ESCAPE '\\' COLLATE NOCASE OR a.description LIKE ? ESCAPE '\\' COLLATE NOCASE OR LOWER(a.owner) = ?)")
      params.push(`%${escapeLike(q)}%`, `%${escapeLike(q)}%`, q.toLowerCase())
    }
  }
  if (rated) where.push('COALESCE(sc.total_feedback, 0) > 0')
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const sortSql =
    sort === 'score'
      ? 'sc.filtered_score'
      : sort === 'feedback'
        ? 'COALESCE(sc.total_feedback, 0)'
        : sort === 'tokenId'
          ? 'CAST(a.token_id AS INTEGER)'
          : 'a.created_at'
  const direction = order === 'asc' ? 'ASC' : 'DESC'
  const rows = all<AgentRow & { feedback_count: number }>(
    `SELECT a.*, COALESCE(sc.total_feedback, (SELECT COUNT(*) FROM feedback f WHERE f.chain_id = a.chain_id AND f.token_id = a.token_id)) AS feedback_count
     FROM agents a LEFT JOIN agent_scores sc ON sc.chain_id = a.chain_id AND sc.token_id = a.token_id
     ${clause}
     ORDER BY ${sortSql} ${direction}, a.chain_id ASC, CAST(a.token_id AS INTEGER) DESC
     LIMIT ? OFFSET ?`,
    ...params,
    limit,
    page * limit,
  )
  const total =
    get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM agents a LEFT JOIN agent_scores sc ON sc.chain_id = a.chain_id AND sc.token_id = a.token_id ${clause}`,
      ...params,
    )?.n ?? 0
  const items = rows.map((row) => serializeAgent(row, getScore(row.chain_id, row.token_id), row.feedback_count))
  return c.json({ items, total, hasMore: (page + 1) * limit < total, page, limit, source: 'index' })
})

app.get('/api/agents/:chainId/:tokenId', async (c) => {
  const chainId = Number(c.req.param('chainId'))
  const tokenId = c.req.param('tokenId')
  if (!/^\d+$/.test(tokenId)) return c.json({ error: 'Bad token id' }, 400)
  if (!chainById(chainId)) return c.json({ error: 'Chain is not indexed' }, 404)
  let agent = get<AgentRow>('SELECT * FROM agents WHERE chain_id = ? AND token_id = ?', chainId, tokenId)
  if (!agent || (agent.agent_wallet === null && agent.agent_uri === null)) {
    const found = await indexDetail(chainId, tokenId)
    agent = get<AgentRow>('SELECT * FROM agents WHERE chain_id = ? AND token_id = ?', chainId, tokenId)
    if (!agent) return c.json({ error: 'Agent not found', found: false }, 404)
    if (!found && !agent.agent_uri) return c.json({ error: 'Agent not found', found: false }, 404)
  }
  if (agent.file_fetched_at === null && agent.agent_uri) {
    const resolved = await resolveFile(agent.agent_uri)
    if (resolved.file) {
      upsertAgent(chainId, { tokenId, agentURI: agent.agent_uri, file: resolved.file, needsRecompute: false })
      agent = get<AgentRow>('SELECT * FROM agents WHERE chain_id = ? AND token_id = ?', chainId, tokenId)!
    }
  }
  let score = getScore(chainId, tokenId)
  if (!score || agent.needs_recompute === 1) {
    scoreAgent(chainId, tokenId)
    score = getScore(chainId, tokenId)
  }
  const rows = all<FeedbackRow & { comment_text: string | null }>(
    `SELECT f.*, ff.comment_text FROM feedback f
     LEFT JOIN feedback_files ff ON ff.uri = f.feedback_uri
     WHERE f.chain_id = ? AND f.token_id = ?
     ORDER BY COALESCE(f.created_at, 0) DESC, f.feedback_index DESC`,
    chainId,
    tokenId,
  )
  const responses = all<ResponseRow>('SELECT * FROM feedback_responses WHERE chain_id = ? AND token_id = ?', chainId, tokenId)
  const feedback = feedbackOfRows(rows, responses)
  const count = feedback.filter((row) => !row.revoked)
  const reputation = { count: count.length, average: count.length ? count.reduce((sum, row) => sum + row.value, 0) / count.length : 0 }
  const file = fileOfAgent(agent)
  return c.json({
    ...serializeAgent(agent, score, rows.length, true),
    agentURI: agent.agent_uri,
    agentWallet: agent.agent_wallet,
    file,
    reputation,
    feedback: feedback.map((row, i) => ({
      ...row,
      tokenId,
      chainId,
      comment: rows[i]?.comment_text ?? null,
    })),
    source: 'index',
  })
})

app.get('/api/feedbacks', (c) => {
  const chainId = c.req.query('chainId') ? Number(c.req.query('chainId')) : undefined
  const client = c.req.query('client')?.toLowerCase()
  const agent = c.req.query('agent')
  const page = int(c.req.query('page'), 0, 0, 1_000_000)
  const limit = int(c.req.query('limit'), 25, 1, 100)
  const where: string[] = []
  const params: Array<string | number> = []
  if (chainId !== undefined) {
    where.push('f.chain_id = ?')
    params.push(chainId)
  }
  if (client) {
    where.push('f.client = ?')
    params.push(client)
  }
  if (agent && /^\d+$/.test(agent)) {
    where.push('f.token_id = ?')
    params.push(agent)
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const rows = all<FeedbackRow & { agent_name: string | null; agent_owner: string | null; comment_text: string | null }>(
    `SELECT f.*, a.name AS agent_name, a.owner AS agent_owner, ff.comment_text
     FROM feedback f
     LEFT JOIN agents a ON a.chain_id = f.chain_id AND a.token_id = f.token_id
     LEFT JOIN feedback_files ff ON ff.uri = f.feedback_uri
     ${clause}
     ORDER BY COALESCE(f.created_at, 0) DESC, f.chain_id ASC, CAST(f.token_id AS INTEGER) DESC, f.feedback_index DESC
     LIMIT ? OFFSET ?`,
    ...params,
    limit,
    page * limit,
  )
  const total = get<{ n: number }>(`SELECT COUNT(*) AS n FROM feedback f ${clause}`, ...params)?.n ?? 0
  return c.json({ items: rows.map(serializeFeedback), total, hasMore: (page + 1) * limit < total, page, limit })
})

app.get('/api/network/:chainId', (c) => {
  const chainId = Number(c.req.param('chainId'))
  if (!chainById(chainId)) return c.json({ error: 'Chain is not indexed' }, 404)
  const snapshot = networkSnapshot(chainId)
  return c.json(snapshot ?? { rows: 0 })
})

app.get('/api/owners', (c) => {
  const chainId = c.req.query('chainId') ? Number(c.req.query('chainId')) : undefined
  const limit = int(c.req.query('limit'), 50, 1, 200)
  const q = c.req.query('q')?.trim().toLowerCase()
  const where: string[] = ["owner IS NOT NULL"]
  const params: Array<string | number> = []
  if (chainId !== undefined) {
    where.push('chain_id = ?')
    params.push(chainId)
  }
  if (q) {
    where.push('owner LIKE ?')
    params.push(`%${escapeLike(q)}%`)
  }
  const rows = all<{ owner: string; agents: number; chains: string; latest_chain: number; latest_token: string }>(
    `SELECT owner, COUNT(*) AS agents, GROUP_CONCAT(DISTINCT chain_id) AS chains,
       MAX(chain_id) AS latest_chain, MAX(CAST(token_id AS INTEGER)) AS latest_token
     FROM agents WHERE ${where.join(' AND ')}
     GROUP BY owner ORDER BY agents DESC, latest_token DESC LIMIT ?`,
    ...params,
    limit,
  )
  return c.json({
    items: rows.map((row) => ({
      owner: row.owner,
      agents: row.agents,
      chainIds: row.chains.split(',').map(Number),
      latest: { chainId: row.latest_chain, tokenId: String(row.latest_token) },
    })),
  })
})

app.get('/api/owners/:address', (c) => {
  const address = c.req.param('address').toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(address)) return c.json({ error: 'Bad address' }, 400)
  const rows = all<AgentRow>(
    'SELECT * FROM agents WHERE owner = ? ORDER BY COALESCE(created_at, 0) DESC LIMIT 200',
    address,
  )
  return c.json({ owner: address, items: rows.map((row) => serializeAgent(row, getScore(row.chain_id, row.token_id), 0)) })
})

app.get('/api/reviewers', (c) => {
  const chainId = c.req.query('chainId') ? Number(c.req.query('chainId')) : undefined
  const limit = int(c.req.query('limit'), 50, 1, 200)
  const where: string[] = []
  const params: Array<string | number> = []
  if (chainId !== undefined) {
    where.push('chain_id = ?')
    params.push(chainId)
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const rows = all<{ client: string; rows: number; agents: number; average: number | null; first: number | null; last: number | null }>(
    `SELECT client, COUNT(*) AS rows, COUNT(DISTINCT chain_id || ':' || token_id) AS agents,
       AVG(value) AS average, MIN(created_at) AS first, MAX(created_at) AS last
     FROM feedback ${clause} GROUP BY client ORDER BY rows DESC LIMIT ?`,
    ...params,
    limit,
  )
  return c.json({ items: rows })
})

app.get('/api/reviewers/:address', async (c) => {
  const address = c.req.param('address').toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(address)) return c.json({ error: 'Bad address' }, 400)
  const rows = all<FeedbackRow & { agent_name: string | null; agent_owner: string | null; comment_text: string | null }>(
    `SELECT f.*, a.name AS agent_name, a.owner AS agent_owner, ff.comment_text
     FROM feedback f LEFT JOIN agents a ON a.chain_id = f.chain_id AND a.token_id = f.token_id
     LEFT JOIN feedback_files ff ON ff.uri = f.feedback_uri
     WHERE f.client = ? ORDER BY COALESCE(f.created_at, 0) DESC LIMIT 500`,
    address,
  )
  const items = rows.map(serializeFeedback) as Array<Record<string, unknown> & { value: number; revoked: boolean; tag1?: string; tag2?: string }>
  const events: FeedbackEvent[] = rows.map((row) => ({
    chainId: row.chain_id,
    tokenId: BigInt(row.token_id),
    client: row.client as Address,
    index: row.feedback_index,
    value: row.value,
    ...(row.tag1 ? { tag1: row.tag1 } : {}),
    ...(row.tag2 ? { tag2: row.tag2 } : {}),
    revoked: row.revoked === 1,
    ...(row.agent_name ? { agentName: row.agent_name } : {}),
    ...(row.agent_owner ? { agentOwner: row.agent_owner as Address } : {}),
  }))
  const { buildReviewerProfile } = await import('../../src/data/reviewerProfile')
  return c.json({ address, profile: buildReviewerProfile(address as Address, events), items })
})

app.get('/api/agents/:chainId/:tokenId/reviewers', async (c) => {
  const chainId = Number(c.req.param('chainId'))
  const tokenId = c.req.param('tokenId')
  const rows = all<FeedbackRow & { agent_name: string | null; agent_owner: string | null; comment_text: string | null }>(
    `SELECT f.*, a.name AS agent_name, a.owner AS agent_owner, ff.comment_text
     FROM feedback f LEFT JOIN agents a ON a.chain_id = f.chain_id AND a.token_id = f.token_id
     LEFT JOIN feedback_files ff ON ff.uri = f.feedback_uri
     WHERE f.chain_id = ? AND f.token_id = ? ORDER BY COALESCE(f.created_at, 0) DESC`,
    chainId,
    tokenId,
  )
  const byClient = new Map<string, FeedbackEvent[]>()
  for (const row of rows) {
    const key = row.client.toLowerCase()
    const list = byClient.get(key) ?? []
    list.push({
      chainId,
      tokenId: BigInt(tokenId),
      client: row.client as Address,
      index: row.feedback_index,
      value: row.value,
      ...(row.tag1 ? { tag1: row.tag1 } : {}),
      ...(row.tag2 ? { tag2: row.tag2 } : {}),
      revoked: row.revoked === 1,
      ...(row.agent_name ? { agentName: row.agent_name } : {}),
      ...(row.agent_owner ? { agentOwner: row.agent_owner as Address } : {}),
    })
    byClient.set(key, list)
  }
  const { buildReviewerProfile } = await import('../../src/data/reviewerProfile')
  return c.json({ items: [...byClient.values()].map((list) => buildReviewerProfile(list[0]!.client, list)) })
})

app.notFound((c) => c.json({ error: 'Not found' }, 404))

app.onError((error, c) => {
  console.error('[api]', error)
  return c.json({ error: error instanceof Error ? error.message : 'Internal error' }, 500)
})
