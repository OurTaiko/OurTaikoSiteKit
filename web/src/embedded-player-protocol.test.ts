import { describe, expect, it } from 'vitest'
import {
  isPlayerMessage,
  playerDrumVolume,
  playerLoad,
  playerReplayResult,
} from './embedded-player-protocol'
describe('embedded player boundary', () => {
  const frame = {} as Window
  const origin = 'https://player.example.com'
  const event = (
    source: Window,
    messageOrigin = origin,
    data: unknown = { channel: 'ourtaiko-view', type: 'ready' },
  ) => ({ source, origin: messageOrigin, data }) as MessageEvent
  it('accepts messages only from the configured iframe and origin', () => {
    expect(isPlayerMessage(event(frame), frame, origin)).toBe(true)
    expect(isPlayerMessage(event({} as Window), frame, origin)).toBe(false)
    expect(isPlayerMessage(event(frame, 'https://other.example.com'), frame, origin)).toBe(false)
    expect(isPlayerMessage(event(frame), null, origin)).toBe(false)
    expect(
      isPlayerMessage(
        event(frame, origin, { channel: 'other-channel', type: 'ready' }),
        frame,
        origin,
      ),
    ).toBe(false)
  })
  it('adds the background movie only when there is one', () => {
    const plain = playerLoad('a', 'TITLE:x', new ArrayBuffer(4), 'Oni', 'practice')
    expect(plain.payload).not.toHaveProperty('movieBytes')
    const movie = new ArrayBuffer(8)
    const withMovie = playerLoad(
      'b',
      'TITLE:x',
      new ArrayBuffer(4),
      'Oni',
      'auto',
      'ogg',
      'native',
      movie,
    )
    expect(withMovie.payload.movieBytes).toBe(movie)
  })
  it('sends a replay as the practice scene with the recording', () => {
    const record = '{"version":2,"inputs":[]}'
    const replay = playerLoad(
      'r',
      'TITLE:x',
      new ArrayBuffer(4),
      'Oni',
      'replay',
      'ogg',
      'native',
      undefined,
      record,
    )
    expect(replay.payload).toMatchObject({
      practice: true,
      autoPlay: false,
      replay: true,
      replayData: record,
    })
    expect(
      playerLoad('p', 'TITLE:x', new ArrayBuffer(4), 'Oni', 'auto').payload,
    ).not.toHaveProperty('replayData')
  })
  it('reads a replay result only when it is whole', () => {
    const result = {
      score: 1000,
      good: 3,
      ok: 1,
      bad: 0,
      drumroll: 2,
      maxCombo: 4,
      hits: 4,
      early: 1,
      late: 3,
      meanMs: 4.5,
      deviationMs: null,
    }
    expect(playerReplayResult({ replay: result })).toEqual(result)
    expect(playerReplayResult({ replay: { ...result, good: 'x' } })).toBeNull()
    expect(playerReplayResult({})).toBeNull()
    expect(playerReplayResult(undefined)).toBeNull()
  })
  it('keeps practice controls in both modes and sends no replay with them', () => {
    const practice = playerLoad('a', 'TITLE:测试', new ArrayBuffer(4), 'Oni', 'practice')
    const auto = playerLoad('b', 'TITLE:测试', new ArrayBuffer(4), 'Edit', 'auto')
    expect(practice.payload).toMatchObject({
      practice: true,
      autoPlay: false,
      replay: false,
      course: 'Oni',
      audioDecode: 'native',
    })
    expect(auto.payload).toMatchObject({
      practice: true,
      autoPlay: true,
      replay: false,
      course: 'Edit',
    })
    expect(auto.requestId).toBe('b')
  })
})

describe('branch selection', () => {
  it('allows an explicit software decode request without changing playback mode', () => {
    const load = playerLoad(
      'soft',
      '#START\n#END',
      new ArrayBuffer(4),
      'Oni',
      'auto',
      'ogg',
      'software',
    )
    expect(load.payload).toMatchObject({ audioDecode: 'software', autoPlay: true, practice: true })
  })
  it('leaves the route to the in-game practice menu', () => {
    const load = playerLoad('a', '#START\n#END', new ArrayBuffer(4), 'Edit', 'practice', 'wav')
    expect(load.payload).not.toHaveProperty('branch')
    expect(load.payload).toMatchObject({ autoPlay: false, audioType: 'wav', course: 'Edit' })
  })
  it('sends the drum volume as an integer from 0 to 100', () => {
    expect(playerDrumVolume('a', 42.4)).toEqual({
      channel: 'ourtaiko-view',
      type: 'setDrumVolume',
      requestId: 'a',
      payload: { volume: 42 },
    })
    expect(playerDrumVolume('a', -5).payload.volume).toBe(0)
    expect(playerDrumVolume('a', 250).payload.volume).toBe(100)
    expect(playerDrumVolume('a', Number.NaN).payload.volume).toBe(100)
  })
})
