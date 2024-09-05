import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/common/FormField'

/**
 * Confirmation dialog for important actions.
 * If `reasonLabel` is set, a reason is collected (required unless reasonOptional) and passed to onConfirm(reason).
 * onConfirm may be async; return false to keep the dialog open.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  variant = 'default',
  onConfirm,
  reasonLabel,
  reasonOptional = false,
  reasonPlaceholder,
  children,
}) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const close = (v) => {
    if (loading) return
    if (!v) {
      setReason('')
      setError(null)
    }
    onOpenChange(v)
  }

  const handleConfirm = async () => {
    if (reasonLabel && !reasonOptional && !reason.trim()) {
      setError(`${reasonLabel} is required.`)
      return
    }
    setLoading(true)
    const result = await onConfirm(reason.trim())
    setLoading(false)
    if (result !== false) close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        {reasonLabel && (
          <FormField label={reasonLabel} required={!reasonOptional} error={error}>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={reasonPlaceholder} rows={3} />
          </FormField>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant={variant} onClick={handleConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
