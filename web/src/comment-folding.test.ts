import { describe, expect, it } from 'vitest'
import type { Comment } from './api/types'
import { planReplies } from './comment-folding'

function comment(id: string, replies: Comment[] = [], extra: Partial<Comment> = {}): Comment {
  return {
    id,
    chartId: 'chart',
    parentId: null,
    depth: 0,
    authorId: 'u1',
    author: 'alice',
    body: id,
    createdAt: '2026-10-01T00:00:00Z',
    editedAt: null,
    deleted: false,
    removed: false,
    score: 1,
    myVote: 0,
    replyCount: replies.length,
    replies,
    ...extra,
  }
}

describe('planReplies', () => {
  const policy = { budget: 10, depth: 2, rootReplies: 3, replies: 1 }
  const chain = (ids: string[]): Comment =>
    ids.reduceRight<Comment | null>((child, id) => comment(id, child ? [child] : []), null)!

  it('shows a few replies per level and folds the rest', () => {
    const root = comment('root', [
      comment('a', [comment('a1', [comment('x', [comment('z')])]), comment('a2', [comment('y')])]),
      comment('b'),
      comment('c'),
      comment('d', [comment('d1')]),
      comment('e', [comment('e1')]),
    ])
    const plan = planReplies(root, policy)
    // The root shows three; a shows one; a1 is at the depth limit and folds.
    expect(plan.get('root')).toBe(3)
    expect(plan.get('a')).toBe(1)
    expect(plan.get('a1')).toBeUndefined()
  })

  it('never folds a single reply that has no replies of its own', () => {
    const root = comment('root', [comment('a', [comment('a1', [comment('leaf')])]), comment('b')])
    const plan = planReplies(root, { ...policy, rootReplies: 1 })
    // b is the last reply and has none; the leaf under a1 is past the depth limit but alone.
    expect(plan.get('root')).toBe(2)
    expect(plan.get('a1')).toBe(1)
    // A reply whose replies the server left out is not a leaf.
    const truncated = comment('root', [comment('a'), comment('b', [], { replyCount: 3 })])
    expect(planReplies(truncated, { ...policy, rootReplies: 1 }).get('root')).toBe(1)
  })

  it('folds a long single-reply chain at the depth limit and stops at the budget', () => {
    expect([...planReplies(chain(['c0', 'c1', 'c2', 'c3', 'c4']), policy)]).toEqual([
      ['c0', 1],
      ['c1', 1],
    ])
    const wide = comment('root', Array.from({ length: 8 }, (_, i) => comment(`r${i}`)))
    expect(planReplies(wide, { ...policy, budget: 4, rootReplies: 8 }).get('root')).toBe(4)
  })

  it('continues after the replies already shown when expanding', () => {
    const root = comment(
      'root',
      Array.from({ length: 6 }, (_, i) => comment(`r${i}`, [comment(`r${i}x`, [comment(`r${i}y`)])])),
    )
    const plan = planReplies(root, { ...policy, rootReplies: 2 }, 2)
    expect(plan.get('root')).toBe(4)
    expect(plan.has('r0')).toBe(false)
    expect(plan.get('r2')).toBe(1)
  })
})
