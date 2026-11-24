import type { ReputationReport } from '../../../lib/explorer/data/reputation/report';
import { PanelTable } from '../PanelTable';

export function MethodsKinds({ rep }: { rep: ReputationReport }) {
  return (
    <PanelTable
      title="What counts"
      subtitle="only ratings enter the score"
      head={
        <tr>
          <th>Kind</th>
          <th className="num">Rows</th>
          <th>Treatment</th>
        </tr>
      }
    >
      {rep.byKind.map((entry) => (
        <tr key={entry.kind}>
          <td>{entry.label}</td>
          <td className="num">{entry.rows}</td>
          <td className="muted">
            {entry.kind === 'rating'
              ? 'normalised to 0–1 on the inferred scale and scored'
              : 'shown, never averaged into the score'}
          </td>
        </tr>
      ))}
    </PanelTable>
  );
}
