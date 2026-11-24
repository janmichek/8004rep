import { yAt } from './columnChartMath';

type Props = {
  width: number;
  height: number;
  plotH: number;
  yTop: number;
  ticks: number[];
  labels: { i: number; x: number; text: string; anchor: string }[];
};

export function ColumnChartAxes({ width, height, plotH, yTop, ticks, labels }: Props) {
  return (
    <>
      <div className="chart-y">
        {ticks.map((tick) => (
          <span key={tick} style={{ top: `${(yAt(tick, yTop, plotH) / height) * 100}%` }}>
            {tick}
          </span>
        ))}
      </div>
      <div className="chart-x">
        {labels.map((label) => (
          <span
            key={label.i}
            className={`anchor-${label.anchor}`}
            style={{ left: `${(label.x / width) * 100}%` }}
          >
            {label.text}
          </span>
        ))}
      </div>
    </>
  );
}
