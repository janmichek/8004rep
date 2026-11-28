import type { Address } from 'viem';
import { inferTagScales, type TagScale } from './reputation/kinds';
import { buildRatingLayer } from './reputation/units';
import { buildReviewerProfile, suspicionOf, type ReviewerLabel } from './reviewerProfile';
import { jaccardSets } from './similarity';
import type { FeedbackEvent } from './types';

/** Jaccard similarity of reviewer sets at or above which two agents look alike. */
const LOOKALIKE_SIMILARITY = 0.8;
/** Shared reviewers needed before two agents can look alike. */
const LOOKALIKE_MIN_SHARED = 2;

export type AgentActivity = {
  tokenId: bigint;
  agentName?: string;
  rows: number;
  reviewers: number;
  average: number | null;
};

export type SuspectReviewer = {
  client: Address;
  rows: number;
  agents: number;
  average: number | null;
  labels: ReviewerLabel[];
  suspicion: number;
};

/** Agents whose reviewer sets nearly coincide. */
export type LookalikeGroup = {
  agents: { tokenId: bigint; agentName?: string }[];
  reviewers: Address[];
  similarity: number;
};

export type NetworkStats = {
  rows: number;
  agents: number;
  reviewers: number;
  /** Mean of scored ratings, normalised to 0–100. */
  average: number | null;
  /** Mean of non-revoked, non-self raw values, comparable to 8004scan's raw mean. */
  rawAverage: number | null;
  /** Scored rating values, normalised to 0–100, for charts. */
  ratingValues: number[];
  /** Share of scored ratings at 100 or more. */
  perfectShare: number | null;
  revoked: number;
  /** Unix seconds of the oldest and newest dated rows. */
  from?: number;
  to?: number;
  /** Most rows first. */
  topAgents: AgentActivity[];
  /** Most suspicious first; only reviewers with a label. */
  suspects: SuspectReviewer[];
  lookalikes: LookalikeGroup[];
};

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = map.get(key);
    if (group) group.push(item);
    else map.set(key, [item]);
  }
  return map;
}

/** Jaccard similarity of two reviewer sets. Kept as the network-local name. */
export const jaccard = jaccardSets;

/** Statistics over a window of a network's feedback feed. */
export function computeNetworkStats(rows: FeedbackEvent[], topN = 10): NetworkStats {
  const live = rows.filter((r) => !r.revoked);
  const dates = rows.map((r) => r.createdAt).filter((t): t is number => t !== undefined);
  // Token IDs repeat between chains; an agent is (chain, token).
  const byAgent = groupBy(rows, (r) => `${r.chainId ?? ''}:${r.tokenId}`);
  // The owner and the registered agent wallet are both the agent itself.
  const selvesOf = (group: FeedbackEvent[]): Address[] => {
    const found = new Map<string, Address>();
    for (const row of group) {
      for (const address of [row.agentOwner, row.agentWallet]) {
        if (address) found.set(address.toLowerCase(), address);
      }
    }
    return [...found.values()];
  };
  const isSelf = (row: FeedbackEvent): boolean =>
    [row.agentOwner, row.agentWallet].some(
      (a) => Boolean(a) && row.client.toLowerCase() === a!.toLowerCase()
    );
  // The headline average is over ratings only, read on their own scale: a
  // network mean that mixes 5-star reviews, uptime and revenue is not a score.
  const ratedOf = (group: FeedbackEvent[]): number[] =>
    buildRatingLayer(group, { self: selvesOf(group) }).classified.flatMap((c, i) =>
      !group[i]!.revoked && !isSelf(group[i]!) && c.kind === 'rating' && c.r !== null
        ? [c.r * 100]
        : []
    );
  const ratings = [...byAgent.values()].flatMap((group) => ratedOf(group));

  // Reviewer profiles get each agent's whole window, not just that reviewer's
  // slice, so a 5 on a 0–100 tag is read as 5/100 rather than 5/5.
  const scalesByAgent = new Map<string, ReadonlyMap<string, TagScale>>();
  for (const [key, group] of byAgent) {
    const selves = new Set(selvesOf(group).map((a) => a.toLowerCase()));
    scalesByAgent.set(
      key,
      inferTagScales(group.filter((r) => !selves.has(r.client.toLowerCase())))
    );
  }

  const topAgents: AgentActivity[] = [...byAgent.values()]
    .map((group) => {
      const agentRatings = ratedOf(group);
      return {
        tokenId: group[0]!.tokenId,
        ...(group.find((r) => r.agentName)?.agentName
          ? { agentName: group.find((r) => r.agentName)!.agentName! }
          : {}),
        rows: group.length,
        reviewers: new Set(
          group.filter((r) => !r.revoked && !isSelf(r)).map((r) => r.client.toLowerCase())
        ).size,
        average: agentRatings.length ? mean(agentRatings) : null,
      };
    })
    .sort((a, b) => b.rows - a.rows)
    .slice(0, topN);

  // Self-reviews are feedback rows but never reviewer evidence: keep them out
  // of reviewer averages, suspect labels and lookalike reviewer sets.
  const reviewerRows = rows.filter((r) => !isSelf(r));
  const byClient = groupBy(reviewerRows, (r) => r.client.toLowerCase());
  const rawAverage = mean(reviewerRows.filter((r) => !r.revoked).map((r) => r.value));

  const suspects: SuspectReviewer[] = [...byClient.values()]
    .map((group) => {
      const profile = buildReviewerProfile(group[0]!.client, group, { scalesByAgent });
      return {
        client: group[0]!.client,
        rows: profile.rows,
        agents: profile.agents,
        average: profile.ratingAverage,
        labels: profile.labels,
        suspicion: suspicionOf(profile.labels),
      };
    })
    .filter((s) => s.suspicion > 0)
    .sort((a, b) => b.suspicion - a.suspicion || b.rows - a.rows);

  // Lookalikes: union-find over agent pairs with near-identical reviewer sets.
  const sets = [...byAgent.entries()]
    .map(([key, group]) => ({
      key,
      tokenId: group[0]!.tokenId,
      agentName: group.find((r) => r.agentName)?.agentName,
      reviewers: new Set(
        group.filter((r) => !r.revoked && !isSelf(r)).map((r) => r.client.toLowerCase())
      ),
    }))
    .filter((a) => a.reviewers.size >= LOOKALIKE_MIN_SHARED);
  const parent = new Map(sets.map((s) => [s.key, s.key]));
  const find = (k: string): string => (parent.get(k) === k ? k : find(parent.get(k)!));
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      if (jaccard(sets[i]!.reviewers, sets[j]!.reviewers) >= LOOKALIKE_SIMILARITY) {
        const [a, b] = [find(sets[i]!.key), find(sets[j]!.key)];
        if (a !== b) parent.set(b, a);
      }
    }
  }
  const groups = groupBy(sets, (s) => find(s.key));
  const lookalikes: LookalikeGroup[] = [...groups.entries()]
    .filter(([, members]) => members.length >= 2)
    .map(([, members]) => {
      const shared = [...members[0]!.reviewers].filter((r) =>
        members.every((m) => m.reviewers.has(r))
      );
      return {
        agents: members.map((m) => ({
          tokenId: m.tokenId,
          ...(m.agentName ? { agentName: m.agentName } : {}),
        })),
        reviewers: shared.map((r) => byClient.get(r)![0]!.client),
        // Weakest pair in the group; chained groups can dip below the threshold end to end.
        similarity: Math.min(
          ...members.flatMap((m, i) =>
            members.slice(i + 1).map((n) => jaccard(m.reviewers, n.reviewers))
          )
        ),
      };
    })
    .sort((a, b) => b.agents.length - a.agents.length);

  return {
    rows: rows.length,
    agents: byAgent.size,
    reviewers: byClient.size,
    average: ratings.length ? mean(ratings) : null,
    rawAverage,
    ratingValues: ratings,
    perfectShare: ratings.length ? ratings.filter((r) => r >= 99).length / ratings.length : null,
    revoked: rows.length - live.length,
    ...(dates.length ? { from: Math.min(...dates), to: Math.max(...dates) } : {}),
    topAgents,
    suspects,
    lookalikes,
  };
}
