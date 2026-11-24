type Props = {
  score: number;
  scoreLabel: string;
};

export function AgentScoreCell({ score, scoreLabel }: Props) {
  return (
    <td className="score-cell">
      <span className="score-label">{scoreLabel}</span>
      <span className="score-track" aria-hidden="true">
        <span className="score-fill" style={{ width: `${score}%` }} />
      </span>
    </td>
  );
}
