import * as gbService from '../services/gradebookService.js';
import { sendSuccess } from '../utils/response.js';

export async function getGradebook(req, res, next) {
  try {
    const gradebook = await gbService.getGradebook(req.params.id, req.user);
    sendSuccess(res, gradebook);
  } catch (err) {
    next(err);
  }
}

export async function saveScores(req, res, next) {
  try {
    const { changes, reason } = req.body;
    const result = await gbService.saveScores(req.params.id, { changes, reason }, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function clearScores(req, res, next) {
  try {
    const { assessmentId } = req.body;
    const result = await gbService.clearScores(req.params.id, assessmentId, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getGradeHistory(req, res, next) {
  try {
    const history = await gbService.getGradeHistory(req.params.id);
    sendSuccess(res, history);
  } catch (err) {
    next(err);
  }
}

export async function exportGradebook(req, res, next) {
  try {
    const gradebook = await gbService.getGradebook(req.params.id, req.user);
    // Build CSV
    const headers = ['Student ID', 'Student Name'];
    for (const a of gradebook.assessments) {
      headers.push(`${a.name} (${a.weight}%)`);
    }
    headers.push('Running %', 'Letter');

    const lines = [headers.join(',')];
    for (const row of gradebook.rows) {
      const line = [
        row.student.studentNumber,
        `"${row.student.name.replace(/"/g, '""')}"`,
      ];
      for (const a of gradebook.assessments) {
        const val = row.marks?.[a.id];
        line.push(val !== undefined && val !== null ? val : '');
      }
      line.push(row.runningPercent !== null ? row.runningPercent : '');
      line.push(row.letter || '');
      lines.push(line.join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="gradebook_${req.params.id}.csv"`);
    res.status(200).send(lines.join('\n'));
  } catch (err) {
    next(err);
  }
}

export async function importScores(req, res, next) {
  try {
    const { records, dryRun, reason } = req.body;
    const result = await gbService.importScores(req.params.id, { records, dryRun, reason }, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getOfferingPerformance(req, res, next) {
  try {
    const performance = await gbService.getOfferingPerformance(req.params.id);
    sendSuccess(res, performance);
  } catch (err) {
    next(err);
  }
}
