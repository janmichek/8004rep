import { useEffect, useState } from 'react';

const NUMBER = /^([^\d-]*)(-?\d[\d,]*(?:\.\d+)?)(.*)$/;

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function CountUp({ value }: { value: string }) {
  const [shown, setShown] = useState(value);
  const parsed = NUMBER.exec(value);
  const digits = parsed?.[2] ?? '';
  const end = Number(digits.replace(/,/g, ''));
  const animate = Boolean(parsed) && Number.isFinite(end) && end !== 0 && !reducedMotion();

  useEffect(() => {
    const match = NUMBER.exec(value);

    if (!match || !animate) return undefined;
    const before = match[1] ?? '';
    const after = match[3] ?? '';
    const target = Number((match[2] ?? '').replace(/,/g, ''));
    const decimals = (match[2] ?? '').split('.')[1]?.length ?? 0;
    const grouped = (match[2] ?? '').includes(',');
    const started = performance.now();
    let frame = 0;

    function step(now: number) {
      const t = Math.min(1, (now - started) / 800);
      const eased = 1 - (1 - t) ** 4;

      const text = (target * eased).toLocaleString('en-US', {
        useGrouping: grouped,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

      setShown(t < 1 ? `${before}${text}${after}` : value);

      if (t < 1) frame = requestAnimationFrame(step);
    }

    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [value, animate]);

  return <>{animate ? shown : value}</>;
}
