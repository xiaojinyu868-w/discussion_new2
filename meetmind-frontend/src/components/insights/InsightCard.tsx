import { cn } from '@/lib/utils'
import type { Insight, ScenarioType } from '@/types'
import { getScenarioConfig } from '@/config/scenarios'
import { BarChart3, Lightbulb, Target, RefreshCw, CheckSquare, FileText, Sparkles } from 'lucide-react'

interface InsightCardProps {
  insight: Insight
  scenario: ScenarioType
}

const iconMap: Record<string, React.ElementType> = {
  data_chart: BarChart3,
  chart_generated: BarChart3,
  skill_result: Sparkles,
  visualization_generated: Lightbulb,
  focus_reminder: Target,
  redundancy_hint: RefreshCw,
  decision_record: CheckSquare,
  periodic_summary: FileText,
}

export default function InsightCard({ insight, scenario }: InsightCardProps) {
  const config = getScenarioConfig(scenario)
  const typeConfig = config.insightTypes[insight.type]
  const Icon = iconMap[insight.type] || Lightbulb

  const renderSkillContent = () => {
    const content = insight.content
    const isClassroom = scenario === 'classroom'

    if (content.skillType === 'inner_os' && content.quote) {
      return (
        <div className={cn('mt-3 p-4 rounded-xl', isClassroom ? 'bg-amber-500/10' : 'bg-purple-500/10')}>
          <div className="text-xs text-slate-400 mb-1">💬 {isClassroom ? '老师原话' : '原话'}</div>
          <p className="text-slate-300 italic mb-3">"{content.quote}"</p>
          <div className="text-xs text-slate-400 mb-1">
            {isClassroom ? '🎓 老师言外之意' : '🎭 潜台词分析'}
          </div>
          <p className={cn('font-medium', isClassroom ? 'text-amber-400' : 'text-purple-400')}>
            {content.innerThought}
          </p>
          {content.emotion && (
            <p className="text-xs text-slate-500 mt-2">
              {isClassroom ? '教学意图' : '情绪'}: {content.emotion}
            </p>
          )}
        </div>
      )
    }

    if (content.skillType === 'brainstorm' && content.idea) {
      return (
        <div className={cn('mt-3 p-4 rounded-xl', isClassroom ? 'bg-green-500/10' : 'bg-amber-500/10')}>
          <div className="text-xs text-slate-400 mb-1">
            {isClassroom ? '🌟 知识拓展' : '💡 破局灵感'}
          </div>
          <p className={cn('font-medium mb-2', isClassroom ? 'text-green-400' : 'text-amber-400')}>
            {content.idea}
          </p>
          {content.rationale && (
            <p className="text-sm text-slate-400 mb-1">
              📖 {isClassroom ? '为什么重要' : '乔布斯式解释'}: {content.rationale}
            </p>
          )}
          {content.challenge && (
            <p className="text-xs text-slate-500">
              🎯 {isClassroom ? '思考题' : '挑战'}: {content.challenge}
            </p>
          )}
        </div>
      )
    }

    if (content.skillType === 'stop_talking') {
      return (
        <div className={cn('mt-3 p-4 rounded-xl', isClassroom ? 'bg-purple-500/10' : 'bg-pink-500/10')}>
          {content.mainTopic && (
            <p className="text-slate-300 mb-2">
              <span className="text-slate-500">{isClassroom ? '本节课主题' : '主题'}:</span> {content.mainTopic}
            </p>
          )}
          {content.deviation && (
            <p className="text-amber-400 mb-2">
              <span className="text-slate-500">{isClassroom ? '需要注意' : '偏离'}:</span> {content.deviation}
            </p>
          )}
          {content.reminder && (
            <p className={cn(isClassroom ? 'text-purple-400' : 'text-pink-400')}>
              💬 {isClassroom ? '学习建议' : '提醒'}: {content.reminder}
            </p>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all duration-200">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${typeConfig?.color || '#6366f1'}20` }}
        >
          <Icon className="w-5 h-5" style={{ color: typeConfig?.color || '#6366f1' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium" style={{ color: typeConfig?.color || '#6366f1' }}>
              {typeConfig?.icon} {typeConfig?.title || '智能洞察'}
            </span>
            <span className="text-xs text-slate-500">
              {new Date(insight.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {insight.content.title && (
            <h4 className="text-white font-medium mb-1">{insight.content.title}</h4>
          )}
          {insight.content.summary && (
            <p className="text-slate-300 text-sm">{insight.content.summary}</p>
          )}
          {insight.type === 'skill_result' && renderSkillContent()}
        </div>
      </div>
    </div>
  )
}
