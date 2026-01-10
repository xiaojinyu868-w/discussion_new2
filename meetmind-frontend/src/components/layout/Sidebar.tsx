import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useApp } from '@/contexts/AppContext'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Waves,
  Mic,
  History,
  Settings,
  LogOut,
  Home,
  GraduationCap,
  Briefcase,
  Sparkles,
} from 'lucide-react'

interface NavItem {
  icon: React.ElementType
  label: string
  path: string
}

const navItems: NavItem[] = [
  { icon: Home, label: '主页', path: '/dashboard' },
  { icon: Mic, label: '录音', path: '/recorder' },
  { icon: History, label: '历史', path: '/history' },
  { icon: Settings, label: '设置', path: '/settings' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { scenario } = useApp()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const scenarioConfig = {
    classroom: {
      icon: GraduationCap,
      label: '课堂模式',
      color: '#fbbf24',
      gradient: 'from-amber-500 to-orange-500',
    },
    meeting: {
      icon: Briefcase,
      label: '会议模式',
      color: '#3b82f6',
      gradient: 'from-blue-500 to-cyan-500',
    },
  }

  const currentScenario = scenarioConfig[scenario]
  const ScenarioIcon = currentScenario.icon

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-24 glass-strong flex flex-col items-center py-6 z-50">
      {/* Logo */}
      <NavLink to="/dashboard" className="mb-8 group relative">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-80 transition-opacity duration-500" />
        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-all duration-300">
          <Waves className="w-7 h-7 text-white" />
        </div>
      </NavLink>

      {/* Scenario indicator */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-all duration-300',
              'bg-gradient-to-br',
              currentScenario.gradient,
              'opacity-80 hover:opacity-100 hover:scale-105'
            )}
          >
            <ScenarioIcon className="w-5 h-5 text-white" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="glass-card border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span>{currentScenario.label}</span>
          </div>
        </TooltipContent>
      </Tooltip>

      {/* Divider */}
      <div className="w-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-6" />

      {/* Navigation */}
      <nav className="flex-1 flex flex-col items-center gap-3">
        {navItems.map((item, index) => {
          const isActive = location.pathname === item.path || 
            (item.path === '/dashboard' && location.pathname === '/')
          
          return (
            <Tooltip key={item.path}>
              <TooltipTrigger asChild>
                <NavLink
                  to={item.path}
                  className={cn(
                    'relative w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300',
                    'hover-lift',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  )}
                  style={{
                    animationDelay: `${index * 0.1}s`,
                  }}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <>
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20" />
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b from-violet-400 to-fuchsia-400" />
                    </>
                  )}
                  <item.icon className={cn('w-5 h-5 relative z-10', isActive && 'text-violet-300')} />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right" className="glass-card border-white/10 font-medium">
                {item.label}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="w-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-4" />

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="w-14 h-14 rounded-xl p-0 hover:bg-white/5 group">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 blur opacity-0 group-hover:opacity-50 transition-opacity" />
              <Avatar className="w-11 h-11 border-2 border-white/20 group-hover:border-violet-400/50 transition-colors">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-sm font-semibold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="right"
          align="end"
          className="w-60 glass-card border-white/10 p-2"
        >
          <div className="px-3 py-3 rounded-lg bg-white/5 mb-2">
            <p className="text-sm font-semibold text-white">{user?.name || '用户'}</p>
            <p className="text-xs text-white/50 mt-0.5">{user?.email || 'user@example.com'}</p>
          </div>
          <DropdownMenuItem
            onClick={() => navigate('/settings')}
            className="text-white/70 focus:text-white focus:bg-white/10 cursor-pointer rounded-lg h-10"
          >
            <Settings className="w-4 h-4 mr-3" />
            账户设置
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/10 my-2" />
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer rounded-lg h-10"
          >
            <LogOut className="w-4 h-4 mr-3" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </aside>
  )
}
