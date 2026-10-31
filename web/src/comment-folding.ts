import type { Comment } from './api/types'

// How much of a thread shows before the rest folds behind a button.
export type FoldPolicy = {
  /** Most replies shown below the starting comment. */
  budget: number
  /** Most levels shown below the starting comment. */
  depth: number
  /** Most direct replies shown on the starting comment. */
  rootReplies: number
  /** Most direct replies shown on each comment further down. */
  replies: number
}

// As on Reddit, a long thread shows a part first and folds the rest into
// "N replies". Replies are picked level by level, siblings in sort order, until
// a cap on count, depth or the budget is hit. A single reply without replies of
// its own never folds: the button would take as much room as the comment.
// The first `skip` replies of the root are already shown and not counted.
// Returns how many direct replies each comment shows; a missing comment shows 0.
export function planReplies(root: Comment, policy: FoldPolicy, skip = 0): Map<string, number> {
  const shown = new Map<string, number>()
  let budget = policy.budget
  let level: { comment: Comment; depth: number }[] = [{ comment: root, depth: 0 }]
  while (level.length > 0 && budget > 0) {
    const next: typeof level = []
    for (const { comment, depth } of level) {
      const offset = comment === root ? skip : 0
      const replies = comment.replies.slice(offset)
      const cap =
        depth >= policy.depth ? 0 : comment === root ? policy.rootReplies : policy.replies
      let count = Math.min(replies.length, cap, budget)
      if (replies.length - count === 1 && replies[count].replyCount === 0 && budget > count) count++
      if (count === 0) continue
      shown.set(comment.id, offset + count)
      budget -= count
      next.push(...replies.slice(0, count).map((reply) => ({ comment: reply, depth: depth + 1 })))
    }
    level = next
  }
  return shown
}
