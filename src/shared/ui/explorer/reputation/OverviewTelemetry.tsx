import type { ReputationReport } from '../../../lib/explorer/data/reputation/report';
import { formatNumber } from '../../../lib/explorer';
import { PanelTable } from '../PanelTable';

export function OverviewTelemetry({ rep }: { rep: ReputationReport }) {
  if (rep.telemetry.length === 0) return null;

  return (
    <PanelTable
      title="Telemetry"
      subtitle="answers “is it up”, not “is it good”"
      head={
        <tr>
          <th>Tag</th>
          <th className="num">Rows</th>
          <th className="num">Wallets</th>
          <th className="num">Latest</th>
          <th className="num">Median</th>
        </tr>
      }
    >
      {rep.telemetry.map((entry) => (
        <tr key={entry.tag}>
          <td>
            <span className="chip clip-chip" title={entry.label}>
              {entry.label}
            </span>
          </td>
          <td className="num">{entry.rows}</td>
          <td className="num">{entry.clients}</td>
          <td className="num">{formatNumber(entry.latest)}</td>
          <td className="num">{formatNumber(entry.median)}</td>
        </tr>
      ))}
    </PanelTable>
  );
}
