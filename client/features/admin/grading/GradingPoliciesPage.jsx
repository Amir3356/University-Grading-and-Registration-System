import { useMemo, useState, useEffect } from 'react'
import {
  SlidersHorizontal,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Check,
  AlertTriangle,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ErrorState } from '@/components/common/ErrorState'
import { PageSkeleton } from '@/components/common/Loading'
import { useQuery } from '@/hooks/useStore'
import { DEFAULT_GRADE_SCALE, validateGradeScale, DEFAULT_POLICY } from '@/lib/grading'
import { store } from '@/store'

let rowSeq = 0
const withKeys = (entries) =>
  entries.map((e) => ({
    key: e.key || `row-${++rowSeq}`,
    letter: e.letter,
    min: String(e.min ?? e.min_score),
    max: String(e.max ?? e.max_score),
    points: String(e.points ?? e.grade_points),
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

  const initialScale = useMemo(() => data?.scale?.entries ?? DEFAULT_GRADE_SCALE, [data?.scale?.entries])
  const initialPolicy = useMemo(() => ({ ...DEFAULT_POLICY, ...(data?.policy ?? {}) }), [data?.policy])

  const [activeTab, setActiveTab] = useState('scale') // 'scale' | 'policy'
  const [rows, setRows] = useState(() => withKeys([...initialScale].sort((a, b) => b.min - a.min)))
  const [policyForm, setPolicyForm] = useState(initialPolicy)

  // Drawer configuration state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState('scale') // 'scale' | 'policy'
  const [editingGradeKey, setEditingGradeKey] = useState(null)
  const [gradeForm, setGradeForm] = useState(EMPTY_GRADE_FORM)

  const [savingScale, setSavingScale] = useState(false)
  const [savingPolicy, setSavingPolicy] = useState(false)
  const [confirmSaveScale, setConfirmSaveScale] = useState(false)

  // Sync state if remote data changes
  useEffect(() => {
    if (data?.scale?.entries) {
      setRows(withKeys([...data.scale.entries].sort((a, b) => b.min - a.min)))
    }
  }, [data?.scale?.entries])

  useEffect(() => {
    if (data?.policy) {
      setPolicyForm({ ...DEFAULT_POLICY, ...data.policy })
    }
  }, [data?.policy])

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
      .sort((a, b) => b.min - a.min)
      .map((e) => ({
        letter: e.letter,
        min: Number(e.min ?? e.min_score),
        max: Number(e.max ?? e.max_score),
        points: Number(e.points ?? e.grade_points),
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
    setDrawerMode('scale')
    setEditingGradeKey(null)
    setGradeForm(EMPTY_GRADE_FORM)
    setIsDrawerOpen(true)
  }

  // Open Drawer to edit existing grade
  const handleEditGrade = (row) => {
    setDrawerMode('scale')
    setEditingGradeKey(row.key)
    setGradeForm({
      letter: row.letter,
      min: row.min,
      max: row.max,
      points: row.points,
    })
    setIsDrawerOpen(true)
  }

  // Delete grade row from scale
  const handleDeleteGrade = (key) => {
    setRows((prev) => prev.filter((r) => r.key !== key))
    if (editingGradeKey === key) {
      setIsDrawerOpen(false)
    }
    toast.success('Grade band removed from scale.')
  }

  // Open Drawer to configure academic policy
  const handleOpenPolicyConfig = () => {
    setDrawerMode('policy')
    setPolicyForm({ ...DEFAULT_POLICY, ...(data?.policy ?? {}) })
    setIsDrawerOpen(true)
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
    const payloadEntries = rows.map((r) => ({
      letter: r.letter.trim(),
      min: Number(r.min),
      max: Number(r.max),
      points: Number(r.points),
    }))

    const errs = validateGradeScale(payloadEntries)
    if (errs.length > 0) {
      toast.error('Please resolve scale validation errors before saving.')
      return false
    }

    setSavingScale(true)
    try {
      await store.grades.updateGradeScale(payloadEntries)
      toast.success('Grading scale successfully saved and activated.')
      refetch()
      setConfirmSaveScale(false)
      return true
    } catch (err) {
      toast.error(err?.message || 'Failed to save grading scale.')
      return false
    } finally {
      setSavingScale(false)
    }
  }

  // Save policy to backend
  const handleSavePolicyForm = async (e) => {
    e.preventDefault()
    setSavingPolicy(true)
    try {
      await store.grades.updatePolicy({
        passMark: parseFloat(policyForm.passMark),
        probationGpa: parseFloat(policyForm.probationGpa),
        honorsGpa: parseFloat(policyForm.honorsGpa),
        repeatPolicy: policyForm.repeatPolicy,
        incompletePolicy: policyForm.incompletePolicy,
        withdrawalPolicy: policyForm.withdrawalPolicy,
        requireWeightsTotal100: Boolean(policyForm.requireWeightsTotal100),
        approvalWorkflowEnabled: Boolean(policyForm.approvalWorkflowEnabled),
      })
      toast.success('Academic policy rules successfully saved.')
      refetch()
      setIsDrawerOpen(false)
    } catch (err) {
      toast.error(err?.message || 'Failed to update academic policy.')
    } finally {
      setSavingPolicy(false)
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
          Configure the university grading scale, letter boundaries, grade points, and academic performance rules.
        </p>
      </div>

      {/* Main Workspace Layout */}
      <div className="semester-reg-layout">
        {/* Left Column: Grade Scale Table & Policy View */}
        <div className="semester-reg-main">
          <section className="reg-card">
            <div className="reg-card__header">
              <div className="reg-card__tabs">
                <button
                  type="button"
                  className={`reg-tab-btn ${activeTab === 'scale' ? 'reg-tab-btn--active' : ''}`}
                  onClick={() => {
                    setActiveTab('scale')
                    if (isDrawerOpen && drawerMode !== 'scale') setIsDrawerOpen(false)
                  }}
                >
                  Grading Scale ({rows.length})
                </button>
                <button
                  type="button"
                  className={`reg-tab-btn ${activeTab === 'policy' ? 'reg-tab-btn--active' : ''}`}
                  onClick={() => {
                    setActiveTab('policy')
                    if (isDrawerOpen && drawerMode !== 'policy') setIsDrawerOpen(false)
                  }}
                >
                  Academic Policy Rules
                </button>
              </div>

              {activeTab === 'scale' ? (
                <button
                  type="button"
                  className="reg-btn-primary"
                  onClick={handleOpenNewGrade}
                >
                  <Plus size={16} aria-hidden="true" />
                  Configure Grade Scale
                </button>
              ) : (
                <button
                  type="button"
                  className="reg-btn-primary"
                  onClick={handleOpenPolicyConfig}
                >
                  <SlidersHorizontal size={16} aria-hidden="true" />
                  Configure Academic Policy
                </button>
              )}
            </div>

            {/* Tab 1: Grading Scale Table */}
            {activeTab === 'scale' && (
              <>
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
                              {Number(r.points).toFixed(2)}
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
                                  onClick={() => handleDeleteGrade(r.key)}
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

                {/* Validation Errors Alert */}
                {scaleErrors.length > 0 && (
                  <div className="mt-4 p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm flex items-start gap-2.5">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold">The grading scale requires adjustments:</p>
                      <ul className="list-disc pl-4 mt-1.5 space-y-1 text-xs">
                        {scaleErrors.map((err) => (
                          <li key={err}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Save Scale Footer */}
                <div className="mt-4 pt-3 border-t flex items-center justify-between flex-wrap gap-2">
                  <div>
                    {dirtyScale ? (
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400 inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                        Unsaved changes in grading scale
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">All scale changes saved</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="reg-btn-primary"
                    disabled={scaleErrors.length > 0 || !dirtyScale || savingScale}
                    onClick={() => setConfirmSaveScale(true)}
                  >
                    <Save size={16} aria-hidden="true" />
                    {savingScale ? 'Saving...' : 'Save & Apply Scale'}
                  </button>
                </div>
              </>
            )}

            {/* Tab 2: Academic Policy Rules */}
            {activeTab === 'policy' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div className="p-3.5 rounded-xl border bg-background/50">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pass Mark</p>
                    <p className="text-xl font-bold mt-1 text-foreground">{policyForm.passMark}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Minimum score required to earn course credit.</p>
                  </div>

                  <div className="p-3.5 rounded-xl border bg-background/50">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Academic Probation</p>
                    <p className="text-xl font-bold mt-1 text-destructive">{policyForm.probationGpa} CGPA</p>
                    <p className="text-xs text-muted-foreground mt-1">Threshold triggering academic probation standing.</p>
                  </div>

                  <div className="p-3.5 rounded-xl border bg-background/50">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dean&apos;s List / Honors</p>
                    <p className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{policyForm.honorsGpa} CGPA</p>
                    <p className="text-xs text-muted-foreground mt-1">Threshold for graduation honors and distinction.</p>
                  </div>

                  <div className="p-3.5 rounded-xl border bg-background/50">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Repeat Policy</p>
                    <p className="text-base font-semibold mt-1 capitalize text-foreground">
                      Keep {policyForm.repeatPolicy === 'highest' ? 'Highest Attempt' : policyForm.repeatPolicy === 'all' ? 'All Attempts' : 'Latest Attempt'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">How repeated course attempts factor into cumulative GPA.</p>
                  </div>

                  <div className="p-3.5 rounded-xl border bg-background/50">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Incomplete (&apos;I&apos;) Policy</p>
                    <p className="text-base font-semibold mt-1 text-foreground">
                      {policyForm.incompletePolicy === 'as_fail' ? 'Count as Fail (0.00 pts)' : 'Exclude from GPA'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">How unresolved incomplete grades affect semester GPA.</p>
                  </div>

                  <div className="p-3.5 rounded-xl border bg-background/50">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Withdrawal (&apos;W&apos;) Policy</p>
                    <p className="text-base font-semibold mt-1 text-foreground">
                      {policyForm.withdrawalPolicy === 'as_fail' ? 'Count as Fail (0.00 pts)' : 'Exclude from GPA'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Impact of official course withdrawal on GPA calculations.</p>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    className="reg-btn-primary"
                    onClick={handleOpenPolicyConfig}
                  >
                    <SlidersHorizontal size={16} aria-hidden="true" />
                    Configure Academic Policy
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Configure Side Drawer (Exact match to Registration Periods) */}
        {isDrawerOpen && (
          <aside className="semester-reg-drawer">
            <div className="reg-drawer-card">
              <div className="reg-drawer-header">
                <h3 className="reg-drawer-title">
                  {drawerMode === 'scale'
                    ? editingGradeKey
                      ? `Edit Grade ${gradeForm.letter}`
                      : 'Configure Grade Entry'
                    : 'Configure Academic Policy'}
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
              {drawerMode === 'scale' && (
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
                      placeholder="e.g. 4.00"
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
              )}

              {/* Policy Drawer Form */}
              {drawerMode === 'policy' && (
                <form onSubmit={handleSavePolicyForm} className="reg-form">
                  <div className="reg-form-group">
                    <label className="reg-form-label" htmlFor="policy-pass-mark">
                      Minimum Pass Mark (%) <span className="reg-required">*</span>
                    </label>
                    <input
                      id="policy-pass-mark"
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      className="reg-search-input"
                      value={policyForm.passMark}
                      onChange={(e) => setPolicyForm((f) => ({ ...f, passMark: e.target.value }))}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="reg-form-group">
                      <label className="reg-form-label" htmlFor="policy-probation-gpa">
                        Probation CGPA <span className="reg-required">*</span>
                      </label>
                      <input
                        id="policy-probation-gpa"
                        type="number"
                        step="0.05"
                        min="0"
                        max="4"
                        className="reg-search-input"
                        value={policyForm.probationGpa}
                        onChange={(e) => setPolicyForm((f) => ({ ...f, probationGpa: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="reg-form-group">
                      <label className="reg-form-label" htmlFor="policy-honors-gpa">
                        Honors CGPA <span className="reg-required">*</span>
                      </label>
                      <input
                        id="policy-honors-gpa"
                        type="number"
                        step="0.05"
                        min="0"
                        max="4"
                        className="reg-search-input"
                        value={policyForm.honorsGpa}
                        onChange={(e) => setPolicyForm((f) => ({ ...f, honorsGpa: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="reg-form-group">
                    <label className="reg-form-label" htmlFor="policy-repeat">
                      Course Repeat Policy
                    </label>
                    <select
                      id="policy-repeat"
                      className="reg-form-select"
                      value={policyForm.repeatPolicy}
                      onChange={(e) => setPolicyForm((f) => ({ ...f, repeatPolicy: e.target.value }))}
                    >
                      <option value="latest">Keep Latest Attempt</option>
                      <option value="highest">Keep Highest Attempt</option>
                      <option value="all">Keep All Attempts in CGPA</option>
                    </select>
                  </div>

                  <div className="reg-form-group">
                    <label className="reg-form-label" htmlFor="policy-incomplete">
                      Incomplete (&apos;I&apos;) Grade Rule
                    </label>
                    <select
                      id="policy-incomplete"
                      className="reg-form-select"
                      value={policyForm.incompletePolicy}
                      onChange={(e) => setPolicyForm((f) => ({ ...f, incompletePolicy: e.target.value }))}
                    >
                      <option value="exclude">Exclude from GPA (Standard)</option>
                      <option value="as_fail">Count as Failing Mark (0.00 GP)</option>
                    </select>
                  </div>

                  <div className="reg-form-group">
                    <label className="reg-form-label" htmlFor="policy-withdrawal">
                      Withdrawal (&apos;W&apos;) Grade Rule
                    </label>
                    <select
                      id="policy-withdrawal"
                      className="reg-form-select"
                      value={policyForm.withdrawalPolicy}
                      onChange={(e) => setPolicyForm((f) => ({ ...f, withdrawalPolicy: e.target.value }))}
                    >
                      <option value="exclude">Exclude from GPA (Standard)</option>
                      <option value="as_fail">Count as Failing Mark (0.00 GP)</option>
                    </select>
                  </div>

                  <div className="reg-info-callout">
                    <Info className="reg-info-callout__icon" aria-hidden="true" />
                    <p className="reg-info-callout__text">
                      Changes to passing thresholds, repeat logic, and standing limits apply universally to transcripts, GPA summaries, and report generation.
                    </p>
                  </div>

                  <div className="reg-drawer-actions">
                    <button type="submit" className="reg-save-btn" disabled={savingPolicy}>
                      <Save size={16} aria-hidden="true" />
                      {savingPolicy ? 'Saving...' : 'Save Academic Policy'}
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
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Confirmation Dialog for Scale Save */}
      <ConfirmDialog
        open={confirmSaveScale}
        onOpenChange={setConfirmSaveScale}
        title="Save and activate grading scale?"
        description="The new scale applies to all letter grades and GPA calculations computed from now on, including students' cumulative GPAs. Submitted grades keep their assigned letter."
        confirmLabel="Save & Apply Scale"
        onConfirm={handleSaveScale}
      />
    </div>
  )
}

export default GradingPoliciesPage
