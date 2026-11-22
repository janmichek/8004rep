import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')

export const PORT = Number(process.env.PORT ?? 8787)
export const DB_PATH = resolve(root, process.env.DB_PATH ?? 'data/8004rep.db')
export const CORS_ORIGIN = process.env.CORS_ORIGIN?.trim() || '*'

/** How many rows one enrichment batch touches; small enough to stay polite. */
export const ENRICH_BATCH = Number(process.env.ENRICH_BATCH ?? 12)
/** Concurrent outbound metadata fetches. */
export const FETCH_CONCURRENCY = Number(process.env.FETCH_CONCURRENCY ?? 6)
/** Agents re-scored per pass. */
export const SCORE_BATCH = Number(process.env.SCORE_BATCH ?? 400)
/** Newest agents whose registration files are fetched first. */
export const ENRICH_AGENT_LIMIT = Number(process.env.ENRICH_AGENT_LIMIT ?? 2_000)
/** Feedback files fetched for comments; the feed only needs the newest. */
export const ENRICH_FEEDBACK_LIMIT = Number(process.env.ENRICH_FEEDBACK_LIMIT ?? 1_000)

mkdirSync(dirname(DB_PATH), { recursive: true })

export const STARTED_AT = Date.now()
