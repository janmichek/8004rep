import { LABEL_INFO, type ReviewerLabel } from '../../../shared/lib/explorer';
import { ReviewerChip } from '../../../shared/ui';

export function ReviewerHabitSignals({ labels }: { labels: ReviewerLabel[] }) {
  return (
    <>
      <h3>What its habits say</h3>
      {labels.length ? (
        <table className="signals">
          <thead>
            <tr>
              <th>Label</th>
              <th>Finding</th>
            </tr>
          </thead>
          <tbody>
            {labels.map((label) => (
              <tr key={label} className={`level-${LABEL_INFO[label].tone}`}>
                <td>
                  <ReviewerChip label={label} />
                </td>
                <td>{LABEL_INFO[label].rule}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">
          No reviewer rule fired: varied values, more than one agent, no bulk days.
        </p>
      )}
    </>
  );
}
