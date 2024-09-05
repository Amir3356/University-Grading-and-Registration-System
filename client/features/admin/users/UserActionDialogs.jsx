import { useState } from 'react'
import { Check, Copy, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useMutation } from '@/hooks/useStore'
import { store } from '@/store'

/** Shows a one-time temporary password with a copy button. result: { name, username, password } | null */
export function TempPasswordDialog({ result, onClose }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.password)
      setCopied(true)
      toast.success('Password copied to clipboard.')
    } catch {
      toast.error('Could not copy. Select the password and copy it manually.')
    }
  }
  return (
    <Dialog
      open={Boolean(result)}
      onOpenChange={(v) => {
        if (!v) {
          setCopied(false)
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Temporary password</DialogTitle>
          <DialogDescription>Share these sign-in details securely with {result?.name}. They will be asked to change the password at their next sign-in.</DialogDescription>
        </DialogHeader>
        {result?.username && (
          <p className="text-sm">
            Username: <code className="rounded bg-muted px-1.5 py-0.5 font-mono select-all">{result.username}</code>
          </p>
        )}
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
          <KeyRound className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <code className="min-w-0 flex-1 font-mono text-base break-all select-all" aria-label="Temporary password">
            {result?.password}
          </code>
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <Alert variant="warning">
          <AlertDescription>This password will not be shown again.</AlertDescription>
        </Alert>
        <DialogFooter>
          <Button
            onClick={() => {
              setCopied(false)
              onClose()
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Confirm dialogs for reset password / activate / deactivate.
 * action: { type: 'reset' | 'activate' | 'deactivate', user: { id, name } } | null
 */
export function UserActionDialogs({ action, onClose }) {
  const [temp, setTemp] = useState(null)
  const [reset] = useMutation((id) => store.users.resetUserPassword(id), { success: 'Password reset.' })
  const [setStatus] = useMutation((id, status, reason) => store.users.setUserStatus(id, { status, reason }), {
    success: (_r, _id, status) => (status === 'active' ? 'Account activated.' : 'Account deactivated.'),
  })
  const user = action?.user
  const name = user?.name ?? ''
  const onOpenChange = (v) => !v && onClose()

  return (
    <>
      <ConfirmDialog
        open={action?.type === 'reset'}
        onOpenChange={onOpenChange}
        title="Reset password?"
        description={`A new temporary password will be generated for ${name}. Their current password will stop working immediately.`}
        confirmLabel="Reset password"
        onConfirm={async () => {
          const res = await reset(user.id)
          if (!res.ok) return false
          setTemp({ name, username: user.username, password: res.result.temporaryPassword })
        }}
      />
      <ConfirmDialog
        open={action?.type === 'deactivate'}
        onOpenChange={onOpenChange}
        title="Deactivate account?"
        description={`${name} will no longer be able to sign in. Their academic records are kept.`}
        confirmLabel="Deactivate"
        variant="destructive"
        reasonLabel="Reason"
        reasonPlaceholder="e.g. Left the university"
        onConfirm={async (reason) => {
          const res = await setStatus(user.id, 'inactive', reason)
          return res.ok ? undefined : false
        }}
      />
      <ConfirmDialog
        open={action?.type === 'activate'}
        onOpenChange={onOpenChange}
        title="Activate account?"
        description={`${name} will be able to sign in again.`}
        confirmLabel="Activate"
        onConfirm={async () => {
          const res = await setStatus(user.id, 'active')
          return res.ok ? undefined : false
        }}
      />
      <TempPasswordDialog result={temp} onClose={() => setTemp(null)} />
    </>
  )
}
