import { useEffect, useState } from 'react'
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
  existingAssessments = [],
  onSaved,
}) {
  const isEdit = Boolean(assessment)

  const otherAssessments = existingAssessments.filter((a) => a.id !== assessment?.id)
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
      if (assessment) {
        setForm({
          type: assessment.type || 'assignment',
          weight: String(assessment.weight ?? 10),
        })
      } else {
        const suggestedWeight = maxAvailableWeight > 0 ? Math.min(20, maxAvailableWeight) : 10
        setForm({
          type: 'assignment',
          weight: String(suggestedWeight),
        })
      }
      setFieldErrors({})
    }
  }, [open, assessment, maxAvailableWeight])

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
          : generateAssessmentName(form.type, existingAssessments, assessment?.id)

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

      if (isEdit) {
        await store.grades.updateAssessment(assessment.id, payload)
        toast.success(`Assessment (${typeLabel(payload.type)}) updated successfully.`)
      } else {
        await store.grades.createAssessment(offering.id, payload)
        toast.success(`Assessment (${typeLabel(payload.type)}) created successfully.`)
      }

      onSaved?.()
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

  const courseTitle = offering?.course ? `${offering.course.code} — ${offering.course.title}` : 'Current course'

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

        <form onSubmit={handleSubmit} className="tea-dialog-form">
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
