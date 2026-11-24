import { Link } from '@tanstack/react-router';
import { buildAgentsSearch } from './agentsSearch';

type Props = {
  rated: boolean;
  page: number;
  hasMore: boolean;
  sort: 'registered' | 'score' | 'feedback' | null;
  slug: string;
  q: string;
  chain: number | undefined;
  order: 'asc' | 'desc';
};

function linkFor(page: number, props: Props) {
  return {
    to: '/agents/$slug' as const,
    params: { slug: props.slug },
    search: buildAgentsSearch({
      q: props.q,
      chain: props.chain,
      rated: false,
      page,
      sort: props.sort,
      order: props.order,
    }),
  };
}

export function AgentsPager(props: Props) {
  if (props.rated) return null;

  if (props.page <= 0 && !props.hasMore) return null;

  const newer = props.sort ? '← Previous' : '← Newer';
  const older = props.sort ? 'Next →' : 'Older →';

  return (
    <nav className="pager" aria-label="Pagination">
      {props.page > 0 ? (
        <Link {...linkFor(props.page - 1, props)}>{newer}</Link>
      ) : (
        <span className="muted">{newer}</span>
      )}
      <span>Page {props.page + 1}</span>
      {props.hasMore ? (
        <Link {...linkFor(props.page + 1, props)}>{older}</Link>
      ) : (
        <span className="muted">{older}</span>
      )}
    </nav>
  );
}
