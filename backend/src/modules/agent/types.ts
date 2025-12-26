/**
 * Agent 模块类型定义
 * V3 - Agent-Flow 智能联动系统
 */

// 分析类型
export type AnalysisType =
  | 'data_mention' // 关键数据
  | 'off_topic' // 跑题
  | 'redundancy' // 冗余/兜圈子
  | 'decision_point' // 决策时刻
  | 'chart_request' // 用户请求生成图表
  | 'skill_request' // 用户请求AI技能（潜台词、灵感、聚焦）
  | 'visualization_request'; // 用户请求视觉化（创意图像、逻辑海报）

// 分析结果
export interface AnalysisResult {
  type: AnalysisType;
  confidence: number;
  triggerSegmentIds: string[];
  context: string;
  metadata?: {
    matches?: string[]; // 匹配到的数据/关键词
    chartType?: string; // 推荐的图表类型
    reason?: string; // 检测原因
    skillType?: 'inner_os' | 'brainstorm' | 'stop_talking'; // 技能类型
    visualizationType?: 'creative' | 'poster'; // 视觉化类型
  };
}

// 洞察类型
export type InsightType =
  | 'data_chart' // 数据图表
  | 'focus_reminder' // 聚焦提醒
  | 'redundancy_hint' // 冗余提示
  | 'decision_record' // 决策记录
  | 'periodic_summary' // 周期性总结
  | 'chart_generated' // 用户请求生成的图表
  | 'skill_result' // AI技能结果（潜台词、灵感等）
  | 'visualization_generated'; // 视觉化结果（创意图像、逻辑海报）

// Agent 洞察
export interface AgentInsight {
  id: string;
  sessionId: string;
  type: InsightType;
  triggerSegmentIds: string[];
  content: {
    title: string;
    summary?: string;
    dataPoints?: string[];
    hint?: string;
    suggestion?: string;
    reason?: string;
    decision?: string;
    nextSteps?: string[];
    timestamp?: string;
    [key: string]: any;
  };
  visualization?: {
    type: 'chart' | 'creative' | 'poster';
    imageUrl?: string;
    imageBase64?: string;
  };
  createdAt: Date;
  isAuto: true; // 标记为自动生成
}

// Agent 会话状态
export interface AgentSessionState {
  intervalId: NodeJS.Timeout | null;
  enabled: boolean;
  lastAnalyzedIndex: number; // 上次分析到的转写索引
  lastSummaryTime: number; // 上次总结时间
  lastSummaryTextLength: number; // 上次总结时的文本长度（用于检测内容变化）
  insights: AgentInsight[]; // 生成的洞察列表
}

// Agent 配置
export interface AgentConfig {
  cycleIntervalMs: number; // Agent 循环间隔（毫秒）
  summaryIntervalMs: number; // 周期性总结间隔（毫秒）
  dataCooldownMs: number; // 数据检测冷却时间
  offTopicCooldownMs: number; // 跑题检测冷却时间
  redundancyCooldownMs: number; // 冗余检测冷却时间
  decisionCooldownMs: number; // 决策检测冷却时间
  minConfidence: number; // 最小置信度阈值
}

// Agent 状态响应
export interface AgentStatusResponse {
  enabled: boolean;
  insightCount: number;
  lastAnalyzedIndex: number;
  lastSummaryTime: number;
}
