import { createPdf, finishPdf, pdfTable } from '@/lib/export'
import { formatDate, formatGpa, formatSemesterName } from '@/lib/format'

/** Render a transcript (from store.reports.getTranscript / store.student.getMyTranscript) to PDF. */
export function downloadTranscriptPdf(t = {}, { official = false } = {}) {
  const s = t.student || {}
  const { doc, y: startY } = createPdf({
    title: official ? 'Official Academic Transcript' : 'Academic Transcript (Unofficial)',
    university: t.university,
    subtitle: [
      `Student: ${s.name || '—'}    ID: ${s.studentNumber || '—'}    Programme: ${s.program || '—'}`,
      `Department: ${s.department?.name ?? '—'}    Admission year: ${s.admissionYear || '—'}    Date issued: ${formatDate(t.generatedAt || new Date().toISOString())}`,
    ],
  })
  let y = startY
  const pageH = doc.internal.pageSize.getHeight()
  const semesters = Array.isArray(t.semesters) ? t.semesters : []

  if (semesters.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(10)
    doc.text('No course registrations or grades on record for this student.', 40, y + 10)
    y += 26
  } else {
    for (const sem of semesters) {
      if (y > pageH - 140) {
        doc.addPage()
        y = 50
      }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(formatSemesterName(sem.name), 40, y + 4)
      doc.setFont('helvetica', 'normal')
      const courses = Array.isArray(sem.courses) ? sem.courses : []
      y = pdfTable(doc, {
        startY: y + 10,
        head: ['Code', 'Course title', 'Credits', 'Score', 'Grade', 'Points', 'Note'],
        body: courses.map((c) => [
          c.courseCode || '—',
          c.courseTitle || '—',
          c.creditHours ?? 0,
          c.totalScore ?? '—',
          c.letter || '—',
          c.gradePoints != null ? Number(c.gradePoints).toFixed(2) : '—',
          c.note ?? '',
        ]),
        foot: ['', `Semester GPA ${formatGpa(sem.gpa)}   ·   Cumulative GPA ${formatGpa(sem.cgpa)}`, sem.credits ?? 0, '', '', '', ''],
        columnStyles: { 0: { cellWidth: 55 }, 2: { halign: 'center', cellWidth: 45 }, 3: { halign: 'center', cellWidth: 45 }, 4: { halign: 'center', cellWidth: 42 }, 5: { halign: 'center', cellWidth: 45 } },
      })
      y += 18
    }
  }

  if (y > pageH - 120) {
    doc.addPage()
    y = 50
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  const standingText = t.standing?.label && t.standing.label !== 'Academic Probation' ? `     Standing: ${t.standing.label}` : ''
  doc.text(`Cumulative GPA: ${formatGpa(t.cgpa)}     Credits earned: ${t.earnedCredits ?? 0}${standingText}`, 40, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(110)
  const scale = Array.isArray(t.scale) ? t.scale : []
  if (scale.length > 0) {
    doc.text(`Grading scale: ${scale.map((e) => `${e.letter} ${e.min}–${Math.floor(e.max)} (${e.points ?? e.gradePoints})`).join(', ')}`, 40, y + 20, { maxWidth: doc.internal.pageSize.getWidth() - 80 })
  }
  const repPolicy = t.policy?.repeatPolicy
  doc.text(`Repeated courses: ${repPolicy === 'latest' ? 'latest attempt' : repPolicy === 'highest' ? 'highest attempt' : 'all attempts'} counted in the cumulative GPA. W = Withdrawn, I = Incomplete.`, 40, y + 44)
  if (official && t.university?.registrarName) doc.text(`Registrar: ${t.university.registrarName}`, 40, y + 66)
  finishPdf(doc, `transcript_${s.studentNumber || 'record'}`)
}
