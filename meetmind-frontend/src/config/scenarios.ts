import type { ScenarioConfig, ScenarioType } from '@/types'

export const SCENARIO_CONFIGS: Record<ScenarioType, ScenarioConfig> = {
  classroom: {
    id: 'classroom',
    name: '课堂模式',
    icon: '🎓',
    description: '专为课堂学习设计，帮助你捕捉老师的言外之意，拓展知识边界',
    color: '#F59E0B',
    bgGradient: 'from-amber-500/20 via-orange-500/10 to-yellow-500/20',
    skills: [
      {
        id: 'inner_os',
        name: '老师言外之意',
        icon: '🎓',
        description: '解读老师话语背后的深层含义和教学意图',
      },
      {
        id: 'brainstorm',
        name: '知识拓展',
        icon: '🌟',
        description: '基于当前内容进行知识延伸和拓展',
      },
      {
        id: 'stop_talking',
        name: '重点回顾',
        icon: '📝',
        description: '回顾本节课的重点内容和知识点',
      },
    ],
    insightTypes: {
      data_chart: { icon: '📊', title: '关键数据', color: '#F59E0B' },
      focus_reminder: { icon: '🎯', title: '学习提醒', color: '#10B981' },
      redundancy_hint: { icon: '💡', title: '知识盲点', color: '#8B5CF6' },
      decision_record: { icon: '✅', title: '重要结论', color: '#3B82F6' },
      periodic_summary: { icon: '📋', title: '课堂小结', color: '#EC4899' },
      skill_result: { icon: '🎭', title: 'AI技能', color: '#6366F1' },
    },
    features: {
      impliedMeaning: true,
      todoTracking: false,
      decisionTracking: false,
      knowledgeExpansion: true,
      keyPointReview: true,
    },
  },
  meeting: {
    id: 'meeting',
    name: '会议模式',
    icon: '💼',
    description: '专为商务会议设计，追踪决策、待办事项，洞察潜台词',
    color: '#3B82F6',
    bgGradient: 'from-blue-500/20 via-indigo-500/10 to-purple-500/20',
    skills: [
      {
        id: 'inner_os',
        name: '潜台词分析',
        icon: '🎭',
        description: '分析发言者话语背后的真实意图',
      },
      {
        id: 'brainstorm',
        name: '破局灵感',
        icon: '💡',
        description: '针对当前讨论提供创新思路',
      },
      {
        id: 'stop_talking',
        name: '议程守护',
        icon: '⏰',
        description: '提醒会议偏离主题或超时',
      },
    ],
    insightTypes: {
      data_chart: { icon: '📊', title: '数据洞察', color: '#3B82F6' },
      focus_reminder: { icon: '🎯', title: '聚焦提醒', color: '#10B981' },
      redundancy_hint: { icon: '🔄', title: '冗余提示', color: '#F59E0B' },
      decision_record: { icon: '✅', title: '决策记录', color: '#8B5CF6' },
      periodic_summary: { icon: '📋', title: '阶段总结', color: '#EC4899' },
      skill_result: { icon: '🎭', title: 'AI技能', color: '#6366F1' },
    },
    features: {
      impliedMeaning: true,
      todoTracking: true,
      decisionTracking: true,
      knowledgeExpansion: false,
      keyPointReview: false,
    },
  },
}

export function getScenarioConfig(scenario: ScenarioType): ScenarioConfig {
  return SCENARIO_CONFIGS[scenario]
}

export function getScenarioColor(scenario: ScenarioType): string {
  return SCENARIO_CONFIGS[scenario].color
}

export function getScenarioName(scenario: ScenarioType): string {
  return SCENARIO_CONFIGS[scenario].name
}
