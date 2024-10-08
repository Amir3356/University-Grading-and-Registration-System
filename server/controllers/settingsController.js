import * as setService from '../services/settingsService.js';
import { sendSuccess } from '../utils/response.js';

export async function getFullSettings(req, res, next) {
  try {
    const settings = await setService.getFullSettings();
    sendSuccess(res, settings);
  } catch (err) {
    next(err);
  }
}

export async function updateUniversitySettings(req, res, next) {
  try {
    const settings = await setService.updateUniversitySettings(req.body, req.user);
    sendSuccess(res, settings);
  } catch (err) {
    next(err);
  }
}

export async function getGradingConfig(req, res, next) {
  try {
    const config = await setService.getGradingConfig();
    sendSuccess(res, config);
  } catch (err) {
    next(err);
  }
}

export async function updateGradeScale(req, res, next) {
  try {
    const scale = await setService.updateGradeScale(req.body, req.user);
    sendSuccess(res, scale);
  } catch (err) {
    next(err);
  }
}

export async function updateAcademicPolicy(req, res, next) {
  try {
    const policy = await setService.updateAcademicPolicy(req.body, req.user);
    sendSuccess(res, policy);
  } catch (err) {
    next(err);
  }
}

export async function backupSystem(req, res, next) {
  try {
    const backupData = await setService.getBackupData();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="system_backup_${Date.now()}.json"`);
    sendSuccess(res, backupData);
  } catch (err) {
    next(err);
  }
}

export async function resetDemoData(req, res, next) {
  try {
    const { runSeed } = await import('../seed/index.js');
    await runSeed();

    sendSuccess(res, { ok: true, message: 'Database reseeded successfully.' });
  } catch (err) {
    next(err);
  }
}
