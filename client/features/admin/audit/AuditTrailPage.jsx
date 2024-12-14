import { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Pencil,
  PlusCircle,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import { listAuditLogsApi } from '@/api/audit';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { TableSkeleton } from '@/components/common/Loading';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useQuery } from '@/hooks/useStore';
import { formatDateTime } from '@/lib/format';
import { useWebSocketEvent } from '@/lib/websocket';

const MODULE_NAMES = {
  course: 'Curriculum & Courses',
  offering: 'Course Offerings',
  enrollment: 'Student Enrollment',
  grade_submission: 'Grade Approvals',
  assessment: 'Assessments',
  grade: 'Gradebook & Scoring',
  withdrawal: 'Withdrawal Clearances',
  registration: 'Registration Periods',
  user: 'Account Provisioning',
};

function formatModule(entityType) {
  if (!entityType) return 'Department Operations';
  return (
    MODULE_NAMES[entityType] ||
    entityType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function AuditActionBadge({ action }) {
  const act = String(action || 'other').toLowerCase();
  let icon = <Activity className="w-3.5 h-3.5" />;
  let badgeClass = 'audit-action-badge--other';

  if (act === 'create') {
    icon = <PlusCircle className="w-3.5 h-3.5" />;
    badgeClass = 'audit-action-badge--create';
  } else if (act === 'update') {
    icon = <Pencil className="w-3.5 h-3.5" />;
    badgeClass = 'audit-action-badge--update';
  } else if (act === 'approve') {
    icon = <CheckCircle2 className="w-3.5 h-3.5" />;
    badgeClass = 'audit-action-badge--approve';
  } else if (act === 'reject') {
    icon = <XCircle className="w-3.5 h-3.5" />;
    badgeClass = 'audit-action-badge--reject';
  } else if (act === 'delete') {
    icon = <Trash2 className="w-3.5 h-3.5" />;
    badgeClass = 'audit-action-badge--delete';
  }

  return (
    <span className={`audit-action-badge ${badgeClass}`}>
      {icon}
      {act.toUpperCase()}
    </span>
  );
}

export function AuditTrailPage() {
  // Strictly queries initial Department Head audit logs on load (no polling)
  const {
    data: logsData,
    loading,
    error,
    refetch,
  } = useQuery(
    () =>
      listAuditLogsApi({
        pageSize: 'all',
        actorRole: 'dept_head',
      }),
    [],
  );

  const [items, setItems] = useState([]);

  // Sync initial query response to state
  useEffect(() => {
    if (logsData?.items) {
      setItems(logsData.items);
    }
  }, [logsData]);

  // Pure event-driven WebSocket push: directly prepends incoming entries without REST API polling
  useWebSocketEvent('AUDIT_LOG_CREATED', (newEntry) => {
    if (!newEntry || !newEntry.id) return;
    setItems((prev) => {
      if (prev.some((item) => item.id === newEntry.id)) {
        return prev;
      }
      return [newEntry, ...prev];
    });
  });

  return (
    <div className="audit-page">
      <PageHeader
        title="Audit Trail"
        description="Immutable record of all Department Head activities, curriculum changes, enrollments, and approval workflows across departments."
        centered
      />

      {/* Persistent Table UI with Column Headers */}
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: '200px' }}>Username</TableHead>
                  <TableHead style={{ width: '150px' }}>Role</TableHead>
                  <TableHead style={{ width: '190px' }}>Department</TableHead>
                  <TableHead style={{ width: '120px' }}>Action</TableHead>
                  <TableHead style={{ width: '180px' }}>Module</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead style={{ width: '170px' }}>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !items.length ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="p-8 text-center">
                      <TableSkeleton rows={6} cols={7} />
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="py-16 text-center whitespace-normal">
                      <EmptyState
                        compact
                        icon={ShieldCheck}
                        title="No Department Head activities recorded"
                        description="There are currently no recorded immutable audit log events for Department Heads."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((log) => {
                    const displayName = log.actorName || log.username || 'DH';
                    const initials = displayName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <TableRow key={log.id} className="hover:bg-muted/40 transition-colors">
                      {/* 1. Username */}
                      <TableCell className="align-middle">
                        <div className="audit-actor-cell">
                          <div className="audit-avatar audit-avatar--dept-head">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-mono text-xs font-semibold text-foreground truncate">
                              {log.username || log.actorUsername || '—'}
                            </div>
                            {log.actorName && log.actorName !== (log.username || log.actorUsername) && (
                              <div className="text-[11px] text-muted-foreground truncate">
                                {log.actorName}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* 2. Role */}
                      <TableCell className="align-middle">
                        <Badge variant="primary" className="text-[11px] font-medium whitespace-nowrap">
                          Department Head
                        </Badge>
                      </TableCell>

                      {/* 3. Department */}
                      <TableCell className="align-middle">
                        <div className="text-xs font-medium text-foreground">
                          {log.departmentName || '—'}
                        </div>
                        {log.departmentCode && (
                          <span className="inline-block text-[10px] font-mono text-muted-foreground">
                            [{log.departmentCode}]
                          </span>
                        )}
                      </TableCell>

                      {/* 4. Action */}
                      <TableCell className="align-middle">
                        <AuditActionBadge action={log.action} />
                      </TableCell>

                      {/* 5. Module */}
                      <TableCell className="align-middle">
                        <Badge variant="outline" className="text-[11px] font-medium whitespace-nowrap">
                          {formatModule(log.entityType)}
                        </Badge>
                      </TableCell>

                      {/* 6. Description */}
                      <TableCell className="align-middle">
                        <p className="text-xs text-foreground leading-relaxed">
                          {log.description}
                        </p>
                        {log.details?.remarks && (
                          <p className="text-[11px] text-muted-foreground italic mt-0.5">
                            Note: &ldquo;{log.details.remarks}&rdquo;
                          </p>
                        )}
                      </TableCell>

                      {/* 7. Timestamp */}
                      <TableCell className="align-middle whitespace-nowrap">
                        <div className="font-medium text-xs text-foreground">
                          {formatDateTime(log.createdAt)}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditTrailPage;
