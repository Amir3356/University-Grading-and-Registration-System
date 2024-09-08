import { GraduationCap, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { cn } from '@/lib/utils'
import { NAVIGATION } from '@/routes/navigation'

export function SidebarNav({ collapsed = false, badges = {}, onNavigate }) {
  const { user } = useAuth()
  const sections = NAVIGATION[user?.roleId] ?? []
  return (
    <nav aria-label="Main navigation" className="sidebar__nav">
      {sections.map((section) => (
        <div key={section.section} className="sidebar__section">
          {!collapsed && <p className="sidebar__section-title">{section.section}</p>}
          <ul className="sidebar__list">
            {section.items.map((item) => {
              const badge = item.badgeKey ? badges[item.badgeKey] : null
              const link = (
                <NavLink to={item.to} end={item.end} onClick={onNavigate} className="sidebar__link">
                  <item.icon aria-hidden="true" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {badge > 0 && <span className="sidebar__badge">{badge > 99 ? '99+' : badge}</span>}
                  {collapsed && <span className="sr-only">{item.label}</span>}
                </NavLink>
              )
              return (
                <li key={item.to}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function Brand({ collapsed }) {
  const lookups = useLookups()
  return (
    <div className="sidebar__brand">
      <div className="sidebar__logo">
        <GraduationCap className="icon-md" aria-hidden="true" />
      </div>
      {!collapsed && (
        <div style={{ minWidth: 0, lineHeight: 1.25 }}>
          <p className="sidebar__brand-name truncate">{lookups?.university?.shortName ?? 'UGS'} Grading</p>
          <p className="sidebar__brand-sub truncate">{lookups?.university?.name ?? 'University Grading System'}</p>
        </div>
      )}
    </div>
  )
}

export function SidebarFooter({ collapsed = false, onToggle, onNavigate }) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    onNavigate?.()
    await logout()
    toast.success('You have been signed out.')
    navigate('/login', { replace: true })
  }

  const collapseBtn = onToggle ? (
    <button
      type="button"
      onClick={onToggle}
      className="sidebar__collapse"
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
      {!collapsed && <span>Collapse</span>}
    </button>
  ) : null

  const signoutBtn = (
    <button
      type="button"
      onClick={handleLogout}
      className="sidebar__signout"
      aria-label="Sign out"
    >
      <LogOut aria-hidden="true" />
      {!collapsed && <span>Sign out</span>}
    </button>
  )

  return (
    <div className="sidebar__footer">
      {collapseBtn && (
        collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{collapseBtn}</TooltipTrigger>
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
        ) : (
          collapseBtn
        )
      )}
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{signoutBtn}</TooltipTrigger>
          <TooltipContent side="right">Sign out</TooltipContent>
        </Tooltip>
      ) : (
        signoutBtn
      )}
    </div>
  )
}

export function Sidebar({ collapsed, onToggle, badges }) {
  return (
    <aside className={cn('sidebar no-print', collapsed && 'sidebar--collapsed')} aria-label="Sidebar">
      <Brand collapsed={collapsed} />
      <SidebarNav collapsed={collapsed} badges={badges} />
      <SidebarFooter collapsed={collapsed} onToggle={onToggle} />
    </aside>
  )
}
