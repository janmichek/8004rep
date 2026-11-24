import { Link } from '@tanstack/react-router';
import { DEFAULT_CHAIN } from '../../../shared/lib/explorer';

const defaultSlug = DEFAULT_CHAIN.slug;

function scrollToTop(): void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth';

  window.scrollTo({ top: 0, behavior });
}

export function DocsFooter() {
  return (
    <footer className="docs-footer">
      <Link to="/agents/$slug" params={{ slug: defaultSlug }}>
        Agents
      </Link>
      <Link to="/network/$slug" params={{ slug: defaultSlug }}>
        Network health
      </Link>
      <a href="#metrics">Back to the metric guide</a>
      <button type="button" className="docs-top" onClick={scrollToTop}>
        Back to top ↑
      </button>
    </footer>
  );
}
