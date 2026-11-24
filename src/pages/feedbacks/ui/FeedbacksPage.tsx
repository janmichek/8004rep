import { useParams } from '@tanstack/react-router';
import { MessageSquareText } from 'lucide-react';
import { chainById, useFeedRows, useScope, useSort } from '../../../shared/lib/explorer';
import type { FeedbackEvent } from '../../../shared/lib/explorer';
import { PageHeader, TableSkeleton } from '../../../shared/ui';
import { NetworkPicker } from '../../../features/network-picker';
import { FeedbacksTable } from './FeedbacksTable';
import { feedbackFacts, feedbackHeaders, feedbackNote } from './feedbacksFacts';
import { FeedbacksLoadNote } from './FeedbacksLoadNote';
import { useFeedbackOpen } from './useFeedbackOpen';

export function FeedbacksPage() {
  const { slug } = useParams({ from: '/feedbacks/$slug' });
  const scope = useScope(slug);

  const {
    rows: items,
    hasMore,
    since,
    loaded,
    failed,
    error,
    loading,
    load,
  } = useFeedRows(scope, {
    minRows: 100,
    maxSteps: 6,
  });

  const open = useFeedbackOpen(slug);
  const facts = feedbackFacts(items, loaded);
  const note = feedbackNote(since);

  const rows = useSort(items, [
    { key: 'agent', value: (row: FeedbackEvent) => row.agentName ?? `Agent #${row.tokenId}` },
    { key: 'network', value: (row) => chainById(row.chainId ?? 0)?.shortName ?? '' },
    { key: 'reviewer', value: (row) => row.client.toLowerCase() },
    { key: 'value', value: (row) => row.value, numeric: true },
    { key: 'when', value: (row) => row.createdAt, numeric: true },
  ]);

  let content;

  if (error) {
    content = (
      <p className="notice">
        Could not load feedback: {error}{' '}
        <button type="button" onClick={() => void load()}>
          Retry
        </button>
      </p>
    );
  } else if (!loaded) {
    content = (
      <TableSkeleton
        label="Loading feedback"
        headers={feedbackHeaders(scope.all)}
        numeric={['Value']}
      />
    );
  } else {
    content = (
      <FeedbacksTable
        rows={rows.sorted}
        all={scope.all}
        slug={slug}
        sortState={rows.state}
        toggle={rows.toggle}
        onOpen={open}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Feedbacks"
        description="Every review left on the newest agents, one row per feedback."
        icon={MessageSquareText}
        facts={facts}
        note={note}
        loading={loading && !loaded}
        actions={<NetworkPicker routeName="feedbacks" slug={slug} />}
      />
      {failed.length > 0 && loaded ? (
        <p className="notice">
          Could not load feedback on {failed.map((failure) => failure.chain.name).join(', ')}; those
          networks are left out.
        </p>
      ) : null}
      {content}
      {loaded ? <FeedbacksLoadNote hasMore={hasMore} loading={loading} load={load} /> : null}
    </>
  );
}
