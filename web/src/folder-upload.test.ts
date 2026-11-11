import { describe, expect, it } from 'vitest'
import { headerFile, scanFolder, songHeaders, validateImages } from './folder-upload'
import type { FolderFile } from './folder-upload'

const file = (path: string, content: BlobPart = 'x'): FolderFile => ({
  file: new File([content], path.split('/').pop()!),
  path,
})
const tja = (headers: string) =>
  `TITLE:Song\nBPM:120\n${headers}COURSE:Oni\nLEVEL:5\n#START\n1000,\n#END\n`

describe('song headers', () => {
  it('reads headers before #START in any case, the last declaration winning', () => {
    const headers = songHeaders(
      'title:A\r\nPREIMAGE:a.png\r\npreimage:b.png // art\r\n#START\r\nWAVE:late.ogg\r\n',
    )
    expect(headers).toEqual({ TITLE: 'A', PREIMAGE: 'b.png' })
  })
  it('takes the file name of a header path', () => {
    expect(headerFile('img\\jacket.png')).toBe('jacket.png')
    expect(headerFile('"../art/c.webp"')).toBe('c.webp')
    expect(headerFile('')).toBe('')
  })
})

describe('scanning a folder', () => {
  it('matches each TJA with the files its own folder names', async () => {
    const charts = await scanFolder([
      file(
        'pack/A/a.tja',
        tja('WAVE:Song A.ogg\nPREIMAGE:img\\Jacket.PNG\nBGIMAGE:../A/bg.jpg\nBGMOVIE:a.mp4\n'),
      ),
      file('pack/A/BG.JPG'),
      file('pack/A/song a.OGG'),
      file('pack/A/img/jacket.png'),
      file('pack/A/a.mp4'),
      file('pack/A/other.mp4'),
      file('pack/B/b.tja', tja('WAVE:b.mp3\n')),
      file('pack/B/b.mp3'),
      file('pack/B/cover.jpg'),
      file('pack/B/notes.txt'),
    ])
    expect(charts.map((c) => c.path)).toEqual(['pack/A/a.tja', 'pack/B/b.tja'])
    const [a, b] = charts
    // Matched files take the names their headers give, which the upload checks exactly.
    expect([a.audio?.name, a.cover?.name, a.background?.name, a.movie?.name]).toEqual([
      'Song A.ogg',
      'Jacket.PNG',
      'bg.jpg',
      'a.mp4',
    ])
    expect(a.missing).toEqual([])
    // A chart takes no image its headers do not name.
    expect([b.audio?.name, b.cover, b.background, b.movie]).toEqual(['b.mp3', null, null, null])
  })

  it('reports headers whose file is missing and keeps a lone file to show the mismatch', async () => {
    const [chart] = await scanFolder([
      file('x.tja', tja('WAVE:x.ogg\nPREIMAGE:x.png\nBGIMAGE:bg.png\n')),
      file('other.ogg'),
      file('bg.png'),
    ])
    expect(chart.audio?.name).toBe('other.ogg')
    // A declared PREIMAGE is not replaced by another image, nor by BGIMAGE's.
    expect(chart.cover).toBeNull()
    expect(chart.missing).toEqual([
      { header: 'WAVE', value: 'x.ogg' },
      { header: 'PREIMAGE', value: 'x.png' },
    ])
  })

  it('checks chosen images against their headers', async () => {
    const prepared = {
      file: new File([tja('WAVE:a.ogg\nPREIMAGE:x.png\nBGIMAGE:bg.png\n')], 'a.tja'),
    }
    const image = (name: string) => new File(['x'], name)
    await expect(validateImages(prepared, image('x.png'), image('bg.png'))).resolves.toBeUndefined()
    await expect(validateImages(prepared, image('y.png'))).rejects.toMatchObject({
      code: 'TJA_PREIMAGE_MISMATCH',
    })
    await expect(validateImages(prepared, null, image('y.png'))).rejects.toMatchObject({
      code: 'TJA_BGIMAGE_MISMATCH',
    })
    const bare = { file: new File([tja('WAVE:a.ogg\n')], 'a.tja') }
    await expect(validateImages(bare, image('any.png'))).resolves.toBeUndefined()
    await expect(validateImages(bare, null, image('bg.png'))).rejects.toMatchObject({
      code: 'UPLOAD_FILES_INVALID',
    })
  })

  it('does not take BGIMAGE as the cover', async () => {
    const [chart] = await scanFolder([
      file('x.tja', tja('WAVE:x.ogg\nBGIMAGE:bg.png\n')),
      file('x.ogg'),
      file('bg.png'),
    ])
    expect(chart.cover).toBeNull()
  })

  it('reads a Shift_JIS TJA by the audio its WAVE names', async () => {
    // 「曲」 in Shift_JIS, as WAVE:曲.ogg
    const header = new Uint8Array([
      0x57, 0x41, 0x56, 0x45, 0x3a, 0x8b, 0xc8, 0x2e, 0x6f, 0x67, 0x67, 0x0a,
    ])
    const body = new TextEncoder().encode(tja(''))
    const data = new Uint8Array([...header, ...body])
    const [chart] = await scanFolder([file('jp/song.tja', data), file('jp/曲.ogg')])
    expect(chart.audio?.name).toBe('曲.ogg')
    expect(chart.missing).toEqual([])
  })
})
