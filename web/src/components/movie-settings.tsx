import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { MoviePicker } from './movie-picker'

// A chart's background movie and MOVIEOFFSET in its edit dialog, beside the preview range.
// A new movie goes up on its own (replaceMovie, transcoded in the background); the offset
// alone is a metadata edit (PATCH movieOffset). The sites rewrite BGMOVIE and MOVIEOFFSET in
// the stored TJA either way, keeping its charts and scores.
type MovieChart = { movieHash?: string; movieSize?: number; movieOffset?: number }
export type MovieDraft = { file: File | null; offset: string }

export const movieDraft = (chart: MovieChart): MovieDraft => ({
  file: null,
  offset: String(chart.movieOffset ?? 0),
})

/** What saving the draft sends: the file to replaceMovie, or `offset` alone to the PATCH. */
export function movieChanges(chart: MovieChart, draft: MovieDraft) {
  const value = Number(draft.offset)
  // Without a movie there is no offset to set.
  const offsetChanged = (!!draft.file || !!chart.movieHash) && value !== (chart.movieOffset ?? 0)
  const invalid =
    offsetChanged && (!draft.offset.trim() || !Number.isFinite(value) || Math.abs(value) > 1200)
  return {
    changed: !!draft.file || offsetChanged,
    invalid,
    file: draft.file,
    offset: offsetChanged && !invalid ? value : undefined,
  }
}

export function MovieSettings({
  chart,
  draft,
  onChange,
  disabled = false,
  className,
}: {
  chart: MovieChart
  draft: MovieDraft
  onChange: (draft: MovieDraft) => void
  disabled?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <fieldset
      disabled={disabled}
      className={`space-y-4 rounded-[14px] border p-4 ${className ?? ''}`}
    >
      <legend className="px-2 font-medium">{t('messages.metadataMovie')}</legend>
      <p className="text-sm text-muted-foreground">
        {chart.movieHash
          ? t('messages.currentMovie', { size: ((chart.movieSize ?? 0) / 1048576).toFixed(1) })
          : t('messages.noCurrentMovie')}
      </p>
      <MoviePicker
        file={draft.file}
        onChange={(file) => onChange({ ...draft, file })}
        hint={t('messages.movieUpTo64Mib')}
        disabled={disabled}
      />
      <Label htmlFor={`${id}-offset`} className="flex flex-col items-start gap-2">
        {t('messages.movieOffsetSeconds')}
        <Input
          id={`${id}-offset`}
          type="number"
          min="-1200"
          max="1200"
          step="any"
          value={draft.offset}
          disabled={disabled || (!chart.movieHash && !draft.file)}
          aria-describedby={`${id}-offset-hint`}
          onChange={(e) => onChange({ ...draft, offset: e.target.value })}
        />
      </Label>
      <small id={`${id}-offset-hint`} className="block text-muted-foreground">
        {t('messages.movieOffsetHint')}
      </small>
    </fieldset>
  )
}
