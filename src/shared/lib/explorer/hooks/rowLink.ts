/** Nested controls keep their own click; the rest of the row opens the destination. */
const NESTED_SELECTOR = 'a, button, input, select, textarea, label, [role="button"]';

export function isNestedControl(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(NESTED_SELECTOR));
}
