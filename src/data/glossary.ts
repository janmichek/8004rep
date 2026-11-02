/**
 * Cast and vocabulary for the Docs page. Stable `id`s are page anchors:
 *   { name: 'docs', hash: `#${id}` }
 */

export type GlossaryEntry = {
  id: string
  name: string
  summary: string
  /** Optional pointer into the metric guide. */
  seeAlso?: string
}

export type GlossaryGroup = {
  id: string
  title: string
  intro: string
  entries: GlossaryEntry[]
}

/** Who and what show up on every page. */
export const ENTITIES: GlossaryGroup = {
  id: 'entities',
  title: 'Entities',
  intro:
    'The cast of the explorer. Everything else — scores, flags, network views — is built from these.',
  entries: [
    {
      id: 'entity-agent',
      name: 'Agent',
      summary:
        'An ERC-8004 identity NFT on a chain: a tokenId, an owner, an optional agent wallet, and a registration file that names its services.',
    },
    {
      id: 'entity-owner',
      name: 'Owner',
      summary:
        'The address that currently holds the agent NFT. Self-reviews from the owner are excluded from the score.',
    },
    {
      id: 'entity-agent-wallet',
      name: 'Agent wallet',
      summary:
        'An operating address the agent declares (when present). Reviews from it are treated as self-reviews.',
    },
    {
      id: 'entity-reviewer',
      name: 'Reviewer',
      summary:
        'The client address that wrote a feedback row. One wallet is one voice after the per-wallet cap.',
      seeAlso: 'wallet-vote',
    },
    {
      id: 'entity-feedback-row',
      name: 'Feedback row',
      summary:
        'One on-chain review of an agent: client, integer value, optional tags, endpoint, date, URI and transaction. Identified by (client, index) per agent.',
      seeAlso: 'feedback-row',
    },
    {
      id: 'entity-response',
      name: 'Response',
      summary:
        'An `appendResponse` entry on a feedback row — anyone may reply. Used for responsiveness, not for the score.',
      seeAlso: 'responsiveness',
    },
    {
      id: 'entity-reputation-registry',
      name: 'Reputation registry',
      summary:
        'The ERC-8004 contract that stores feedback rows, revocations and responses for agents on a chain.',
    },
    {
      id: 'entity-tag',
      name: 'Tag',
      summary:
        'Optional labels on a feedback row (`tag1`, `tag2`). They decide whether a value is a rating, outcome, telemetry, metric or unknown.',
      seeAlso: 'rating-only',
    },
    {
      id: 'entity-feedback-file',
      name: 'Feedback file',
      summary:
        'An off-chain URI on a row (comment, task or payment proof). The explorer links to it; it does not fetch or grade the prose.',
      seeAlso: 'evidence-ladder',
    },
  ],
}

/** Words used across the UI before the metric guide goes into rules. */
export const VOCABULARY: GlossaryGroup = {
  id: 'vocabulary',
  title: 'Vocabulary',
  intro:
    'Basic words the explorer uses. The metric guide below spells out formulas and thresholds; this is the plain reading.',
  entries: [
    {
      id: 'vocab-value',
      name: 'Value',
      summary:
        'The bare integer stored on a feedback row. The same field can mean stars, a pass flag, latency or revenue — tags decide which.',
    },
    {
      id: 'vocab-rating',
      name: 'Rating',
      summary:
        'A value that expresses quality. Only ratings are normalised and averaged into the filtered score.',
      seeAlso: 'rating-only',
    },
    {
      id: 'vocab-scale',
      name: 'Scale',
      summary:
        'The range a rating is read on (0/1, 0–5, 0–100…). Inferred from observed values, then mapped to 0–100.',
      seeAlso: 'scale',
    },
    {
      id: 'vocab-revoke',
      name: 'Revoke',
      summary:
        'The author withdrew the review. Revoked rows stay visible in the log and count nowhere in the score.',
      seeAlso: 'revoked',
    },
    {
      id: 'vocab-evidence',
      name: 'Evidence',
      summary:
        'What makes a review checkable: a date, a transaction, a feedback file, a named endpoint. Coverage is about verifiability, not quality.',
      seeAlso: 'evidence-ladder',
    },
    {
      id: 'vocab-confidence',
      name: 'Confidence',
      summary:
        'How much independent weight stands behind the score: low, medium or high. It measures quantity and concentration, not honesty.',
      seeAlso: 'confidence',
    },
  ],
}

export const GLOSSARY_GROUPS: GlossaryGroup[] = [ENTITIES, VOCABULARY]
