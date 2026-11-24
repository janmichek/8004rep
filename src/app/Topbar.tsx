import { Link } from '@tanstack/react-router';
import { SourceBadge } from '../shared/ui';
import { EnvSwitch } from '../features/env-switch';
import type { NetworkEnv, ResolvedSource } from '../shared/lib/explorer';

type Props = {
  activeSlug: string;
  listSlug: string;
  starCount: number;
  resolved?: ResolvedSource | undefined;
  showSource: boolean;
  onSwitch: (value: NetworkEnv) => void;
};

const activeProps = { className: 'router-link-active' };

export function Topbar({ activeSlug, listSlug, starCount, resolved, showSource, onSwitch }: Props) {
  return (
    <header className="topbar">
      <Link className="brand" to="/agents/$slug" params={{ slug: activeSlug }}>
        8004<span>rep</span>
      </Link>
      <nav className="nav">
        <Link to="/agents/$slug" params={{ slug: activeSlug }} activeProps={activeProps}>
          Agents
        </Link>
        <Link to="/owners/$slug" params={{ slug: listSlug }} activeProps={activeProps}>
          Owners
        </Link>
        <Link to="/reviewers/$slug" params={{ slug: listSlug }} activeProps={activeProps}>
          Reviewers
        </Link>
        <Link to="/feedbacks/$slug" params={{ slug: listSlug }} activeProps={activeProps}>
          Feedbacks
        </Link>
        <Link to="/network/$slug" params={{ slug: activeSlug }} activeProps={activeProps}>
          Network health
        </Link>
        <Link to="/docs" activeProps={activeProps}>
          Docs
        </Link>
      </nav>
      <div className="topbar-right">
        <EnvSwitch onSwitch={onSwitch} />
        {showSource ? <SourceBadge resolved={resolved} /> : null}
        <Link
          className="star-link"
          to="/starred"
          activeProps={activeProps}
          aria-label={`Starred (${starCount})`}
          title="Starred agents, owners and reviewers"
        >
          <span aria-hidden="true">★</span>
          {starCount > 0 ? <span className="star-count">{starCount}</span> : null}
        </Link>
      </div>
    </header>
  );
}
