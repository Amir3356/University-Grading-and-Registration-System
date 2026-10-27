import { useMemo, useState, useEffect } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ErrorState } from '@/components/common/ErrorState'
import { PageSkeleton } from '@/components/common/Loading'
import { useQuery } from '@/hooks/useStore'
import { DEFAULT_GRADE_SCALE, formatGradePoints, validateGradeScale } from '@/lib/grading'
import { store } from '@/store'

let rowSeq = 0
const withKeys = (entries) =>
  entries.map((e) => ({
    key: e.key || `row-${++rowSeq}`,
    letter: e.letter,
    min: String(e.min ?? e.minScore ?? e.min_score ?? 0),
    max: String(e.max ?? e.maxScore ?? e.max_score ?? 100),
    points: String(e.points ?? e.gradePoints ?? e.grade_points ?? 0),
  }))

const EMPTY_GRADE_FORM = {
  letter: '',
  min: '',
  max: '',
  points: '',
}

export function GradingPoliciesPage() {
  const { data, loading, error, refetch } = useQuery(
    () => store.grades.getGradingConfig(),
    [],
    { live: false }
  )

  const initialScale = useMemo(() => {
    const list = data?.scale?.entries
    return Array.isArray(list) && list.length > 0 ? list : DEFAULT_GRADE_SCALE
  }, [data?.scale?.entries])

  const [rows, setRows] = useState(() =>
    withKeys(
      [...initialScale].sort(
        (a, b) => Number(b.min ?? b.minScore ?? 0) - Number(a.min ?? a.minScore ?? 0)
      )
    )
  )

  // Drawer configuration state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingGradeKey, setEditingGradeKey] = useState(null)
  const [gradeForm, setGradeForm] = useState(EMPTY_GRADE_FORM)

  const [savingScale, setSavingScale] = useState(false)
  const [gradeToDelete, setGradeToDelete] = useState(null)
  const [deletingGrade, setDeletingGrade] = useState(false)

  // Sync state if remote data changes
  useEffect(() => {
    const list = data?.scale?.entries
    if (Array.isArray(list) && list.length > 0) {
      setRows(
        withKeys(
          [...list].sort(
            (a, b) => Number(b.min ?? b.minScore ?? 0) - Number(a.min ?? a.minScore ?? 0)
          )
        )
      )
    }
  }, [data?.scale?.entries])

  // Scale validation
  const entries = useMemo(
    () =>
      rows.map((r) => ({
        letter: r.letter.trim(),
        min: Number(r.min),
        max: Number(r.max),
        points: Number(r.points),
      })),
    [rows]
  )

  const blank = rows.some((r) => r.min === '' || r.max === '' || r.points === '')
  const scaleErrors = useMemo(() => {
    const list = validateGradeScale(entries)
    if (blank) list.unshift('Every row needs a minimum, maximum and grade points value.')
    if (entries.some((e) => [e.min, e.max, e.points].some((n) => Number.isNaN(n)))) {
      list.unshift('Bounds and grade points must be numbers.')
    }
    return [...new Set(list)]
  }, [entries, blank])

  const dirtyScale = useMemo(() => {
    const originalSorted = [...initialScale]
      .sort((a, b) => Number(b.min ?? b.minScore ?? 0) - Number(a.min ?? a.minScore ?? 0))
      .map((e) => ({
        letter: e.letter,
        min: Number(e.min ?? e.minScore ?? e.min_score ?? 0),
        max: Number(e.max ?? e.maxScore ?? e.max_score ?? 0),
        points: Number(e.points ?? e.gradePoints ?? e.grade_points ?? 0),
      }))

    const currentSorted = rows
      .map((r) => ({
        letter: r.letter.trim(),
        min: Number(r.min),
        max: Number(r.max),
        points: Number(r.points),
      }))
      .sort((a, b) => b.min - a.min)

    return JSON.stringify(originalSorted) !== JSON.stringify(currentSorted)
  }, [rows, initialScale])

  // Open Drawer to configure new grade
  const handleOpenNewGrade = () => {
    setEditingGradeKey(null)
    setGradeForm(EMPTY_GRADE_FORM)
    setIsDrawerOpen(true)
  }

  // Open Drawer to edit existing grade
  const handleEditGrade = (row) => {
    setEditingGradeKey(row.key)
    setGradeForm({
      letter: row.letter,
      min: row.min,
      max: row.max,
      points: formatGradePoints(row.points),
    })
    setIsDrawerOpen(true)
  }

  // Prompt to delete grade row with database persistence
  const handlePromptDeleteGrade = (row) => {
    setGradeToDelete(row)
  }

  // Confirm delete grade row and persist to database
  const handleConfirmDeleteGrade = async () => {
    if (!gradeToDelete) return false
    const targetKey = gradeToDelete.key
    const sorted = [...rows].sort((a, b) => Number(b.min) - Number(a.min))
    const targetIdx = sorted.findIndex((r) => r.key === targetKey)
    if (targetIdx === -1) {
      setGradeToDelete(null)
      return true
    }

    const target = sorted[targetIdx]
    const nextRows = sorted.filter((r) => r.key !== targetKey)

    // Bridge score boundaries so the scale remains continuous (0..100) without gaps
    if (nextRows.length > 0) {
      if (targetIdx === 0) {
        // Highest grade deleted: expand next grade's max to 100
        nextRows[0] = { ...nextRows[0], max: target.max }
      } else if (targetIdx === sorted.length - 1) {
        // Lowest grade deleted: expand previous grade's min to 0
        nextRows[nextRows.length - 1] = {
          ...nextRows[nextRows.length - 1],
          min: target.min,
        }
      } else {
        // Middle grade deleted: expand the grade below it up to target's max
        nextRows[targetIdx] = {
          ...nextRows[targetIdx],
          max: target.max,
        }
      }
    }

    const payloadEntries = nextRows.map((r) => ({
      letter: r.letter.trim(),
      min: Number(r.min),
      max: Number(r.max),
      points: Number(r.points),
    }))

    setDeletingGrade(true)
    try {
      await store.grades.updateGradeScale(payloadEntries)
      setRows(withKeys(nextRows))
      if (editingGradeKey === targetKey) {
        setIsDrawerOpen(false)
      }
      toast.success(`Grade '${gradeToDelete.letter}' permanently deleted from database.`)
      refetch()
      setGradeToDelete(null)
      return true
    } catch (err) {
      toast.error(err?.message || `Failed to delete grade '${gradeToDelete.letter}'.`)
      return false
    } finally {
      setDeletingGrade(false)
    }
  }

  // Save grade form from drawer
  const handleSaveGradeForm = (e) => {
    e.preventDefault()
    const letter = gradeForm.letter.trim().toUpperCase()
    const min = parseFloat(gradeForm.min)
    const max = parseFloat(gradeForm.max)
    const points = parseFloat(gradeForm.points)

    if (!letter) {
      toast.error('Grade letter cannot be empty.')
      return
    }
    if (isNaN(min) || isNaN(max) || min < 0 || max > 100 || min > max) {
      toast.error('Score bounds must be valid numbers between 0 and 100 (Min <= Max).')
      return
    }
    if (isNaN(points) || points < 0 || points > 5) {
      toast.error('Grade points must be between 0.00 and 5.00.')
      return
    }

    const duplicate = rows.find(
      (r) => r.letter.toUpperCase() === letter && r.key !== editingGradeKey
    )
    if (duplicate) {
      toast.error(`A grade band with letter '${letter}' already exists.`)
      return
    }

    const nextEntry = {
      letter,
      min: String(min),
      max: String(max),
      points: String(points),
    }

    if (editingGradeKey) {
      setRows((prev) =>
        prev
          .map((r) => (r.key === editingGradeKey ? { ...r, ...nextEntry } : r))
          .sort((a, b) => Number(b.min) - Number(a.min))
      )
      toast.success(`Grade ${letter} updated in scale.`)
    } else {
      setRows((prev) =>
        [...prev, { key: `row-${Date.now()}-${Math.random()}`, ...nextEntry }].sort(
          (a, b) => Number(b.min) - Number(a.min)
        )
      )
      toast.success(`Grade ${letter} added to scale.`)
    }

    setIsDrawerOpen(false)
  }

  // Save scale to backend
  const handleSaveScale = async () => {
    if (scaleErrors.length > 0) {
      toast.error(scaleErrors[0] || 'Please resolve scale validation errors before saving.')
      return false
    }

    const payloadEntries = rows.map((r) => ({
      letter: r.letter.trim(),
      min: Number(r.min),
      max: Number(r.max),
      points: Number(r.points),
    }))

    const errs = validateGradeScale(payloadEntries)
    if (errs.length > 0) {
      toast.error(errs[0] || 'Please resolve scale validation errors before saving.')
      return false
    }

    setSavingScale(true)
    try {
      await store.grades.updateGradeScale(payloadEntries)
      toast.success('Grading scale successfully saved and applied.', {
        description: 'The updated scale is now active across the university system.',
        duration: 3000,
      })
      refetch()
      return true
    } catch (err) {
      toast.error(err?.message || 'Failed to save grading scale.', {
        duration: 3000,
      })
      return false
    } finally {
      setSavingScale(false)
    }
  }

  if (loading && !data) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  return (
    <div className="semester-reg-page">
      {/* Header */}
      <div className="semester-reg-header">
        <h1 className="semester-reg-header__title">Grading Policies & Scale Management</h1>
        <p className="semester-reg-header__subtitle">
          Configure the university grading scale, letter boundaries, and grade points.
        </p>
      </div>

      {/* Main Workspace Layout */}
      <div className="semester-reg-layout">
        {/* Left Column: Grade Scale Table */}
        <div className="semester-reg-main">
          <section className="reg-card">
            <div className="reg-card__header">
              <h2 className="reg-card__title">Grading Scale ({rows.length})</h2>
              <button
                type="button"
                className="reg-btn-primary"
                onClick={handleOpenNewGrade}
              >
                <Plus size={16} aria-hidden="true" />
                Configure Grade Scale
              </button>
            </div>

            {/* Grading Scale Table */}
            <div className="reg-table-container">
              <table className="reg-table">
                <thead>
                  <tr>
                    <th style={{ width: '48px' }}>No</th>
                    <th>Grade Letter</th>
                    <th>Score Range</th>
                    <th>Grade Points</th>
                    <th style={{ textAlign: 'right', width: '130px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-foreground)' }}
                      >
                        No grade bands in scale. Click &quot;Configure Grade Scale&quot; to add grades.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, i) => (
                      <tr key={r.key}>
                        <td className="tabular text-muted-foreground">{i + 1}</td>
                        <td>
                          <span className="font-bold text-base tracking-tight">{r.letter}</span>
                        </td>
                        <td className="tabular font-medium">
                          {r.min}% – {r.max}%
                        </td>
                        <td className="tabular font-semibold text-primary">
                          {formatGradePoints(r.points)}
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              className="reg-action-trigger"
                              onClick={() => handleEditGrade(r)}
                              aria-label={`Edit ${r.letter}`}
                            >
                              <Pencil size={13} aria-hidden="true" />
                              Edit
                            </button>
                            <button
                              type="button"
                              className="reg-action-delete"
                              onClick={() => handlePromptDeleteGrade(r)}
                              aria-label={`Delete ${r.letter}`}
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Save Scale Footer */}
            <div className="mt-4 pt-3 border-t flex items-center justify-end flex-wrap gap-2">
              <button
                type="button"
                className="reg-btn-primary"
                disabled={savingScale}
                onClick={handleSaveScale}
              >
                <Save size={16} aria-hidden="true" />
                {savingScale ? 'Saving...' : 'Save & Apply Scale'}
              </button>
            </div>
          </section>
        </div>

        {/* Right Column: Configure Side Drawer */}
        {isDrawerOpen && (
          <aside className="semester-reg-drawer">
            <div className="reg-drawer-card">
              <div className="reg-drawer-header">
                <h3 className="reg-drawer-title">
                  {editingGradeKey
                    ? `Edit Grade ${gradeForm.letter}`
                    : 'Configure Grade Entry'}
                </h3>
                <button
                  type="button"
                  className="reg-drawer-close"
                  onClick={() => setIsDrawerOpen(false)}
                  aria-label="Close configuration panel"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              {/* Scale Drawer Form */}
              <form onSubmit={handleSaveGradeForm} className="reg-form">
                <div className="reg-form-group">
                  <label className="reg-form-label" htmlFor="reg-grade-letter">
                    Grade Letter <span className="reg-required">*</span>
                  </label>
                  <input
                    id="reg-grade-letter"
                    type="text"
                    className="reg-search-input"
                    value={gradeForm.letter}
                    onChange={(e) => setGradeForm((f) => ({ ...f, letter: e.target.value.toUpperCase() }))}
                    placeholder="e.g. A+, A, B"
                    maxLength={3}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="reg-form-group">
                    <label className="reg-form-label" htmlFor="reg-grade-min">
                      Min Score (%) <span className="reg-required">*</span>
                    </label>
                    <input
                      id="reg-grade-min"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className="reg-search-input"
                      value={gradeForm.min}
                      onChange={(e) => setGradeForm((f) => ({ ...f, min: e.target.value }))}
                      placeholder="e.g. 85"
                      required
                    />
                  </div>

                  <div className="reg-form-group">
                    <label className="reg-form-label" htmlFor="reg-grade-max">
                      Max Score (%) <span className="reg-required">*</span>
                    </label>
                    <input
                      id="reg-grade-max"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className="reg-search-input"
                      value={gradeForm.max}
                      onChange={(e) => setGradeForm((f) => ({ ...f, max: e.target.value }))}
                      placeholder="e.g. 89.99"
                      required
                    />
                  </div>
                </div>

                <div className="reg-form-group">
                  <label className="reg-form-label" htmlFor="reg-grade-points">
                    Grade Points (0.00 – 5.00) <span className="reg-required">*</span>
                  </label>
                  <input
                    id="reg-grade-points"
                    type="number"
                    step="0.01"
                    min="0"
                    max="5"
                    className="reg-search-input"
                    value={gradeForm.points}
                    onChange={(e) => setGradeForm((f) => ({ ...f, points: e.target.value }))}
                    placeholder="e.g. 4.0"
                    required
                  />
                </div>

                {/* Drawer Actions */}
                <div className="reg-drawer-actions">
                  <button type="submit" className="reg-save-btn">
                    <Check size={16} aria-hidden="true" />
                    {editingGradeKey ? 'Apply Grade Changes' : 'Add to Grade Scale'}
                  </button>
                  <button
                    type="button"
                    className="reg-cancel-btn"
                    onClick={() => setIsDrawerOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </aside>
        )}
      </div>


      {/* Confirmation Dialog for Grade Deletion */}
      <ConfirmDialog
        open={Boolean(gradeToDelete)}
        onOpenChange={(open) => !open && setGradeToDelete(null)}
        title={gradeToDelete ? `Delete Grade '${gradeToDelete.letter}'?` : 'Delete Grade?'}
        description={
          gradeToDelete
            ? `Are you sure you want to permanently delete grade '${gradeToDelete.letter}' (${gradeToDelete.min}% – ${gradeToDelete.max}%, ${formatGradePoints(gradeToDelete.points)} pts) from the database? Adjacent grade boundaries will automatically adjust to preserve a complete 0–100 scale.`
            : 'Are you sure you want to delete this grade band?'
        }
        confirmLabel={deletingGrade ? 'Deleting…' : 'Delete Grade'}
        variant="destructive"
        onConfirm={handleConfirmDeleteGrade}
      />
    </div>
  )
}

export default GradingPoliciesPage
