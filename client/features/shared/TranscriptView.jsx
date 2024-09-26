import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/common/EmptyState'
import { GradeBadge } from '@/components/common/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatGpa, formatSemesterName } from '@/lib/format'

/** Read-only transcript rendering shared by the admin and student transcript pages. */
export function TranscriptView({ transcript: t }) {
  const s = t.student
  return (
    <div className="stack stack--lg">
      <Card>
        <CardContent className="transcript-summary">
          <div>
            <p className="text-xs text-muted">Student</p>
            <p className="font-semibold">{s.name}</p>
            <p className="text-sm text-muted">{s.studentNumber}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Programme</p>
            <p className="font-medium">{s.program}</p>
            <p className="text-sm text-muted">{s.department?.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Cumulative GPA</p>
            <p className="big-number">{formatGpa(t.cgpa)}</p>
            <Badge variant={t.standing.tone === 'danger' ? 'danger' : t.standing.tone === 'success' ? 'success' : 'secondary'}>{t.standing.label}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted">Credits earned</p>
            <p className="big-number">{t.earnedCredits}</p>
            <p className="text-sm text-muted">Issued {formatDate(t.generatedAt)}</p>
          </div>
        </CardContent>
      </Card>

      {t.semesters.length === 0 ? (
        <Card>
          <EmptyState title="No published results yet" description="Results appear here once grades have been approved and published." />
        </Card>
      ) : (
        t.semesters.map((sem) => (
          <Card key={sem.semesterId} className="card--table">
            <CardHeader>
              <CardTitle>{formatSemesterName(sem.name)}</CardTitle>
              <p className="tabular text-sm text-muted">
                GPA <strong>{formatGpa(sem.gpa)}</strong> · CGPA <strong>{formatGpa(sem.cgpa)}</strong>
              </p>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead className="num">Credits</TableHead>
                  <TableHead className="num">Score</TableHead>
                  <TableHead className="center">Grade</TableHead>
                  <TableHead className="num">Points</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sem.courses.map((c) => (
                  <TableRow key={c.courseCode + sem.semesterId}>
                    <TableCell className="font-medium">{c.courseCode}</TableCell>
                    <TableCell className="wrap">{c.courseTitle}</TableCell>
                    <TableCell className="num">{c.creditHours}</TableCell>
                    <TableCell className="num">{c.totalScore ?? '—'}</TableCell>
                    <TableCell className="center">
                      <GradeBadge letter={c.letter} />
                    </TableCell>
                    <TableCell className="num">{c.gradePoints != null ? c.gradePoints.toFixed(2) : '—'}</TableCell>
                    <TableCell className="text-xs text-muted">{c.note ?? (c.isRepeat ? 'Repeat attempt' : '')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>Semester totals (GPA credits)</TableCell>
                  <TableCell className="num">{sem.credits}</TableCell>
                  <TableCell colSpan={2} />
                  <TableCell className="num">{sem.qualityPoints?.toFixed(2)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </Card>
        ))
      )}
    </div>
  )
}
