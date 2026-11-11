import { isAudioFilename, isMovieFilename, maxTja, ValidationError } from './tja'
import { coverFileError } from './cover'
import { normalizeTja } from './tja-encoding'
import { t } from './i18n'

/** A file from a dropped or chosen folder, with its '/'-separated path inside it. */
export type FolderFile = { file: File; path: string }

/** The song headers whose files an upload carries, beside WAVE. */
export type FileHeader = 'WAVE' | 'PREIMAGE' | 'BGIMAGE' | 'BGMOVIE'

/** One TJA of a folder with the files its headers name, ready for the upload form. */
export type FolderChart = {
  path: string
  tja: File
  /** TITLE as the TJA declares it, for the list; the file name when unreadable. */
  title: string
  audio: File | null
  /** PREIMAGE's image, the chart's cover. */
  cover: File | null
  /** BGIMAGE's image. */
  background: File | null
  movie: File | null
  /** Headers whose file is not in the folder (or is not a usable image). */
  missing: { header: FileHeader; value: string }[]
}

export const isImageFilename = (name: string) => /\.(jpe?g|png|webp)$/i.test(name)
export const isTjaFilename = (name: string) => /\.tja$/i.test(name)

/**
 * The song headers of a UTF-8 TJA before its first #START, upper-cased; a repeated header's
 * last declaration counts, as in the game.
 */
export function songHeaders(text: string): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const s = raw.split('//', 1)[0].trim()
    if (s.startsWith('#START')) break
    const colon = s.indexOf(':')
    if (colon < 0 || s.startsWith('#')) continue
    headers[s.slice(0, colon).trim().toUpperCase()] = s.slice(colon + 1).trim()
  }
  return headers
}

/** The file name a header value refers to: game folders may give a path, with either slash. */
export const headerFile = (value: string) =>
  value.replace(/^"|"$/g, '').replaceAll('\\', '/').split('/').pop() ?? ''

/**
 * Chosen images must be the ones the TJA names, as the server checks: the cover PREIMAGE's,
 * the background image BGIMAGE's, which needs the header.
 */
export async function validateImages(
  prepared: { file: File },
  cover: File | null,
  background: File | null = null,
) {
  if (!cover && !background) return
  const headers = songHeaders(await prepared.file.text())
  const check = (header: 'PREIMAGE' | 'BGIMAGE', file: File | null) => {
    const expected = headerFile(headers[header] ?? '')
    if (!file || (!expected && header === 'PREIMAGE')) return
    if (!expected) fail('UPLOAD_FILES_INVALID', t('folderUpload.backgroundNotDeclared'))
    if (expected.normalize('NFC') !== file.name.normalize('NFC'))
      throw new ValidationError(
        `TJA_${header}_MISMATCH`,
        header === 'PREIMAGE'
          ? t('folderUpload.preimageMismatch', { expected, actual: file.name })
          : t('folderUpload.bgimageMismatch', { expected, actual: file.name }),
        0,
        expected,
        file.name,
      )
  }
  if (background && coverFileError(background))
    fail('UPLOAD_FILES_INVALID', coverFileError(background))
  check('PREIMAGE', cover)
  check('BGIMAGE', background)
}
function fail(code: string, message: string): never {
  throw new ValidationError(code, message)
}

/** Files of a drop, with folders read recursively; plain files keep their bare names. */
export async function droppedFiles(transfer: DataTransfer): Promise<FolderFile[]> {
  // The entries must be taken during the drop event, before anything awaits.
  const entries = Array.from(transfer.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry?.())
  if (!entries.length || entries.some((entry) => !entry) || entries.every((e) => e!.isFile))
    return Array.from(transfer.files, (file) => ({ file, path: file.name }))
  const out: FolderFile[] = []
  const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject),
      )
      out.push({ file, path: prefix + entry.name })
      return
    }
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    // readEntries returns a directory in batches until it returns none.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject),
      )
      if (!batch.length) break
      for (const child of batch) await walk(child, `${prefix}${entry.name}/`)
    }
  }
  for (const entry of entries) await walk(entry!, '')
  return out
}

/** Files of an <input webkitdirectory>, which carry their path in the chosen folder. */
export function chosenFiles(list: FileList | null): FolderFile[] {
  return Array.from(list ?? [], (file) => ({ file, path: file.webkitRelativePath || file.name }))
}

const directory = (path: string) => path.slice(0, path.lastIndexOf('/') + 1)
const key = (path: string) => path.normalize('NFC').toLowerCase()

/** Resolves a header's value against the TJA's folder: '\' and '..' as games read them. */
function resolve(dir: string, value: string) {
  const parts = dir.split('/').filter(Boolean)
  for (const part of value.replace(/^"|"$/g, '').replaceAll('\\', '/').split('/')) {
    if (part === '..') parts.pop()
    else if (part && part !== '.') parts.push(part)
  }
  return parts.join('/')
}

/**
 * The file under a bare name, by default its own: browsers send a file chosen with its folder
 * under its path there, which the server refuses.
 */
function plain(file: File, name = file.name) {
  return file.name === name && !file.webkitRelativePath
    ? file
    : new File([file], name, { type: file.type, lastModified: file.lastModified })
}

async function readTja(file: File, folderAudio: File[]) {
  const data = new Uint8Array(await file.arrayBuffer())
  // A legacy encoding is told apart by the audio WAVE names, as when one is chosen by hand.
  for (const audio of folderAudio) {
    try {
      const text = new TextDecoder().decode((await normalizeTja(data, audio.name)).data)
      if (songHeaders(text).WAVE?.normalize('NFC') === audio.name.normalize('NFC')) return text
    } catch {
      /* Try the next candidate, then without one. */
    }
  }
  try {
    return new TextDecoder().decode((await normalizeTja(data, '')).data)
  } catch {
    return ''
  }
}

/**
 * Finds every TJA of a folder and, from its own folder, the files its headers name: WAVE's
 * audio, PREIMAGE's cover, BGIMAGE's background image and BGMOVIE's movie. Names match ignoring
 * case, as on the systems these folders come from, and a matched file takes the name its header
 * gives, which the upload checks. A chart takes no image its headers do not name. A missing
 * WAVE or BGMOVIE falls back to the folder's only file of that kind, so the form shows why it
 * does not match.
 */
export async function scanFolder(files: FolderFile[]): Promise<FolderChart[]> {
  const byPath = new Map<string, FolderFile>()
  for (const item of files) byPath.set(key(item.path), item)
  const inFolder = (dir: string, test: (name: string) => boolean) =>
    files.filter((f) => directory(f.path) === dir && test(f.file.name)).map((f) => f.file)
  const charts = files
    .filter((f) => isTjaFilename(f.file.name) && f.file.size <= maxTja)
    .sort((a, b) => a.path.localeCompare(b.path))
  const out: FolderChart[] = []
  for (const chart of charts) {
    const dir = directory(chart.path)
    const audios = inFolder(dir, isAudioFilename)
    const headers = songHeaders(await readTja(chart.file, audios))
    const missing: FolderChart['missing'] = []
    const find = (header: FileHeader, test: (name: string) => boolean) => {
      const value = headers[header] ?? ''
      if (!value) return null
      const found = byPath.get(key(resolve(dir, value)))
      if (found && test(found.file.name)) {
        const file = plain(found.file, headerFile(value))
        // An image the upload would refuse is left out, as one not in the folder.
        if (!isImageFilename(file.name) || !coverFileError(file)) return file
      }
      missing.push({ header, value })
      return null
    }
    const only = (list: File[]) => (list.length === 1 ? plain(list[0]) : null)
    out.push({
      path: chart.path,
      tja: plain(chart.file),
      title: headers.TITLE || chart.file.name.replace(/\.tja$/i, ''),
      audio: find('WAVE', isAudioFilename) ?? only(audios),
      cover: find('PREIMAGE', isImageFilename),
      background: find('BGIMAGE', isImageFilename),
      movie:
        find('BGMOVIE', isMovieFilename) ??
        (headers.BGMOVIE ? only(inFolder(dir, isMovieFilename)) : null),
      missing,
    })
  }
  return out
}
