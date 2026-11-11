// The Nijiiro ID input of both sites' upload page and edit dialog. A Nijiiro ID names one chart,
// so the field looks the typed one up and says whose it is before the form is sent.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { endpoints } from './api/endpoints'
import type { ChartBase } from './api/types'
import { chartText } from './chart-language'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import { i18n } from './i18n'

/** Reads the field: `null` when empty, `undefined` when not a Nijiiro ID. */
export function parseNijiiroId(value: string): number | null | undefined {
  const text = value.trim()
  if (!text) return null
  return /^[1-9][0-9]{0,8}$/.test(text) ? Number(text) : undefined
}

/**
 * What is known of the typed Nijiiro ID: `taken` names the other chart that has it, `own` is
 * the edited chart's, and `unknown` means the lookup failed (the server still checks on save).
 */
export type NijiiroIdCheck =
  | { state: 'empty' | 'invalid' | 'checking' | 'free' | 'own' | 'unknown' }
  | { state: 'taken'; chart: ChartBase }

/** A check that must stop the form: not a Nijiiro ID, or another chart's. */
export const nijiiroIdBlocks = (check: NijiiroIdCheck) =>
  check.state === 'invalid' || check.state === 'taken'

/** Looks the typed Nijiiro ID up, shortly after typing stops. `chartId` is the edited chart. */
export function useNijiiroIdCheck(value: string, chartId = ''): NijiiroIdCheck {
  const parsed = parseNijiiroId(value)
  const [found, setFound] = useState<{ id: number; check: NijiiroIdCheck } | null>(null)
  useEffect(() => {
    if (!parsed) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(endpoints.chartDetail(String(parsed), 'nijiiro'), {
        credentials: 'include',
        signal: controller.signal,
      })
        .then(async (response): Promise<NijiiroIdCheck> => {
          if (response.status === 404) return { state: 'free' }
          if (!response.ok) return { state: 'unknown' }
          const chart = (await response.json()) as ChartBase
          return chart.id === chartId ? { state: 'own' } : { state: 'taken', chart }
        })
        .catch((): NijiiroIdCheck => ({ state: 'unknown' }))
        .then((check) => {
          if (!controller.signal.aborted) setFound({ id: parsed, check })
        })
    }, 350)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [parsed, chartId])
  if (parsed === null) return { state: 'empty' }
  if (parsed === undefined) return { state: 'invalid' }
  return found?.id === parsed ? found.check : { state: 'checking' }
}

export function NijiiroIdField({
  id,
  value,
  check,
  disabled,
  onChange,
}: {
  id: string
  value: string
  /** From useNijiiroIdCheck(value), which the form also reads to refuse a blocked ID. */
  check: NijiiroIdCheck
  disabled?: boolean
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const blocked = nijiiroIdBlocks(check)
  const hint =
    check.state === 'invalid' ? (
      t('messages.nijiiroIdInvalid')
    ) : check.state === 'checking' ? (
      t('messages.nijiiroIdChecking')
    ) : check.state === 'free' ? (
      t('messages.nijiiroIdFree')
    ) : check.state === 'unknown' ? (
      t('messages.nijiiroIdUnknown')
    ) : check.state === 'taken' ? (
      <>
        {t('messages.nijiiroIdTaken')}{' '}
        <Link
          className="font-bold underline underline-offset-2"
          to={`/charts/${check.chart.id}`}
          target="_blank"
          rel="noreferrer"
        >
          {chartText(check.chart, i18n.resolvedLanguage).title}
        </Link>
      </>
    ) : null
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t('messages.nijiiroId')}</Label>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={value}
        disabled={disabled}
        aria-invalid={blocked || undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && (
        <p
          id={`${id}-hint`}
          role={blocked ? 'alert' : 'status'}
          data-state={check.state}
          className={blocked ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}
        >
          {hint}
        </p>
      )}
    </div>
  )
}
