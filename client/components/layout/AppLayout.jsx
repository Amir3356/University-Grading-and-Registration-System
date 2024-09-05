import { useEffect, useState } from 'react'
import { Menu, Moon, Sun } from 'lucide-react'
import { Outlet, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { useTheme } from '@/context/theme-context'
import { useQuery } from '@/hooks/useStore'
import { store } from '@/store'
import { GlobalSearch } from './GlobalSearch'
import { NotificationsMenu } from './NotificationsMenu'
import { Brand, Sidebar, SidebarNav } from './Sidebar'
import { UserMenu } from './UserMenu'

const COLLAPSE_KEY = 'ugs-sidebar-collapsed'

export function AppLayout() {
  const { user } = useAuth()
  const { theme, toggle } = useTheme()
  const lookups = useLookups()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })

  const { data: notif } = useQuery(() => store.notifications.listNotifications({ pageSize: 1 }), [])
  const { data: approvals } = useQuery(() => store.grades.listApprovalRequests({ status: 'pending', pageSize: 1 }), [], { enabled: user?.roleId === 'admin' })
  const badges = { unread: notif?.unreadCount ?? 0, pendingApprovals: approvals?.pendingCount ?? 0 }

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {
        // ignore
      }
      return !c
    })
  }

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="app">
      <a href="#main" className="sr-only skip-link">
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} badges={badges} />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="sidebar sidebar--drawer">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main navigation menu</SheetDescription>
          <Brand />
          <SidebarNav badges={badges} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="app__body">
        <header className="topbar no-print">
          <Button variant="ghost" size="icon" className="topbar__menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <GlobalSearch />
          <div className="topbar__actions">
            {lookups?.currentSemester && (
              <span className="topbar__semester">{lookups.currentSemester.name}</span>
            )}
            <Button variant="ghost" size="icon" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
            <NotificationsMenu />
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
