// What a site gives the shared pages: its own card, search and the detail page's parts it
// still keeps, and the facts it shows besides the shared ones. A site provides one Site
// object in main.tsx (SiteProvider); its Chart is a ChartBase here, so it casts back.
import { createContext, useContext } from 'react'
import type { ComponentType, ReactNode } from 'react'
import type { ChartBase, UserBase } from './api/types'

export type Site = {
  /** The name after "OurTaiko" in the header: Fanmade or Database. */
  brand: string
  /** Who sees the chart manager: anyone (Fanmade) or administrators (Database). */
  canUpload: (user: UserBase | null) => boolean
  /** The site's chart card with its rows filled. */
  chartCard: (chart: ChartBase) => ReactNode
  /** The list's orders (besides the default, '') and their names. */
  chartOrders: readonly string[]
  useChartOrderLabels: () => Record<string, string>
  /** The chart list's search with the site's orders and filters; see ChartSearch. */
  chartSearch: (props: {
    query: string
    filters: Record<string, string>
    onSearch: (query: string) => void
    onPendingChange: (pending: boolean) => void
    onChange: (values: Record<string, string>) => void
    counts: boolean
  }) => ReactNode
  /** The site's list filters besides the shared ones, from the address ('' for none). */
  readExtraFilters?: (params: URLSearchParams) => Record<string, string>
  /** The chart information dialog. */
  EditMetadata: ComponentType<{
    chart: ChartBase
    csrf: string
    onSaved: (chart: ChartBase) => void
    onDismiss: () => void
  }>
  /** The upload form of the chart manager. */
  UploadPage: ComponentType<{ embedded?: boolean }>
  /** Facts in the chart page's header before BPM, each a <div><dt/><dd/></div>. */
  chartStats?: (chart: ChartBase) => ReactNode
  /** Rows of the chart information after the owners, as <dt/><dd/> pairs. */
  chartRecord?: (chart: ChartBase) => ReactNode
}

const SiteContext = createContext<Site | null>(null)
export const SiteProvider = SiteContext.Provider
export function useSite() {
  const site = useContext(SiteContext)
  if (!site) throw new Error('SiteProvider missing')
  return site
}
