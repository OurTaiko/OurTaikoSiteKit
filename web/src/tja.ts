// The browser's copy of the upload gate (the Go package tja): the same header and structure
// rules, checked before a file goes up; ../../contracts/validation.json holds the cases both
// run. The server then reads the blocks through TJAParser, which the browser cannot.
import { t } from './i18n'
import { parseTjaCourse } from './courses'
import { normalizeTja } from './tja-encoding'
import { ValidationError } from './validation-error'
import type { Difficulty, Side, TitleTexts } from './api/types'
import { maxAudio, maxMovie, maxTja } from './tja-limits'
export { ValidationError } from './validation-error'
export type { Side, Difficulty, DifficultyConstants, TitleTexts } from './api/types'
export { maxTja, maxAudio, maxMovie } from './tja-limits'

export const validationVersion = 'tja-v13'
export type Metadata = {
  title: string
  subtitle: string
  titleTranslations?: TitleTexts
  subtitleTranslations?: TitleTexts
  /** The MAKER header: the credit of every block without its own NOTESDESIGNERn. */
  maker: string
  bpm: number
  offset: number
  demoStart: number
  wave: string
  /** BGMOVIE file name as declared; empty when the chart has no movie. */
  movie: string
  /** MOVIEOFFSET in seconds. */
  movieOffset: number
  difficulties: Difficulty[]
}
const fail = (code: string, message: string, line = 0): never => {
  throw new ValidationError(code, message, line)
}
const bytes = (s: string) => new TextEncoder().encode(s).length
const finiteNumber = /^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/
export const isAudioFilename = (name: string) => /\.(ogg|mp3)$/i.test(name)
export const isMovieFilename = (name: string) => /\.(mp4|webm|mov)$/i.test(name)

async function validateAudioHeader(audio: File) {
  const header = new Uint8Array(await audio.slice(0, 10).arrayBuffer())
  if (/\.ogg$/i.test(audio.name)) {
    if (new TextDecoder().decode(header.slice(0, 4)) !== 'OggS')
      fail('AUDIO_INVALID', t('messages.audioIsNotAValidOggFileCheckItsFormat'))
    return
  }
  const id3 =
    header.length === 10 &&
    new TextDecoder().decode(header.slice(0, 3)) === 'ID3' &&
    header[3] >= 2 &&
    header[3] <= 4 &&
    header[4] !== 255 &&
    header.slice(6, 10).every((b) => b < 128)
  if (id3) {
    const tagSize = header.slice(6, 10).reduce((size, b) => size * 128 + b, 0)
    const footer = header[3] === 4 && (header[5] & 16) !== 0 ? 10 : 0
    if (10 + tagSize + footer + 4 <= audio.size) return
  } else if (
    header.length >= 4 &&
    header[0] === 255 &&
    (header[1] & 224) === 224 &&
    ((header[1] >> 3) & 3) !== 1 &&
    ((header[1] >> 1) & 3) === 1 &&
    header[2] >> 4 > 0 &&
    header[2] >> 4 < 15 &&
    ((header[2] >> 2) & 3) !== 3
  )
    return
  // This is a lightweight signature check. The backend validates all frames and decodes the file.
  fail('AUDIO_INVALID', t('messages.audioIsNotAValidMp3FileCheckTheFormatRenamingThe'))
}

export function safeFilename(s: string) {
  return (
    !!s &&
    s !== '.' &&
    s !== '..' &&
    bytes(s) <= 240 &&
    s.trim() === s &&
    !Array.from(s).some((c) => {
      const n = c.codePointAt(0)!
      return n < 32 || (n >= 127 && n <= 159)
    }) &&
    !/[/\\:"<>|?*]/u.test(s)
  )
}
/**
 * Reads a UTF-8 TJA; prepareTja converts other encodings first. audioName, when not empty,
 * must be the file the WAVE header names. Header names are read in any case, and a repeated
 * song header counts as in the game: its last declaration, even one after the charts.
 */
export function parseTja(data: Uint8Array, audioName: string): Metadata {
  const m: Metadata = {
    title: '',
    subtitle: '',
    maker: '',
    bpm: 0,
    offset: 0,
    demoStart: 0,
    wave: '',
    movie: '',
    movieOffset: 0,
    difficulties: [],
  }
  if (!data.length || data.length > maxTja)
    fail('FILE_SIZE_INVALID', t('messages.tjaMustNotBeEmptyOrExceed2Mib'))
  let text = ''
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(data).replace(/^\uFEFF/, '')
  } catch {
    fail('TJA_ENCODING_INVALID', t('messages.cannotDecodeTextSaveAsUtf8AndSelectAgain'))
  }
  if (text.includes('\uFFFD') || text.includes('\u0000'))
    fail('TJA_ENCODING_INVALID', t('messages.textContainsUnrecognizedCharacters'))
  let waveLine = 0,
    started = false,
    inBlock = false,
    hasNotes = false,
    course = 'Oni',
    level = 0,
    style = 'Single'
  const slotsSeen = new Set<string>()
  const seen = new Set<string>()
  // NOTESDESIGNER0–4 credit one course each (0 Easy … 4 Edit); MAKER credits every other block.
  const designers: Record<string, string> = {}
  for (const [index, raw] of text.replace(/\r\n/g, '\n').split('\n').entries()) {
    const line = index + 1
    if (bytes(raw) > 65536) fail('TJA_STRUCTURE_INVALID', t('messages.aLineExceeds64Kib'), line)
    const s = raw.split('//', 1)[0].trim()
    if (!s) continue
    if (s.startsWith('#NEXTSONG'))
      fail('TJA_COURSE_UNSUPPORTED', t('messages.multiSongChartsAreNotSupported'), line)
    if (s.startsWith('#START')) {
      const player = s.slice(6).trim()
      if ((player && player !== 'P1' && player !== 'P2') || inBlock || level === 0)
        fail('TJA_STRUCTURE_INVALID', t('messages.eachChartNeedsLevel110AndItsOwnStartEnd'), line)
      started = true
      inBlock = true
      hasNotes = false
      if (style !== 'Single' && !player)
        fail('TJA_PLAYER_REQUIRED', t('messages.doublePlayerRequired'), line)
      // Single, 1P and 2P blocks of a course may share a file; each only once.
      const side: Side = player === 'P1' ? 'p1' : player === 'P2' ? 'p2' : 'single'
      const slot = `${course} ${side}`
      if (slotsSeen.has(slot)) fail('TJA_DIFFICULTY_DUPLICATE', t('messages.duplicateCourse'), line)
      slotsSeen.add(slot)
      m.difficulties.push({ course, side, level, maker: '' })
      continue
    }
    if (inBlock && /^#BRANCHSTART/i.test(s)) {
      m.difficulties[m.difficulties.length - 1].branching = true
      continue
    }
    if (s === '#END') {
      if (!inBlock || !hasNotes)
        fail('TJA_STRUCTURE_INVALID', t('messages.emptyChartBlockOrEndWithoutStart'), line)
      inBlock = false
      continue
    }
    const colon = s.indexOf(':')
    if (colon < 0 || s.startsWith('#')) {
      if (inBlock && !s.startsWith('#') && /[0-9]/.test(s)) hasNotes = true
      continue
    }
    const written = s.slice(0, colon).trim(),
      key = written.toUpperCase(),
      value = s.slice(colon + 1).trim()
    if (bytes(value) > 500 && !key.startsWith('BALLOON'))
      fail('TJA_STRUCTURE_INVALID', t('messages.metadataFieldIsTooLong'), line)
    const localized = /^(TITLE|SUBTITLE)(EN|JA|ZH|KO)$/.exec(key)
    if (localized) {
      const field = localized[1] === 'TITLE' ? 'titleTranslations' : 'subtitleTranslations'
      const language = localized[2].toLowerCase() as 'en' | 'ja' | 'zh' | 'ko'
      m[field] = { ...m[field], [language]: value }
      continue
    }
    const designer = /^NOTESDESIGNER([0-4])$/.exec(key)
    if (designer) {
      designers[['Easy', 'Normal', 'Hard', 'Oni', 'Edit'][Number(designer[1])]] = value
      continue
    }
    switch (key) {
      case 'STYLE': {
        // As OpenTaiko reads it: 1 or Single is one player, 2 or Double (Couple) two.
        const parsed = {
          single: 'Single',
          '0': 'Single',
          '1': 'Single',
          double: 'Double',
          duet: 'Double',
          couple: 'Double',
          '2': 'Double',
        }[value.toLowerCase()]
        if (!parsed || inBlock) fail('TJA_STRUCTURE_INVALID', t('messages.invalidChartStyle'), line)
        style = parsed!
        break
      }
      case 'WAVE':
        if (started)
          fail('TJA_WAVE_SCOPE_INVALID', t('messages.waveMustAppearBeforeTheFirstStart'), line)
        if (seen.has(key)) fail('TJA_WAVE_DUPLICATE', t('messages.waveCanOnlyBeDeclaredOnce'), line)
        seen.add(key)
        waveLine = line
        m.wave = value
        break
      case 'BGMOVIE':
      case 'MOVIEOFFSET':
        // The server rewrites or reads these headers back, so they must be unambiguous.
        if (written !== key || started || seen.has(key))
          fail('TJA_MOVIE_INVALID', t('messages.movieHeaderScopeError', { field: key }), line)
        seen.add(key)
        if (key === 'BGMOVIE') {
          if (value && (!safeFilename(value) || !isMovieFilename(value)))
            fail('TJA_MOVIE_PATH_INVALID', t('messages.movieFilenameInvalid'), line)
          m.movie = value
        } else if (value) {
          const n = Number(value)
          if (!finiteNumber.test(value) || !(Math.abs(n) <= 1200))
            fail('TJA_MOVIE_OFFSET_INVALID', t('messages.movieOffsetInvalid'), line)
          m.movieOffset = n
        }
        break
      case 'COURSE': {
        if (['tower', 'dan', '5', '6'].includes(value.toLowerCase()))
          fail(
            'TJA_COURSE_UNSUPPORTED',
            t('messages.towerAndDanChartsAreNotSupportedRemoveThoseBlocksAndUpload'),
            line,
          )
        const parsed = parseTjaCourse(value)
        if (!parsed || inBlock)
          fail('TJA_STRUCTURE_INVALID', t('messages.courseMustBeEasyNormalHardOniEditOr04'), line)
        course = parsed!
        style = 'Single'
        level = 0
        break
      }
      case 'LEVEL': {
        const n = Number(value)
        if (!/^[+-]?[0-9]+$/.test(value) || !Number.isInteger(n) || n < 1 || n > 10 || inBlock)
          fail('TJA_STRUCTURE_INVALID', t('messages.levelMustBeAnIntegerFrom1To10'), line)
        level = n
        break
      }
      case 'TITLE':
        m.title = value
        break
      case 'SUBTITLE':
        m.subtitle = value
        break
      case 'MAKER':
        m.maker = value
        break
      case 'BPM':
      case 'OFFSET':
      case 'DEMOSTART': {
        const n = Number(value)
        if (!finiteNumber.test(value) || !Number.isFinite(n))
          fail('TJA_STRUCTURE_INVALID', t('messages.finiteNumberRequired', { field: key }), line)
        if (key === 'BPM') m.bpm = n
        if (key === 'OFFSET') m.offset = n
        if (key === 'DEMOSTART') m.demoStart = n
      }
    }
  }
  if (!m.wave) fail('TJA_WAVE_MISSING', t('messages.tjaNeedsANonemptyWaveAudioReference'), waveLine)
  if (!safeFilename(m.wave) || !isAudioFilename(m.wave))
    fail(
      'TJA_WAVE_PATH_INVALID',
      t('messages.waveMustBeAnOggOrMp3FilenameWithoutPathsOrQuotes'),
      waveLine,
    )
  if (audioName) {
    if (!safeFilename(audioName))
      fail(
        'UPLOAD_FILENAME_INVALID',
        t('messages.uploadFilenamesCannotContainPathsOrSpecialCharacters'),
      )
    if (m.wave.normalize('NFC') !== audioName.normalize('NFC'))
      throw new ValidationError(
        'TJA_AUDIO_MISMATCH',
        t('messages.audioFilenameMismatch', {
          line: waveLine,
          expected: m.wave,
          actual: audioName,
        }),
        waveLine,
        m.wave,
        audioName,
      )
  }
  if (!m.title || m.bpm <= 0 || inBlock || !m.difficulties.length)
    fail('TJA_STRUCTURE_INVALID', t('messages.titleAPositiveBpmAndCompleteChartBlocksAreRequired'))
  // Five courses on three sides (single, 1P, 2P).
  if (m.difficulties.length > 15) fail('TJA_STRUCTURE_INVALID', t('messages.tooManyChartBlocks'))
  for (const d of m.difficulties) d.maker = designers[d.course] || m.maker
  m.titleTranslations = { en: m.title, ...m.titleTranslations }
  m.subtitleTranslations = { en: m.subtitle, ...m.subtitleTranslations }
  return m
}
export type PreparedTja = Metadata & { file: File; sourceEncoding: string }
/**
 * Converts a chosen TJA to UTF-8 and checks it. audioName is the chosen audio, which WAVE must
 * name; it is '' when a replacement keeps the stored audio, whose name (keptAudio) then only
 * helps tell encodings apart, as the server does not match WAVE against a kept file.
 */
export async function prepareTja(
  tja: File,
  audioName: string,
  keptAudio = '',
): Promise<PreparedTja> {
  if (
    !safeFilename(tja.name) ||
    !/\.tja$/i.test(tja.name) ||
    (audioName && !isAudioFilename(audioName))
  )
    fail('UPLOAD_FILES_INVALID', t('messages.selectOneTjaChartAndOneOggOrMp3AudioFile'))
  if (!tja.size || tja.size > maxTja)
    fail('FILE_SIZE_INVALID', t('messages.filesMustNotBeEmptyTjaUpTo2MibAudioUp'))
  const normalized = await normalizeTja(
    new Uint8Array(await tja.arrayBuffer()),
    audioName || keptAudio,
  )
  const metadata = parseTja(normalized.data, audioName)
  return {
    ...metadata,
    sourceEncoding: normalized.sourceEncoding,
    file: new File([normalized.data], tja.name, { type: 'text/plain;charset=utf-8' }),
  }
}

/**
 * A declared BGMOVIE needs its file, under the same name; a replacement may
 * keep the movie the chart already has.
 */
export function validateMovie(metadata: Metadata, movie: File | null, hasStoredMovie = false) {
  if (!movie) {
    if (metadata.movie && !hasStoredMovie)
      fail('TJA_MOVIE_MISSING', t('messages.movieFileRequired', { expected: metadata.movie }))
    return
  }
  if (!metadata.movie) fail('UPLOAD_FILES_INVALID', t('messages.movieNotDeclared'))
  if (!safeFilename(movie.name) || !isMovieFilename(movie.name) || !movie.size)
    fail('UPLOAD_FILES_INVALID', t('messages.movieFileInvalid'))
  if (movie.size > maxMovie) fail('FILE_SIZE_INVALID', t('messages.movieFileInvalid'))
  if (metadata.movie.normalize('NFC') !== movie.name.normalize('NFC'))
    throw new ValidationError(
      'TJA_MOVIE_MISMATCH',
      t('messages.movieFilenameMismatch', { expected: metadata.movie, actual: movie.name }),
      0,
      metadata.movie,
      movie.name,
    )
}

export async function validateFiles(tja: File, audio: File): Promise<PreparedTja> {
  if (!audio.size || audio.size > maxAudio)
    fail('FILE_SIZE_INVALID', t('messages.filesMustNotBeEmptyTjaUpTo2MibAudioUp'))
  const prepared = await prepareTja(tja, audio.name)
  await validateAudioHeader(audio)
  return prepared
}
