import { useState, type ReactNode } from 'react';

type Props = { label: string; children: ReactNode };

export function Disclosure({ label, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="disclosure">
      <button
        type="button"
        className="disclosure-trigger"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span
          className="disclosure-chevron"
          aria-hidden="true"
          style={{ transform: open ? 'rotate(90deg)' : undefined }}
        />
        {label}
      </button>
      {open ? <div className="disclosure-content">{children}</div> : null}
    </div>
  );
}
