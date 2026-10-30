// The pages both sites share: the chart list, sign-in, a chart's page and the chart manager.
// What a site still has its own of comes from its Site (site.tsx).
import { chartOwners, isChartOwner } from './chart-owners'
import { CollaborationDialog } from './collaborations'
import { AddToPlaylistDialog } from './playlist-dialogs'
import { formatLocale, i18n } from './i18n'
import { chartText } from './chart-language'
import { buildChartPackage, packageFilename, saveBlob } from './chart-package'
import { useTranslation } from 'react-i18next'
import { endpoints } from './api/endpoints'
import { DialogClose } from './components/ui/dialog'
import { ChartCover, CoverDialog } from './components/chart-cover'
import { AudioPlayer } from './components/audio-player'
import { buttonVariants, Button } from './components/ui/button'
import { readChartFilters } from './components/chart-search'
import { Skeleton } from './components/ui/skeleton'
import { Card } from './components/ui/card'
import { UserAvatar } from './components/user-avatar'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowRightIcon as ArrowRight,
  DownloadSimpleIcon as Download,
  UploadSimpleIcon as Upload,
  ArrowSquareOutIcon,
  ChatCircleIcon,
  CaretRightIcon,
  FileDashedIcon,
  PlaylistIcon,
} from '@phosphor-icons/react'
import { api, jsonRequest } from './api/client'
import type { ChartBase, ChartList, Vote, VoteResult } from './api/types'
import { SiteChartCard, formatDuration } from './components/chart-card'
import { slotKey, supportsChart } from './courses'
import { defaultDifficulty, hasConstants } from './chart-difficulty'
import { DifficultyConstants } from './difficulty-constants'
import { useSession } from './session-context'
import { useSite } from './site'
import { ChartActivity } from './chart-activity'
import type { ActivityTab } from './chart-activity'
import { Modal, Notice } from './notifications'
import { useNotification } from './notification-context'
import { CategoryLabels } from './categories'
import { CommentSection, chartSubject } from './comments'
import { VoteControl } from './components/vote-control'
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs'
import { cn } from './lib/utils'
import { coverSource } from './cover'
import { PageHero } from './components/page-hero'
import { EmptyState } from './components/empty-state'

// A chart registered without its files yet (OurTaiko Database) has hasFiles false.
type Chart = ChartBase & { hasFiles?: boolean }

export function Library({
  mine = false,
  ownerId,
  embedded = false,
}: {
  mine?: boolean
  /** Only this user's charts, as on their page. */
  ownerId?: string
  /** Inside another page: no page heading. */
  embedded?: boolean
}) {
  const { t } = useTranslation()
  const site = useSite()
  const orderLabels = site.useChartOrderLabels()
  const [params, setParams] = useSearchParams(),
    { user, loading: authLoading } = useSession()
  const [data, setData] = useState<ChartList | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true)
  const [searchPending, setSearchPending] = useState(false)
  const search = useCallback(
    (query: string) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (query) next.set('q', query)
          else next.delete('q')
          next.set('page', '1')
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )
  const q = params.get('q') || '',
    owner = mine ? '' : ownerId || params.get('owner') || '',
    page = Math.min(10000, Math.max(1, Math.floor(Number(params.get('page')) || 1)))
  const filters: Record<string, string> = {
    ...readChartFilters(params, site.chartOrders),
    ...site.readExtraFilters?.(params),
  }
  // The address of the list, filters and all: the request follows it.
  const query = JSON.stringify({ q, page, owner, ...filters })
  useEffect(() => {
    if (mine && !user) return
    const controller = new AbortController()
    setLoading(true)
    setError('')
    api<ChartList>(endpoints.chartList(JSON.parse(query), mine), { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setData(result)
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [mine, user, query])
  if (mine && !user)
    return (
      <EmptyState title={t('messages.myCharts')}>
        {authLoading ? (
          <p className="text-muted-foreground">{t('messages.loadingAccount')}</p>
        ) : (
          <Link className={buttonVariants({ variant: 'default', size: 'default' })} to="/login">
            {t('messages.signIn')}
            <ArrowRight size={16} />
          </Link>
        )}
      </EmptyState>
    )
  const update = (value: Record<string, string>) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set('page', '1')
      for (const [key, entry] of Object.entries(value)) {
        if (entry) next.set(key, entry)
        else next.delete(key)
      }
      return next
    })
  const filtered = !!q || Object.entries(filters).some(([key, value]) => key !== 'order' && value)
  return (
    <>
      {!embedded &&
        (mine ? (
          <h1 className="font-extrabold text-2xl sm:text-3xl">{t('messages.myCharts')}</h1>
        ) : owner ? (
          <>
            <h1 className="font-extrabold text-2xl sm:text-3xl">
              {t('messages.userPublishedCharts')}
            </h1>
            <Link to="/users" className="text-sm text-link hover:underline">
              {t('messages.backToUserSquare')}
            </Link>
          </>
        ) : (
          <PageHero title={t('messages.exploreCharts')} />
        ))}
      {site.chartSearch({
        query: q,
        filters,
        onSearch: search,
        onPendingChange: setSearchPending,
        onChange: update,
        counts: !mine && !owner,
      })}
      <div className="flex flex-wrap items-center justify-between gap-3 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-2 [&_h2_span]:text-muted-foreground">
        <h2 className="text-base font-extrabold">
          {q ? t('messages.searchResults', { query: q }) : orderLabels[filters.order]}
          {!searchPending && !loading && !error && data && <span>{data.total}</span>}
        </h2>
        {q && <span className="text-sm text-muted-foreground">{orderLabels[filters.order]}</span>}
      </div>
      {error ? (
        <Notice>{error}</Notice>
      ) : loading && !data ? (
        <div
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          aria-label={t('messages.loadingCharts')}
        >
          {[0, 1, 2].map((n) => (
            <Skeleton className="h-56 rounded-[14px]" key={n} />
          ))}
        </div>
      ) : data?.items.length ? (
        <>
          <div
            className={cn(
              'grid gap-4 sm:grid-cols-2 xl:grid-cols-3 transition-opacity',
              loading && 'opacity-60',
            )}
          >
            {data.items.map((chart) => (
              <SiteChartCard key={chart.id} chart={chart} />
            ))}
          </div>
          {data.total > data.pageSize && (
            <div className="flex flex-wrap items-center justify-center gap-4 py-4 text-sm">
              <Button
                variant="outline"
                size="default"
                disabled={page <= 1}
                onClick={() => update({ page: String(page - 1) })}
              >
                {t('messages.previous')}
              </Button>
              <span>
                {t('messages.pagination', {
                  page: page,
                  pages: Math.ceil(data.total / data.pageSize),
                })}
              </span>
              <Button
                variant="outline"
                size="default"
                disabled={page * data.pageSize >= data.total}
                onClick={() => update({ page: String(page + 1) })}
              >
                {t('messages.next')}
              </Button>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          title={
            filtered
              ? t('messages.noMatchingCharts')
              : mine || owner
                ? t('messages.noPublishedChartsYet')
                : t('messages.noChartsYet')
          }
        />
      )}
    </>
  )
}

export function Auth({ register = false }: { register?: boolean }) {
  const { t } = useTranslation()

  const [params] = useSearchParams()
  const session = useSession()
  const destination = params.get('returnTo') || '/'
  return (
    <div className="mx-auto max-w-lg space-y-4 py-8">
      <h1 className="text-2xl font-extrabold sm:text-3xl">
        {register ? t('messages.joinTheRhythm') : t('messages.welcomeBack')}
      </h1>
      <Card
        className="min-w-0 p-5 sm:p-6 gap-4 p-6 [&>p]:text-muted-foreground"
        aria-label={t('messages.accountCenterSignIn')}
      >
        <h2 className="text-base font-extrabold">
          {register
            ? t('messages.createAnAccountInTheAccountCenter')
            : t('messages.signInWithOurtaiko')}
        </h2>
        <p>{t('messages.signInNicknameAndPasswordAreManagedInTheAccountCenterYou')}</p>
        {params.has('error') && (
          <Notice>
            {t('messages.signInWasIncompleteOrAuthorizationExpiredPleaseSignInAgain')}
          </Notice>
        )}
        {session.error && <Notice>{session.error}</Notice>}
        <a
          className={buttonVariants({ variant: 'default', size: 'default', className: 'w-full' })}
          href={endpoints.login(destination)}
        >
          {t('messages.goToAccountCenter')}
          <ArrowRight size={17} />
        </a>
        <a
          className={buttonVariants({ variant: 'outline', size: 'default', className: 'w-full' })}
          href={endpoints.accountRegister}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('messages.createAnOurtaikoAccount')}
        </a>
        {session.user && (
          <Link className={buttonVariants({ variant: 'outline', size: 'default' })} to="/">
            {t('messages.backToHome')}
          </Link>
        )}
      </Card>
    </div>
  )
}
const detailCardClassName = 'rounded-[14px] border-2 border-outline bg-card p-6 shadow-drop'
const manageItemClassName =
  'flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm text-foreground transition-colors hover:text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md'

type DetailSection = 'info' | 'activity' | 'comments'
type PageTab = 'info' | 'chart' | 'leaderboard' | 'comments'

export function Detail() {
  const { t } = useTranslation()
  const { EditMetadata, chartStats, chartRecord } = useSite()
  const { notify } = useNotification()
  const { id, commentId } = useParams(),
    session = useSession(),
    navigate = useNavigate(),
    location = useLocation()
  const [chart, setChart] = useState<Chart | null>(null),
    [error, setError] = useState(''),
    [confirm, setConfirm] = useState(false),
    [leaving, setLeaving] = useState(false),
    [busy, setBusy] = useState(false),
    [packaging, setPackaging] = useState(false)
  const [editing, setEditing] = useState(false)
  // The saved notice hands focus back here; the edit dialog is gone by then.
  const editButton = useRef<HTMLButtonElement>(null)
  const [coverEditing, setCoverEditing] = useState(false)
  const [collaborating, setCollaborating] = useState(false)
  const [collecting, setCollecting] = useState(false)
  // Below lg the page shows one section at a time; wider screens show them all.
  const [section, setSection] = useState<DetailSection>('info')
  const [activityTab, setActivityTab] = useState<ActivityTab>('image')
  // The block the chart area shows (slot key); empty for the default one.
  const [chosenCourse, setChosenCourse] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setChart(null)
    setError('')
    setEditing(false)
    setCoverEditing(false)
    setCollaborating(false)
    setCollecting(false)
    setConfirm(false)
    setLeaving(false)
    setActivityTab('image')
    setChosenCourse('')
    if (!id) return
    api<Chart>(endpoints.chartDetail(id), { signal: controller.signal })
      .then(setChart)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message)
      })
    return () => controller.abort()
  }, [id])
  useEffect(() => {
    setSection(commentId || location.hash === '#comments' ? 'comments' : 'info')
  }, [id, commentId, location.hash])
  // The archive is built here from the stored files; leaving the page cancels it.
  const packageRequest = useRef<AbortController | null>(null)
  useEffect(() => () => packageRequest.current?.abort(), [id])
  const downloadPackage = async () => {
    if (!chart) return
    const controller = new AbortController()
    packageRequest.current = controller
    setPackaging(true)
    try {
      const archive = await buildChartPackage(chart, controller.signal)
      saveBlob(archive, packageFilename(chartText(chart, i18n.resolvedLanguage).title))
    } catch {
      if (!controller.signal.aborted) notify(t('messages.chartPackageDownloadFailed'), 'error')
    } finally {
      if (packageRequest.current === controller) setPackaging(false)
    }
  }
  // Give up one's share of a co-owned chart; the other owners keep it.
  const leave = async () => {
    if (!chart) return
    setBusy(true)
    try {
      await api(endpoints.chartOwnership(chart.id), jsonRequest('DELETE', {}, session.csrfToken))
      setLeaving(false)
      setChart(await api<Chart>(endpoints.chartDetail(chart.id)))
      notify(t('collaboration.left'), 'success')
    } catch (e) {
      setLeaving(false)
      notify((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    if (!chart) return
    setError('')
    setBusy(true)
    try {
      await api(endpoints.chart(chart.id), jsonRequest('DELETE', {}, session.csrfToken))
      setConfirm(false)
      navigate('/me/charts')
      notify(t('messages.chartDeleted'), 'success')
    } catch (e) {
      setConfirm(false)
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (!id) return <Notice>{t('messages.missingSongId')}</Notice>
  if (!chart)
    return error ? (
      <Notice>{error}</Notice>
    ) : (
      <p className="text-sm text-muted-foreground">{t('messages.loadingChart')}</p>
    )
  if (!supportsChart(chart)) return <Notice>{t('messages.thisChartTypeIsNotSupported')}</Notice>
  const text = chartText(chart, i18n.resolvedLanguage)
  const course = chart.difficulties.some((d) => slotKey(d) === chosenCourse)
    ? chosenCourse
    : defaultDifficulty(chart.difficulties)
  const chosenDifficulty = chart.difficulties.find((d) => slotKey(d) === course)
  const showConstants = hasConstants(chart.difficulties)
  // The API decides; this only hides controls that would be refused.
  const isOwner = isChartOwner(chart, session.user?.id)
  const canManage = isOwner || !!session.user?.isAdmin
  const votes = chart.upvotes + chart.downvotes
  const hasFiles = chart.hasFiles !== false
  // A chart without files has no leaderboard to open.
  const pageTabs: [PageTab, string][] = [
    ['info', t('messages.aboutTab')],
    ['chart', t('messages.chartTab')],
    ...(hasFiles ? [['leaderboard', t('messages.leaderboardTab')] as [PageTab, string]] : []),
    ['comments', t('interactions.publicCommentCount')],
  ]
  const date = (value: string) =>
    new Date(value).toLocaleString(formatLocale(i18n.resolvedLanguage), {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  const pageTab: PageTab =
    section === 'activity' ? (activityTab === 'leaderboard' ? 'leaderboard' : 'chart') : section
  const selectPageTab = (value: PageTab) => {
    if (value === 'info' || value === 'comments') return setSection(value)
    setSection('activity')
    if (value === 'leaderboard') setActivityTab('leaderboard')
    else if (activityTab === 'leaderboard') setActivityTab('image')
  }
  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="chart-title"
        className="overflow-hidden rounded-[14px] border-2 border-outline bg-card shadow-drop"
      >
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-4 p-4 sm:grid-cols-[16rem_minmax(0,1fr)] sm:gap-x-8 sm:gap-y-5 sm:p-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-x-10">
          <ChartCover chart={chart} className="sm:row-span-3" />
          <div className="flex min-w-0 flex-col gap-1 self-center sm:gap-2 sm:self-start">
            <CategoryLabels ids={chart.categoryIds} />
            <h1 id="chart-title" className="text-xl font-extrabold wrap-anywhere sm:text-4xl">
              {text.title}
            </h1>
            {text.subtitle && (
              <p className="truncate text-sm text-muted-foreground sm:whitespace-normal sm:text-lg sm:wrap-anywhere">
                {text.subtitle}
              </p>
            )}
            {chart.title !== text.title && (
              <p className="text-sm text-muted-foreground wrap-anywhere">{chart.title}</p>
            )}
            <p data-testid="detail-facts" className="text-sm text-muted-foreground wrap-anywhere">
              {t('messages.chartCreator')}{' '}
              <span className="font-medium text-foreground">{chart.maker || chart.uploader}</span>
            </p>
          </div>
          <dl className="col-span-2 flex max-w-xl flex-wrap justify-around gap-x-6 gap-y-2 rounded-xl bg-muted p-3 text-center sm:col-span-1 sm:col-start-2 sm:justify-start sm:gap-x-8 sm:bg-transparent sm:p-0 sm:text-left sm:dark:bg-transparent [&_dd]:text-base [&_dd]:font-semibold [&_dd]:tabular-nums sm:[&_dd]:text-xl [&_dt]:text-xs [&_dt]:text-muted-foreground">
            {chartStats?.(chart)}
            <div>
              <dt>{t('messages.chartNumber')}</dt>
              <dd>{chart.numberId}</dd>
            </div>
            <div>
              <dt>BPM</dt>
              <dd>{chart.bpm > 0 ? chart.bpm : '—'}</dd>
            </div>
            <div>
              <dt>{t('messages.duration')}</dt>
              <dd>{hasFiles ? formatDuration(chart.duration) : '—'}</dd>
            </div>
            {votes > 0 && (
              <div>
                <dt>{t('interactions.approval')}</dt>
                <dd>{Math.round((chart.upvotes / votes) * 100)}%</dd>
              </div>
            )}
          </dl>
          <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1 sm:col-start-2 sm:gap-3">
            {hasFiles ? (
              <>
                <Button
                  size="lg"
                  className="h-11 flex-1 px-5 sm:flex-none"
                  disabled={packaging}
                  onClick={downloadPackage}
                >
                  <Download size={18} aria-hidden="true" />
                  {t(packaging ? 'messages.packagingChart' : 'messages.downloadChartPackage')}
                </Button>
                <a
                  className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'h-11')}
                  href={endpoints.resource(chart, 'tja')}
                >
                  <ArrowSquareOutIcon size={17} aria-hidden="true" />
                  TJA
                </a>
              </>
            ) : canManage ? (
              <Link
                className={cn(buttonVariants({ size: 'lg' }), 'h-11 flex-1 px-5 sm:flex-none')}
                to={`/charts/${chart.id}/update`}
              >
                <Upload size={18} aria-hidden="true" />
                {t('messages.uploadChartFiles')}
              </Link>
            ) : null}
            {session.user && (
              <Button
                variant="secondary"
                size="lg"
                className="h-11"
                aria-label={t('playlists.addToPlaylist')}
                onClick={() => setCollecting(true)}
              >
                <PlaylistIcon size={17} aria-hidden="true" />
                <span className="max-sm:hidden">{t('playlists.addToPlaylist')}</span>
              </Button>
            )}
            <div className="hidden flex-1 sm:block" />
            <VoteControl
              className="rounded-full bg-muted px-1 py-0.5"
              score={chart.score}
              myVote={chart.myVote}
              label={t('interactions.voteOnChart')}
              onVote={(value: Vote) =>
                api<VoteResult>(
                  endpoints.chartVote(chart.id),
                  jsonRequest('PUT', { value }, session.csrfToken),
                )
              }
              onResult={(result) =>
                setChart((current) =>
                  current?.id === chart.id ? { ...current, ...result } : current,
                )
              }
            />
            <a
              href="#comments"
              onClick={() => setSection('comments')}
              className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground hover:text-foreground max-sm:hidden"
            >
              <ChatCircleIcon size={18} aria-hidden="true" />
              {t('interactions.commentCount', { count: chart.commentCount })}
            </a>
          </div>
        </div>
        {hasFiles ? (
          <AudioPlayer
            compact
            className="rounded-none border-0 border-t bg-muted/60 px-4 py-3 sm:px-8"
            label={t('messages.audioPreview')}
            src={endpoints.resource(chart, 'audio')}
            startAt={chart.demoStart}
            knownDuration={chart.duration}
          />
        ) : (
          <p
            role="status"
            className="flex items-center gap-2 border-t bg-muted/60 px-4 py-3 text-sm text-muted-foreground sm:px-8"
          >
            <FileDashedIcon size={18} aria-hidden="true" />
            {t('messages.noFilesText')}
          </p>
        )}
      </section>
      {error && <Notice>{error}</Notice>}
      {editing && canManage && (
        <EditMetadata
          key={chart.id}
          chart={chart}
          csrf={session.csrfToken}
          onDismiss={() => setEditing(false)}
          onSaved={(updated) => {
            setChart(updated as Chart)
            setEditing(false)
            notify(t('messages.chartInformationSaved'), 'success', '', editButton)
          }}
        />
      )}
      {collecting && session.user && (
        <AddToPlaylistDialog chart={chart} onDismiss={() => setCollecting(false)} />
      )}
      {collaborating && isOwner && (
        <CollaborationDialog chart={chart} onDismiss={() => setCollaborating(false)} />
      )}
      {coverEditing && canManage && (
        <CoverDialog
          chart={chart}
          onDismiss={() => setCoverEditing(false)}
          onSaved={(coverHash) =>
            setChart((current) => (current?.id === chart.id ? { ...current, coverHash } : current))
          }
        />
      )}
      <Tabs
        value={pageTab}
        onValueChange={(value) => selectPageTab(value as PageTab)}
        className="lg:hidden"
      >
        {/* Short labels, each tab as wide as its label needs; one that still does not fit is cut short. */}
        <TabsList
          aria-label={t('messages.chartSections')}
          className="flex h-auto w-full gap-0.5 rounded-[12px] bg-muted p-1"
        >
          {pageTabs.map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="h-9 min-w-0 flex-auto px-1.5 text-sm text-muted-foreground after:hidden"
            >
              <span className="truncate">{label}</span>
              {value === 'comments' && chart.commentCount > 0 && (
                <span className="text-xs tabular-nums">{chart.commentCount}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div
          className={cn(
            'flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-1',
            section === 'info' && 'max-lg:hidden',
          )}
        >
          <div
            className={cn('flex min-w-0 flex-col gap-6', section !== 'activity' && 'max-lg:hidden')}
          >
            {/* Below lg the constants head the chart section; from lg, the sidebar. */}
            {showConstants && (
              <DifficultyConstants
                key={course}
                difficulty={chosenDifficulty}
                className="lg:hidden"
              />
            )}
            {hasFiles ? (
              <ChartActivity
                key={`${chart.id}:${chart.difficulties.map((d) => d.chartHash ?? '').join(',')}:${chart.audioHash}`}
                chart={chart}
                tab={activityTab}
                onTabChange={setActivityTab}
                course={course}
                onCourseChange={setChosenCourse}
              />
            ) : (
              <section
                className={cn(
                  detailCardClassName,
                  'flex flex-col items-center gap-3 py-12 text-center',
                )}
                aria-label={t('messages.chartImage')}
              >
                <FileDashedIcon size={32} className="text-muted-foreground" aria-hidden="true" />
                <h2 className="text-lg font-extrabold">{t('messages.noFiles')}</h2>
                <p className="max-w-md text-sm text-muted-foreground">
                  {canManage ? t('messages.noFilesManagerText') : t('messages.noFilesText')}
                </p>
                {canManage && (
                  <Link
                    className={buttonVariants({ variant: 'outline' })}
                    to={`/charts/${chart.id}/update`}
                  >
                    <Upload size={16} aria-hidden="true" />
                    {t('messages.uploadChartFiles')}
                  </Link>
                )}
              </section>
            )}
          </div>
          <div className={cn('min-w-0', section !== 'comments' && 'max-lg:hidden')}>
            <CommentSection
              subject={chartSubject(chart)}
              focusId={commentId}
              onCountChange={(delta) =>
                setChart((current) =>
                  current?.id === chart.id
                    ? { ...current, commentCount: Math.max(0, current.commentCount + delta) }
                    : current,
                )
              }
            />
          </div>
        </div>
        <aside
          className={cn(
            'flex min-w-0 flex-col gap-6 lg:col-start-2 lg:row-start-1',
            section !== 'info' && 'max-lg:hidden',
          )}
        >
          {showConstants && (
            <DifficultyConstants
              key={course}
              difficulty={chosenDifficulty}
              className="max-lg:hidden"
            />
          )}
          <section
            aria-labelledby="chart-notes-heading"
            className={cn(detailCardClassName, 'space-y-3')}
          >
            <h2 id="chart-notes-heading" className="text-lg font-extrabold">
              {t('messages.notes')}
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground wrap-anywhere">
              {chart.description || t('messages.noNotesYet')}
            </p>
          </section>
          <section
            aria-labelledby="chart-information-heading"
            className={cn(detailCardClassName, 'space-y-4')}
          >
            <h2 id="chart-information-heading" className="text-lg font-extrabold">
              {t('messages.chartInformation')}
            </h2>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm [&>dt]:text-muted-foreground [&>dd]:wrap-anywhere">
              <dt className="self-center">{t('collaboration.owners')}</dt>
              <dd className="flex flex-wrap gap-3">
                {chartOwners(chart).map((owner) => (
                  <Link
                    key={owner.id}
                    className="inline-flex max-w-full items-center gap-2 align-middle text-link hover:underline"
                    to={`/users/${encodeURIComponent(owner.id)}`}
                  >
                    <UserAvatar
                      nickname={owner.nickname}
                      avatarUrl={owner.avatarUrl}
                      className="size-6"
                      fallbackClassName="text-xs"
                    />
                    <span className="min-w-0 wrap-anywhere">{owner.nickname}</span>
                  </Link>
                ))}
              </dd>
              {chartRecord?.(chart)}
              <dt>{t('messages.createdAt')}</dt>
              <dd>
                <time dateTime={chart.createdAt}>{date(chart.createdAt)}</time>
              </dd>
              <dt>{t('messages.lastChanged')}</dt>
              <dd>
                <time dateTime={chart.updateAt}>{date(chart.updateAt)}</time>
              </dd>
            </dl>
          </section>
          {canManage && (
            <section
              aria-labelledby="chart-manage-heading"
              className={cn(detailCardClassName, 'space-y-1')}
            >
              <h2 id="chart-manage-heading" className="pb-2 text-lg font-extrabold">
                {t('messages.manageChart')}
              </h2>
              <ul className="divide-y">
                <li>
                  <Link className={manageItemClassName} to={`/charts/${chart.id}/update`}>
                    {hasFiles ? t('messages.updateSongAndCharts') : t('messages.uploadChartFiles')}
                    <CaretRightIcon
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
                {hasFiles && (
                  <li>
                    <Link className={manageItemClassName} to={`/charts/${chart.id}/edit`}>
                      {t('editor.open')}
                      <CaretRightIcon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                )}
                <li>
                  <button
                    ref={editButton}
                    type="button"
                    className={manageItemClassName}
                    onClick={() => setEditing(true)}
                  >
                    {t('messages.editInformation')}
                    <CaretRightIcon
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </button>
                </li>
                {canManage && (
                  <li>
                    <button
                      type="button"
                      className={manageItemClassName}
                      onClick={() => setCoverEditing(true)}
                    >
                      {coverSource(chart) ? t('messages.changeCover') : t('messages.addCover')}
                      <CaretRightIcon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                )}
                {isOwner && (
                  <li>
                    <button
                      type="button"
                      className={manageItemClassName}
                      onClick={() => setCollaborating(true)}
                    >
                      {t('collaboration.add')}
                      <CaretRightIcon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                )}
                {isOwner && chartOwners(chart).length > 1 && (
                  <li>
                    <button
                      type="button"
                      className={manageItemClassName}
                      onClick={() => setLeaving(true)}
                    >
                      {t('collaboration.leave')}
                    </button>
                  </li>
                )}
                {canManage && (
                  <li>
                    <button
                      type="button"
                      className={cn(manageItemClassName, 'text-destructive hover:text-destructive')}
                      onClick={() => setConfirm(true)}
                    >
                      {t('messages.deleteChart')}
                    </button>
                  </li>
                )}
              </ul>
              {leaving && (
                <Modal
                  title={t('collaboration.leaveTitle')}
                  busy={busy}
                  onDismiss={() => setLeaving(false)}
                  actions={
                    <>
                      <DialogClose
                        render={<Button type="button" variant="outline" size="default" />}
                        disabled={busy}
                      >
                        {t('messages.cancel')}
                      </DialogClose>
                      <Button
                        type="button"
                        variant="destructive"
                        size="default"
                        disabled={busy}
                        onClick={leave}
                      >
                        {busy ? t('collaboration.leavingNow') : t('collaboration.leaveConfirm')}
                      </Button>
                    </>
                  }
                >
                  {t('collaboration.leaveDescription')}
                </Modal>
              )}
              {confirm && (
                <Modal
                  title={t('messages.deleteThisChart')}
                  busy={busy}
                  onDismiss={() => setConfirm(false)}
                  actions={
                    <>
                      <DialogClose
                        render={<Button type="button" variant="outline" size="default" />}
                        disabled={busy}
                      >
                        {t('messages.cancel')}
                      </DialogClose>
                      <Button
                        type="button"
                        variant="destructive"
                        size="default"
                        disabled={busy}
                        onClick={remove}
                      >
                        {busy ? t('messages.deleting') : t('messages.confirmDeletion')}
                      </Button>
                    </>
                  }
                >
                  {t('messages.deleteChartText')}
                </Modal>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

// My charts and the publish form on one page: /me/charts lists the user's
// charts, /me/charts/publish publishes a new one.
export function ChartManagerPage() {
  const { t } = useTranslation()
  const { UploadPage } = useSite()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const tab = pathname.replace(/\/$/, '').endsWith('/publish') ? 'publish' : 'charts'
  return (
    <>
      <h1 className="font-extrabold text-2xl sm:text-3xl">{t('messages.chartManager')}</h1>
      <Tabs
        value={tab}
        onValueChange={(value) =>
          navigate(value === 'publish' ? '/me/charts/publish' : '/me/charts')
        }
      >
        <TabsList aria-label={t('messages.chartManager')}>
          <TabsTrigger value="charts">{t('messages.myCharts')}</TabsTrigger>
          <TabsTrigger value="publish">
            <Upload aria-hidden="true" />
            {t('messages.publishChart')}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'publish' ? <UploadPage embedded /> : <Library mine embedded />}
    </>
  )
}
