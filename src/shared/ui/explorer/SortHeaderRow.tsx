import { SortHeader } from './SortHeader';

type Column = { key: string; label: string; numeric?: boolean; text?: string; static?: boolean };

type Props = {
  columns: Column[];
  state: (key: string) => 'asc' | 'desc' | null;
  toggle: (key: string) => void;
};

export function SortHeaderRow({ columns, state, toggle }: Props) {
  return (
    <tr>
      {columns.map((column) =>
        column.static ? (
          <th key={column.key} className={column.numeric ? 'num' : undefined}>
            {column.label}
          </th>
        ) : (
          <SortHeader
            key={column.key}
            label={column.label}
            numeric={column.numeric}
            text={column.text}
            active={state(column.key)}
            onSort={() => toggle(column.key)}
          />
        )
      )}
    </tr>
  );
}
