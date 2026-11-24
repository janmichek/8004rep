import { PAD, segmentPath, type Bar } from './columnChartMath';

type Props = {
  width: number;
  height: number;
  plotH: number;
  ticks: number[];
  yTop: number;
  bars: Bar[];
  barW: number;
  slot: number;
  colors: Record<string, string | undefined>;
  hover: number | undefined;
  onHover: (index: number | undefined) => void;
  markerX: number | undefined;
};

export function ColumnChartSvg({
  width,
  height,
  plotH,
  ticks,
  yTop,
  bars,
  barW,
  slot,
  colors,
  hover,
  onHover,
  markerX,
}: Props) {
  return (
    <svg viewBox={`0 0 ${width} ${height}`} height={height} role="img">
      <g className="grid">
        {ticks.map((tick) => (
          <line
            key={tick}
            x1={PAD.left}
            x2={width - PAD.right}
            y1={PAD.top + plotH - (tick / yTop) * plotH}
            y2={PAD.top + plotH - (tick / yTop) * plotH}
          />
        ))}
      </g>
      {bars.map((bar, index) => (
        <g key={bar.parts[0]?.x ?? `bar-${index}`}>
          {bar.parts.map((part) => (
            <path
              key={part.key}
              d={segmentPath(part, barW)}
              fill={colors[part.key]}
              opacity={hover === undefined || hover === index ? 1 : 0.45}
            />
          ))}
          <rect
            x={PAD.left + index * slot}
            y={PAD.top}
            width={slot}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => onHover(index)}
          />
        </g>
      ))}
      {markerX !== undefined ? (
        <line className="marker" x1={markerX} x2={markerX} y1={PAD.top} y2={PAD.top + plotH} />
      ) : null}
    </svg>
  );
}
