import { serve } from '@hono/node-server'
import { PORT } from './config'
import { app } from './api'
import { enrichOnce } from './enricher'
import { scoreDirty } from './scorer'
import { bootstrapAll, refreshAll, tailAll } from './sync'
import { enabledChains } from './chains'
import { all, run } from './db'

const server = serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' }, (info) => {
  console.log(`[8004rep] listening on http://0.0.0.0:${info.port}`)
  console.log(`[8004rep] chains: ${enabledChains().map((chain) => `${chain.name} (${chain.chainId})`).join(', ')}`)
})

let enriching = false
let scoring = false
let snapshotting = false

async function loop(name: string, everyMs: number, task: () => Promise<unknown>): Promise<void> {
  for (;;) {
    try {
      await task()
    } catch (error) {
      console.error(`[${name}] ${error instanceof Error ? error.message : String(error)}`)
    }
    await new Promise((resolve) => setTimeout(resolve, everyMs))
  }
}

function saveDailySnapshots(): void {
  const day = new Date().toISOString().slice(0, 10)
  run(
    `INSERT INTO score_snapshots (chain_id, token_id, day_utc, filtered_score, raw_score, wallets_count, feedback_count)
     SELECT chain_id, token_id, ?, filtered_score, raw_score, wallets_count, total_feedback
     FROM agent_scores WHERE filtered_score IS NOT NULL
     ON CONFLICT(chain_id, token_id, day_utc) DO UPDATE SET
       filtered_score = excluded.filtered_score,
       raw_score = excluded.raw_score,
       wallets_count = excluded.wallets_count,
       feedback_count = excluded.feedback_count`,
    day,
  )
}

async function main(): Promise<void> {
  console.log('[8004rep] bootstrapping chains in the background')
  void bootstrapAll().then(() => {
    console.log('[8004rep] bootstrap finished')
    // One pass of enrichment and scoring right after the first bootstrap, so
    // the first page has names and scores rather than bare registry rows.
    void enrichOnce()
    scoreDirty(2_000)
    saveDailySnapshots()
  })

  void loop('tail', 30_000, tailAll)
  void loop('refresh', 60_000, refreshAll)
  void loop('enrich', 8_000, async () => {
    if (enriching) return
    enriching = true
    try {
      const done = await enrichOnce()
      if (done.agents || done.feedback) console.log(`[enrich] agents ${done.agents}, feedback ${done.feedback}`)
    } finally {
      enriching = false
    }
  })
  void loop('score', 6_000, async () => {
    if (scoring) return
    scoring = true
    try {
      const done = scoreDirty()
      if (done) console.log(`[score] ${done} agents`)
    } finally {
      scoring = false
    }
  })
  void loop('snapshot', 6 * 60 * 60_000, async () => {
    if (snapshotting) return
    snapshotting = true
    try {
      saveDailySnapshots()
      const counts = all<{ n: number }>('SELECT COUNT(*) AS n FROM agent_scores')[0]?.n ?? 0
      console.log(`[snapshot] ${counts} scored agents`)
    } finally {
      snapshotting = false
    }
  })
}

process.on('SIGTERM', () => {
  console.log('[8004rep] shutting down')
  server.close()
  process.exit(0)
})

void main()
