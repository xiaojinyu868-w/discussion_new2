import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '@/contexts/AppContext'
import { SCENARIO_CONFIGS } from '@/config/scenarios'
import type { ScenarioType } from '@/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  Mic,
  GraduationCap,
  Briefcase,
  Brain,
  Target,
  Users,
  ArrowRight,
  Play,
  Sparkles,
  Link2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const [showScenarioDialog, setShowScenarioDialog] = useState(false)
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

  // 认知对齐核心理念
  const alignmentConcept = {
    title: '认知对齐',
    subtitle: '不只是记录，而是真正理解',
    description: '传统工具解决的是「记不住」，我们解决的是「听不懂」',
    scenarios: [
      {
        type: 'classroom' as ScenarioType,
        target: '老师',
        icon: GraduationCap,
        color: '#F59E0B',
        pain: '跟不上老师思路，漏掉言外之意',
        solution: '像学霸同桌一样，实时翻译老师的深层意图',
      },
      {
        type: 'meeting' as ScenarioType,
        target: '他人',
        icon: Briefcase,
        color: '#3B82F6',
        pain: '听不懂潜台词，错过关键信号',
        solution: '像读心高手一样，解读每个人话语背后的想法',
      },
    ],
  }

  // 对齐能力三层
  const alignmentLayers = [
    {
      name: '被动对齐',
      desc: 'AI 发现你可能「没听懂」时，主动轻推提醒',
      icon: Sparkles,
      color: '#00d4ff',
    },
    {
      name: '主动对齐',
      desc: '感到困惑时，一键触发认知技能获取洞察',
      icon: Target,
      color: '#a855f7',
    },
    {
      name: '深度对齐',
      desc: '随时提问，AI 基于全量上下文帮你「补课」',
      icon: Brain,
      color: '#00ffc8',
    },
  ]

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* 极光背景 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '2s' }} />
        {/* 网格纹理 */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        {/* Hero Section - 认知对齐核心理念 */}
        <div className="text-center mb-16 pt-8">
          {/* Logo & Tagline */}
          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-sm">
            <Link2 className="w-4 h-4 text-cyan-400" />
            <span className="text-white/60 text-sm font-medium tracking-wide">认知对齐工具</span>
          </div>

          <h1 className="text-6xl font-bold mb-6 tracking-tight">
            <span className="text-white">MeetMind</span>
            <span className="mx-3 text-white/20">·</span>
            <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-amber-400 bg-clip-text text-transparent">视界</span>
          </h1>
          
          <p className="text-2xl text-white/50 mb-4 font-light">
            {alignmentConcept.subtitle}
          </p>
          <p className="text-lg text-white/40 max-w-2xl mx-auto">
            {alignmentConcept.description}
          </p>

          {/* CTA Button */}
          <div className="mt-10">
            <Button
              onClick={handleStartRecording}
              size="lg"
              className={cn(
                'relative h-16 px-10 text-lg font-semibold rounded-2xl',
                'bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500',
                'hover:from-cyan-400 hover:via-violet-400 hover:to-fuchsia-400',
                'text-white shadow-2xl shadow-violet-500/25',
                'transition-all duration-500 hover:scale-105 hover:shadow-violet-500/40',
                'group overflow-hidden'
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <Mic className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform" />
              <span>开始认知对齐</span>
              <Play className="w-5 h-5 ml-3 opacity-60 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>

        {/* 两大场景对比 */}
        <div className="mb-16">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Users className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-semibold text-white/80">你要对齐谁？</h2>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {alignmentConcept.scenarios.map((scenario) => {
              const config = SCENARIO_CONFIGS[scenario.type]
              return (
                <button
                  key={scenario.type}
                  onClick={() => handleSelectScenario(scenario.type)}
                  className={cn(
                    'relative p-8 rounded-2xl text-left transition-all duration-500',
                    'bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm',
                    'hover:bg-white/[0.06] hover:border-white/10 hover:-translate-y-1',
                    'hover:shadow-2xl group'
                  )}
                  style={{ boxShadow: `0 0 60px ${scenario.color}10` }}
                >
                  {/* Glow on hover */}
                  <div 
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ boxShadow: `inset 0 0 40px ${scenario.color}15, 0 0 60px ${scenario.color}10` }}
                  />
                  
                  <div className="relative">
                    {/* 对齐目标标签 */}
                    <div 
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-6"
                      style={{ 
                        background: `linear-gradient(135deg, ${scenario.color}20, ${scenario.color}10)`,
                        color: scenario.color,
                      }}
                    >
                      <Link2 className="w-4 h-4" />
                      <span>对齐{scenario.target}</span>
                    </div>

                    {/* Icon */}
                    <div 
                      className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                      style={{ background: `${scenario.color}20` }}
                    >
                      <scenario.icon className="w-8 h-8" style={{ color: scenario.color }} />
                    </div>

                    {/* 场景名称 */}
                    <h3 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                      {config.icon} {config.name}
                    </h3>

                    {/* 痛点 */}
                    <div className="mb-4">
                      <span className="text-white/40 text-sm">痛点：</span>
                      <p className="text-white/60 text-sm mt-1">{scenario.pain}</p>
                    </div>

                    {/* 解决方案 */}
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <span className="text-xs font-medium" style={{ color: scenario.color }}>AI 帮你</span>
                      <p className="text-white/80 text-sm mt-1">{scenario.solution}</p>
                    </div>

                    {/* 技能预览 */}
                    <div className="flex flex-wrap gap-2 mt-6">
                      {config.skills.map((skill) => (
                        <span
                          key={skill.id}
                          className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white/70"
                        >
                          {skill.icon} {skill.name}
                        </span>
                      ))}
                    </div>

                    {/* Arrow indicator */}
                    <div className="absolute top-8 right-8 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="w-5 h-5 text-white/60" />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 对齐能力三层 */}
        <div className="mb-16">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Brain className="w-5 h-5 text-violet-400" />
            <h2 className="text-xl font-semibold text-white/80">三层对齐能力</h2>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {alignmentLayers.map((layer, index) => (
              <div
                key={layer.name}
                className={cn(
                  'relative p-6 rounded-2xl transition-all duration-500',
                  'bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm',
                  'hover:bg-white/[0.06] hover:border-white/10'
                )}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${layer.color}20` }}
                >
                  <layer.icon className="w-6 h-6" style={{ color: layer.color }} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{layer.name}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{layer.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 底部信息 */}
        <div className="text-center text-white/30 text-sm pb-8">
          <p>MeetMind · 视界 — 认知对齐，让理解没有偏差</p>
        </div>
      </div>

      {/* Scenario selection dialog */}
      <Dialog open={showScenarioDialog} onOpenChange={setShowScenarioDialog}>
        <DialogContent className="sm:max-w-2xl bg-slate-900/95 backdrop-blur-xl border-white/10 rounded-3xl p-0 overflow-hidden">
          {/* Header */}
          <div className="p-8 pb-6 text-center relative">
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 to-transparent" />
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-cyan-500/20">
                <Link2 className="w-8 h-8 text-white" />
              </div>
              <DialogTitle className="text-2xl font-bold text-white mb-2">你要对齐谁？</DialogTitle>
              <p className="text-white/50">选择场景，AI 将针对性地帮你理解对方</p>
            </div>
          </div>
          
          {/* Scenario cards */}
          <div className="px-8 pb-8 grid grid-cols-2 gap-4">
            {alignmentConcept.scenarios.map((scenario) => {
              const config = SCENARIO_CONFIGS[scenario.type]
              
              return (
                <button
                  key={scenario.type}
                  onClick={() => handleSelectScenario(scenario.type)}
                  className={cn(
                    'relative p-6 rounded-2xl text-left transition-all duration-300',
                    'border border-white/10 hover:border-white/20',
                    'hover:scale-[1.02] group overflow-hidden',
                    'bg-white/[0.02] hover:bg-white/[0.05]'
                  )}
                >
                  {/* Hover glow */}
                  <div 
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: `radial-gradient(circle at 50% 50%, ${scenario.color}15, transparent 70%)`,
                    }}
                  />
                  
                  <div className="relative">
                    {/* 对齐目标 */}
                    <div
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-4"
                      style={{ 
                        background: `${scenario.color}20`,
                        color: scenario.color,
                      }}
                    >
                      <Link2 className="w-3 h-3" />
                      对齐{scenario.target}
                    </div>

                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
                      style={{ 
                        background: `linear-gradient(135deg, ${scenario.color}30, ${scenario.color}10)`,
                      }}
                    >
                      <scenario.icon className="w-7 h-7" style={{ color: scenario.color }} />
                    </div>
                    
                    <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                      {config.icon} {config.name}
                    </h3>
                    <p className="text-white/50 text-sm leading-relaxed mb-4">{scenario.solution}</p>
                    
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
                    
                    {/* Arrow indicator */}
                    <div className="absolute top-6 right-6 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="w-4 h-4 text-white/60" />
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
