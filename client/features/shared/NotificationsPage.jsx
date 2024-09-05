import { useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { TableSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { Pagination } from '@/components/common/Pagination'
import { useQuery, useMutation } from '@/hooks/useStore'
import { formatDateTime, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { store } from '@/store'

const TYPE_LABELS = {
  grade_published: 'Results',
  marks_released: 'Marks',
  grade_rejected: 'Returned',
  grade_attention: 'Attention',
  grade_approved: 'Approved',
  approval_required: 'Approval',
  announcement: 'Announcement',
  assignment: 'Assignment',
  enrollment: 'Enrollment',
  system: 'System',
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const { data, loading, error, refetch } = useQuery(() => store.notifications.listNotifications({ unreadOnly: filter === 'unread', page, pageSize: 15 }), [filter, page])
  const [markAll, { loading: marking }] = useMutation(() => store.notifications.markAllNotificationsRead(), { success: 'All notifications marked as read.' })

  const open = async (n) => {
    if (!n.isRead) await store.notifications.markNotificationRead(n.id)
    if (n.link) navigate(n.link)
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Results, approvals, assignments and announcements."
        actions={
          <Button variant="outline" onClick={() => markAll()} loading={marking} disabled={!data?.unreadCount}>
            <CheckCheck /> Mark all as read
          </Button>
        }
      />
      <Tabs
        value={filter}
        onValueChange={(v) => {
          setFilter(v)
          setPage(1)
        }}
        className="mb-md"
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread {data?.unreadCount ? `(${data.unreadCount})` : ''}</TabsTrigger>
        </TabsList>
      </Tabs>
      {loading && !data ? (
        <TableSkeleton rows={6} cols={1} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !data.items.length ? (
        <Card>
          <EmptyState icon={Bell} title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'} description="You'll be notified about results, approvals and announcements here." />
        </Card>
      ) : (
        <>
          <Card className="card--flush">
            <ul className="list-divided">
              {data.items.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => open(n)} className="list-item">
                    <span className={cn('unread-dot', n.isRead && 'unread-dot--read')} aria-hidden="true" />
                    <span className="grow">
                      <span className="cluster">
                        <span className={cn('text-sm', !n.isRead && 'font-semibold')}>{n.title}</span>
                        <Badge variant="outline">
                          {TYPE_LABELS[n.type] ?? n.type}
                        </Badge>
                        {!n.isRead && <span className="sr-only">Unread</span>}
                      </span>
                      <span className="block text-sm text-muted mt-xs">{n.message}</span>
                    </span>
                    <time className="nowrap text-xs text-muted" dateTime={n.createdAt} title={formatDateTime(n.createdAt)}>
                      {timeAgo(n.createdAt)}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </>
      )}
    </>
  )
}
