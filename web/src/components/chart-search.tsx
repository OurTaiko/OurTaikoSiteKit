import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { SortDescendingIcon } from '@phosphor-icons/react'
import { ChoiceSelect } from './choice-select'
import { SearchInput } from './search-input'
import { categoryName, useCategories } from '../categories'
import { cn } from '../lib/utils'
import { categoryColor } from '../category-colors'

export const filterCourses = ['Easy', 'Normal', 'Hard', 'Oni', 'Edit'] as const
/** The chart list's filters both sites have; '' is no filter (and the newest first). */
export type ChartFilters = { order: string; category: string; course: string; level: string }

/** The shared filters as the address has them, values the API would refuse dropped. */
export function readChartFilters(params: URLSearchParams, orders: readonly string[]): ChartFilters {
  const order = params.get('order') || ''
  const course = params.get('course') || ''
  const level = Number(params.get('level'))
  return {
    order: orders.includes(order) ? order : '',
    category: params.get('category') || '',
    course: (filterCourses as readonly string[]).includes(course) ? course : '',
    level: Number.isInteger(level) && level >= 1 && level <= 10 ? String(level) : '',
  }
}

const chipClassName =
  'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring'
/**
 * The chart list's search: keyword, the site's orders, category chips with their chart counts,
 * course and star level, then whatever filters the site adds as children.
 */
export function ChartSearch({
  query,
  filters,
  orders,
  orderLabels,
  placeholder,
  onSearch,
  onPendingChange,
  onChange,
  counts = true,
  children,
}: {
  query: string
  filters: ChartFilters
  orders: readonly string[]
  /** Each order's name; '' is the default (newest) order. */
  orderLabels: Record<string, string>
  placeholder?: string
  onSearch: (query: string) => void
  onPendingChange: (pending: boolean) => void
  onChange: (values: Record<string, string>) => void
  /** The chips' chart counts are the whole catalogue's: off for a user's own list. */
  counts?: boolean
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const { items: categories, chartCount } = useCategories()
  const courseLabels: Record<string, string> = {
    Easy: t('messages.easy'),
    Normal: t('messages.normal'),
    Hard: t('messages.hard'),
    Oni: t('messages.oni'),
    Edit: t('messages.uraOni'),
  }
  return (
    <div
      role="search"
      aria-label={t('messages.searchAndFilterCharts')}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={query}
          onSearch={onSearch}
          onPendingChange={onPendingChange}
          placeholder={placeholder}
        />
        <div className="shrink-0 [&_[data-slot=select-trigger]]:w-full sm:[&_[data-slot=select-trigger]]:w-auto">
          <ChoiceSelect
            label={t('messages.searchOrder')}
            value={filters.order}
            prefix={
              <SortDescendingIcon aria-hidden="true" className="size-4 text-muted-foreground" />
            }
            items={(['', ...orders] as const).map((value) => ({
              value,
              label: orderLabels[value],
            }))}
            onValueChange={(value) => onChange({ order: value })}
          />
        </div>
      </div>
      <ul
        aria-label={t('messages.categories')}
        className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 py-1"
      >
        {[{ id: '', title: t('messages.allCategories'), chartCount }, ...(categories ?? [])].map(
          (category) => {
            const active = filters.category === category.id
            return (
              <li key={category.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  data-category={category.id}
                  className={cn(
                    chipClassName,
                    active
                      ? 'border-foreground bg-foreground text-background'
                      : 'bg-background/70 text-foreground hover:bg-muted',
                  )}
                  onClick={() => onChange({ category: category.id })}
                >
                  {categoryColor(category.id) && (
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-full border-[1.5px] border-[#382d2a]"
                      style={{ background: categoryColor(category.id) }}
                    />
                  )}
                  {category.id ? categoryName(category) : category.title}
                  {counts && (
                    <span
                      className={cn('text-xs tabular-nums', !active && 'text-muted-foreground')}
                    >
                      {category.chartCount}
                    </span>
                  )}
                </button>
              </li>
            )
          },
        )}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <ChoiceSelect
          label={t('messages.filterCourse')}
          value={filters.course}
          items={[
            { value: '', label: t('messages.anyCourse') },
            ...filterCourses.map((value) => ({ value, label: courseLabels[value] })),
          ]}
          onValueChange={(value) => onChange({ course: value })}
        />
        <ChoiceSelect
          label={t('messages.filterLevel')}
          value={filters.level}
          items={[
            { value: '', label: t('messages.anyLevel') },
            ...Array.from({ length: 10 }, (_, index) => ({
              value: String(10 - index),
              label: `★ ${10 - index}`,
            })),
          ]}
          onValueChange={(value) => onChange({ level: value })}
        />
        {children}
      </div>
    </div>
  )
}
