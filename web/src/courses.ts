import { t } from './i18n'
import type { Difficulty, Side } from './api/types'
const baseNames = {
  get Easy() {
    return t('messages.easy')
  },
  get Normal() {
    return t('messages.normal')
  },
  get Hard() {
    return t('messages.hard')
  },
  get Oni() {
    return t('messages.oni')
  },
  get Edit() {
    return t('messages.uraOni')
  },
} as const

export type BaseCourse = keyof typeof baseNames
/** Localized course names, Easy to Ura. */
export const courseNames: Record<BaseCourse, string> = baseNames
export const sides: Side[] = ['single', 'p1', 'p2']

/**
 * A block as one string, for keys and the preview parser's block names: the course, with
 * `_1p` or `_2p` for a `#START P1` / `#START P2` block (Oni, Oni_1p, Oni_2p).
 */
export function slotKey(d: { course: string; side?: string }): string {
  return d.course + (d.side === 'p1' ? '_1p' : d.side === 'p2' ? '_2p' : '')
}
/** The course and side a slot key names: slotKey's inverse. */
export function slotFromKey(key: string): { course: string; side: Side } {
  const course = baseCourse(key)
  const suffix = key.slice(course.length)
  return { course, side: suffix === '_1p' ? 'p1' : suffix === '_2p' ? 'p2' : 'single' }
}
export function baseCourse(key: string): BaseCourse {
  return key.replace(/_[12]p$/, '') as BaseCourse
}
export function isSupportedCourse(value: string): value is BaseCourse {
  return Object.hasOwn(baseNames, value)
}
/** A block's localized name, from the block or its slot key: "Oni", or "Oni 1P" for one of a pair. */
export function blockName(block: { course: string; side?: string } | string): string {
  const key = typeof block === 'string' ? block : slotKey(block)
  const course = baseCourse(key)
  const name = isSupportedCourse(course) ? courseNames[course] : course
  const side = key.slice(course.length)
  return side ? `${name} ${side.slice(1).toUpperCase()}` : name
}
export function sideName(side: string | undefined): string {
  return side === 'p1' ? '1P' : side === 'p2' ? '2P' : t('messages.singleSide')
}
/** Whether the site can show a chart: every block is a known course, and a
 * chart with files has at least one. A song registered without files has none. */
export function supportsChart(chart: {
  difficulties: { course: string }[]
  hasFiles?: boolean
}): boolean {
  const { difficulties, hasFiles = true } = chart
  return (
    (!hasFiles || difficulties.length > 0) && difficulties.every((d) => isSupportedCourse(d.course))
  )
}

// As both APIs read COURSE: the numbers 0–4, the names, and Ura for Edit.
const tjaCourses: Record<string, BaseCourse> = {
  '0': 'Easy',
  '1': 'Normal',
  '2': 'Hard',
  '3': 'Oni',
  '4': 'Edit',
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  oni: 'Oni',
  edit: 'Edit',
  ura: 'Edit',
}
export function parseTjaCourse(value: string): BaseCourse | undefined {
  const key = value.trim().toLowerCase()
  return Object.hasOwn(tjaCourses, key) ? tjaCourses[key] : undefined
}

// The blocks of one course, single first, then P1 and P2. `double` marks a
// course that has no single chart at all. Scores and leaderboards stay per block.
export type CourseGroup = { base: BaseCourse; double: boolean; sides: Difficulty[] }
export function groupCourses(difficulties: Difficulty[]): CourseGroup[] {
  const groups: CourseGroup[] = []
  for (const d of difficulties) {
    if (!isSupportedCourse(d.course)) continue
    let group = groups.find((g) => g.base === d.course)
    if (!group) groups.push((group = { base: d.course, double: true, sides: [] }))
    if (d.side === 'single') group.double = false
    if (!group.sides.some((other) => other.side === d.side)) group.sides.push(d)
  }
  for (const group of groups)
    group.sides.sort((a, b) => sides.indexOf(a.side) - sides.indexOf(b.side))
  // Files list courses in any order; show them from Easy to Ura.
  const order = Object.keys(baseNames)
  return groups.sort((a, b) => order.indexOf(a.base) - order.indexOf(b.base))
}
export function groupName(group: CourseGroup): string {
  return group.double
    ? t('messages.doubleCourse', { course: baseNames[group.base] })
    : baseNames[group.base]
}
// "3" when every side has the same level, otherwise "3/4" in single/P1/P2 order.
export function groupLevel(group: CourseGroup): string {
  return [...new Set(group.sides.map((side) => side.level))].join('/')
}
