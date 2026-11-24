import type { Series } from './palette';
import type { Bar } from './columnChartMath';
import { ColumnChartAxes } from './ColumnChartAxes';
import { ColumnChartSvg } from './ColumnChartSvg';

type Props = {
  width: number;
  height: number;
  plotH: number;
  yTop: number;
  ticks: number[];
  bars: Bar[];
  slot: number;
  barW: number;
  series: Series[];
  colors: Record<string, string | undefined>;
  labels: { i: number; x: number; text: string; anchor: string }[];
  hover: number | undefined;
  onHover: (index: number | undefined) => void;
  markerX: number | undefined;
  tip: { text: string; left: number } | undefined;
};

export function ColumnChartPlot(props: Props) {
  return (
    <div className="chart-plot" onMouseLeave={() => props.onHover(undefined)}>
      <ColumnChartSvg
        width={props.width}
        height={props.height}
        plotH={props.plotH}
        ticks={props.ticks}
        yTop={props.yTop}
        bars={props.bars}
        barW={props.barW}
        slot={props.slot}
        colors={props.colors}
        hover={props.hover}
        onHover={props.onHover}
        markerX={props.markerX}
      />
      <ColumnChartAxes
        width={props.width}
        height={props.height}
        plotH={props.plotH}
        yTop={props.yTop}
        ticks={props.ticks}
        labels={props.labels}
      />
      {props.tip ? (
        <div className="chart-tip" style={{ left: `${props.tip.left}%` }}>
          {props.tip.text}
        </div>
      ) : null}
    </div>
  );
}
