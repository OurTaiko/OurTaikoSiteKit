import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, jsonRequest } from './api/client'
import { endpoints } from './api/endpoints'
import type {
  ChartBase,
  Collaboration,
  CollaborationHistory,
  PublicUser,
  UserDirectory,
} from './api/types'
import { isChartOwner } from './chart-owners'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { SearchInput } from './components/search-input'
import { UserAvatar } from './components/user-avatar'
import { formatLocale } from './i18n'
import { Modal, Notice } from './notifications'
import { useSession } from './session-context'
import { useNotification } from './notification-context'

export function CollaborationDialog({
  chart,
  onDismiss,
}: {
  chart: ChartBase
  onDismiss: () => void
}) {
  const { t, i18n } = useTranslation()
  const { csrfToken } = useSession()
  const { notify } = useNotification()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<Collaboration[] | null>(null)
  const [historyError, setHistoryError] = useState('')
  const [revoking, setRevoking] = useState<string | null>(null)
  const [revokeError, setRevokeError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  // Another list no longer shows the selected user.
  const clearSelection = useCallback(() => {
    setSelected(null)
    setError('')
  }, [])
  // The server keeps every invitation, so owners can see whom they invited
  // after the dialog that sent it closes, and other owners' invitations too.
  const loadHistory = useCallback(
    (signal?: AbortSignal) => {
      setHistoryError('')
      return api<CollaborationHistory>(endpoints.collaborations(chart.id), { signal })
        .then((page) => setHistory(page.items))
        .catch((e: Error) => {
          if (!signal?.aborted) setHistoryError(e.message)
        })
    },
    [chart.id],
  )
  useEffect(() => {
    const controller = new AbortController()
    void loadHistory(controller.signal)
    return () => controller.abort()
  }, [loadHistory])
  const pendingIds = new Set(
    history?.filter((item) => item.status === 'pending').map((item) => item.recipient.id),
  )
  const date = (value: string) =>
    new Date(value).toLocaleString(formatLocale(i18n.resolvedLanguage), {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  const statusLabel = {
    pending: t('collaboration.statusPending'),
    accepted: t('collaboration.statusAccepted'),
    declined: t('collaboration.statusDeclined'),
    revoked: t('collaboration.statusRevoked'),
  }
  // Any owner can withdraw a pending invitation; the record stays as revoked.
  const revoke = async (invitation: string) => {
    setRevoking(invitation)
    setRevokeError('')
    try {
      await api(endpoints.collaboration(chart.id, invitation), jsonRequest('DELETE', {}, csrfToken))
      notify(t('collaboration.revokedNotice'), 'success')
    } catch (e) {
      setRevokeError((e as Error).message)
    } finally {
      // Reload either way: the recipient may have answered in the meantime.
      await loadHistory()
      setRevoking(null)
    }
  }
  const invite = async () => {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      await api(
        endpoints.collaborations(chart.id),
        jsonRequest('POST', { userId: selected }, csrfToken),
      )
      setSelected(null)
      notify(t('collaboration.sent'), 'success')
      void loadHistory()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title={t('collaboration.add')}
      onDismiss={onDismiss}
      busy={busy || revoking !== null}
      actions={
        <Button disabled={!selected || busy || pending} onClick={() => void invite()}>
          {t('collaboration.invite')}
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('collaboration.description')}</p>
        {error && <Notice>{error}</Notice>}
        <UserSearch
          disabled={busy}
          pressed={(id) => selected === id}
          note={(user) =>
            isChartOwner(chart, user.id)
              ? t('collaboration.owner')
              : pendingIds.has(user.id)
                ? t('collaboration.pending')
                : null
          }
          onChoose={(user) => setSelected(user.id)}
          onSearch={clearSelection}
          onPendingChange={setPending}
        />
        <section aria-labelledby="collaboration-history" className="space-y-2 border-t pt-4">
          <h3 id="collaboration-history" className="text-sm font-bold">
            {t('collaboration.history')}
          </h3>
          {historyError && <Notice>{historyError}</Notice>}
          {revokeError && <Notice>{revokeError}</Notice>}
          {!history && !historyError && <p role="status">{t('messages.connecting')}</p>}
          {history?.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('collaboration.noHistory')}</p>
          )}
          {history && history.length > 0 && (
            <ul className="max-h-60 space-y-2 overflow-y-auto">
              {history.map((item) => {
                const nickname = item.recipient.nickname || t('messages.unknownMember')
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl bg-muted/40 p-3 text-sm"
                  >
                    <UserAvatar
                      nickname={nickname}
                      avatarUrl={item.recipient.avatarUrl}
                      className="size-8"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{nickname}</span>
                      <span className="block text-xs wrap-anywhere text-muted-foreground">
                        <time dateTime={item.createdAt}>{date(item.createdAt)}</time>
                        {' · '}
                        {t('collaboration.invitedBy', {
                          name: item.inviter.nickname || t('messages.unknownMember'),
                        })}
                        {item.revokedBy &&
                          ` · ${t('collaboration.revokedBy', {
                            name: item.revokedBy.nickname || t('messages.unknownMember'),
                          })}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-2">
                      <Badge
                        variant={
                          item.status === 'pending'
                            ? 'secondary'
                            : item.status === 'accepted'
                              ? 'default'
                              : 'outline'
                        }
                      >
                        {statusLabel[item.status] ?? item.status}
                      </Badge>
                      {item.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={revoking !== null}
                          aria-label={t('collaboration.revokeLabel', { name: nickname })}
                          onClick={() => void revoke(item.id)}
                        >
                          {revoking === item.id
                            ? t('collaboration.revoking')
                            : t('collaboration.revoke')}
                        </Button>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  )
}

/**
 * Searches members by nickname and lists them to choose from. A user with a
 * note cannot be chosen; the note says why.
 */
export function UserSearch({
  pressed,
  note,
  disabled = false,
  onChoose,
  onSearch,
  onPendingChange,
}: {
  pressed: (id: string) => boolean
  note: (user: PublicUser) => string | null
  disabled?: boolean
  onChoose: (user: PublicUser) => void
  /** Another query or page is being loaded: the listed users change. Must be stable. */
  onSearch?: () => void
  /** True while a typed query has not been searched yet. Must be stable. */
  onPendingChange?: (pending: boolean) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<UserDirectory | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setResult(null)
    setError('')
    onSearch?.()
    api<UserDirectory>(endpoints.users({ q: query, sort: 'active', page }), {
      signal: controller.signal,
    })
      .then(setResult)
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message)
      })
    return () => controller.abort()
  }, [query, page, onSearch])
  const changePending = useCallback(
    (value: boolean) => {
      setPending(value)
      onPendingChange?.(value)
    },
    [onPendingChange],
  )
  const search = useCallback((value: string) => {
    setQuery(value)
    setPage(1)
  }, [])
  return (
    <>
      <SearchInput
        value={query}
        label={t('collaboration.search')}
        placeholder={t('collaboration.search')}
        onSearch={search}
        onPendingChange={changePending}
      />
      {error && <Notice>{error}</Notice>}
      {!result && !error && <p role="status">{t('messages.connecting')}</p>}
      {result && (
        <div
          className="max-h-72 space-y-2 overflow-y-auto"
          role="group"
          aria-label={t('collaboration.search')}
        >
          {result.items.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('collaboration.noUsers')}</p>
          )}
          {result.items.map((user) => {
            const reason = note(user)
            const chosen = pressed(user.id)
            return (
              <button
                key={user.id}
                type="button"
                disabled={reason !== null || disabled || pending}
                aria-pressed={chosen}
                onClick={() => onChoose(user)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left active:scale-[0.98] disabled:opacity-50 ${chosen ? 'border-primary bg-primary/5' : 'border-transparent bg-muted/40'}`}
              >
                <UserAvatar
                  nickname={user.nickname || t('messages.unknownMember')}
                  avatarUrl={user.avatarUrl}
                  className="size-8"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {user.nickname || t('messages.unknownMember')}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{user.id}</span>
                </span>
                {reason}
              </button>
            )
          })}
        </div>
      )}
      {result && result.total > result.pageSize && (
        <div className="flex justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1 || disabled || pending}
            onClick={() => setPage(page - 1)}
          >
            {t('messages.previous')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={page * result.pageSize >= result.total || disabled || pending}
            onClick={() => setPage(page + 1)}
          >
            {t('messages.next')}
          </Button>
        </div>
      )}
    </>
  )
}
