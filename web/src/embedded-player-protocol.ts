export const playerChannel = 'ourtaiko-view'
// 'replay' shows a recorded play: the practice menu's bars and speed, the drum struck by the record.
export type PlayerMode = 'practice' | 'auto' | 'replay'
// What the player reports when a replay has played to the end: the play judged again from its
// record, and how early or late its hits were (ms; negative is early).
export type PlayerReplayResult = {
  score: number
  good: number
  ok: number
  bad: number
  drumroll: number
  maxCombo: number
  hits: number
  early: number
  late: number
  meanMs: number | null
  deviationMs: number | null
}
export type PlayerAudioDecode = 'native' | 'software'
export function playerLoad(
  requestId: string,
  chartText: string,
  audioBytes: ArrayBuffer,
  course: string,
  mode: PlayerMode,
  audioType = 'ogg',
  audioDecode: PlayerAudioDecode = 'native',
  // The chart's background movie (BGMOVIE, H.264 MP4); the key is left out when there is none.
  movieBytes?: ArrayBuffer,
  // The recording of the play to show (mode 'replay'), as JSON text.
  replayData?: string,
) {
  return {
    channel: playerChannel,
    type: 'load',
    requestId,
    payload: {
      chartText,
      audioBytes,
      audioType,
      audioDecode,
      course,
      practice: true,
      autoPlay: mode === 'auto',
      replay: mode === 'replay',
      ...(mode === 'replay' ? { replayData: replayData ?? '' } : {}),
      ...(movieBytes ? { movieBytes } : {}),
    },
  }
}
export const defaultDrumVolume = 100
// Hit-sound volume, 0-100; the player rejects anything else.
export function playerDrumVolume(requestId: string, volume: number) {
  const value = Number.isFinite(volume) ? Math.round(Math.min(100, Math.max(0, volume))) : 100
  return {
    channel: playerChannel,
    type: 'setDrumVolume',
    requestId,
    payload: { volume: value },
  }
}
export function isPlayerMessage(
  event: MessageEvent,
  source: Window | null,
  origin: string,
): boolean {
  return (
    source !== null &&
    event.source === source &&
    event.origin === origin &&
    event.data?.channel === playerChannel &&
    typeof event.data?.type === 'string'
  )
}
// The result in a replay's `finished` message; null for anything else.
export function playerReplayResult(payload: unknown): PlayerReplayResult | null {
  const value = (payload as { replay?: Record<string, unknown> } | undefined)?.replay
  if (!value || typeof value !== 'object') return null
  const count = (key: string) =>
    typeof value[key] === 'number' && Number.isFinite(value[key]) ? (value[key] as number) : null
  const counts = [
    'score',
    'good',
    'ok',
    'bad',
    'drumroll',
    'maxCombo',
    'hits',
    'early',
    'late',
  ].map(count)
  if (counts.some((n) => n === null)) return null
  const [score, good, ok, bad, drumroll, maxCombo, hits, early, late] = counts as number[]
  return {
    score,
    good,
    ok,
    bad,
    drumroll,
    maxCombo,
    hits,
    early,
    late,
    meanMs: count('meanMs'),
    deviationMs: count('deviationMs'),
  }
}
