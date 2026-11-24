import { useEffect, useState } from 'react';

const NUMBER = /^([^\d-]*)(-?\d[\d,]*(?:\.\d+)?)(.*)$/;

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function CountUp({ value }: { value: string }) {
  const [shown, setShown] = useState(value);
  const match = NUMBER.exec(value);
  const digits = match?.[2] ?? '';
  const end = Number(digits.replace(/,/g, ''));
  const animate = Boolean(match) && Number.isFinite(end) && end !== 0 && !reducedMotion();

  useEffect(() => {
    if (!match || !animate) return undefined;
    const before = match[1] ?? '';
    const after = match[3] ?? '';
    const decimals = (match[2] ?? '').split('.')[1]?.length ?? 0;
    const grouped = (match[2] ?? '').includes(',');
    const started = performance.now();
    let frame = 0;

    function step(now: number) {
      const t = Math.min(1, (now - started) / 800);
      const eased = 1 - (1 - t) ** 4;

      const text = (end * eased).toLocaleString('en-US', {
        useGrouping: grouped,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

      setShown(t < 1 ? `${before}${text}${after}` : value);

      if (t < 1) frame = requestAnimationFrame(step);
    }

    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
    // oxlint-disable-next-line react/exhaustive-deps -- animation restarts on the printed value
  }, [value, animate]);

  return <>{animate ? shown : value}</>;
}
