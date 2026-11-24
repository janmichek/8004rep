import { useMemo, useState } from 'react';
import { DAY, MONTHS } from './activityMath';
import type { ActivityCell } from './activityMath';
import { ActivityGridHead } from './ActivityGridHead';
import { ActivityGridLegend } from './ActivityGridLegend';
import { ActivityGridWeeks } from './ActivityGridWeeks';

function yearWeeks(year: number, perDay: Map<number, number>): (ActivityCell | null)[][] {
  const start = Date.UTC(year, 0, 1) / 1000 / DAY;
  const end = Date.UTC(year + 1, 0, 1) / 1000 / DAY;
  const startWeekday = new Date(start * DAY * 1000).getUTCDay();
  const cells: (ActivityCell | null)[] = Array.from({ length: startWeekday }, () => null);
  const counts: number[] = [];

  for (let day = start; day < end; day++) {
    const count = perDay.get(day) ?? 0;
    counts.push(count);
    cells.push({
      day,
      date: new Date(day * DAY * 1000).toISOString().slice(0, 10),
      count,
      level: 0,
    });
  }

  const max = Math.max(0, ...counts);

  for (const cell of cells) {
    if (cell && cell.count > 0)
      cell.level = Math.min(4, Math.max(1, Math.ceil((cell.count / max) * 4)));
  }

  while (cells.length % 7 !== 0) cells.push(null);
  const out: (ActivityCell | null)[][] = [];

  for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));

  return out;
}

function monthLabelsOf(weeks: (ActivityCell | null)[][]): { col: number; text: string }[] {
  const labels: { col: number; text: string }[] = [];
  weeks.forEach((week, col) => {
    const first = week.find((cell) => cell && cell.date.endsWith('-01'));

    if (first) labels.push({ col, text: MONTHS[Number(first.date.slice(5, 7)) - 1] ?? '' });
  });

  return labels;
}

export function ActivityGrid({ times, label }: { times: number[]; label?: string }) {
  const perDay = useMemo(() => {
    const map = new Map<number, number>();

    for (const time of times) {
      const day = Math.floor(time / DAY);
      map.set(day, (map.get(day) ?? 0) + 1);
    }

    return map;
  }, [times]);

  const years = useMemo(() => {
    const days = [...perDay.keys()];

    if (days.length === 0) return [];
    const first = new Date(Math.min(...days) * DAY * 1000).getUTCFullYear();
    const last = new Date(Math.max(...days) * DAY * 1000).getUTCFullYear();

    return Array.from({ length: last - first + 1 }, (_, index) => first + index);
  }, [perDay]);

  const [page, setPage] = useState(() => Math.max(0, years.length - 1));
  const current = Math.min(page, Math.max(0, years.length - 1));
  const year = years[current];
  const weeks = useMemo(() => (year === undefined ? [] : yearWeeks(year, perDay)), [year, perDay]);
  const labels = useMemo(() => monthLabelsOf(weeks), [weeks]);

  const total = useMemo(() => {
    if (year === undefined) return 0;
    let count = 0;

    for (const [day, value] of perDay) {
      if (new Date(day * DAY * 1000).getUTCFullYear() === year) count += value;
    }

    return count;
  }, [perDay, year]);

  const activeDays = weeks.flat().filter((cell) => cell && cell.count > 0).length;

  return (
    <section className="panel activity">
      <ActivityGridHead
        year={year}
        years={years}
        page={current}
        total={total}
        label={label ?? 'Activity'}
        activeDays={activeDays}
        onChange={setPage}
      />
      {years.length > 0 ? <ActivityGridWeeks weeks={weeks} year={year} labels={labels} /> : null}
      {years.length > 0 ? <ActivityGridLegend /> : null}
    </section>
  );
}
