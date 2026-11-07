import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, jsonRequest } from './api/client'
import { endpoints } from './api/endpoints'
import type { ChartBase, Collaboration, CollaborationHistory, UserDirectory } from './api/types'
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
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<UserDirectory | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<Collaboration[] | null>(null)
  const [historyError, setHistoryError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    setResult(null)
    setError('')
    setSelected(null)
    api<UserDirectory>(endpoints.users({ q: query, sort: 'active', page }), {
      signal: controller.signal,
    })
      .then(setResult)
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message)
      })
    return () => controller.abort()
  }, [query, page])
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
      busy={busy}
      actions={
        <Button disabled={!selected || busy || pending} onClick={() => void invite()}>
          {t('collaboration.invite')}
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('collaboration.description')}</p>
        <SearchInput
          value={query}
          label={t('collaboration.search')}
          placeholder={t('collaboration.search')}
          onSearch={(value) => {
            setQuery(value)
            setPage(1)
          }}
          onPendingChange={setPending}
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
              const owned = isChartOwner(chart, user.id)
              const invited = pendingIds.has(user.id)
              return (
                <button
                  key={user.id}
                  type="button"
                  disabled={owned || invited || busy || pending}
                  aria-pressed={selected === user.id}
                  onClick={() => setSelected(user.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left active:scale-[0.98] disabled:opacity-50 ${selected === user.id ? 'border-primary bg-primary/5' : 'border-transparent bg-muted/40'}`}
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
                  {owned ? t('collaboration.owner') : invited ? t('collaboration.pending') : null}
                </button>
              )
            })}
          </div>
        )}
        {result && result.total > result.pageSize && (
          <div className="flex justify-between gap-3">
            <Button
              variant="outline"
              disabled={page <= 1 || busy || pending}
              onClick={() => setPage(page - 1)}
            >
              {t('messages.previous')}
            </Button>
            <Button
              variant="outline"
              disabled={page * result.pageSize >= result.total || busy || pending}
              onClick={() => setPage(page + 1)}
            >
              {t('messages.next')}
            </Button>
          </div>
        )}
        <section aria-labelledby="collaboration-history" className="space-y-2 border-t pt-4">
          <h3 id="collaboration-history" className="text-sm font-bold">
            {t('collaboration.history')}
          </h3>
          {historyError && <Notice>{historyError}</Notice>}
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
                      </span>
                    </span>
                    <Badge
                      variant={
                        item.status === 'accepted'
                          ? 'default'
                          : item.status === 'declined'
                            ? 'outline'
                            : 'secondary'
                      }
                    >
                      {statusLabel[item.status] ?? item.status}
                    </Badge>
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
