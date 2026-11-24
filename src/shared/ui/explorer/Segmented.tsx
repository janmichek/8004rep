type Segment<T extends string> = { id: T; label: string; count?: number; disabled?: boolean };

type Props<T extends string> = {
  segments: Segment<T>[];
  label: string;
  value: T;
  onChange: (value: T) => void;
};

export function Segmented<T extends string>({ segments, label, value, onChange }: Props<T>) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {segments.map((segment) => (
        <button
          key={segment.id}
          type="button"
          className="segment"
          data-state={segment.id === value ? 'on' : 'off'}
          aria-pressed={segment.id === value}
          disabled={segment.disabled}
          onClick={() => onChange(segment.id)}
        >
          {segment.label}
          {segment.count !== undefined ? <span className="muted">{segment.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
