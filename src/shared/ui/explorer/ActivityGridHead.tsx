type Props = {
  year: number | undefined;
  years: number[];
  page: number;
  total: number;
  label: string;
  activeDays: number;
  onChange: (page: number) => void;
};

export function ActivityGridHead({ year, years, page, total, activeDays, label, onChange }: Props) {
  return (
    <>
      <div className="activity-head">
        <h3>{label}</h3>
        {years.length > 0 ? (
          <div className="pager" role="group" aria-label="Change year">
            <button
              type="button"
              disabled={page <= 0}
              aria-label="Previous year"
              onClick={() => onChange(page - 1)}
            >
              ‹
            </button>
            <span className="mono year" aria-live="polite">
              {year}
            </span>
            <button
              type="button"
              disabled={page >= years.length - 1}
              aria-label="Next year"
              onClick={() => onChange(page + 1)}
            >
              ›
            </button>
          </div>
        ) : null}
      </div>
      {years.length === 0 ? (
        <p className="muted summary">No dated feedback, so there is no activity to plot.</p>
      ) : (
        <p className="muted summary">
          {total} feedback in {year} · {activeDays} active day{activeDays === 1 ? '' : 's'}
        </p>
      )}
    </>
  );
}
