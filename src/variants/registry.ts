import type { Component } from 'vue'

/** The five routed views every design implements. */
export type PageSet = {
  agents: Component
  agent: Component
  network: Component
  owner: Component
  reviewer: Component
  /** Classic-only: a feedback row opened as its own view. */
  feedback?: Component
  /** Classic-only: an agent on a network with no chain config, read from 8004scan. */
  scanAgent?: Component
}

export type VariantModule = { Shell: Component; pages: PageSet }

export type VariantInfo = {
  id: number
  name: string
  /** One line on what the design tries. */
  idea: string
  /** Null for the classic design, which boots through `App.vue`. */
  load: (() => Promise<VariantModule>) | null
}

// Each design is its own chunk with its own global stylesheet: only the
// chosen one is ever downloaded, so their styles never meet.
export const VARIANTS: VariantInfo[] = [
  { id: 0, name: 'Classic', idea: 'The original explorer', load: null },
  { id: 1, name: 'Terminal', idea: 'A TUI: listings, ascii bars, keyboard first', load: () => import('./v1-terminal') },
  { id: 2, name: 'Ledger', idea: 'A broadsheet that reports the numbers as news', load: () => import('./v2-ledger') },
  { id: 3, name: 'Bento', idea: 'One mosaic canvas per view, gauges over tables', load: () => import('./v3-bento') },
  { id: 4, name: 'League', idea: 'Standings: every agent ranked, every reviewer refereed', load: () => import('./v4-league') },
  { id: 5, name: 'Bureau', idea: 'A credit file with letter grades and disputes', load: () => import('./v5-bureau') },
  { id: 6, name: 'Stream', idea: 'A social feed: reviews as posts, day by day', load: () => import('./v6-stream') },
  { id: 7, name: 'Orbit', idea: 'Who rates whom, drawn as a constellation', load: () => import('./v7-orbit') },
  { id: 8, name: 'Swiss', idea: 'Giant numerals, red rules, nothing else', load: () => import('./v8-swiss') },
  { id: 9, name: 'Grid', idea: 'A spreadsheet: sort, pick columns, export CSV', load: () => import('./v9-grid') },
  { id: 10, name: 'Inspector', idea: 'Master–detail panes, nothing ever navigates away', load: () => import('./v10-inspector') },
  { id: 11, name: 'Docket', idea: 'A court record: exhibits, a verdict stamp and a testimony table', load: () => import('./v11-docket') },
  { id: 12, name: 'Blueprint', idea: 'An engineering drawing: title block, dimension lines and a calibration gauge', load: () => import('./v12-blueprint') },
  { id: 13, name: 'Herbarium', idea: 'Specimens pressed on paper, with taxonomy and a determination key', load: () => import('./v13-herbarium') },
  { id: 14, name: 'Forecast', idea: 'A weather bulletin: conditions, degrees, outlooks and advisories', load: () => import('./v14-forecast') },
  { id: 15, name: 'Recipe', idea: 'A cookbook: ingredients, method, servings and tasting notes', load: () => import('./v15-recipe') },
  { id: 16, name: 'Atlas', idea: 'Cartography: a gazetteer, charted places and terrain surveys', load: () => import('./v16-atlas') },
  { id: 17, name: 'Ticker', idea: 'A market terminal: listings, candles, volatility and an order book', load: () => import('./v17-ticker') },
  { id: 18, name: 'Museum', idea: 'A gallery: framed works, wall labels, provenance and condition reports', load: () => import('./v18-museum') },
  { id: 19, name: 'Archive', idea: 'A registry: manila cards, call numbers, series and an item list', load: () => import('./v19-archive') },
  { id: 20, name: 'Signal', idea: 'A radio receiver: frequencies, S-meters, SNR and interference', load: () => import('./v20-signal') },
]

const KEY = '8004rep:variant'

function parse(value: string | null | undefined): number | undefined {
  if (value == null || value === '') return undefined
  const n = Number(value)
  return VARIANTS.some((v) => v.id === n) ? n : undefined
}

/** `?v=N` (before or inside the hash) wins and is remembered; then the remembered one; then classic. */
export function currentVariant(): VariantInfo {
  const fromSearch = parse(new URLSearchParams(location.search).get('v'))
  const hashQuery = location.hash.split('?')[1]
  const fromHash = parse(hashQuery ? new URLSearchParams(hashQuery).get('v') : undefined)
  let stored: number | undefined
  try {
    stored = parse(localStorage.getItem(KEY))
  } catch {
    stored = undefined
  }
  const id = fromSearch ?? fromHash ?? stored ?? 0
  if (id !== stored) {
    try {
      localStorage.setItem(KEY, String(id))
    } catch {
      // Private mode: the URL parameter still selects it for this load.
    }
  }
  return VARIANTS.find((v) => v.id === id)!
}

/** Switching reloads: each design brings its own global stylesheet. */
export function switchVariant(id: number): void {
  try {
    localStorage.setItem(KEY, String(id))
  } catch {
    // Fall through to the URL parameter.
  }
  const url = new URL(location.href)
  url.searchParams.set('v', String(id))
  location.assign(url.toString())
}
