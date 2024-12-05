import { useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import {
  CalendarRange,
  FileDown,
  Percent,
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
import { DateInput } from '@/components/common/DateInput'
import { EmptyState } from '@/components/common/EmptyState'
import { ChartCard } from '@/components/charts/ChartCard'
import {
  axisProps,
  barRadiusHorizontal,
  gridProps,
  legendProps,
  lineCursor,
  tooltipProps,
} from '@/components/charts/chart-theme'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadRegistrationReportPdf } from '@/lib/registration-report-pdf'
import { KpiCard } from './KpiCard'
import { PERIOD_OPTIONS } from './periods'
import { buildReport, resolvePeriod } from './reportsMockData'

const REG_COLOR = 'var(--chart-1)'
const WD_COLOR = 'var(--chart-2)'

const numberFmt = new Intl.NumberFormat('en-US')
const formatNumber = (n) => numberFmt.format(n)

/**
 * Registration & withdrawal report (admin) with period filters, charts and PDF download.
 */
export function RegistrationReportsView({ description, university }) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [period, setPeriod] = useState('weekly')
  const [range, setRange] = useState(() => ({
    from: format(subDays(new Date(), 29), 'yyyy-MM-dd'),
    to: today,
  }))

  const resolved = useMemo(() => resolvePeriod(period, range), [period, range])
  const report = useMemo(() => (resolved ? buildReport(resolved) : null), [resolved])

  const rangeInvalid = period === 'custom' && range.from && range.to && range.from > range.to
  const compareHint = period === 'today' ? 'vs yesterday' : 'vs previous period'

  const handleDownload = () => {
    try {
      downloadRegistrationReportPdf(report, {
        periodLabel: PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? period,
        rangeLabel: resolved.rangeLabel,
        granularity: resolved.granularity,
        compareHint,
        university,
      })
      toast.success('Report downloaded as PDF.')
    } catch (err) {
      toast.error(err.message || 'Could not generate the PDF.')
    }
  }

  const periodControls = (
    <div className="rpt-filters">
      <div className="rpt-filters__field">
        <span className="rpt-filters__label">Period</span>
        <FilterSelect
          value={period}
          onChange={setPeriod}
          options={PERIOD_OPTIONS}
          includeAll={false}
          label="Report period"
          className="rpt-filters__select"
          align="end"
        />
      </div>
      {period === 'custom' && (
        <div className="rpt-filters__range">
          <div className="rpt-filters__field">
            <span className="rpt-filters__label">From</span>
            <DateInput value={range.from} onChange={(from) => setRange((r) => ({ ...r, from }))} className="rpt-filters__date" />
          </div>
          <div className="rpt-filters__field">
            <span className="rpt-filters__label">To</span>
            <DateInput
              value={range.to}
              min={range.from || undefined}
              onChange={(to) => setRange((r) => ({ ...r, to }))}
              className="rpt-filters__date"
            />
          </div>
        </div>
      )}
      <Button className="rpt-filters__download" onClick={handleDownload} disabled={!report}>
        <FileDown /> Download PDF
      </Button>
    </div>
  )

  return (
    <div className="rpt">
      <PageHeader title="Reports" description={description} centered actions={periodControls} />

      {resolved && (
        <div className="rpt-context">
          <CalendarRange aria-hidden="true" />
          <span className="rpt-context__range">{resolved.rangeLabel}</span>
          <span className="rpt-context__dot" aria-hidden="true" />
          <span>{resolved.granularity} breakdown</span>
        </div>
      )}

      {!report ? (
        <Card>
          <CardContent>
            <EmptyState
              title={rangeInvalid ? 'The start date is after the end date' : 'Choose a date range'}
              description={
                rangeInvalid
                  ? 'Adjust the From or To date to see the report.'
                  : 'Pick both a From and a To date to generate the report.'
              }
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
              hint={compareHint}
            />
            <KpiCard
              label="Withdrawals"
              value={formatNumber(report.kpis.withdrawals.value)}
              icon={UserMinus}
              tone="wd"
              change={report.kpis.withdrawals.change}
              invert
              hint={compareHint}
            />
            <KpiCard
              label="Withdrawal rate"
              value={`${report.kpis.rate.value.toFixed(1)}%`}
              icon={Percent}
              tone="rate"
              change={report.kpis.rate.change}
              changeSuffix=" pts"
              invert
              hint={compareHint}
            />
          </section>

          <ChartCard
            title="Registrations vs. withdrawals"
            description={`${resolved.granularity} totals for the selected period`}
            height={320}
            tableColumns={[
              { key: 'label', header: 'Period' },
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
              description="Why students withdrew in this period"
              height={300}
              empty={report.kpis.withdrawals.value === 0}
              emptyText="No withdrawals in this period."
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

          <Card className="card--table">
            <CardHeader className="justify-center text-center" style={{ justifyContent: 'center', textAlign: 'center' }}>
              <div className="grow text-center w-full" style={{ width: '100%', textAlign: 'center' }}>
                <CardTitle style={{ textAlign: 'center' }}>Recent activity</CardTitle>
                <CardDescription style={{ textAlign: 'center' }}>Latest registrations and withdrawals in the selected period</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rpt-table">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="rpt-table__when">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.recentActivity.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="rpt-student">
                            <span className="rpt-student__name">{row.student}</span>
                            <span className="rpt-student__id">{row.studentId}</span>
                          </div>
                        </TableCell>
                        <TableCell>{row.course}</TableCell>
                        <TableCell>
                          {row.type === 'registration' ? (
                            <Badge variant="info" className="rpt-type">
                              <UserPlus aria-hidden="true" /> Registration
                            </Badge>
                          ) : (
                            <Badge variant="warning" className="rpt-type">
                              <UserMinus aria-hidden="true" /> Withdrawal
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="rpt-table__when tabular">{row.when}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
