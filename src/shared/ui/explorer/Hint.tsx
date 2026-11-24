import { cloneElement, useState, type FocusEvent, type MouseEvent, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { Link } from '@tanstack/react-router';

type HintChild = ReactElement<{
  onMouseEnter?: (event: MouseEvent<HTMLElement>) => void;
  onMouseLeave?: () => void;
  onFocus?: (event: FocusEvent<HTMLElement>) => void;
  onBlur?: () => void;
}>;

type Props = {
  text?: string;
  /** Docs page section id to land on. Without it the link opens the Docs page top. */
  docs?: string | undefined;
  children: HintChild;
};

type Spot = { x: number; y: number };

/**
 * Reka-style tooltip on an arbitrary child. The child keeps its own box, so a
 * tile stays a tile and a table button stays a button; the bubble is portalled
 * and placed from the child's rect.
 */
export function Hint({ text, docs, children }: Props) {
  const [spot, setSpot] = useState<Spot | null>(null);
  const [timer, setTimer] = useState<number | undefined>(undefined);

  function show(node: HTMLElement) {
    window.clearTimeout(timer);
    setTimer(
      window.setTimeout(() => {
        const rect = node.getBoundingClientRect();
        setSpot({ x: rect.left + rect.width / 2, y: rect.top - 6 });
      }, 200)
    );
  }

  function hide() {
    window.clearTimeout(timer);
    setSpot(null);
  }

  if (!text) return children;

  const child = cloneElement(children, {
    onMouseEnter: (event) => show(event.currentTarget),
    onMouseLeave: hide,
    onFocus: (event) => show(event.currentTarget),
    onBlur: hide,
  });

  return (
    <>
      {child}
      {spot
        ? createPortal(
            <span
              className="hint"
              role="tooltip"
              style={{
                position: 'fixed',
                left: spot.x,
                top: spot.y,
                zIndex: 60,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <span className="hint-text">{text}</span>
              <Link className="hint-more" to="/docs" hash={docs ?? ''}>
                More
              </Link>
            </span>,
            document.body
          )
        : null}
    </>
  );
}
