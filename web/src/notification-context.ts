import { createContext, useContext } from 'react'
import type { ReactNode, RefObject } from 'react'
export type NoticeKind = 'error' | 'success' | 'info'
export type Notification = {
  message: ReactNode
  kind: NoticeKind
  title: string
  /** Where focus goes when the notice closes: the control the action came from. */
  finalFocus?: RefObject<HTMLElement | null>
}
export const NotificationContext = createContext<{
  publish: (id: string, notice: Notification) => void
  dismiss: (id: string) => void
  notify: (
    message: ReactNode,
    kind?: NoticeKind,
    title?: string,
    finalFocus?: RefObject<HTMLElement | null>,
  ) => void
} | null>(null)
export function useNotification() {
  const context = useContext(NotificationContext)
  if (!context) throw new Error('NotificationProvider missing')
  return context
}
