import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { groupBy } from '@/lib/utils'
import { cn } from '@/lib/utils'

/** Select one of the teacher's course offerings, grouped by semester. */
export function OfferingPicker({ offerings, value, onChange, className, label = 'Course' }) {
  const groups = [...groupBy(offerings ?? [], (o) => o.semester.name).entries()]
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger className={cn('w-full sm:w-80', className)} aria-label={label}>
        <SelectValue placeholder="Select a course" />
      </SelectTrigger>
      <SelectContent>
        {groups.map(([semester, list]) => (
          <SelectGroup key={semester}>
            <SelectLabel>{semester}</SelectLabel>
            {list.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.course.code} — {o.course.title} ({o.section})
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
