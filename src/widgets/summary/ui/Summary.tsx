import { averageScore, byNetwork, countByStatus, useAgents } from '../../../entities/agent';
import { formatScore } from '../../../shared/lib';
import { LoadingState, Stat } from '../../../shared/ui';

export function Summary({ network }: { network: string | undefined }) {
  const query = useAgents();

  if (query.isPending) return <LoadingState label="Counting..." />;

  if (query.error !== null) {
    return (
      <p className="notice notice--error" role="alert">
        {query.error.message}
      </p>
    );
  }

  const rows = byNetwork(query.data, network);
  const counts = countByStatus(rows);
  const average = averageScore(rows);

  return (
    <div className="summary">
      <Stat label="Active" value={String(counts.active)} />
      <Stat label="Quiet" value={String(counts.quiet)} />
      <Stat label="Unreviewed" value={String(counts.unreviewed)} />
      <Stat label="Avg score" value={average === null ? '—' : formatScore(average)} />
    </div>
  );
}
