import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, CornerDownLeft, FileText, Search, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/context/auth-context'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import { store } from '@/store'
import { NAVIGATION } from '@/routes/navigation'

/** Quick search across pages (all roles) plus users/courses (admin) or own courses (teacher/student). */
export function GlobalSearch() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const q = useDebounce(query, 200)
  const listRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pages = useMemo(
    () => (NAVIGATION[user?.roleId] ?? []).flatMap((s) => s.items).map((i) => ({ id: i.to, label: i.label, sub: 'Page', to: i.to, icon: FileText })),
    [user?.roleId],
  )

  const term = q.trim().toLowerCase()
  const role = user?.roleId
  const results = useMemo(() => {
    const pageHits = pages.filter((p) => !term || p.label.toLowerCase().includes(term))
    if (!term) return pageHits.slice(0, 8)
    const extra = []
    try {
      if (role === 'admin') {
        store.users
          .listUsers({ search: term, pageSize: 5 })
          .items.forEach((u) => extra.push({ id: u.id, label: u.name, sub: `${u.roleId} · ${u.email}`, to: `/admin/users/${u.id}`, icon: User }))
        store.academics
          .listCourses({ search: term, pageSize: 5 })
          .items.forEach((c) => extra.push({ id: c.id, label: `${c.code} ${c.title}`, sub: 'Course', to: `/admin/courses?search=${encodeURIComponent(c.code)}`, icon: BookOpen }))
      } else if (role === 'teacher') {
        store.teacher
          .listMyOfferings({ search: term })
          .slice(0, 6)
          .forEach((o) => extra.push({ id: o.id, label: `${o.course.code} ${o.course.title}`, sub: o.semester.name, to: `/teacher/courses/${o.id}`, icon: BookOpen }))
      } else {
        store.student
          .listMyCourses()
          .filter((c) => `${c.course.code} ${c.course.title}`.toLowerCase().includes(term))
          .slice(0, 6)
          .forEach((c) => extra.push({ id: c.enrollmentId, label: `${c.course.code} ${c.course.title}`, sub: c.semester.name, to: `/student/courses/${c.enrollmentId}`, icon: BookOpen }))
      }
    } catch {
      // ignore search errors
    }
    return [...pageHits, ...extra].slice(0, 12)
  }, [pages, term, role])

  const go = (r) => {
    setOpen(false)
    setQuery('')
    navigate(r.to)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(results.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault()
      go(results[active])
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="search-trigger"
        aria-label="Search"
      >
        <Search className="icon" aria-hidden="true" />
        <span className="search-trigger__label">Search pages, people, courses…</span>
        <kbd className="search-trigger__kbd">Ctrl K</kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="search-dialog" showCloseButton={false}>
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogDescription className="sr-only">Search pages and records. Use arrow keys to navigate.</DialogDescription>
          <div className="search-dialog__bar">
            <Search className="icon text-muted" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={onKeyDown}
              placeholder="Type to search…"
              className="search-dialog__input"
              role="combobox"
              aria-expanded="true"
              aria-controls="global-search-list"
              aria-activedescendant={results[active] ? `gs-${active}` : undefined}
            />
          </div>
          <ul id="global-search-list" role="listbox" ref={listRef} className="search-dialog__list">
            {results.length === 0 && <li className="search-dialog__empty">No results.</li>}
            {results.map((r, i) => (
              <li
                key={`${r.id}-${i}`}
                id={`gs-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={cn('search-dialog__item', i === active && 'search-dialog__item--active')}
              >
                <r.icon className="icon text-muted" aria-hidden="true" />
                <span className="grow">
                  <span className="truncate block">{r.label}</span>
                  <span className="block truncate text-xs text-muted" style={{ textTransform: 'capitalize' }}>{r.sub}</span>
                </span>
                {i === active && <CornerDownLeft className="icon-sm text-muted" aria-hidden="true" />}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
