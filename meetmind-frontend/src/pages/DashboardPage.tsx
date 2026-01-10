import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import { SCENARIO_CONFIGS } from '@/config/scenarios'
import type { ScenarioType } from '@/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Mic,
  History,
  Sparkles,
  ArrowRight,
  GraduationCap,
  Briefcase,
  Brain,
  Clock,
  TrendingUp,
  Zap,
  Waves,
  ChevronRight,
  Calendar,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const [showScenarioDialog, setShowScenarioDialog] = useState(false)
  const { user } = useAuth()
  const { setScenario } = useApp()
  const navigate = useNavigate()

  const handleStartRecording = () => {
    setShowScenarioDialog(true)
  }

  const handleSelectScenario = (scenario: ScenarioType) => {
    setScenario(scenario)
    setShowScenarioDialog(false)
    navigate('/recorder')
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 6) return '夜深了'
    if (hour < 12) return '早上好'
    if (hour < 14) return '中午好'
    if (hour < 18) return '下午好'
    return '晚上好'
  }

  const stats = [
    { 
      label: '本周会议', 
      value: '12', 
      unit: '场',
      icon: Calendar, 
      gradient: 'from-blue-500 to-cyan-400',
      glow: 'rgba(59, 130, 246, 0.3)',
    },
    { 
      label: '转写时长', 
      value: '8.5', 
      unit: '小时',
      icon: Clock, 
      gradient: 'from-violet-500 to-purple-400',
      glow: 'rgba(139, 92, 246, 0.3)',
    },
    { 
      label: 'AI 洞察', 
      value: '47', 
      unit: '条',
      icon: Sparkles, 
      gradient: 'from-amber-500 to-orange-400',
      glow: 'rgba(245, 158, 11, 0.3)',
    },
    { 
      label: '效率提升', 
      value: '32', 
      unit: '%',
      icon: TrendingUp, 
      gradient: 'from-emerald-500 to-teal-400',
      glow: 'rgba(16, 185, 129, 0.3)',
    },
  ]

  const quickActions = [
    {
      title: '历史记录',
      description: '查看所有会议记录和 AI 洞察',
      icon: History,
      gradient: 'from-blue-500/20 to-cyan-500/20',
      iconColor: 'text-blue-400',
      path: '/history',
    },
    {
      title: 'AI 设置',
      description: '自定义 AI 行为和偏好',
      icon: Brain,
      gradient: 'from-violet-500/20 to-purple-500/20',
      iconColor: 'text-violet-400',
      path: '/settings',
    },
  ]

  return (
    <div className="min-h-screen p-8">
      {/* Greeting section */}
      <div className="mb-10 animate-slide-up">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 animate-pulse" />
          <span className="text-white/50 text-sm font-medium tracking-wide uppercase">
            {new Date().toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
        </div>
        <h1 className="text-5xl font-bold text-white mb-3">
          {getGreeting()}，
          <span className="text-gradient">{user?.name || '用户'}</span>
        </h1>
        <p className="text-white/50 text-xl">准备好开启今天的智能会议了吗？</p>
      </div>

      {/* Main action card */}
      <div 
        className="mb-10 glass-card rounded-3xl overflow-hidden group cursor-pointer hover-lift animate-slide-up stagger-1"
        onClick={handleStartRecording}
      >
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 via-fuchsia-600/20 to-cyan-600/20 animate-gradient opacity-50" />
        
        {/* Content */}
        <div className="relative p-10 flex items-center justify-between">
          <div className="flex items-center gap-8">
            {/* Animated icon */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-3xl blur-xl opacity-50 group-hover:opacity-80 transition-opacity duration-500" />
              <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-500">
                <Mic className="w-12 h-12 text-white" />
                
                {/* Sound wave animation */}
                <div className="absolute -right-2 top-1/2 -translate-y-1/2 flex gap-0.5">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="w-1 bg-white/60 rounded-full animate-wave"
                      style={{
                        height: `${12 + i * 4}px`,
                        animationDelay: `${i * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">开始新的录音</h2>
              <p className="text-white/60 text-lg">选择场景，开启智能转写与 AI 洞察</p>
            </div>
          </div>
          
          <Button
            size="lg"
            className={cn(
              'bg-white text-slate-900 hover:bg-white/90 font-bold px-10 h-16 text-lg',
              'shadow-2xl hover:shadow-white/20 transition-all duration-300',
              'group-hover:scale-105 rounded-2xl'
            )}
          >
            立即开始
            <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-5 mb-10">
        {stats.map((stat, index) => (
          <div 
            key={stat.label} 
            className="glass-card rounded-2xl p-6 hover-lift animate-slide-up"
            style={{ 
              animationDelay: `${0.2 + index * 0.1}s`,
              boxShadow: `0 8px 32px ${stat.glow}`,
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div 
                className={cn(
                  'w-14 h-14 rounded-xl flex items-center justify-center',
                  `bg-gradient-to-br ${stat.gradient}`
                )}
              >
                <stat.icon className="w-7 h-7 text-white" />
              </div>
              <BarChart3 className="w-5 h-5 text-white/20" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-white font-mono">{stat.value}</span>
              <span className="text-lg text-white/50">{stat.unit}</span>
            </div>
            <p className="text-white/40 text-sm mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-6">
        {quickActions.map((action, index) => (
          <div
            key={action.title}
            onClick={() => navigate(action.path)}
            className={cn(
              'glass-card rounded-2xl p-8 cursor-pointer group hover-lift animate-slide-up',
              'transition-all duration-300'
            )}
            style={{ animationDelay: `${0.5 + index * 0.1}s` }}
          >
            <div className="flex items-start justify-between mb-6">
              <div 
                className={cn(
                  'w-16 h-16 rounded-2xl flex items-center justify-center',
                  `bg-gradient-to-br ${action.gradient}`,
                  'group-hover:scale-110 transition-transform duration-300'
                )}
              >
                <action.icon className={cn('w-8 h-8', action.iconColor)} />
              </div>
              <ChevronRight className="w-6 h-6 text-white/20 group-hover:text-white/50 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">{action.title}</h3>
            <p className="text-white/50">{action.description}</p>
          </div>
        ))}
      </div>

      {/* Scenario selection dialog */}
      <Dialog open={showScenarioDialog} onOpenChange={setShowScenarioDialog}>
        <DialogContent className="sm:max-w-2xl glass-strong border-white/10 rounded-3xl p-0 overflow-hidden">
          {/* Header */}
          <div className="p-8 pb-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mx-auto mb-4">
              <Waves className="w-8 h-8 text-white" />
            </div>
            <DialogTitle className="text-3xl font-bold text-white mb-2">选择使用场景</DialogTitle>
            <p className="text-white/50">不同场景将启用针对性的 AI 功能</p>
          </div>
          
          {/* Scenario cards */}
          <div className="px-8 pb-8 grid grid-cols-2 gap-4">
            {Object.values(SCENARIO_CONFIGS).map((config) => {
              const Icon = config.id === 'classroom' ? GraduationCap : Briefcase
              return (
                <button
                  key={config.id}
                  onClick={() => handleSelectScenario(config.id)}
                  className={cn(
                    'relative p-6 rounded-2xl text-left transition-all duration-300',
                    'border-2 border-transparent hover:border-white/20',
                    'hover:scale-[1.02] hover-lift group overflow-hidden'
                  )}
                  style={{
                    background: `linear-gradient(135deg, ${config.color}15, ${config.color}05)`,
                  }}
                >
                  {/* Hover glow */}
                  <div 
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: `radial-gradient(circle at 50% 50%, ${config.color}20, transparent 70%)`,
                    }}
                  />
                  
                  <div className="relative">
                    <div
                      className="w-16 h-16 rounded-xl flex items-center justify-center mb-4"
                      style={{ 
                        background: `linear-gradient(135deg, ${config.color}30, ${config.color}10)`,
                      }}
                    >
                      <Icon className="w-8 h-8" style={{ color: config.color }} />
                    </div>
                    
                    <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                      {config.icon} {config.name}
                    </h3>
                    <p className="text-white/50 text-sm leading-relaxed mb-4">{config.description}</p>
                    
                    {/* Skills preview */}
                    <div className="flex flex-wrap gap-2">
                      {config.skills.slice(0, 3).map((skill) => (
                        <span
                          key={skill.id}
                          className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white/70"
                        >
                          {skill.icon} {skill.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
