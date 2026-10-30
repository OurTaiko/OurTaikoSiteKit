import { describe, expect, it } from 'vitest'
import fixtures from './testdata/encoding.json'
import { normalizeTja } from './tja-encoding'

const text = 'TITLE:初音ミク\nBPM:120\nWAVE:music.ogg\nCOURSE:Oni\nLEVEL:5\n#START\n1000,\n#END\n'
const fromHex = (hex: string) => Uint8Array.from(hex.match(/../g)!, (byte) => parseInt(byte, 16))
const utf16 = (text: string, little: boolean, bom = true) => {
  const value = (bom ? '\uFEFF' : '') + text
  const data = new Uint8Array(value.length * 2)
  const view = new DataView(data.buffer)
  for (let i = 0; i < value.length; i++) view.setUint16(i * 2, value.charCodeAt(i), little)
  return data
}

describe('automatic TJA encoding', () => {
  it.each(fixtures)('converts $encoding without changing metadata or notes', async (fixture) => {
    const result = await normalizeTja(fromHex(fixture.hex), fixture.wave)
    expect(new TextDecoder('utf-8', { fatal: true }).decode(result.data)).toBe(fixture.text)
  })
  it.each([false, true])('normalizes UTF-8, BOM=%s', async (bom) => {
    const result = await normalizeTja(
      new TextEncoder().encode((bom ? '\uFEFF' : '') + text),
      'music.ogg',
    )
    expect(new TextDecoder('utf-8', { fatal: true }).decode(result.data)).toBe(text)
    expect(result.sourceEncoding).toBe('UTF-8')
    expect(result.data[0]).toBe(84)
  })
  it.each([
    [true, true],
    [false, true],
    [true, false],
    [false, false],
  ])('converts UTF-16 little=%s BOM=%s', async (little, bom) => {
    const result = await normalizeTja(utf16(text, little, bom), 'music.ogg')
    expect(new TextDecoder().decode(result.data)).toBe(text)
  })
  it.each([true, false])(
    'converts UTF-32 little=%s including supplementary characters',
    async (little) => {
      const value = [...('\uFEFF' + text.replace('初音ミク', '太鼓🥁'))]
      const data = new Uint8Array(value.length * 4)
      const view = new DataView(data.buffer)
      value.forEach((char, i) => view.setUint32(i * 4, char.codePointAt(0)!, little))
      const result = await normalizeTja(data, 'music.ogg')
      expect(new TextDecoder().decode(result.data)).toBe(text.replace('初音ミク', '太鼓🥁'))
    },
  )
  it.each([
    [0xef, 0xbb, 0xbf, 0xff],
    [0xff, 0xfe, 0],
    [0xfe, 0xff, 0xd8, 0],
    [0xff, 0xfe, 0, 0, 0, 0, 0x11, 0],
    [0, 1, 0, 2],
  ])('rejects malformed Unicode %j without guessing another encoding', async (...bytes) => {
    await expect(normalizeTja(new Uint8Array(bytes), 'music.ogg')).rejects.toMatchObject({
      code: 'TJA_ENCODING_INVALID',
    })
  })
  it('rejects existing replacement characters instead of reinterpreting them', async () => {
    await expect(
      normalizeTja(new TextEncoder().encode(text + '\uFFFD'), 'music.ogg'),
    ).rejects.toMatchObject({ code: 'TJA_ENCODING_INVALID' })
  })
  it('preserves valid Unicode control characters already present in ESE charts', async () => {
    const source = text.replace('初音ミク', 'tn\u0081-shi')
    const result = await normalizeTja(new TextEncoder().encode(source), 'music.ogg')
    expect(new TextDecoder().decode(result.data)).toBe(source)
  })
})
