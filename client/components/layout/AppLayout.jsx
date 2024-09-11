import { useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Outlet, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'
import { useQuery } from '@/hooks/useStore'
import { store } from '@/store'
import { Sidebar } from './Sidebar'
import { UserMenu } from './UserMenu'

export function AppLayout() {
  const { user } = useAuth()
  const { theme, toggle } = useTheme()
  const location = useLocation()

  const { data: notif } = useQuery(() => store.notifications.listNotifications({ pageSize: 1 }), [])
  const { data: approvals } = useQuery(() => store.grades.listApprovalRequests({ status: 'pending', pageSize: 1 }), [], { enabled: user?.roleId === 'admin' })
  const badges = { unread: notif?.unreadCount ?? 0, pendingApprovals: approvals?.pendingCount ?? 0 }

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="app">
      <a href="#main" className="sr-only skip-link">
        Skip to content
      </a>
      <Sidebar badges={badges} />

      <div className="app__body">
        <header className="topbar no-print">
          <div className="topbar__actions">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
            <UserMenu />
          </div>
        </header>
        <main id="main" className="app__main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
