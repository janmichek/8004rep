import type { GuideMetric } from './docsTypes';

export function DocsMetricCard({ metric }: { metric: GuideMetric }) {
  return (
    <article id={metric.id} className="docs-metric">
      <h3>
        <a href={`#${metric.id}`} title={`Link to ${metric.name}`}>
          {metric.name}
        </a>
      </h3>
      <p>{metric.summary}</p>
      {metric.rule ? <p className="docs-rule">{metric.rule}</p> : null}
      {metric.where ? (
        <p className="docs-where">
          <span>Seen in</span> {metric.where}
        </p>
      ) : null}
      {metric.caveat ? (
        <p className="docs-caveat">
          <span>Worth knowing</span> {metric.caveat}
        </p>
      ) : null}
    </article>
  );
}
