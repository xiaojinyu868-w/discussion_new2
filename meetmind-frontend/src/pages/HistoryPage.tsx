import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { sessionApi } from '@/services/api'
import { formatDuration, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search,
  Calendar,
  Clock,
  GraduationCap,
  Briefcase,
  ChevronRight,
  Loader2,
  FolderOpen,
  Mic,
  Sparkles,
  Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScenarioType } from '@/types'

interface SessionItem {
  id: string
  title: string
  scenario: ScenarioType
  status: string
  createdAt: string
  duration: number
}

export default function HistoryPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | ScenarioType>('all')

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    setIsLoading(true)
    try {
      const response = await sessionApi.getHistory(1, 50)
      // 适配后端返回格式
      const data = response.data as unknown as { meetings?: SessionItem[] }
      if (data.meetings) {
        setSessions(data.meetings)
      }
    } catch (error) {
      console.error('Failed to load sessions:', error)
    }
    setIsLoading(false)
  }

  const filteredSessions = sessions.filter((session) => {
    const matchesSearch = session.title?.toLowerCase().includes(searchQuery.toLowerCase()) ?? true
    const matchesFilter = filter === 'all' || session.scenario === filter
    return matchesSearch && matchesFilter
  })

  const scenarioConfig = {
    classroom: {
      icon: GraduationCap,
      label: '课堂',
      color: '#fbbf24',
      gradient: 'from-amber-500 to-orange-500',
      glow: 'rgba(251, 191, 36, 0.2)',
    },
    meeting: {
      icon: Briefcase,
      label: '会议',
      color: '#3b82f6',
      gradient: 'from-blue-500 to-cyan-500',
      glow: 'rgba(59, 130, 246, 0.2)',
    },
  }

  const filterButtons = [
    { id: 'all' as const, label: '全部', icon: Filter },
    { id: 'classroom' as const, label: '课堂', icon: GraduationCap, color: scenarioConfig.classroom.color },
    { id: 'meeting' as const, label: '会议', icon: Briefcase, color: scenarioConfig.meeting.color },
  ]

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="mb-10 animate-slide-up">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" />
          <span className="text-white/50 text-sm font-medium tracking-wide uppercase">
            历史记录
          </span>
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">会议记录</h1>
        <p className="text-white/50 text-lg">查看和管理您的所有会议记录与 AI 洞察</p>
      </div>

      {/* Search and filters */}
      <div className="flex items-center gap-4 mb-8 animate-slide-up stagger-1">
        {/* Search input */}
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
          <Input
            type="text"
            placeholder="搜索会议记录..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'pl-12 h-14 rounded-2xl',
              'bg-white/5 border-white/10 text-white placeholder:text-white/30',
              'focus:bg-white/10 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20',
              'transition-all duration-300'
            )}
          />
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-2 p-1.5 glass-card rounded-2xl">
          {filterButtons.map((btn) => (
            <Button
              key={btn.id}
              variant="ghost"
              onClick={() => setFilter(btn.id)}
              className={cn(
                'h-11 px-5 rounded-xl transition-all duration-300',
                filter === btn.id
                  ? btn.color
                    ? 'text-white'
                    : 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              )}
              style={{
                background: filter === btn.id && btn.color 
                  ? `linear-gradient(135deg, ${btn.color}30, ${btn.color}10)` 
                  : undefined,
              }}
            >
              <btn.icon className="w-4 h-4 mr-2" style={{ color: filter === btn.id ? btn.color : undefined }} />
              {btn.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Sessions list */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32">
          <div className="relative">
            <div className="absolute inset-0 bg-violet-500/20 rounded-full blur-xl animate-pulse" />
            <Loader2 className="w-12 h-12 text-violet-400 animate-spin relative" />
          </div>
          <p className="text-white/50 mt-6">加载中...</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 animate-scale-in">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-white/5 rounded-3xl blur-xl" />
            <div className="relative w-24 h-24 glass-card rounded-3xl flex items-center justify-center">
              <FolderOpen className="w-12 h-12 text-white/30" />
            </div>
          </div>
          <p className="text-2xl font-semibold text-white mb-2">暂无记录</p>
          <p className="text-white/50 mb-8">
            {searchQuery ? '没有找到匹配的记录' : '开始录音后，记录将显示在这里'}
          </p>
          {!searchQuery && (
            <Button
              onClick={() => navigate('/recorder')}
              className={cn(
                'h-14 px-8 rounded-2xl font-semibold text-lg',
                'bg-gradient-to-r from-violet-500 to-fuchsia-500',
                'hover:from-violet-600 hover:to-fuchsia-600',
                'shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50',
                'transition-all duration-300 hover-lift'
              )}
            >
              <Mic className="w-5 h-5 mr-2" />
              开始新录音
            </Button>
          )}
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="space-y-4 pr-4">
            {filteredSessions.map((session, index) => {
              const config = scenarioConfig[session.scenario] || scenarioConfig.meeting
              const Icon = config.icon
              return (
                <div
                  key={session.id}
                  onClick={() => navigate(`/session/${session.id}`)}
                  className={cn(
                    'glass-card rounded-2xl p-5 cursor-pointer group',
                    'hover-lift transition-all duration-300',
                    'animate-slide-up'
                  )}
                  style={{ 
                    animationDelay: `${index * 0.05}s`,
                    boxShadow: `0 4px 24px ${config.glow}`,
                  }}
                >
                  <div className="flex items-center gap-5">
                    {/* Icon */}
                    <div
                      className={cn(
                        'w-16 h-16 rounded-2xl flex items-center justify-center',
                        'group-hover:scale-110 transition-transform duration-300'
                      )}
                      style={{
                        background: `linear-gradient(135deg, ${config.color}30, ${config.color}10)`,
                      }}
                    >
                      <Icon className="w-8 h-8" style={{ color: config.color }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-white truncate group-hover:text-violet-300 transition-colors">
                        {session.title || `${config.label}记录`}
                      </h3>
                      <div className="flex items-center gap-5 mt-2">
                        <span className="flex items-center gap-2 text-sm text-white/40">
                          <Calendar className="w-4 h-4" />
                          {formatDate(session.createdAt)}
                        </span>
                        <span className="flex items-center gap-2 text-sm text-white/40">
                          <Clock className="w-4 h-4" />
                          {formatDuration(session.duration || 0)}
                        </span>
                      </div>
                    </div>

                    {/* Status & Arrow */}
                    <div className="flex items-center gap-4">
                      <span
                        className={cn(
                          'px-4 py-2 rounded-xl text-sm font-medium',
                          session.status === 'ended' || session.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        )}
                      >
                        {session.status === 'ended' || session.status === 'completed' ? '已完成' : '进行中'}
                      </span>
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
                        <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      )}

      {/* Stats footer */}
      {!isLoading && filteredSessions.length > 0 && (
        <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between animate-slide-up">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-white/40">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm">共 {filteredSessions.length} 条记录</span>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => navigate('/recorder')}
            className="text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
          >
            <Mic className="w-4 h-4 mr-2" />
            新建录音
          </Button>
        </div>
      )}
    </div>
  )
}
