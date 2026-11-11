import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  WaveformIcon as AudioLines,
  FilmStripIcon,
  ImageIcon,
  ImageSquareIcon,
  UploadSimpleIcon as Upload,
} from '@phosphor-icons/react'
import { Card } from './components/ui/card'
import { Button, buttonVariants } from './components/ui/button'
import { Checkbox } from './components/ui/checkbox'
import { Progress } from './components/ui/progress'
import { CategoryPicker } from './categories'
import { uploadChart } from './api/client'
import { useSession } from './session-context'
import { t as translate } from './i18n'
import { validateFiles, validateMovie } from './tja'
import type { PreparedTja } from './tja'
import type { ChartBase } from './api/types'
import { validateImages } from './folder-upload'
import type { FolderChart } from './folder-upload'

type State = 'checking' | 'ready' | 'invalid' | 'uploading' | 'waiting' | 'sent' | 'failed'
type Row = {
  chart: FolderChart
  state: State
  message: string
  /** A missing PREIMAGE: the chart is published without a cover. */
  warning: string
  prepared?: PreparedTja
  include: boolean
  progress: number
}

/** Codes after which the same request is sent again once the server has room. */
const busy = new Set(['UPLOAD_BUSY', 'RATE_LIMITED', 'SERVICE_UNAVAILABLE'])

function requestKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => (clearTimeout(timer), resolve()), { once: true })
  })
}

/**
 * Publishes the charts of a folder one after another as new charts. Each is checked here as a
 * single upload is; the server processes them after replying and reports each by notification.
 * fields are sent with every chart (a site's own upload fields).
 */
export function BatchUpload({
  charts,
  onExit,
  fields = {},
}: {
  charts: FolderChart[]
  onExit: () => void
  fields?: Record<string, string>
}) {
  const { t } = useTranslation()
  const session = useSession()
  const [rows, setRows] = useState<Row[]>(() =>
    charts.map((chart) => ({
      chart,
      state: 'checking',
      message: '',
      warning: '',
      include: false,
      progress: 0,
    })),
  )
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [sent, setSent] = useState(0)
  const controller = useRef<AbortController | null>(null)
  const update = useCallback(
    (index: number, change: Partial<Row>) =>
      setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row))),
    [],
  )

  useEffect(() => {
    let active = true
    void (async () => {
      for (const [index, chart] of charts.entries()) {
        const missing = (header: string) => chart.missing.find((m) => m.header === header)
        // A missing image or movie is published without; the list says so.
        const warning = chart.missing
          .filter((m) => m.header !== 'WAVE')
          .map((m) =>
            translate('folderUpload.missingOptional', { header: m.header, value: m.value }),
          )
          .join(' ')
        try {
          if (!chart.audio) {
            const wave = missing('WAVE')
            throw new Error(
              wave
                ? translate('folderUpload.missingFile', { header: 'WAVE', value: wave.value })
                : translate('folderUpload.noAudio'),
            )
          }
          const prepared = await validateFiles(chart.tja, chart.audio)
          validateMovie(prepared, chart.movie)
          await validateImages(prepared, chart.cover, chart.background)
          if (active) update(index, { state: 'ready', prepared, warning, include: true })
        } catch (e) {
          if (active) update(index, { state: 'invalid', message: (e as Error).message, warning })
        }
      }
    })()
    return () => {
      active = false
    }
  }, [charts, update])
  useEffect(() => () => controller.current?.abort(), [])
  // Leaving the page would stop the charts not yet sent.
  useEffect(() => {
    if (!running) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [running])

  const queued = rows.filter(
    (row) => row.include && (row.state === 'ready' || row.state === 'failed'),
  )
  const publish = async () => {
    if (running || !queued.length) return
    const abort = new AbortController()
    controller.current = abort
    setRunning(true)
    for (const [index, row] of rows.entries()) {
      if (abort.signal.aborted) break
      if (!row.include || !row.prepared || (row.state !== 'ready' && row.state !== 'failed'))
        continue
      const { chart, prepared } = row
      const form = new FormData()
      form.append('tja', prepared.file)
      form.append('audio', chart.audio!)
      if (chart.movie) form.append('movie', chart.movie)
      if (chart.cover) form.append('cover', chart.cover)
      if (chart.background) form.append('bgimage', chart.background)
      for (const [name, value] of Object.entries(fields)) form.append(name, value)
      form.append('description', '')
      form.append('categoryIds', JSON.stringify(categoryIds))
      form.append(
        'difficultyMakers',
        JSON.stringify(
          prepared.difficulties.map(({ course, side, maker }) => ({ course, side, maker })),
        ),
      )
      // One key per chart: a retry after a busy server is the same request.
      const key = requestKey()
      update(index, { state: 'uploading', progress: 0, message: '' })
      for (let attempt = 0; ; attempt++) {
        try {
          await uploadChart<ChartBase>(form, session.csrfToken, key, abort.signal, (progress) =>
            update(index, { progress }),
          )
          update(index, { state: 'sent', progress: 100 })
          setSent((n) => n + 1)
          break
        } catch (e) {
          const code = ((e as Error).cause as { code?: string } | undefined)?.code ?? ''
          if (abort.signal.aborted) {
            update(index, { state: 'failed', message: t('folderUpload.stopped') })
            break
          }
          if (busy.has(code) && attempt < 30) {
            update(index, { state: 'waiting' })
            await pause(Math.min(5000 * 2 ** attempt, 60000), abort.signal)
            if (abort.signal.aborted) {
              update(index, { state: 'failed', message: t('folderUpload.stopped') })
              break
            }
            update(index, { state: 'uploading', progress: 0 })
            continue
          }
          update(index, { state: 'failed', message: (e as Error).message })
          break
        }
      }
    }
    controller.current = null
    setRunning(false)
  }

  const status = (row: Row) => {
    switch (row.state) {
      case 'checking':
        return <span className="text-muted-foreground">{t('folderUpload.checking')}</span>
      case 'ready':
        return <span className="text-muted-foreground">{t('folderUpload.ready')}</span>
      case 'uploading':
        return (
          <span className="flex items-center gap-3">
            <Progress
              className="w-32"
              aria-label={t('messages.uploadProgress')}
              max={100}
              value={row.progress}
            />
            <span className="text-muted-foreground">
              {t('folderUpload.uploading', { progress: row.progress })}
            </span>
          </span>
        )
      case 'waiting':
        return <span className="text-muted-foreground">{t('folderUpload.waiting')}</span>
      case 'sent':
        return <span className="font-bold">{t('folderUpload.sent')}</span>
      default:
        return <span className="text-destructive">{row.message}</span>
    }
  }
  const file = (icon: ReactNode, label: string, value: File | null) => (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1">
      {icon}
      <span className="sr-only">{label}</span>
      <span className="truncate">{value?.name ?? t('folderUpload.none')}</span>
    </span>
  )

  return (
    <div className="space-y-6">
      <Card className="min-w-0 gap-4 border-[1.5px] border-border p-5 shadow-none sm:p-6">
        <CategoryPicker value={categoryIds} disabled={running} onChange={setCategoryIds} />
      </Card>
      <Card className="min-w-0 gap-4 border-[1.5px] border-border p-5 shadow-none sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold">{t('folderUpload.batchTitle')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('folderUpload.found', { count: rows.length })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {running ? (
              <Button type="button" variant="outline" onClick={() => controller.current?.abort()}>
                {t('folderUpload.stop')}
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={onExit}>
                {t('folderUpload.chooseAgain')}
              </Button>
            )}
            <Button
              type="button"
              disabled={running || !queued.length || !session.user}
              onClick={() => void publish()}
            >
              <Upload size={18} /> {t('folderUpload.publishSelected', { count: queued.length })}
            </Button>
          </div>
        </div>
        <ul className="divide-y divide-border rounded-[14px] border-[1.5px] border-border">
          {rows.map((row, index) => (
            <li key={row.chart.path} className="flex min-w-0 items-start gap-3 p-4">
              <Checkbox
                className="mt-1"
                aria-label={t('folderUpload.include', { title: row.chart.title })}
                checked={row.include}
                disabled={running || !row.prepared || row.state === 'sent'}
                onCheckedChange={(checked) => update(index, { include: checked === true })}
              />
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
                  <b className="wrap-anywhere">{row.prepared?.title || row.chart.title}</b>
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {row.chart.path}
                  </span>
                </div>
                <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {file(
                    <AudioLines size={14} aria-hidden />,
                    t('folderUpload.audio'),
                    row.chart.audio,
                  )}
                  {file(
                    <ImageIcon size={14} aria-hidden />,
                    t('folderUpload.cover'),
                    row.chart.cover,
                  )}
                  {file(
                    <ImageSquareIcon size={14} aria-hidden />,
                    t('folderUpload.background'),
                    row.chart.background,
                  )}
                  {file(
                    <FilmStripIcon size={14} aria-hidden />,
                    t('folderUpload.movie'),
                    row.chart.movie,
                  )}
                </div>
                <div className="wrap-anywhere">{status(row)}</div>
                {row.warning && row.state !== 'sent' && (
                  <p className="text-xs text-muted-foreground">{row.warning}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
        {sent > 0 && !running && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-cream px-4 py-3 text-sm">
            <span>{t('folderUpload.done', { count: sent })}</span>
            <Link className={buttonVariants({ variant: 'secondary' })} to="/me/charts">
              {t('folderUpload.myCharts')}
            </Link>
          </div>
        )}
      </Card>
    </div>
  )
}
