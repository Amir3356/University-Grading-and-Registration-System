import * as setService from '../services/settingsService.js';
import { query } from '../config/database.js';

export async function getFullSettings(req, res, next) {
  try {
    const settings = await setService.getFullSettings();
    res.status(200).json(settings);
  } catch (err) {
    next(err);
  }
}

export async function updateUniversitySettings(req, res, next) {
  try {
    const settings = await setService.updateUniversitySettings(req.body, req.user);
    res.status(200).json(settings);
  } catch (err) {
    next(err);
  }
}

export async function getGradingConfig(req, res, next) {
  try {
    const config = await setService.getGradingConfig();
    res.status(200).json(config);
  } catch (err) {
    next(err);
  }
}

export async function updateGradeScale(req, res, next) {
  try {
    const scale = await setService.updateGradeScale(req.body, req.user);
    res.status(200).json(scale);
  } catch (err) {
    next(err);
  }
}

export async function updateAcademicPolicy(req, res, next) {
  try {
    const policy = await setService.updateAcademicPolicy(req.body, req.user);
    res.status(200).json(policy);
  } catch (err) {
    next(err);
  }
}

export async function backupSystem(req, res, next) {
  try {
    const uni = await query(`SELECT * FROM university_settings WHERE id = 1`);
    const pol = await query(`SELECT * FROM academic_policies WHERE id = 1`);
    const sc = await query(`SELECT * FROM grade_scales WHERE is_active = true`);
    const depts = await query(`SELECT * FROM departments`);
    const progs = await query(`SELECT * FROM programs`);
    const courses = await query(`SELECT * FROM courses`);
    const sems = await query(`SELECT * FROM semesters`);

    const backupData = {
      timestamp: new Date().toISOString(),
      university: uni.rows[0],
      policy: pol.rows[0],
      activeScale: sc.rows[0],
      departments: depts.rows,
      programs: progs.rows,
      courses: courses.rows,
      semesters: sems.rows,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="system_backup_${Date.now()}.json"`);
    res.status(200).json(backupData);
  } catch (err) {
    next(err);
  }
}

export async function resetDemoData(req, res, next) {
  try {
    const { runSeed } = await import('../scripts/seed.js');
    await runSeed();
    res.status(200).json({ ok: true, message: 'Database reseeded successfully.' });
  } catch (err) {
    next(err);
  }
}
