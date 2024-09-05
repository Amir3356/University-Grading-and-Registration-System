// Client-side exports: CSV, Excel (.xlsx) and PDF.
// columns: [{ header, value: (row) => any }]
import { autoTable } from 'jspdf-autotable'
import { jsPDF } from 'jspdf'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

const stamp = () => new Date().toISOString().slice(0, 10)
const safe = (name) => `${String(name).replace(/[^\w.-]+/g, '_')}_${stamp()}`

function toMatrix(columns, rows) {
  return rows.map((r) => columns.map((c) => {
    const v = c.value(r)
    return v == null ? '' : v
  }))
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportCsv(filename, columns, rows) {
  const csv = Papa.unparse({ fields: columns.map((c) => c.header), data: toMatrix(columns, rows) })
  download(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), `${safe(filename)}.csv`)
}

/** sheets: [{ name, columns, rows }] or a single sheet via (filename, columns, rows). */
export function exportExcel(filename, columnsOrSheets, rows) {
  const sheets = rows ? [{ name: 'Report', columns: columnsOrSheets, rows }] : columnsOrSheets
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([s.columns.map((c) => c.header), ...toMatrix(s.columns, s.rows)])
    ws['!cols'] = s.columns.map((c) => ({ wch: Math.max(10, String(c.header).length + 2, c.width ?? 0) }))
    XLSX.utils.book_append_sheet(wb, ws, String(s.name).slice(0, 31))
  }
  XLSX.writeFile(wb, `${safe(filename)}.xlsx`)
}

const NAVY = [30, 58, 95]

/** Create a branded PDF document with a header. Returns { doc, y } where y is the next free line. */
export function createPdf({ title, subtitle, university, orientation = 'portrait' }) {
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' })
  const w = doc.internal.pageSize.getWidth()
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, w, 6, 'F')
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(university?.name ?? 'University Grading System', 40, 40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100)
  if (university?.address) doc.text(`${university.address} · ${university.email ?? ''}`, 40, 54)
  doc.setTextColor(20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(title, 40, 80)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90)
  let y = 94
  if (subtitle) {
    for (const line of [].concat(subtitle)) {
      doc.text(line, 40, y)
      y += 12
    }
  }
  doc.text(`Generated ${new Date().toLocaleString()}`, w - 40, 80, { align: 'right' })
  doc.setTextColor(20)
  return { doc, y: y + 6 }
}

export function pdfTable(doc, { startY, head, body, foot, columnStyles }) {
  autoTable(doc, {
    startY,
    head: [head],
    body,
    foot: foot ? [foot] : undefined,
    theme: 'grid',
    margin: { left: 40, right: 40 },
    styles: { fontSize: 8.5, cellPadding: 4, lineColor: [220, 225, 232], lineWidth: 0.5 },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [238, 242, 247], textColor: 20, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles,
  })
  return doc.lastAutoTable.finalY
}

export function finishPdf(doc, filename) {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(130)
    const w = doc.internal.pageSize.getWidth()
    const h = doc.internal.pageSize.getHeight()
    doc.text(`Page ${i} of ${pages}`, w - 40, h - 20, { align: 'right' })
  }
  doc.save(`${safe(filename)}.pdf`)
}

/** Simple tabular PDF export. */
export function exportPdf({ filename, title, subtitle, columns, rows, university, orientation }) {
  const { doc, y } = createPdf({ title, subtitle, university, orientation: orientation ?? (columns.length > 6 ? 'landscape' : 'portrait') })
  pdfTable(doc, { startY: y, head: columns.map((c) => c.header), body: toMatrix(columns, rows) })
  finishPdf(doc, filename)
}

/** Parse a CSV File into an array of objects keyed by header. */
export function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
      complete: (res) => (res.errors.length && !res.data.length ? reject(new Error(res.errors[0].message)) : resolve(res.data)),
      error: reject,
    })
  })
}
