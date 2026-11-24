import { Hint } from './Hint';

type Props = {
  label: string;
  numeric?: boolean | undefined;
  active?: 'asc' | 'desc' | null;
  text?: string | undefined;
  onSort: () => void;
};

function ariaSort(active: 'asc' | 'desc' | null | undefined): 'ascending' | 'descending' | 'none' {
  if (active === 'asc') return 'ascending';

  if (active === 'desc') return 'descending';

  return 'none';
}

function caret(active: 'asc' | 'desc' | null | undefined): string {
  if (active === 'asc') return '▲';

  if (active === 'desc') return '▼';

  return '↕';
}

export function SortHeader({ label, numeric, active, text, onSort }: Props) {
  const button = (
    <button type="button" className={`sort-trigger${active ? ' active' : ''}`} onClick={onSort}>
      {label}
      <span className="sort-caret" aria-hidden="true">
        {caret(active)}
      </span>
    </button>
  );

  return (
    <th className={numeric ? 'num' : undefined} aria-sort={ariaSort(active)}>
      {text ? <Hint text={text}>{button}</Hint> : button}
    </th>
  );
}
