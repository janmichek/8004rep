import { Skeleton } from './Skeleton';
import type { PageFact } from './PageHeaderTitle';

type Props = { facts: PageFact[]; note?: string | undefined; loading: boolean };

function factsSkeleton() {
  return (
    <div className="page-header-facts" aria-hidden="true">
      <span className="page-fact">
        <Skeleton width="2.4em" height="0.75em" />
      </span>
      <span className="page-fact">
        <Skeleton width="3.2em" height="0.75em" />
      </span>
      <span className="page-fact">
        <Skeleton width="2em" height="0.75em" />
      </span>
    </div>
  );
}

export function PageHeaderFacts({ facts, note, loading }: Props) {
  return (
    <div className="page-header-foot">
      {loading ? factsSkeleton() : null}
      {!loading && facts.length > 0 ? (
        <ul className="page-header-facts">
          {facts.map((fact) => (
            <li key={fact.label} className={`page-fact${fact.tone ? ` tone-${fact.tone}` : ''}`}>
              <b>{fact.value}</b> {fact.label}
            </li>
          ))}
        </ul>
      ) : null}
      {note ? <p className="page-header-note">{note}</p> : null}
    </div>
  );
}
