import type { Address, PublicClient } from 'viem'
import type { ChainInfo } from '../chains'
import { errorMessage } from '../format'
import { fetchFunding, type Funding } from './funding'
import { buildReviewerProfile, type ReviewerProfile } from './reviewerProfile'
import type { DataSource, FeedbackEvent } from './types'

/** Reviewers looked up at once; each costs a feed query, a nonce read and two explorer calls. */
const CONCURRENCY = 3

export type ReviewerInsight = {
  address: Address
  /** Across agents, as far as the source reaches. */
  profile?: ReviewerProfile
  /** Its feed rows, newest first. */
  rows?: FeedbackEvent[]
  /** True when older rows exist beyond `rows`. */
  truncated?: boolean
  /** Unix seconds the log scan reached; log scan only. */
  since?: number
  /** Transactions sent. */
  nonce?: number
  /** Undefined = not looked up (no explorer for the chain); null = none found. */
  funding?: Funding | null
  /** Why something above is missing. */
  errors: string[]
}

export async function loadReviewerInsight(
  chain: ChainInfo,
  client: PublicClient,
  source: DataSource,
  address: Address,
): Promise<ReviewerInsight> {
  const { explorerApiUrl } = chain
  const [feed, nonce, funding] = await Promise.allSettled([
    source.listFeedback({ client: address }),
    client.getTransactionCount({ address }),
    explorerApiUrl ? fetchFunding({ ...chain, explorerApiUrl }, address) : Promise.resolve(undefined),
  ])
  const errors: string[] = []
  if (feed.status === 'rejected') errors.push(`feedback: ${errorMessage(feed.reason)}`)
  if (nonce.status === 'rejected') errors.push(`nonce: ${errorMessage(nonce.reason)}`)
  if (funding.status === 'rejected') errors.push(`funding: ${errorMessage(funding.reason)}`)
  return {
    address,
    ...(feed.status === 'fulfilled'
      ? {
          rows: feed.value.items,
          profile: buildReviewerProfile(address, feed.value.items),
          ...(feed.value.cursor ? { truncated: true } : {}),
          ...(feed.value.since !== undefined ? { since: feed.value.since } : {}),
        }
      : {}),
    ...(nonce.status === 'fulfilled' ? { nonce: nonce.value } : {}),
    ...(funding.status === 'fulfilled' && funding.value !== undefined ? { funding: funding.value } : {}),
    errors,
  }
}

/** Looks up several reviewers, `onEach` firing as each one lands. */
export async function loadReviewerInsights(
  chain: ChainInfo,
  client: PublicClient,
  source: DataSource,
  addresses: Address[],
  onEach: (insight: ReviewerInsight) => void,
): Promise<void> {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, addresses.length) }, async () => {
      while (next < addresses.length) {
        const address = addresses[next++]
        onEach(await loadReviewerInsight(chain, client, source, address))
      }
    }),
  )
}
