import { Link } from '@tanstack/react-router';
import { formatPercent, type MetadataCloneGroup } from '../../../shared/lib/explorer';

export function OwnerClonePanel({ groups, slug }: { groups: MetadataCloneGroup[]; slug: string }) {
  if (groups.length === 0) return null;

  return (
    <section className="panel">
      <h3>Registration clones</h3>
      <p className="muted note">
        These agents share at least 80% of the words in their registration text. A shared template
        is common for platforms; identical files from one owner are worth a closer look.
      </p>
      <ul className="groups">
        {groups.slice(0, 10).map((group) => (
          <li key={group.tokenIds.map((id) => id.toString()).join('-')}>
            <b>{group.tokenIds.length} agents</b> · overlap {formatPercent(group.similarity)}
            <div>
              {group.tokenIds.map((tokenId) => (
                <Link
                  key={tokenId.toString()}
                  to="/agents/$slug/$id"
                  params={{ slug, id: tokenId.toString() }}
                  className="chip"
                >
                  #{tokenId.toString()}
                </Link>
              ))}
            </div>
            {group.shared.length ? (
              <small className="muted">Shared words: {group.shared.slice(0, 8).join(', ')}</small>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
