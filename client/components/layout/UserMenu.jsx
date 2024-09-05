import { LogOut, Moon, Sun, UserCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'
import { ROLE_LABELS } from '@/lib/format'
import { fullName, initials } from '@/lib/utils'

export function UserMenu() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    toast.success('You have been signed out.')
    navigate('/login', { replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="user-button" aria-label="Account menu">
          <Avatar>
            <AvatarFallback>{initials(user)}</AvatarFallback>
          </Avatar>
          <span className="user-button__text">
            <span className="text-sm font-medium block">{fullName(user)}</span>
            <span className="text-xs text-muted block">{ROLE_LABELS[user?.roleId]}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="menu--wide">
        <DropdownMenuLabel>
          <span className="truncate block">{fullName(user)}</span>
          <span className="block truncate text-xs text-muted" style={{ fontWeight: 400 }}>{user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/profile')}>
          <UserCircle /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={toggle}>
          {theme === 'dark' ? <Sun /> : <Moon />} {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
