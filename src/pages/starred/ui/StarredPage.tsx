import { useStarred, type StarKind } from '../../../shared/lib/explorer';
import { StarredGroup } from './StarredGroup';
import { useStarStats } from './useStarStats';

const GROUPS: { kind: StarKind; title: string }[] = [
  { kind: 'agent', title: 'Agents' },
  { kind: 'owner', title: 'Owners' },
  { kind: 'reviewer', title: 'Reviewers' },
];

export function StarredPage() {
  const starred = useStarred();
  const stats = useStarStats(starred);

  return (
    <>
      <div className="page-head">
        <h1>
          Starred <small>{starred.length} starred</small>
        </h1>
        <p className="meta">Kept in this browser only.</p>
      </div>

      {starred.length === 0 ? (
        <section className="state muted">
          Nothing starred yet. Use “Star” on an agent, owner or reviewer page.
        </section>
      ) : (
        GROUPS.map((group) => {
          const rows = starred.filter((star) => star.kind === group.kind);

          if (rows.length === 0) return null;

          return <StarredGroup key={group.kind} title={group.title} rows={rows} stats={stats} />;
        })
      )}
    </>
  );
}
