import { useState } from 'react'
import { Building, Database, Download, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ErrorState } from '@/components/common/ErrorState'
import { FormField } from '@/components/common/FormField'
import { PageSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { useQuery, useMutation } from '@/hooks/useStore'
import { formatDateTime } from '@/lib/format'
import { store } from '@/store'

const DB_KEY = 'ugs-db-v2'
const TABS = ['university', 'grading', 'data']

const FIELDS = [
  { key: 'name', label: 'University name', required: true, span: true },
  { key: 'shortName', label: 'Short name', required: true },
  { key: 'motto', label: 'Motto' },
  { key: 'email', label: 'Registrar email', required: true, type: 'email' },
  { key: 'phone', label: 'Phone', type: 'tel' },
  { key: 'website', label: 'Website', type: 'url' },
  { key: 'registrarName', label: 'Registrar name', required: true, hint: 'Printed on transcripts.' },
  { key: 'address', label: 'Address', span: true },
]

const REPEAT_LABELS = { latest: 'Latest attempt counts', highest: 'Highest attempt counts', all: 'All attempts count' }

function UniversityForm({ university }) {
  const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map((f) => [f.key, university?.[f.key] ?? ''])))
  const [save, { loading, fieldErrors }] = useMutation((data) => store.reports.updateUniversitySettings(data), { success: 'University information saved.' })
  const fe = fieldErrors ?? {}
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>University information</CardTitle>
          <CardDescription className="mt-1">Used in the app header, on transcripts, grade sheets and exported reports.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            save(form)
          }}
        >
          {FIELDS.map((f) => (
            <FormField key={f.key} label={f.label} required={f.required} error={fe[f.key]} hint={f.hint} className={f.span ? 'sm:col-span-2' : undefined}>
              <Input type={f.type ?? 'text'} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            </FormField>
          ))}
          <div className="sm:col-span-2">
            <Button type="submit" loading={loading}>
              Save changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function PolicyRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

function downloadBackup() {
  let raw
  try {
    raw = localStorage.getItem(DB_KEY)
  } catch {
    // Storage unavailable — treated as "no saved changes".
  }
  if (!raw) {
    toast.info('No changes have been saved yet — the database is still the original demo data.')
    return
  }
  const blob = new Blob([JSON.stringify(JSON.parse(raw), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ugs_backup_${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  toast.success('Backup downloaded.')
}

export function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'university'
  const { data, loading, error, refetch } = useQuery(() => store.reports.getSettings(), [], { live: false })
  const [resetOpen, setResetOpen] = useState(false)
  const [reset] = useMutation(() => store.reports.resetDemoData(), { success: 'Demo data restored. Reloading…' })

  if (loading && !data) return <PageSkeleton />

  const policy = data?.policy

  return (
    <>
      <PageHeader title="Settings" description="University information, grading configuration and data management." />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
          <TabsList>
            <TabsTrigger value="university">
              <Building /> University
            </TabsTrigger>
            <TabsTrigger value="grading">
              <SlidersHorizontal /> Grading
            </TabsTrigger>
            <TabsTrigger value="data">
              <Database /> Data
            </TabsTrigger>
          </TabsList>

          <TabsContent value="university" className="max-w-3xl">
            <UniversityForm university={data.university} />
            {data.updatedAt && <p className="mt-2 text-xs text-muted-foreground">Settings last updated {formatDateTime(data.updatedAt)}.</p>}
          </TabsContent>

          <TabsContent value="grading" className="max-w-3xl">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Grading policy</CardTitle>
                  <CardDescription className="mt-1">Pass mark, grade scale, GPA rules and the approval workflow are managed on the Grading Policies page.</CardDescription>
                </div>
                <Button asChild>
                  <Link to="/admin/grading-policies">
                    <SlidersHorizontal /> Open grading policies
                  </Link>
                </Button>
              </CardHeader>
              {policy && (
                <CardContent>
                  <dl className="divide-y">
                    <PolicyRow label="Pass mark" value={`${policy.passMark}%`} />
                    <PolicyRow
                      label="Approval workflow"
                      value={<Badge variant={policy.approvalWorkflowEnabled ? 'success' : 'muted'}>{policy.approvalWorkflowEnabled ? 'Enabled' : 'Disabled'}</Badge>}
                    />
                    <PolicyRow label="Repeated courses" value={REPEAT_LABELS[policy.repeatPolicy] ?? policy.repeatPolicy} />
                    <PolicyRow label="Probation below CGPA" value={policy.probationGpa?.toFixed(2)} />
                    <PolicyRow label="Honours from CGPA" value={policy.honorsGpa?.toFixed(2)} />
                    <PolicyRow label="Assessment weights must total 100%" value={policy.requireWeightsTotal100 ? 'Yes' : 'No'} />
                  </dl>
                </CardContent>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="data" className="flex max-w-3xl flex-col gap-6">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Backup</CardTitle>
                  <CardDescription className="mt-1">Download the complete database (users, courses, grades, audit logs) as a JSON file.</CardDescription>
                </div>
                <Button variant="outline" onClick={downloadBackup}>
                  <Download /> Download backup
                </Button>
              </CardHeader>
            </Card>
            <Card className="border-destructive/40">
              <CardHeader>
                <div>
                  <CardTitle>Reset demo data</CardTitle>
                  <CardDescription className="mt-1">Restore the original demo dataset. All changes — new users, grades, approvals and logs — are permanently discarded.</CardDescription>
                </div>
                <Button variant="destructive" onClick={() => setResetOpen(true)}>
                  <RotateCcw /> Reset demo data
                </Button>
              </CardHeader>
              <CardContent>
                <Alert variant="warning">
                  <AlertDescription>Consider downloading a backup first. You may need to sign in again after the reset.</AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset all demo data?"
        description="Every change made in this browser will be permanently lost and the original demo data restored. This cannot be undone."
        confirmLabel="Reset data"
        variant="destructive"
        onConfirm={async () => {
          const res = await reset()
          if (!res.ok) return false
          window.location.reload()
        }}
      />
    </>
  )
}
