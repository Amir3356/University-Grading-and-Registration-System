import { exportCsv, exportExcel, createPdf, savePdf } from '@/lib/export';
import { generateTranscriptPdf } from '@/lib/transcript-pdf';

/**
 * Frontend Export & Document Generation Service
 * Handles CSV, Excel, and PDF compilation for transcripts, grade sheets, and analytical reports.
 */

export function exportTableToCsv(filename, columns, rows) {
  return exportCsv(filename, columns, rows);
}

export function exportTableToExcel(filename, columnsOrSheets, rows) {
  return exportExcel(filename, columnsOrSheets, rows);
}

export function exportTableToPdf(options) {
  const { filename, title, subtitle, university, columns, rows, orientation = 'portrait' } = options;
  const { doc } = createPdf({ title, subtitle, university, orientation });
  // Add table rows
  return savePdf(doc, filename);
}

export function exportStudentTranscriptPdf(record, university) {
  return generateTranscriptPdf(record, university);
}

export { exportCsv, exportExcel, createPdf, savePdf, generateTranscriptPdf };
