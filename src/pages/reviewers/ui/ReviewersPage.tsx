import { useMemo } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { MessagesSquare } from 'lucide-react';
import {
  reviewerDirectory,
  useFeedRows,
  useScope,
  useSort,
  type ReviewerProfile,
} from '../../../shared/lib/explorer';
import { PageHeader } from '../../../shared/ui';
import { NetworkPicker } from '../../../features/network-picker';
import { ReviewersContent } from './ReviewersContent';
import { ReviewersStatus } from './ReviewersStatus';
import { openReviewer } from './openReviewer';
import { REVIEWERS_NOTE, REVIEWER_COLUMNS, reviewerFacts } from './reviewerFacts';

export function ReviewersPage() {
  const { slug } = useParams({ from: '/reviewers/$slug' });
  const scope = useScope(slug);
  const feed = useFeedRows(scope, { minRows: 250, maxSteps: 12 });
  const navigate = useNavigate();
  const reviewers = useMemo(() => reviewerDirectory(feed.rows), [feed.rows]);
  const rows = useSort(reviewers, REVIEWER_COLUMNS);
  const facts = feed.loaded ? reviewerFacts(reviewers, feed.rows.length) : [];

  const headers = scope.all
    ? ['Reviewer', 'Reviews', 'Agents', 'Networks', 'Avg rating', 'Flags']
    : ['Reviewer', 'Reviews', 'Agents', 'Avg rating', 'Flags'];

  function open(reviewer: ReviewerProfile, event?: { target: EventTarget | null }) {
    openReviewer(navigate, slug, reviewer, event);
  }

  return (
    <>
      <PageHeader
        title="Reviewers"
        description="Addresses that rated agents in the latest feedback, with the flags the rules raise."
        icon={MessagesSquare}
        facts={facts}
        note={REVIEWERS_NOTE}
        loading={feed.loading && !feed.loaded}
        actions={<NetworkPicker routeName="reviewers" slug={slug} />}
      />

      <ReviewersStatus
        failed={feed.failed}
        loaded={feed.loaded}
        error={feed.error}
        headers={headers}
        onRetry={() => void feed.load()}
      />

      {!feed.error && feed.loaded ? (
        <ReviewersContent
          rows={rows.sorted}
          all={scope.all}
          hasMore={feed.hasMore}
          loading={feed.loading}
          sortState={rows.state}
          onToggle={rows.toggle}
          onOpen={open}
          onLoadOlder={() => void feed.load(true)}
        />
      ) : null}
    </>
  );
}
