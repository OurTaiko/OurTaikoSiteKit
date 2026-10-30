import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowFatUpIcon, ChatCircleIcon, GitBranchIcon, UsersIcon } from '@phosphor-icons/react'
import type { ChartBase, Difficulty } from '../api/types'
import { chartText } from '../chart-language'
import { i18n } from '../i18n'
import { coverSource } from '../cover'
import { CategoryLabels } from '../categories'
import { supportsChart } from '../courses'
import { categoryStripeColor } from '../category-colors'
import { cn } from '../lib/utils'
import { Badge } from './ui/badge'
import { Card, CardContent } from './ui/card'
import { DifficultyBadges } from './difficulty-badges'
import { useSite } from '../site'
import { compactNumber } from './vote-control'
import { CardCoverBackdrop, coveredTextClassName, useCardCover } from './card-cover'

export function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

/**
 * A chart in a list: cover, title and subtitle, a row of facts after the categories, a bottom
 * row and the difficulty bookmarks. The site fills the two rows, each item an <li>, from the
 * badges below and its own.
 */
export function ChartCard({
  chart,
  facts,
  footer,
}: {
  chart: ChartBase & { hasFiles?: boolean }
  facts?: ReactNode
  footer?: ReactNode
}) {
  const { t } = useTranslation()
  const cover = useCardCover(coverSource(chart))
  const hasCover = !!cover.source
  if (!supportsChart(chart)) return null
  const text = chartText(chart, i18n.resolvedLanguage)
  return (
    <Link
      className="group block rounded-[14px] outline-none focus-visible:ring-ring focus-visible:ring-3 focus-visible:ring-offset-4 min-w-0 hover:-translate-y-0.5 motion-reduce:transform-none transition-transform motion-reduce:transition-none duration-150"
      data-testid="chart-card"
      to={`/charts/${chart.id}`}
    >
      {/* Fixed height: five difficulty bookmarks, the most a song has, fit exactly. */}
      <Card
        size="sm"
        className="isolate relative group-hover:shadow-drop-hover pt-6 pb-5 h-56 transition-shadow"
      >
        <div
          aria-hidden="true"
          className="top-0 z-10 absolute inset-x-0 border-b-2 border-outline h-1.5"
          style={{ background: categoryStripeColor(chart.categoryIds) }}
        />
        {cover.source && <CardCoverBackdrop source={cover.source} onError={cover.onError} />}
        <CardContent className="relative flex gap-4 pr-4 pl-6 h-full min-h-0">
          <div className="flex flex-col flex-1 gap-4 min-w-0 min-h-0">
            <div className={cn('space-y-0.5 min-w-0', hasCover && coveredTextClassName)}>
              <h3 className="font-extrabold text-lg truncate" title={text.title}>
                {text.title}
              </h3>
              <p
                className={cn(
                  'text-sm truncate',
                  hasCover ? 'text-foreground/80' : 'text-muted-foreground',
                )}
                title={text.subtitle}
              >
                {text.subtitle}
              </p>
            </div>
            {/* Two rows of facts at most; a third row is cut off whole. */}
            <div className="max-h-[3.25rem] overflow-hidden">
              <CategoryLabels ids={chart.categoryIds}>{facts}</CategoryLabels>
            </div>
            <ul
              className="flex items-center gap-2 mt-auto"
              aria-label={t('messages.chartInformation')}
            >
              {footer}
            </ul>
          </div>
          <DifficultyBadges difficulties={chart.difficulties} bookmarks />
        </CardContent>
      </Card>
    </Link>
  )
}

/** The chart's maker: its MAKER, else the uploader. */
export function MakerBadge({ name }: { name: string }) {
  const { t } = useTranslation()
  return (
    <li className="min-w-0 max-w-full">
      <Badge
        variant="outline"
        className="gap-0 p-0 min-w-0 max-w-full"
        title={t('messages.chartCreatorWithName', { name })}
      >
        <span className="flex items-center bg-muted px-2 border-r h-full text-muted-foreground shrink-0">
          {t('messages.chartCreator')}
        </span>
        <span className="px-2 truncate">{name}</span>
      </Badge>
    </li>
  )
}

/** Left out when the BPM is unknown (0). */
export function BpmBadge({ bpm }: { bpm: number }) {
  if (!(bpm > 0)) return null
  return (
    <li>
      <Badge variant="outline" className="tabular-nums">
        {bpm} BPM
      </Badge>
    </li>
  )
}

export function DurationBadge({ seconds }: { seconds: number }) {
  return (
    <li>
      <Badge variant="outline" className="tabular-nums">
        {formatDuration(seconds)}
      </Badge>
    </li>
  )
}

/** Shown when any block is one of a 1P/2P pair. */
export function DoubleBadge({ difficulties }: { difficulties: Difficulty[] }) {
  const { t } = useTranslation()
  if (!difficulties.some((d) => d.side !== 'single')) return null
  return (
    <li>
      <Badge variant="outline" title={t('messages.hasDouble')}>
        <UsersIcon className="size-3" aria-hidden="true" />
        <span className="sr-only">{t('messages.hasDouble')}</span>
      </Badge>
    </li>
  )
}

/** Shown when any block branches. */
export function BranchingBadge({ difficulties }: { difficulties: Difficulty[] }) {
  const { t } = useTranslation()
  if (!difficulties.some((d) => d.branching)) return null
  return (
    <li>
      <Badge variant="outline" title={t('messages.hasBranching')}>
        <GitBranchIcon className="size-3" aria-hidden="true" />
        <span className="sr-only">{t('messages.hasBranching')}</span>
      </Badge>
    </li>
  )
}

export function ScoreBadge({ score }: { score: number }) {
  const { t, i18n } = useTranslation()
  return (
    <li>
      <Badge
        variant="outline"
        className="tabular-nums"
        title={t('interactions.scoreExact', { score })}
      >
        <ArrowFatUpIcon className="size-3" aria-hidden="true" />
        <span className="sr-only">{t('interactions.score')}</span>
        {compactNumber(score, i18n.resolvedLanguage ?? '')}
      </Badge>
    </li>
  )
}

export function CommentCountBadge({ count }: { count: number }) {
  const { t, i18n } = useTranslation()
  return (
    <li>
      <Badge
        variant="outline"
        className="tabular-nums"
        title={t('interactions.commentCount', { count })}
      >
        <ChatCircleIcon className="size-3" aria-hidden="true" />
        <span className="sr-only">{t('interactions.commentCount', { count })}</span>
        <span aria-hidden="true">{compactNumber(count, i18n.resolvedLanguage ?? '')}</span>
      </Badge>
    </li>
  )
}

// The site's own card, rows filled (Site.chartCard), for the shared pages that list charts.
export function SiteChartCard({ chart }: { chart: ChartBase }) {
  return useSite().chartCard(chart)
}
