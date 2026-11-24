import type { FeedbackStats } from '../../../lib/explorer/data/feedbackStats';
import type { ReputationReport } from '../../../lib/explorer/data/reputation/report';
import { SeverityIcon } from '../SeverityIcon';

type Props = { stats: FeedbackStats; rep: ReputationReport };

export function OverviewSignals({ stats, rep }: Props) {
  const hasConcentration = stats.signals.some((signal) => signal.code === 'concentration');

  const findings = rep.findings.filter(
    (finding) => !(hasConcentration && finding.code === 'repeat')
  );

  const rows = [
    ...stats.signals.map((signal) => ({
      key: `sig-${signal.code}`,
      level: signal.level,
      text: signal.text,
    })),
    ...findings.map((finding) => ({
      key: `find-${finding.code}`,
      level: finding.level,
      text: finding.text,
    })),
  ];

  return (
    <section className="panel">
      <h3>What stands out</h3>
      <table className="signals">
        <caption className="sr-only">What stands out, by severity</caption>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={`level-${row.level}`}>
              <td className="signal-level">
                <SeverityIcon level={row.level} />
              </td>
              <td>{row.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="muted">No warning signs in this feedback.</p> : null}
    </section>
  );
}
