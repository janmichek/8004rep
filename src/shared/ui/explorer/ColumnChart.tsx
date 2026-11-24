import { useEffect, useRef, useState } from 'react';
import type { Column } from '../../lib/explorer/data/chartData';
import type { Series } from './palette';
import { ColumnChartLegend } from './ColumnChartLegend';
import { ColumnChartPlot } from './ColumnChartPlot';
import { PAD, buildBars, ticksFor } from './columnChartMath';

type Props = {
  title: string;
  columns: Column[];
  series: Series[];
  /** Value marked with a dashed rule and its label (e.g. a mean). */
  marker?: { at: number; label: string } | undefined;
  height?: number;
};

function labelsFor(columns: Column[], slot: number) {
  const n = columns.length;
  const picks = n <= 3 ? [...Array(n).keys()] : [0, Math.floor((n - 1) / 2), n - 1];

  return picks.map((index) => {
    let anchor = 'middle';

    if (n > 3 && index === 0) anchor = 'start';
    else if (n > 3 && index === n - 1) anchor = 'end';

    return {
      i: index,
      x: PAD.left + index * slot + slot / 2,
      text: columns[index]?.label ?? '',
      anchor,
    };
  });
}

function markerXFor(columns: Column[], slot: number, marker: { at: number } | undefined) {
  if (!marker || columns.length === 0) return undefined;
  const offset = columns[0]?.label === '< 0' ? 1 : 0;

  return PAD.left + (offset + Math.min(marker.at, 100) / 10) * slot;
}

function tipFor(columns: Column[], slot: number, width: number, hover: number | undefined) {
  if (hover === undefined) return undefined;

  return {
    text: columns[hover]?.title ?? '',
    left: Math.min(85, Math.max(15, ((PAD.left + (hover + 0.5) * slot) / width) * 100)),
  };
}

export function ColumnChart({ title, columns, series, marker, height = 150 }: Props) {
  const plot = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | undefined>(undefined);

  useEffect(() => {
    const node = plot.current;

    if (!node) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0) setWidth(entry.contentRect.width);
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const max = Math.max(
    1,
    ...columns.map((column) => column.segments.reduce((a, s) => a + s.value, 0))
  );

  const ticks = ticksFor(max);
  const yTop = ticks.at(-1) ?? 1;
  const plotH = height - PAD.top - PAD.bottom;
  const { slot, barW, bars } = buildBars(columns, width, plotH, yTop);
  const colors = Object.fromEntries(series.map((item) => [item.key, item.color]));

  return (
    <figure className="chart">
      <ColumnChartLegend title={title} marker={marker} series={series} />
      {columns.length === 0 ? <p className="muted chart-empty">Nothing dated to plot.</p> : null}
      <div ref={plot} style={{ display: columns.length === 0 ? 'none' : undefined }}>
        {columns.length === 0 ? null : (
          <ColumnChartPlot
            width={width}
            height={height}
            plotH={plotH}
            yTop={yTop}
            ticks={ticks}
            bars={bars}
            slot={slot}
            barW={barW}
            series={series}
            colors={colors}
            labels={labelsFor(columns, slot)}
            hover={hover}
            onHover={setHover}
            markerX={markerXFor(columns, slot, marker)}
            tip={tipFor(columns, slot, width, hover)}
          />
        )}
      </div>
    </figure>
  );
}
