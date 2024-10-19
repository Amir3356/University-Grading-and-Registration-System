import { GraduationCap } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { NAVIGATION } from '@/routes/navigation'

export function SidebarNav({ collapsed = false, badges = {}, onNavigate }) {
  const { user } = useAuth()
  const location = useLocation()
  const sections = NAVIGATION[user?.roleId] ?? []
  return (
    <nav aria-label="Main navigation" className="sidebar__nav">
      {sections.map((section) => (
        <div key={section.section} className="sidebar__section">
          {!collapsed && <p className="sidebar__section-title">{section.section}</p>}
          <ul className="sidebar__list">
            {section.items.map((item) => {
              const badge = item.badgeKey ? badges[item.badgeKey] : null
              const isCurrent = location.pathname === item.to || (item.to !== '/admin' && location.pathname.startsWith(item.to))
              const link = (
                <NavLink to={item.to} end={item.end} onClick={onNavigate} className="sidebar__link">
                  <item.icon aria-hidden="true" />
                  {!collapsed && <span className="sidebar__link-text">{item.label}</span>}
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
                    <>
                      {link}
                      {isCurrent && item.children && !collapsed && (
                        <ul className="sidebar__sublist">
                          {item.children.map((child) => (
                            <li key={child.label}>
                              <NavLink
                                to={child.to}
                                className={({ isActive }) =>
                                  `sidebar__sublink ${isActive ? 'sidebar__sublink--active' : ''}`
                                }
                                onClick={onNavigate}
                              >
                                <span className="sidebar__subdot">•</span>
                                <span>{child.label}</span>
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
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

export function Sidebar({ badges }) {
  return (
    <aside className="sidebar no-print" aria-label="Sidebar">
      <Brand />
      <SidebarNav badges={badges} />
    </aside>
  )
}
