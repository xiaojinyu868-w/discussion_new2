import type { ScenarioConfig, ScenarioType } from '@/types'

/**
 * MeetMind 场景配置
 * 
 * 核心理念：认知对齐
 * - 教育场景：帮助学生与老师的思维对齐
 * - 会议场景：帮助参会者与他人的想法对齐
 */

export const SCENARIO_CONFIGS: Record<ScenarioType, ScenarioConfig> = {
  classroom: {
    id: 'classroom',
    name: '课堂模式',
    icon: '🎓',
    description: '与老师认知对齐 — 像有个学霸同桌，实时帮你翻译老师的深层意图',
    color: '#F59E0B',
    bgGradient: 'from-amber-500/20 via-orange-500/10 to-yellow-500/20',
    // 对齐目标
    alignmentTarget: '老师',
    alignmentGoal: '理解老师真正想传达的知识',
    skills: [
      {
        id: 'inner_os',
        name: '对齐老师思维',
        icon: '🎯',
        description: '捕捉老师话语中的认知密度最高点，翻译教学意图',
      },
      {
        id: 'brainstorm',
        name: '拓展认知边界',
        icon: '🌟',
        description: '建立知识连接，与更广阔的知识体系对齐',
      },
      {
        id: 'stop_talking',
        name: '对齐学习目标',
        icon: '📝',
        description: '梳理核心知识点，确保与课程目标保持同步',
      },
    ],
    insightTypes: {
      data_chart: { icon: '📊', title: '关键数据', color: '#F59E0B' },
      focus_reminder: { icon: '🎯', title: '对齐提醒', color: '#10B981' },
      redundancy_hint: { icon: '💡', title: '认知盲点', color: '#8B5CF6' },
      decision_record: { icon: '✅', title: '重要结论', color: '#3B82F6' },
      periodic_summary: { icon: '📋', title: '阶段对齐', color: '#EC4899' },
      skill_result: { icon: '🧠', title: '认知对齐', color: '#6366F1' },
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
    description: '与他人认知对齐 — 像有个读心高手，帮你解读每个人话语背后的真实意图',
    color: '#3B82F6',
    bgGradient: 'from-blue-500/20 via-indigo-500/10 to-purple-500/20',
    // 对齐目标
    alignmentTarget: '参会者',
    alignmentGoal: '理解他人话语背后的真实意图',
    skills: [
      {
        id: 'inner_os',
        name: '对齐他人意图',
        icon: '🎭',
        description: '解码话语背后的真实诉求，识别潜台词和立场',
      },
      {
        id: 'brainstorm',
        name: '破局新视角',
        icon: '💡',
        description: '跳出思维定式，与更高维度的解决方案对齐',
      },
      {
        id: 'stop_talking',
        name: '对齐会议目标',
        icon: '⏰',
        description: '守护会议主线，确保团队与目标保持同步',
      },
    ],
    insightTypes: {
      data_chart: { icon: '📊', title: '数据洞察', color: '#3B82F6' },
      focus_reminder: { icon: '🎯', title: '对齐提醒', color: '#10B981' },
      redundancy_hint: { icon: '🔄', title: '认知偏差', color: '#F59E0B' },
      decision_record: { icon: '✅', title: '共识记录', color: '#8B5CF6' },
      periodic_summary: { icon: '📋', title: '阶段对齐', color: '#EC4899' },
      skill_result: { icon: '🧠', title: '认知对齐', color: '#6366F1' },
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

export function getAlignmentTarget(scenario: ScenarioType): string {
  return SCENARIO_CONFIGS[scenario].alignmentTarget || (scenario === 'classroom' ? '老师' : '参会者')
}

export function getAlignmentGoal(scenario: ScenarioType): string {
  return SCENARIO_CONFIGS[scenario].alignmentGoal || ''
}
