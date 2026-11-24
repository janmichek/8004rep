import { DAY_ROWS, cellTitle } from './activityMath';
import type { ActivityCell } from './activityMath';

type Props = {
  weeks: (ActivityCell | null)[][];
  year: number | undefined;
  labels: { col: number; text: string }[];
};

function weekKey(week: (ActivityCell | null)[], index: number): string {
  const first = week.find((cell) => cell);

  return first ? first.date : `week-${index}`;
}

export function ActivityGridWeeks({ weeks, year, labels }: Props) {
  return (
    <div className="grid-scroll">
      <div className="grid-wrap">
        <div className="month-row" aria-hidden="true">
          {labels.map((month) => (
            <span
              key={`${month.col}-${month.text}`}
              className="month"
              style={{ left: `${month.col * 14}px` }}
            >
              {month.text}
            </span>
          ))}
        </div>
        <div className="grid-body">
          <div className="day-labels" aria-hidden="true">
            {DAY_ROWS.map((entry) => (
              <span key={entry.key}>{entry.label}</span>
            ))}
          </div>
          <div className="weeks" role="img" aria-label={`Feedback per day in ${year}`}>
            {weeks.map((week, index) => {
              const key = weekKey(week, index);

              const slots = week.map((cell, slot) => ({
                cell,
                key: cell ? cell.date : `pad-${key}-${slot}`,
              }));

              return (
                <div key={key} className="week">
                  {slots.map((slot) =>
                    slot.cell ? (
                      <span
                        key={slot.key}
                        className={`cell l${slot.cell.level}`}
                        title={cellTitle(slot.cell)}
                        aria-label={cellTitle(slot.cell)}
                      />
                    ) : (
                      <span key={slot.key} className="cell pad" aria-hidden="true" />
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
