import { Link } from '@tanstack/react-router';
import {
  formatDate,
  formatScore,
  formatTimeline,
  shortAddress,
  txExplorerUrl,
} from '../../../shared/lib/explorer';
import type { ChainInfo, Feedback } from '../../../shared/lib/explorer';
import { AddressIdenticon, FeedbackNote } from '../../../shared/ui';
import { evidenceUrl } from '../../../shared/ui';
import { FeedbackRepliesList } from './FeedbackRepliesList';

type Props = { slug: string; chain: ChainInfo; row: Feedback };

function tagsRow(row: Feedback) {
  if (!row.tag1 && !row.tag2) return null;

  return (
    <>
      <dt>Tags</dt>
      <dd>
        {row.tag1 ? <span className="chip">{row.tag1}</span> : null}
        {row.tag2 ? <span className="chip">{row.tag2}</span> : null}
      </dd>
    </>
  );
}

function endpointRow(endpoint: string | undefined) {
  if (!endpoint) return null;

  return (
    <>
      <dt>Endpoint</dt>
      <dd className="ellipsis" title={endpoint}>
        {endpoint}
      </dd>
    </>
  );
}

function whenValue(createdAt: number | undefined) {
  if (!createdAt) return <span className="muted">Unknown</span>;

  return (
    <span title={formatDate(createdAt)}>
      {formatDate(createdAt)} · {formatTimeline(createdAt)}
    </span>
  );
}

function transactionValue(chain: ChainInfo, row: Feedback) {
  if (!row.txHash) return <span className="muted">not known for this row</span>;

  return (
    <a
      href={txExplorerUrl(chain, row.txHash)}
      target="_blank"
      rel="noopener noreferrer"
      className="mono"
    >
      {shortAddress(row.txHash)} ↗
    </a>
  );
}

export function FeedbackDetailSummary({ slug, chain, row }: Props) {
  return (
    <section className="panel feedback-detail-summary">
      <dl>
        <dt>Reviewer</dt>
        <dd>
          <Link
            to="/reviewers/$slug/$address"
            params={{ slug, address: row.client }}
            className="address-mark mono"
            title={row.client}
          >
            <AddressIdenticon address={row.client} />
            {shortAddress(row.client)}
          </Link>
        </dd>
        <dt>Value</dt>
        <dd>
          <b>{formatScore(row.value)}</b>
        </dd>
        {tagsRow(row)}
        <dt>When</dt>
        <dd>{whenValue(row.createdAt)}</dd>
        {endpointRow(row.endpoint)}
        <dt>Feedback file</dt>
        <dd>
          {row.feedbackURI ? (
            <FeedbackNote uri={row.feedbackURI} />
          ) : (
            <span className="muted">none</span>
          )}
          {evidenceUrl(row.feedbackURI) ? (
            <a href={evidenceUrl(row.feedbackURI)} target="_blank" rel="noopener noreferrer">
              {' '}
              · open ↗
            </a>
          ) : null}
        </dd>
        <dt>Transaction</dt>
        <dd>{transactionValue(chain, row)}</dd>
      </dl>
      {row.responses?.length ? <FeedbackRepliesList chain={chain} replies={row.responses} /> : null}
    </section>
  );
}
