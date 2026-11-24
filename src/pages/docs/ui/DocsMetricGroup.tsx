import { DocsMetricCard } from './DocsMetricCard';
import type { GuideGroup } from './docsTypes';

export function DocsMetricGroup({ group }: { group: GuideGroup }) {
  return (
    <section id={group.id} className="docs-group">
      <div className="docs-group-head">
        <h2>{group.title}</h2>
        <span className="docs-group-count">{group.metrics.length} metrics</span>
      </div>
      <p className="docs-group-intro">{group.intro}</p>

      {group.metrics.map((metric) => (
        <DocsMetricCard key={metric.id} metric={metric} />
      ))}
    </section>
  );
}
