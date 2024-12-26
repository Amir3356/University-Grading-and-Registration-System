import { useMemo, useState } from 'react'
import {
  FileDown,
  UserMinus,
  UserPlus,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { FilterSelect } from '@/components/common/FilterSelect'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { PageSkeleton } from '@/components/common/Loading'
import { ChartCard } from '@/components/charts/ChartCard'
import {
  axisProps,
  barRadiusHorizontal,
  gridProps,
  legendProps,
  lineCursor,
  tooltipProps,
} from '@/components/charts/chart-theme'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { formatSemesterName } from '@/lib/format'
import { downloadRegistrationReportPdf } from '@/lib/registration-report-pdf'
import { useWebSocketEvent } from '@/lib/websocket'
import { store } from '@/store'
import { KpiCard } from './KpiCard'

const REG_COLOR = 'var(--chart-1)'
const WD_COLOR = 'var(--chart-2)'
const ALL = ''

const numberFmt = new Intl.NumberFormat('en-US')
const formatNumber = (n) => numberFmt.format(n)

/**
 * Registration & withdrawal report (admin) with semester filter, charts and PDF download.
 * Fetches real operational metrics directly from the backend API.
 */
export function RegistrationReportsView({ description, university }) {
  const lookups = useLookups()
  const [semesterId, setSemesterId] = useState(null)
  const activeSemester = semesterId ?? ALL

  const semestersList = useMemo(() => {
    const list = Array.isArray(lookups?.semesters) ? lookups.semesters : []
    return list.map((s) => ({
      value: s.id,
      label: formatSemesterName(s.name),
    }))
  }, [lookups?.semesters])

  const activeSemesterLabel =
    activeSemester === ALL
      ? 'All semesters'
      : semestersList.find((s) => s.value === activeSemester)?.label ?? '—'

  const { data: apiData, loading, error, refetch } = useQuery(
    () =>
      store.reports.getWithdrawalRegistrationReportData(
        activeSemester ? { semesterId: activeSemester } : {}
      ),
    [activeSemester],
  )

  useWebSocketEvent('REGISTRATION_CHANGED', () => refetch())
  useWebSocketEvent('WITHDRAWAL_APPROVED', () => refetch())
  useWebSocketEvent('WITHDRAWAL_UPDATED', () => refetch())

  const report = useMemo(() => {
    if (!apiData) return null
    const regCount = Number(apiData.registrations?.period?.total ?? 0)
    const wdCount = Number(apiData.withdrawals?.period?.total ?? 0)
    const net = regCount - wdCount
    const rate = regCount ? (wdCount / regCount) * 100 : 0

    const trend = Array.isArray(apiData.trend)
      ? apiData.trend.map((t) => ({
          label: t.date || t.label || '',
          registrations: Number(t.registrations ?? 0),
          withdrawals: Number(t.withdrawals ?? 0),
        }))
      : []

    const deptMap = new Map()
    if (Array.isArray(apiData.registrations?.byDepartment)) {
      for (const d of apiData.registrations.byDepartment) {
        deptMap.set(d.department, { name: d.department, registrations: Number(d.count ?? 0), withdrawals: 0 })
      }
    }
    const breakdownRows = Array.from(deptMap.values())

    const withdrawalReasons = Array.isArray(apiData.withdrawals?.byCategory)
      ? apiData.withdrawals.byCategory.map((c) => ({
          reason: c.category || c.reason || 'Other',
          count: Number(c.count ?? 0),
        }))
      : []

    const recentRegs = (apiData.registrations?.recent || []).map((r) => ({
      id: `reg-${r.id}`,
      student: r.studentName || 'Student',
      studentId: r.studentNumber || '—',
      course: r.registrationType || r.departmentName || 'Semester Registration',
      type: 'registration',
      when: r.submittedAt ? r.submittedAt.slice(0, 10) : '—',
    }))

    const recentWdrs = (apiData.withdrawals?.recent || []).map((w) => ({
      id: `wdr-${w.id}`,
      student: w.studentName || 'Student',
      studentId: w.studentNumber || '—',
      course: w.reasonCategory || w.reason || w.scope || 'Withdrawal',
      type: 'withdrawal',
      when: w.submittedAt ? w.submittedAt.slice(0, 10) : '—',
    }))

    const recentActivity = [...recentRegs, ...recentWdrs].slice(0, 10)

    return {
      kpis: {
        registrations: { value: regCount, change: null },
        withdrawals: { value: wdCount, change: null },
        net: { value: net, change: null },
        rate: { value: rate, change: null },
      },
      trend,
      breakdown: { title: 'By department', dimension: 'Department', rows: breakdownRows },
      withdrawalReasons,
      recentActivity,
    }
  }, [apiData])

  const handleDownload = () => {
    if (!report) return
    try {
      downloadRegistrationReportPdf(report, {
        semesterLabel: activeSemesterLabel,
        university,
      })
      toast.success('Report downloaded as PDF.')
    } catch (err) {
      toast.error(err.message || 'Could not generate the PDF.')
    }
  }

  if (loading && !apiData) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={refetch} title="Could not load registration report" />

  return (
    <div className="rpt">
      <PageHeader title="Reports" description={description} centered />

      <div className="rpt-toolbar" style={{ justifyContent: 'flex-end' }}>
        <div className="rpt-filters" style={{ width: 'auto', marginLeft: 'auto', justifyContent: 'flex-end' }}>
          <div className="rpt-filters__field">
            <FilterSelect
              value={activeSemester}
              onChange={(v) => setSemesterId(v)}
              options={semestersList}
              allLabel="All semesters"
              label="Semester"
              className="rpt-filters__select"
              align="end"
            />
          </div>
          <Button type="button" className="rpt-filters__download" onClick={handleDownload} disabled={!report}>
            <FileDown /> Download PDF
          </Button>
        </div>
      </div>

      {!report || (!report.kpis.registrations.value && !report.kpis.withdrawals.value) ? (
        <Card>
          <CardContent>
            <EmptyState
              title="No registration or withdrawal activity"
              description="No registration or withdrawal records found for the selected semester."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="rpt-kpis" aria-label="Key figures">
            <KpiCard
              label="Registrations"
              value={formatNumber(report.kpis.registrations.value)}
              icon={UserPlus}
              tone="reg"
              change={report.kpis.registrations.change}
              hint={activeSemester === ALL ? 'All time records' : activeSemesterLabel}
            />
            <KpiCard
              label="Withdrawals"
              value={formatNumber(report.kpis.withdrawals.value)}
              icon={UserMinus}
              tone="wd"
              change={report.kpis.withdrawals.change}
              invert
              hint={activeSemester === ALL ? 'All time records' : activeSemesterLabel}
            />
          </section>

          <ChartCard
            title="Registrations vs. withdrawals"
            description="Daily totals across departments"
            height={320}
            empty={!report.trend.length}
            emptyText="No registrations or withdrawals recorded for this semester."
            tableColumns={[
              { key: 'label', header: 'Date' },
              { key: 'registrations', header: 'Registrations', format: formatNumber },
              { key: 'withdrawals', header: 'Withdrawals', format: formatNumber },
            ]}
            tableRows={report.trend}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={report.trend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="rpt-reg-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={REG_COLOR} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={REG_COLOR} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rpt-wd-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={WD_COLOR} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={WD_COLOR} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} minTickGap={16} />
                <YAxis {...axisProps} allowDecimals={false} width={48} />
                <Tooltip {...tooltipProps} cursor={lineCursor} formatter={(v) => formatNumber(v)} />
                <Legend {...legendProps} />
                <Area
                  type="monotone"
                  dataKey="registrations"
                  name="Registrations"
                  stroke={REG_COLOR}
                  strokeWidth={2}
                  fill="url(#rpt-reg-fill)"
                  activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }}
                />
                <Area
                  type="monotone"
                  dataKey="withdrawals"
                  name="Withdrawals"
                  stroke={WD_COLOR}
                  strokeWidth={2}
                  fill="url(#rpt-wd-fill)"
                  activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="rpt-grid">
            <ChartCard
              title={report.breakdown.title}
              description={`Registrations and withdrawals per ${report.breakdown.dimension.toLowerCase()}`}
              height={300}
              empty={!report.breakdown.rows.length}
              emptyText="No departmental registration activity recorded."
              tableColumns={[
                { key: 'name', header: report.breakdown.dimension },
                { key: 'registrations', header: 'Registrations', format: formatNumber },
                { key: 'withdrawals', header: 'Withdrawals', format: formatNumber },
              ]}
              tableRows={report.breakdown.rows}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.breakdown.rows} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
                  <CartesianGrid {...gridProps} vertical horizontal={false} />
                  <XAxis type="number" {...axisProps} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" {...axisProps} width={112} />
                  <Tooltip {...tooltipProps} formatter={(v) => formatNumber(v)} />
                  <Legend {...legendProps} />
                  <Bar dataKey="registrations" name="Registrations" fill={REG_COLOR} radius={barRadiusHorizontal} maxBarSize={14} />
                  <Bar dataKey="withdrawals" name="Withdrawals" fill={WD_COLOR} radius={barRadiusHorizontal} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Withdrawal reasons"
              description="Why students withdrew"
              height={300}
              empty={!report.withdrawalReasons.length}
              emptyText="No withdrawals recorded for this semester."
              tableColumns={[
                { key: 'reason', header: 'Reason' },
                { key: 'count', header: 'Withdrawals', format: formatNumber },
              ]}
              tableRows={report.withdrawalReasons}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.withdrawalReasons} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid {...gridProps} vertical horizontal={false} />
                  <XAxis type="number" {...axisProps} allowDecimals={false} />
                  <YAxis type="category" dataKey="reason" {...axisProps} width={128} />
                  <Tooltip {...tooltipProps} formatter={(v) => [formatNumber(v), 'Withdrawals']} />
                  <Bar
                    dataKey="count"
                    name="Withdrawals"
                    fill={WD_COLOR}
                    radius={barRadiusHorizontal}
                    maxBarSize={18}
                    label={{ position: 'right', fill: 'var(--muted-foreground)', fontSize: 12 }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  )
}
