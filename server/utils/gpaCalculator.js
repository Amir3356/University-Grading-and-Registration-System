export function roundTo2(num) {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

export function computeEnrollmentScore(assessments, scoreMap, scaleEntries, passMark = 50) {
  let weightedTotal = 0;
  let enteredWeightSum = 0;
  let enteredCount = 0;
  const totalWeight = assessments.reduce((sum, a) => sum + Number(a.weight), 0);

  for (const a of assessments) {
    const mark = scoreMap[a.id];
    if (mark !== undefined && mark !== null && mark !== '') {
      const numericMark = Number(mark);
      const contribution = (numericMark / Number(a.maxMarks)) * Number(a.weight);
      weightedTotal += contribution;
      enteredWeightSum += Number(a.weight);
      enteredCount++;
    }
  }

  weightedTotal = roundTo2(weightedTotal);
  const complete = assessments.length > 0 && enteredCount === assessments.length;
  const runningPercent = enteredWeightSum > 0 ? roundTo2((weightedTotal / enteredWeightSum) * 100) : 0;

  let letter = null;
  let gradePoints = null;
  let passed = null;

  if (scaleEntries && scaleEntries.length > 0) {
    const sorted = [...scaleEntries].sort(
      (a, b) => Number(b.minScore ?? b.min ?? 0) - Number(a.minScore ?? a.min ?? 0)
    );
    const matched =
      sorted.find((e) => weightedTotal >= Number(e.minScore ?? e.min ?? 0)) ||
      sorted[sorted.length - 1];
    if (matched) {
      letter = matched.letter;
      gradePoints = Number(matched.gradePoints ?? matched.points ?? 0);
    }
  }

  if (letter !== null) {
    passed = weightedTotal >= Number(passMark);
  }

  return {
    weightedTotal,
    enteredWeightSum,
    enteredCount,
    complete,
    runningPercent,
    letter,
    gradePoints,
    passed,
  };
}

export function getAcademicStanding(cgpa, honorsGpa = 3.5, probationGpa = 2.0) {
  if (cgpa === null || cgpa === undefined || Number.isNaN(Number(cgpa))) {
    return { label: 'Good Standing', tone: 'default' };
  }
  const val = Number(cgpa);
  if (val >= Number(honorsGpa)) {
    return { label: "Dean's List", tone: 'success' };
  }
  if (val < Number(probationGpa)) {
    return { label: 'Academic Probation', tone: 'warning' };
  }
  return { label: 'Good Standing', tone: 'default' };
}

export function computeGpa(gradesWithCredits) {
  let totalQualityPoints = 0;
  let totalCredits = 0;

  for (const g of gradesWithCredits) {
    if (g.countsInGpa && g.gradePoints !== null && g.gradePoints !== undefined) {
      const cr = Number(g.creditHours);
      const gp = Number(g.gradePoints);
      totalQualityPoints += gp * cr;
      totalCredits += cr;
    }
  }

  const gpa = totalCredits > 0 ? roundTo2(totalQualityPoints / totalCredits) : 0;
  return {
    gpa,
    qualityPoints: roundTo2(totalQualityPoints),
    gpaCredits: totalCredits,
  };
}
