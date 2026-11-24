import { Skeleton } from './Skeleton';

type Props = { label: string; headers: string[]; numeric?: string[]; rows?: number };

function barWidth(row: number, col: number): string {
  if (col === 0) return `${46 + ((row + col) % 4) * 12}%`;

  return `${2.2 + ((row * 3 + col) % 4) * 0.7}em`;
}

export function TableSkeleton({ label, headers, numeric = [], rows = 8 }: Props) {
  const body = Array.from({ length: rows }, (_, row) => row + 1);

  return (
    <div className="table-wrap" aria-busy="true">
      <span className="sr-only">{label}</span>
      <table aria-hidden="true">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} className={numeric.includes(header) ? 'num' : undefined}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row) => (
            <tr key={row}>
              {headers.map((header, col) => (
                <td key={header} className={numeric.includes(header) ? 'num' : undefined}>
                  {col === 0 ? (
                    <div className="agent-cell">
                      <Skeleton width="32px" height="32px" radius="8px" />
                      <span className="agent-name">
                        <Skeleton width={barWidth(row, col)} />
                        <Skeleton width="72%" height="0.65em" />
                      </span>
                    </div>
                  ) : (
                    <Skeleton width={barWidth(row, col)} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
