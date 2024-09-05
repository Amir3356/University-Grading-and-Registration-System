import { Bell, CheckCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useQuery } from '@/hooks/useStore'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { store } from '@/store'
import { useState } from 'react'

export function NotificationsMenu() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { data } = useQuery(() => store.notifications.listNotifications({ pageSize: 6 }), [])
  const unread = data?.unreadCount ?? 0

  const openItem = async (n) => {
    if (!n.isRead) await store.notifications.markNotificationRead(n.id)
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="notif-trigger" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <Bell />
          {unread > 0 && (
            <span className="notif-count tabular">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="popover--flush notif-panel">
        <div className="notif-panel__header">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => store.notifications.markAllNotificationsRead()}>
              <CheckCheck /> Mark all read
            </Button>
          )}
        </div>
        <ul className="notif-panel__list">
          {!data?.items?.length && <li className="notif-panel__empty">You're all caught up.</li>}
          {data?.items?.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => openItem(n)} className="notif-panel__item">
                <span className="unread-dot" style={n.isRead ? { background: 'transparent' } : undefined} aria-hidden="true" />
                <span style={{ minWidth: 0 }}>
                  <span className={cn('block text-sm', !n.isRead && 'font-medium')}>{n.title}</span>
                  <span className="line-clamp-2 text-xs text-muted">{n.message}</span>
                  <span className="text-xs text-muted mt-xs block">{timeAgo(n.createdAt)}</span>
                </span>
                {!n.isRead && <span className="sr-only">(unread)</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="notif-panel__footer">
          <Button variant="ghost" size="sm" className="btn--block" asChild>
            <Link to="/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
