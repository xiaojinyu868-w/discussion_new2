// 用户相关类型
export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  createdAt?: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

// 场景类型
export type ScenarioType = 'classroom' | 'meeting'

export interface ScenarioConfig {
  id: ScenarioType
  name: string
  icon: string
  description: string
  color: string
  bgGradient: string
  // 认知对齐相关
  alignmentTarget?: string  // 对齐目标：老师 / 参会者
  alignmentGoal?: string    // 对齐目标描述
  skills: SkillConfig[]
  insightTypes: Record<string, InsightTypeConfig>
  features: {
    impliedMeaning: boolean
    todoTracking: boolean
    decisionTracking: boolean
    knowledgeExpansion: boolean
    keyPointReview: boolean
  }
}

export interface SkillConfig {
  id: string
  name: string
  icon: string
  description: string
}

export interface InsightTypeConfig {
  icon: string
  title: string
  color: string
}

// 录音相关类型
export interface Recording {
  id: string
  blob?: Blob
  url?: string
  duration: number
  createdAt: string
  title?: string
  scenario: ScenarioType
}

export interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  duration: number
  audioLevel: number
}

// 转写相关类型
export interface TranscriptionSegment {
  id: string
  text: string
  startTime: number
  endTime: number
  speaker?: string
  confidence?: number
}

export interface TranscriptionResult {
  id: string
  sessionId: string
  segments: TranscriptionSegment[]
  fullText: string
  language: string
  createdAt: string
}

// 会话相关类型
export interface Session {
  id: string
  title: string
  scenario: ScenarioType
  status: 'active' | 'paused' | 'ended'
  createdAt: string
  updatedAt: string
  duration: number
  transcription?: TranscriptionResult
  insights: Insight[]
  summaries: Summary[]
}

// 洞察相关类型
export type InsightType = 
  | 'data_chart'
  | 'chart_generated'
  | 'skill_result'
  | 'visualization_generated'
  | 'focus_reminder'
  | 'redundancy_hint'
  | 'decision_record'
  | 'periodic_summary'

export interface Insight {
  id: string
  type: InsightType
  content: InsightContent
  createdAt: string
  sessionId: string
}

export interface InsightContent {
  title?: string
  summary?: string
  details?: string
  quote?: string
  innerThought?: string
  emotion?: string
  idea?: string
  rationale?: string
  challenge?: string
  mainTopic?: string
  deviation?: string
  reminder?: string
  skillType?: string
  chartData?: ChartData
  [key: string]: unknown
}

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'area'
  data: Array<Record<string, unknown>>
  xKey?: string
  yKey?: string
  title?: string
}

// 总结相关类型
export interface Summary {
  id: string
  sessionId: string
  type: 'periodic' | 'final'
  content: string
  keyPoints: string[]
  createdAt: string
}

// 聊天相关类型
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  isLoading?: boolean
}

// API 响应类型
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// 配额相关类型
export interface QuotaInfo {
  used: number
  total: number
  remaining: number
  resetAt?: string
}

// WebSocket 消息类型
export interface WSMessage {
  type: string
  payload: unknown
  timestamp: string
}

export interface TranscriptionWSMessage extends WSMessage {
  type: 'transcription'
  payload: {
    text: string
    isFinal: boolean
    segment?: TranscriptionSegment
  }
}

export interface InsightWSMessage extends WSMessage {
  type: 'insight'
  payload: Insight
}
