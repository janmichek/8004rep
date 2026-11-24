const score = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatScore(value: number): string {
  return score.format(value);
}
