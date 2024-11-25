import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FormField } from '@/components/common/FormField'
import { formatYearOfStudy, getCourseStudyYear } from '@/lib/format'
import { ASSESSMENT_TYPES, round, sumWeights } from '@/lib/grading'
import { store } from '@/store'
import { typeLabel } from '../lib'

function generateAssessmentName(type, existingList = [], currentId = null) {
  const typeObj = ASSESSMENT_TYPES.find((t) => t.value === type)
  const baseLabel = typeObj ? typeObj.label : (type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Assessment')
  const others = existingList.filter((a) => a.id !== currentId)

  const isTaken = (n) => others.some((a) => a.name?.trim().toLowerCase() === n.toLowerCase())

  if (!isTaken(baseLabel)) {
    return baseLabel
  }

  let index = 2
  while (isTaken(`${baseLabel} ${index}`)) {
    index++
  }
  return `${baseLabel} ${index}`
}

export function AssessmentFormDialog({
  open,
  onOpenChange,
  assessment,
  offering,
  offerings = [],
  existingAssessments = [],
  onSaved,
}) {
  const isEdit = Boolean(assessment)

  // Distinct years of study that the teacher teaches across their course offerings
  const teacherYearOptions = useMemo(() => {
    const list = offerings.length > 0 ? offerings : (offering ? [offering] : [])
    const yearSet = new Set()
    for (const o of list) {
      const y = o?.yearOfStudy ?? o?.year_of_study ?? (o?.course ? getCourseStudyYear(o.course) : null)
      if (y != null && y !== '') {
        yearSet.add(String(y))
      }
    }
    const sorted = Array.from(yearSet).sort((a, b) => Number(a) - Number(b))
    return sorted.map((y) => ({
      value: String(y),
      label: `Year ${y}`,
    }))
  }, [offerings, offering])

  const [selectedYearOfStudy, setSelectedYearOfStudy] = useState('')
  const [selectedOfferingId, setSelectedOfferingId] = useState('')
  const [activeOfferingAssessments, setActiveOfferingAssessments] = useState(existingAssessments)

  const currentActiveOffering = useMemo(() => {
    if (selectedOfferingId) {
      const found = (offerings.length > 0 ? offerings : [offering]).find((o) => o?.id === selectedOfferingId)
      if (found) return found
    }
    return offering || offerings[0] || null
  }, [selectedOfferingId, offerings, offering])

  const coursesForYear = useMemo(() => {
    const list = offerings.length > 0 ? offerings : (offering ? [offering] : [])
    if (!selectedYearOfStudy) return list
    return list.filter((o) => {
      const y = o?.yearOfStudy ?? o?.year_of_study ?? (o?.course ? getCourseStudyYear(o.course) : null)
      return String(y) === String(selectedYearOfStudy)
    })
  }, [offerings, offering, selectedYearOfStudy])

  const otherAssessments = activeOfferingAssessments.filter((a) => a.id !== assessment?.id)
  const otherWeight = sumWeights(otherAssessments)
  const maxAvailableWeight = Math.max(0, round(100 - otherWeight, 2))

  const [form, setForm] = useState({
    type: 'assignment',
    weight: '10',
  })
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    if (open) {
      const targetOff = offering || offerings[0] || null
      const initialOffId = targetOff?.id || ''
      const rawY =
        targetOff?.yearOfStudy ??
        targetOff?.year_of_study ??
        (targetOff?.course ? getCourseStudyYear(targetOff.course) : null)
      const initialYear = rawY != null ? String(rawY) : (teacherYearOptions[0]?.value || '')

      setSelectedOfferingId(initialOffId)
      setSelectedYearOfStudy(initialYear)
      setActiveOfferingAssessments(existingAssessments)

      if (assessment) {
        setForm({
          type: assessment.type || 'assignment',
          weight: String(assessment.weight ?? 10),
        })
      } else {
        const otherW = sumWeights(existingAssessments.filter((a) => a.id !== assessment?.id))
        const avail = Math.max(0, round(100 - otherW, 2))
        const suggestedWeight = avail > 0 ? Math.min(20, avail) : 10
        setForm({
          type: 'assignment',
          weight: String(suggestedWeight),
        })
      }
      setFieldErrors({})
    }
  }, [open, assessment, offering, offerings, existingAssessments, teacherYearOptions])

  // Fetch assessments if a different course offering is selected in the dialog
  useEffect(() => {
    let active = true
    if (!open || isEdit || !selectedOfferingId) return

    if (offering && selectedOfferingId === offering.id) {
      setActiveOfferingAssessments(existingAssessments)
      return
    }

    async function loadAssessments() {
      try {
        const list = await store.grades.listAssessments(selectedOfferingId)
        if (active && Array.isArray(list)) {
          setActiveOfferingAssessments(list)
        }
      } catch {
        if (active) setActiveOfferingAssessments([])
      }
    }
    loadAssessments()
    return () => {
      active = false
    }
  }, [open, isEdit, selectedOfferingId, offering, existingAssessments])

  const handleYearChange = (yearVal) => {
    setSelectedYearOfStudy(yearVal)
    const matching = (offerings.length > 0 ? offerings : [offering]).filter((o) => {
      if (!o) return false
      const y = o.yearOfStudy ?? o.year_of_study ?? (o.course ? getCourseStudyYear(o.course) : null)
      return String(y) === String(yearVal)
    })
    if (matching.length > 0) {
      const currentStillValid = matching.some((o) => o.id === selectedOfferingId)
      if (!currentStillValid) {
        setSelectedOfferingId(matching[0].id)
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFieldErrors({})

    const errors = {}

    if (!form.type) {
      errors.type = 'Assessment type is required.'
    }

    const wt = parseFloat(form.weight)
    if (Number.isNaN(wt) || wt < 0.5 || wt > 100) {
      errors.weight = 'Weight must be between 0.5% and 100%.'
    } else if (otherWeight + wt > 100.001) {
      errors.weight = `Total weights cannot exceed 100%. Remaining weight available: ${maxAvailableWeight}%.`
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      const defaultDate = assessment?.dueDate || assessment?.due_date || new Date().toISOString().slice(0, 10)
      const assignedName =
        isEdit && assessment?.name && assessment.type === form.type
          ? assessment.name
          : generateAssessmentName(form.type, activeOfferingAssessments, assessment?.id)

      // Maximum marks aligns with assessment weight (e.g. 20% weight means max marks is 20)
      const marks = wt

      const payload = {
        name: assignedName,
        type: form.type,
        maxMarks: marks,
        weight: wt,
        dueDate: defaultDate,
        description: assessment?.description || null,
      }

      const targetOfferingId = currentActiveOffering?.id || offering?.id

      if (isEdit) {
        await store.grades.updateAssessment(assessment.id, payload)
        toast.success(`Assessment (${typeLabel(payload.type)}) updated successfully.`)
      } else {
        await store.grades.createAssessment(targetOfferingId, payload)
        toast.success(`Assessment (${typeLabel(payload.type)}) created successfully.`)
      }

      onSaved?.(targetOfferingId)
      onOpenChange(false)
    } catch (err) {
      if (err.fieldErrors) {
        setFieldErrors(err.fieldErrors)
      }
      toast.error(err.message || `Failed to ${isEdit ? 'update' : 'create'} assessment.`)
    } finally {
      setLoading(false)
    }
  }

  const courseTitle = currentActiveOffering?.course
    ? `${currentActiveOffering.course.code} — ${currentActiveOffering.course.title || currentActiveOffering.course.name}`
    : 'Current course'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Assessment' : 'Create Assessment'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Update specifications for ${typeLabel(assessment?.type)} in ${courseTitle}.`
              : `Create a new assessment for ${courseTitle}.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="tea-dialog-form space-y-4">
          {!isEdit && (
            <div className="tea-dialog-grid tea-dialog-grid--2">
              <FormField label="Year of Study" required>
                <Select
                  value={selectedYearOfStudy}
                  onValueChange={handleYearChange}
                  disabled={loading || teacherYearOptions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select year of study" />
                  </SelectTrigger>
                  <SelectContent>
                    {teacherYearOptions.map((y) => (
                      <SelectItem key={y.value} value={y.value}>
                        {y.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Course" required>
                <Select
                  value={selectedOfferingId}
                  onValueChange={(val) => setSelectedOfferingId(val)}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    {coursesForYear.map((o) => {
                      const c = o.course
                      const code = c?.code || ''
                      const title = c?.title || c?.name || 'Course'
                      const sec = o.section ? ` · Sec ${o.section}` : ''
                      return (
                        <SelectItem key={o.id} value={o.id}>
                          {code} — {title}{sec}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          )}

          {isEdit && (
            <div className="tea-details-box mb-1">
              <div className="tea-dialog-grid tea-dialog-grid--2 text-xs">
                <p>
                  <span className="text-muted-foreground font-medium">Year of Study: </span>
                  <span className="font-semibold">
                    {`Year ${currentActiveOffering?.yearOfStudy ?? currentActiveOffering?.year_of_study ?? (currentActiveOffering?.course ? getCourseStudyYear(currentActiveOffering.course) : '—')}`}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground font-medium">Course: </span>
                  <span className="font-semibold">
                    {currentActiveOffering?.course?.code} — {currentActiveOffering?.course?.title || currentActiveOffering?.course?.name}
                  </span>
                </p>
              </div>
            </div>
          )}
          <div className="tea-dialog-grid tea-dialog-grid--2">
            <FormField label="Assessment Type" required error={fieldErrors.type}>
              <Select
                value={form.type}
                onValueChange={(val) => setForm((f) => ({ ...f, type: val }))}
                disabled={loading}
              >
                <SelectTrigger autoFocus>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {ASSESSMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label="Weight (%)"
              required
              error={fieldErrors.weight}
              hint={`Max available: ${maxAvailableWeight}% · Graded out of ${form.weight || 0} marks`}
            >
              <Input
                type="number"
                min={0.5}
                max={100}
                step={0.5}
                value={form.weight}
                onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
                placeholder="20"
                disabled={loading}
              />
            </FormField>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {isEdit ? 'Save Changes' : 'Create Assessment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default AssessmentFormDialog
