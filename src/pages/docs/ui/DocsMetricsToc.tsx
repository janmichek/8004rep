import { Fragment } from 'react';
import { METRIC_GROUPS } from '../../../shared/lib/explorer';

const metricCount = METRIC_GROUPS.reduce((total, group) => total + group.metrics.length, 0);

export function DocsMetricsToc() {
  return (
    <aside className="docs-toc" aria-label="Metrics">
      <p className="docs-toc-title">{metricCount} metrics</p>
      <nav>
        {METRIC_GROUPS.map((group) => (
          <Fragment key={group.id}>
            <a className="docs-toc-group" href={`#${group.id}`}>
              {group.title}
            </a>
            <ol>
              {group.metrics.map((metric) => (
                <li key={metric.id}>
                  <a href={`#${metric.id}`}>{metric.name}</a>
                </li>
              ))}
            </ol>
          </Fragment>
        ))}
      </nav>
    </aside>
  );
}
