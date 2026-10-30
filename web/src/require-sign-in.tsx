import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { ArrowRightIcon as ArrowRight } from '@phosphor-icons/react'
import { buttonVariants } from './components/ui/button'
import { EmptyState } from './components/empty-state'
import { loginPath } from './components/vote-control'
import { useSession } from './session-context'

// A layout route for pages that need a signed-in user: in their place it asks the visitor to
// sign in, and signing in comes back to the page.
export function RequireSignIn() {
  const { t } = useTranslation()
  const session = useSession()
  const location = useLocation()
  if (session.loading) return <p role="status">{t('messages.loadingAccount')}</p>
  if (!session.user)
    return (
      <EmptyState title={t('messages.signInRequired')}>
        <Link
          className={buttonVariants({ variant: 'default', size: 'default' })}
          to={loginPath(location)}
        >
          {t('messages.signIn')}
          <ArrowRight size={16} />
        </Link>
      </EmptyState>
    )
  return <Outlet />
}
