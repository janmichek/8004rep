import type { Series } from './palette';

type Props = {
  title: string;
  marker?: { at: number; label: string } | undefined;
  series: Series[];
};

export function ColumnChartLegend({ title, marker, series }: Props) {
  return (
    <figcaption className="chart-title">
      {title}
      {marker || series.length > 1 ? (
        <span className="chart-legend">
          {marker ? <span className="legend-item marker-key">{marker.label}</span> : null}
          {series.length > 1
            ? series.map((item) => (
                <span key={item.key} className="legend-item">
                  <span className="swatch" style={{ background: item.color }} />
                  {item.label}
                </span>
              ))
            : null}
        </span>
      ) : null}
    </figcaption>
  );
}
