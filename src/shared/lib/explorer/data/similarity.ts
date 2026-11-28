/** Jaccard similarity of two sets: shared / union, 0 when both are empty. */
export function jaccardSets(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let shared = 0;
  for (const value of a) if (b.has(value)) shared++;
  const union = a.size + b.size - shared;
  return union ? shared / union : 0;
}
