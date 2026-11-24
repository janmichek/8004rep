import { useEffect, useRef, useState } from 'react';
import { ChainIcon } from '../marks/ChainIcon';

export type SelectOption = { value: string; label: string; disabled?: boolean; chainId?: number };

type Props = {
  options: SelectOption[];
  /** Accessible name, since the trigger shows the current value rather than the field name. */
  label: string;
  value: string;
  placeholder?: string;
  compact?: boolean;
  onChange: (value: string) => void;
};

/** Reka-style select: a trigger button and a floating list of options. */
export function SelectMenu({ options, label, value, placeholder, compact, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return undefined;

    function close(event: MouseEvent) {
      if (root.current && event.target instanceof Node && !root.current.contains(event.target))
        setOpen(false);
    }

    function key(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);

    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  function pick(next: string) {
    setOpen(false);

    if (next !== value) onChange(next);
  }

  return (
    <div className="select-root" ref={root}>
      <button
        type="button"
        className={`select-trigger${compact ? ' compact' : ''}`}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-state={open ? 'open' : 'closed'}
        onClick={() => setOpen((next) => !next)}
      >
        <span className="select-value">
          {selected?.chainId !== undefined ? (
            <ChainIcon chainId={selected.chainId} name={selected.label} size={15} />
          ) : null}
          {selected ? selected.label : (placeholder ?? label)}
        </span>
        <span className="select-icon" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="select-content" role="listbox" aria-label={label} data-state="open">
          <div className="select-viewport">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className="select-item"
                role="option"
                aria-selected={option.value === value}
                disabled={option.disabled}
                onClick={() => pick(option.value)}
              >
                <span className="select-option">
                  {option.chainId !== undefined ? (
                    <ChainIcon chainId={option.chainId} name={option.label} size={15} />
                  ) : null}
                  {option.label}
                </span>
                <span className="select-check" aria-hidden="true">
                  {option.value === value ? '✓' : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
