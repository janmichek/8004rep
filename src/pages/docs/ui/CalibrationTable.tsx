const ROWS = [
  ['Current (α=3, 90d, 30d)', 5, 8, 1, '1.0000'],
  ['Fast decay (30d)', 4, 9, 1, '0.9868'],
  ['Slow decay (180d)', 7, 6, 1, '0.9956'],
  ['Strong prior (α=5)', 4, 9, 1, '0.9956'],
  ['Weak prior (α=1)', 8, 4, 2, '0.9516'],
  ['Short unit window (7d)', 5, 8, 1, '1.0000'],
  ['Long unit window (90d)', 5, 8, 1, '1.0000'],
] as const;

export function CalibrationTable() {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Config</th>
            <th className="num">Trusted</th>
            <th className="num">Fair</th>
            <th className="num">Flagged</th>
            <th className="num">Spearman ρ</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([label, trusted, fair, flagged, rho]) => (
            <tr key={label}>
              <td>{label}</td>
              <td className="num">{trusted}</td>
              <td className="num">{fair}</td>
              <td className="num">{flagged}</td>
              <td className="num">{rho}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
