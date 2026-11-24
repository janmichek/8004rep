import { METRIC_GROUPS } from '../../../shared/lib/explorer';
import { DocsMetricGroup } from './DocsMetricGroup';
import { DocsMetricsToc } from './DocsMetricsToc';

export function DocsMetrics() {
  return (
    <section id="metrics" className="docs-section docs-metrics">
      <div className="docs-metrics-head">
        <h2>Metric guide</h2>
        <p>
          Every metric has a permanent anchor. When a tooltip, chip or number needs to explain
          itself later, it can link to the matching paragraph with{' '}
          <code>{"{ name: 'docs', hash: '#id' }"}</code>.
        </p>
      </div>

      <div className="docs-metrics-body">
        <DocsMetricsToc />
        <div className="docs-groups">
          {METRIC_GROUPS.map((group) => (
            <DocsMetricGroup key={group.id} group={group} />
          ))}
        </div>
      </div>
    </section>
  );
}
