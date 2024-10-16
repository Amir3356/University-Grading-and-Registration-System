import { useState } from 'react'
import { Check, Copy, IdCard, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useMutation } from '@/hooks/useStore'
import { store } from '@/store'

/** Shows the created account's sign-in credential once. result: { name, username, password, identifier, roleId } | null */
export function TempPasswordDialog({ result, onClose }) {
  const [copied, setCopied] = useState(false)
  const usesId = result?.roleId === 'student' || result?.roleId === 'teacher'
  const idLabel = result?.roleId === 'student' ? 'Student ID' : 'Teacher ID'
  const credential = usesId ? result?.identifier : result?.password
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(credential)
      setCopied(true)
      toast.success(`${usesId ? idLabel : 'Password'} copied to clipboard.`)
    } catch {
      toast.error('Could not copy. Select it and copy manually.')
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
          <DialogTitle>{usesId ? idLabel : 'Temporary password'}</DialogTitle>
          <DialogDescription>
            Share these sign-in details securely with {result?.name}.{' '}
            {usesId ? `They sign in with their ${idLabel}.` : 'They will be asked to change the password at their next sign-in.'}
          </DialogDescription>
        </DialogHeader>
        {result?.username && (
          <p className="text-sm">
            Username: <code className="rounded bg-muted px-1.5 py-0.5 font-mono select-all">{result.username}</code>
          </p>
        )}
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
          {usesId ? <IdCard className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <KeyRound className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
          <code className="min-w-0 flex-1 font-mono text-base break-all select-all" aria-label={usesId ? idLabel : 'Temporary password'}>
            {credential}
          </code>
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <Alert variant="warning">
          <AlertDescription>{usesId ? `This ${idLabel} is the credential used to sign in.` : 'This password will not be shown again.'}</AlertDescription>
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
 * Confirm dialogs for reset password / activate / deactivate / delete.
 * action: { type: 'reset' | 'activate' | 'deactivate' | 'delete', user: { id, name } } | null
 */
export function UserActionDialogs({ action, onClose }) {
  const [temp, setTemp] = useState(null)
  const [reset] = useMutation((id) => store.users.resetUserPassword(id), { success: 'Password reset.' })
  const [setStatus] = useMutation((id, status, reason) => store.users.setUserStatus(id, { status, reason }), {
    success: (_r, _id, status) => (status === 'active' ? 'Account activated.' : 'Account deactivated.'),
  })
  const [remove] = useMutation((id) => store.users.deleteUser(id), { success: 'Account deleted.' })
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
        onConfirm={async () => {
          const res = await setStatus(user.id, 'inactive')
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
      <ConfirmDialog
        open={action?.type === 'delete'}
        onOpenChange={onOpenChange}
        title="Delete account?"
        description={`${name} will be permanently removed. Accounts with academic records cannot be deleted — deactivate them instead.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          const res = await remove(user.id)
          return res.ok ? undefined : false
        }}
      />
      <TempPasswordDialog result={temp} onClose={() => setTemp(null)} />
    </>
  )
}
