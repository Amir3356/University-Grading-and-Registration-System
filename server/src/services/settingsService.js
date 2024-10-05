import * as setRepo from '../repositories/settingsRepository.js';
import { ValidationError } from '../utils/errors.js';

export async function getFullSettings() {
  return await setRepo.getFullSettings();
}

export async function updateUniversitySettings(data, caller) {
  const { name, shortName, motto, address, email, phone, website, registrarName } = data;
  const fieldErrors = {};

  if (!name || !String(name).trim()) fieldErrors.name = 'University name is required.';
  if (!shortName || !String(shortName).trim()) fieldErrors.shortName = 'Short name / acronym is required.';
  if (!email || !String(email).trim()) fieldErrors.email = 'Official contact email is required.';
  if (!registrarName || !String(registrarName).trim()) fieldErrors.registrarName = 'Registrar name is required.';

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('Validation failed for university settings.', fieldErrors);
  }

  return await setRepo.updateUniversitySettings({
    name: name.trim(),
    shortName: shortName.trim(),
    motto: motto ? motto.trim() : null,
    address: address ? address.trim() : null,
    email: email.trim(),
    phone: phone ? phone.trim() : null,
    website: website ? website.trim() : null,
    registrarName: registrarName.trim(),
    userId: caller.id,
  });
}

export async function getGradingConfig() {
  return await setRepo.getGradingConfig();
}

export async function updateGradeScale({ entries }, caller) {
  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    throw new ValidationError('Grade scale entries are required.', {
      scale: ['At least one scale entry is required.'],
    });
  }

  const scaleErrors = [];
  const lettersSeen = new Set();

  // Normalize entries
  const norm = entries.map((e) => ({
    letter: (e.letter || '').trim(),
    min: parseFloat(e.min ?? e.minScore),
    max: parseFloat(e.max ?? e.maxScore),
    points: parseFloat(e.points ?? e.gradePoints),
  }));

  for (const e of norm) {
    if (!e.letter) {
      scaleErrors.push('Letter grade cannot be empty.');
    } else if (lettersSeen.has(e.letter.toUpperCase())) {
      scaleErrors.push(`Duplicate letter grade '${e.letter}'.`);
    } else {
      lettersSeen.add(e.letter.toUpperCase());
    }

    if (isNaN(e.min) || isNaN(e.max) || e.min < 0 || e.max > 100 || e.min > e.max) {
      scaleErrors.push(`Invalid score range for ${e.letter || 'entry'}: [${e.min}, ${e.max}]. Range must be between 0 and 100.`);
    }

    if (isNaN(e.points) || e.points < 0 || e.points > 5) {
      scaleErrors.push(`Grade points for ${e.letter || 'entry'} must be between 0 and 5.`);
    }
  }

  // Sort by min asc
  norm.sort((a, b) => a.min - b.min);

  if (norm.length > 0) {
    if (norm[0].min !== 0) {
      scaleErrors.push(`Scale must start at 0 (currently starts at ${norm[0].min}).`);
    }
    if (norm[norm.length - 1].max !== 100) {
      scaleErrors.push(`Scale must end at 100 (currently ends at ${norm[norm.length - 1].max}).`);
    }

    for (let i = 0; i < norm.length - 1; i++) {
      const current = norm[i];
      const next = norm[i + 1];
      if (current.max < next.min) {
        scaleErrors.push(`Gap detected between ${current.letter} (ends at ${current.max}) and ${next.letter} (starts at ${next.min}).`);
      } else if (current.max > next.min) {
        scaleErrors.push(`Overlap detected between ${current.letter} (max ${current.max}) and ${next.letter} (min ${next.min}).`);
      }
    }
  }

  if (scaleErrors.length > 0) {
    throw new ValidationError('Grade scale validation failed.', { scale: scaleErrors });
  }

  return await setRepo.saveNewScaleVersion({ entries: norm, userId: caller.id });
}

export async function updateAcademicPolicy(data, caller) {
  const {
    passMark,
    approvalWorkflowEnabled,
    repeatPolicy,
    incompletePolicy,
    withdrawalPolicy,
    probationGpa,
    honorsGpa,
    requireWeightsTotal100,
    atRiskMargin,
    excludedCourseIds,
  } = data;

  return await setRepo.updateAcademicPolicy({
    passMark: passMark !== undefined ? parseFloat(passMark) : undefined,
    approvalWorkflowEnabled: approvalWorkflowEnabled !== undefined ? Boolean(approvalWorkflowEnabled) : undefined,
    repeatPolicy,
    incompletePolicy,
    withdrawalPolicy,
    probationGpa: probationGpa !== undefined ? parseFloat(probationGpa) : undefined,
    honorsGpa: honorsGpa !== undefined ? parseFloat(honorsGpa) : undefined,
    requireWeightsTotal100: requireWeightsTotal100 !== undefined ? Boolean(requireWeightsTotal100) : undefined,
    atRiskMargin: atRiskMargin !== undefined ? parseFloat(atRiskMargin) : undefined,
    excludedCourseIds,
    userId: caller.id,
  });
}
