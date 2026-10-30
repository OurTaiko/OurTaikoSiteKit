import { expect, it } from 'vitest'
import { i18n } from './i18n'
import { blockName, groupCourses, parseTjaCourse } from './courses'

it('names a block from the block or its slot key', async () => {
  await i18n.changeLanguage('en')
  expect(blockName({ course: 'Oni', side: 'single' })).toBe(i18n.t('messages.oni'))
  expect(blockName({ course: 'Oni', side: 'p1' })).toBe(`${i18n.t('messages.oni')} 1P`)
  expect(blockName('Edit_2p')).toBe(`${i18n.t('messages.uraOni')} 2P`)
  expect(blockName('Tower')).toBe('Tower')
})

it('reads COURSE as both APIs do, Ura included', () => {
  expect(['0', 'easy', ' Oni ', '4', 'edit', 'URA'].map(parseTjaCourse)).toEqual([
    'Easy',
    'Easy',
    'Oni',
    'Edit',
    'Edit',
    'Edit',
  ])
  expect(parseTjaCourse('Tower')).toBeUndefined()
})

it('orders course groups from Easy to Ura', () => {
  const block = (course: string) => ({ course, side: 'single' as const, level: 1, maker: '' })
  expect(groupCourses(['Edit', 'Easy', 'Oni'].map(block)).map((g) => g.base)).toEqual([
    'Easy',
    'Oni',
    'Edit',
  ])
})
