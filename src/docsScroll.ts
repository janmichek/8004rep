/** Sticky header clearance used by the docs page and the router. */
export const DOCS_HEADER_OFFSET = 84

/** Document scroll position that puts a section just under the sticky header. */
export function sectionScrollTop(viewportTop: number, scrollY: number, offset = DOCS_HEADER_OFFSET): number {
  return Math.max(0, viewportTop + scrollY - offset)
}

/** True when the section's top is already sitting under the sticky header. */
export function sectionAligned(viewportTop: number, offset = DOCS_HEADER_OFFSET, slack = 12): boolean {
  return Math.abs(viewportTop - offset) <= slack
}
