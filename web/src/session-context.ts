import { createContext, useContext } from 'react'
import type { Session, UserBase } from './api/types'
export type SessionState<U extends UserBase = UserBase> = Session<U> & {
  loading: boolean
  error: string
  // A method, so a site's SessionState<User> fits the shared context.
  setSession(session: Session<U>): void
  logout: () => Promise<void>
}
export const SessionContext = createContext<SessionState | null>(null)
/** A site calls this with its own User, which its SessionProvider puts in the context. */
export function useSession<U extends UserBase = UserBase>() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('SessionProvider missing')
  return value as SessionState<U>
}
