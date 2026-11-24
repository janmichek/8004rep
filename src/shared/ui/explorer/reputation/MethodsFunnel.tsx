import type { ReputationReport } from '../../../lib/explorer/data/reputation/report';
import { funnelRows } from './methodsData';

export function MethodsFunnel({ rep }: { rep: ReputationReport }) {
  return (
    <section className="panel">
      <h3>From rows to voices</h3>
      <ul className="meters">
        {funnelRows(rep).map((entry) => (
          <li key={entry.label}>
            <span className="bar-label">{entry.label}</span>
            <span className="bar-track" aria-hidden="true">
              <span
                style={{
                  width: `${rep.funnel.feedback ? (entry.n / rep.funnel.feedback) * 100 : 0}%`,
                }}
              />
            </span>
            <span className="bar-value">{entry.n}</span>
            {entry.hint ? <span className="bar-note muted">{entry.hint}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
