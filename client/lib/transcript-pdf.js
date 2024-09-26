import { createPdf, finishPdf, pdfTable } from '@/lib/export'
import { formatDate, formatGpa, formatSemesterName } from '@/lib/format'

/** Render a transcript (from store.reports.getTranscript / store.student.getMyTranscript) to PDF. */
export function downloadTranscriptPdf(t, { official = false } = {}) {
  const s = t.student
  const { doc, y: startY } = createPdf({
    title: official ? 'Official Academic Transcript' : 'Academic Transcript (Unofficial)',
    university: t.university,
    subtitle: [
      `Student: ${s.name}    ID: ${s.studentNumber}    Programme: ${s.program}`,
      `Department: ${s.department?.name ?? '—'}    Admission year: ${s.admissionYear}    Date issued: ${formatDate(t.generatedAt)}`,
    ],
  })
  let y = startY
  const pageH = doc.internal.pageSize.getHeight()
  for (const sem of t.semesters) {
    if (y > pageH - 140) {
      doc.addPage()
      y = 50
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(formatSemesterName(sem.name), 40, y + 4)
    doc.setFont('helvetica', 'normal')
    y = pdfTable(doc, {
      startY: y + 10,
      head: ['Code', 'Course title', 'Credits', 'Score', 'Grade', 'Points', 'Note'],
      body: sem.courses.map((c) => [c.courseCode, c.courseTitle, c.creditHours, c.totalScore ?? '—', c.letter, c.gradePoints != null ? c.gradePoints.toFixed(2) : '—', c.note ?? '']),
      foot: ['', `Semester GPA ${formatGpa(sem.gpa)}   ·   Cumulative GPA ${formatGpa(sem.cgpa)}`, sem.credits, '', '', '', ''],
      columnStyles: { 0: { cellWidth: 55 }, 2: { halign: 'center', cellWidth: 45 }, 3: { halign: 'center', cellWidth: 45 }, 4: { halign: 'center', cellWidth: 42 }, 5: { halign: 'center', cellWidth: 45 } },
    })
    y += 18
  }
  if (y > pageH - 120) {
    doc.addPage()
    y = 50
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(`Cumulative GPA: ${formatGpa(t.cgpa)}     Credits earned: ${t.earnedCredits}     Standing: ${t.standing.label}`, 40, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(110)
  doc.text(`Grading scale: ${t.scale.map((e) => `${e.letter} ${e.min}–${Math.floor(e.max)} (${e.points})`).join(', ')}`, 40, y + 20, { maxWidth: doc.internal.pageSize.getWidth() - 80 })
  doc.text(`Repeated courses: ${t.policy.repeatPolicy === 'latest' ? 'latest attempt' : t.policy.repeatPolicy === 'highest' ? 'highest attempt' : 'all attempts'} counted in the cumulative GPA. W = Withdrawn, I = Incomplete.`, 40, y + 44)
  if (official) doc.text(`Registrar: ${t.university.registrarName}`, 40, y + 66)
  finishPdf(doc, `transcript_${s.studentNumber}`)
}
