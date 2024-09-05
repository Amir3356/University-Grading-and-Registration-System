import { useState } from 'react'
import { BarChart3, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/common/EmptyState'

/**
 * Card wrapper for a chart with a chart/table toggle (accessible data view).
 * tableColumns: [{key, header, format?}]  tableRows: array of objects
 */
export function ChartCard({ title, description, children, tableColumns, tableRows, height = 260, empty, emptyText = 'No data to display yet.', actions, className }) {
  const [view, setView] = useState('chart')
  const canToggle = Boolean(tableColumns && tableRows)
  return (
    <Card className={className}>
      <CardHeader>
        <div className="grow">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <div className="cluster cluster--xs">
          {actions}
          {canToggle && !empty && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setView((v) => (v === 'chart' ? 'table' : 'chart'))}
              aria-label={view === 'chart' ? 'Show data table' : 'Show chart'}
              title={view === 'chart' ? 'Show data table' : 'Show chart'}
            >
              {view === 'chart' ? <Table2 /> : <BarChart3 />}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {empty ? (
          <EmptyState compact title={emptyText} />
        ) : view === 'table' && canToggle ? (
          <div className="chart-table" style={{ maxHeight: height }}>
            <Table>
              <TableHeader>
                <TableRow>
                  {tableColumns.map((c) => (
                    <TableHead key={c.key}>{c.header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.map((r, i) => (
                  <TableRow key={i}>
                    {tableColumns.map((c) => (
                      <TableCell key={c.key} className="tabular">
                        {c.format ? c.format(r[c.key], r) : (r[c.key] ?? '—')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div style={{ height }} className="chart-box">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
