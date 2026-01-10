import { Injectable, Logger } from '@nestjs/common';
import { LLMAdapterService } from '../llm/llm-adapter.service';
import { AnalysisResult, AnalysisType } from './types';

interface ContextSegment {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
}

@Injectable()
export class ContentAnalyzerService {
  private readonly logger = new Logger(ContentAnalyzerService.name);
  private readonly cooldowns = new Map<string, number>(); // sessionId-type -> lastTriggerTime

  // 冷却时间配置（毫秒）
  private readonly COOLDOWNS = {
    data_mention: 60000, // 数据检测：60秒
    decision_point: 60000, // 决策检测：60秒
    off_topic: 120000, // 跑题检测：120秒
    redundancy: 90000, // 冗余检测：90秒
    llm_detection: 60000, // LLM检测总冷却：60秒
    skill_request: 15000, // 技能请求检测：15秒
  };

  constructor(private readonly llmAdapter: LLMAdapterService) {}

  /**
   * 分析转写内容
   */
  async analyze(
    sessionId: string,
    segments: ContextSegment[],
  ): Promise<AnalysisResult[]> {
    if (!segments || segments.length === 0) {
      return [];
    }

    const results: AnalysisResult[] = [];
    const text = segments.map((s) => s.text).join('\n');

    this.logger.log(
      `Analyzing ${segments.length} segments for session ${sessionId}, text length: ${text.length}`,
    );
    this.logger.debug(`Text content: ${text.substring(0, 200)}...`);

    // 0. 技能请求检测（潜台词、灵感、聚焦）
    const skillRequestResult = this.detectSkillRequest(sessionId, segments, text);
    if (skillRequestResult) {
      results.push(skillRequestResult);
      this.logger.log(`Skill request detected in session ${sessionId}: ${skillRequestResult.metadata?.skillType}`);
    }

    // 1. 数据检测（正则 + 关键词，快速）
    const dataResult = this.detectData(sessionId, segments, text);
    if (dataResult) {
      results.push(dataResult);
      this.logger.log(`Data detected in session ${sessionId}`);
    }

    // 2. 决策检测（关键词，快速）
    const decisionResult = this.detectDecision(sessionId, segments, text);
    if (decisionResult) {
      results.push(decisionResult);
      this.logger.log(`Decision detected in session ${sessionId}`);
    }

    // 3. 跑题/冗余检测（LLM，较慢，合并调用）
    if (this.shouldRunLLMDetection(sessionId) && text.length > 100) {
      try {
        const llmResults = await this.detectWithLLM(sessionId, segments, text);
        results.push(...llmResults);
        if (llmResults.length > 0) {
          this.logger.log(
            `LLM detection found ${llmResults.length} issues in session ${sessionId}`,
          );
        }
      } catch (error) {
        this.logger.warn(`LLM detection failed: ${error}`);
      }
    }

    return results;
  }

  /**
   * 技能请求检测 - 用户请求AI技能（潜台词、灵感、聚焦）
   */
  private detectSkillRequest(
    sessionId: string,
    segments: ContextSegment[],
    text: string,
  ): AnalysisResult | null {
    if (this.isInCooldown(sessionId, 'skill_request')) {
      this.logger.debug(`Skill request detection skipped due to cooldown for session ${sessionId}`);
      return null;
    }

    this.logger.debug(`Detecting skill request in text: "${text.substring(0, 100)}..."`);

    // 潜台词/内心OS相关关键词
    const innerOsKeywords = [
      '潜台词',
      '内心[OoSs想法戏]',
      '真实想法',
      '话外音',
      '言外之意',
      '弦外之音',
      '看.*潜台词',
      '分析.*潜台词',
      '什么意思',
      '背后.*意思',
    ];

    // 灵感/头脑风暴相关关键词（更精确的匹配）
    const brainstormKeywords = [
      '灵感',
      '头脑风暴',
      '给.*创意',
      '来.*创意',
      '要.*创意',
      '给.*点子',
      '来.*点子',
      '要.*点子',
      '给.*想法',
      '来.*想法',
      '给.*建议',
      '来.*建议',
      '启发一下',
      '启发.*我',
      '给.*灵感',
      '来.*灵感',
      '要.*灵感',
      '激发.*灵感',
      '脑暴',
    ];

    // 聚焦相关关键词
    const focusKeywords = [
      '聚焦',
      '跑题',
      '偏题',
      '回到正题',
      '主题',
      '别说了',
      '停一下',
    ];

    // 检测潜台词请求
    for (const keyword of innerOsKeywords) {
      const regex = new RegExp(keyword, 'i');
      if (regex.test(text)) {
        this.updateCooldown(sessionId, 'skill_request');
        this.logger.log(`Inner OS skill request detected: ${keyword}`);
        return {
          type: 'skill_request',
          confidence: 0.9,
          triggerSegmentIds: segments.map((s) => s.id),
          context: text,
          metadata: {
            matches: [keyword],
            skillType: 'inner_os',
          },
        };
      }
    }

    // 检测灵感请求
    for (const keyword of brainstormKeywords) {
      const regex = new RegExp(keyword, 'i');
      if (regex.test(text)) {
        this.updateCooldown(sessionId, 'skill_request');
        this.logger.log(`Brainstorm skill request detected: ${keyword}`);
        return {
          type: 'skill_request',
          confidence: 0.9,
          triggerSegmentIds: segments.map((s) => s.id),
          context: text,
          metadata: {
            matches: [keyword],
            skillType: 'brainstorm',
          },
        };
      }
    }

    // 检测聚焦请求
    for (const keyword of focusKeywords) {
      const regex = new RegExp(keyword, 'i');
      if (regex.test(text)) {
        this.updateCooldown(sessionId, 'skill_request');
        this.logger.log(`Focus skill request detected: ${keyword}`);
        return {
          type: 'skill_request',
          confidence: 0.9,
          triggerSegmentIds: segments.map((s) => s.id),
          context: text,
          metadata: {
            matches: [keyword],
            skillType: 'stop_talking',
          },
        };
      }
    }

    return null;
  }

  /**
   * 数据检测 - 使用正则和关键词
   */
  private detectData(
    sessionId: string,
    segments: ContextSegment[],
    text: string,
  ): AnalysisResult | null {
    if (this.isInCooldown(sessionId, 'data_mention')) return null;

    const patterns = [
      /\d+(\.\d+)?%/g, // 百分比
      /\d{1,3}(,\d{3})*(\.\d+)?[万亿]?元?/g, // 金额/数量
      /Q[1-4]|第[一二三四]季度/g, // 季度
      /同比|环比|增长|下降|提升|降低|上涨|下跌/g, // 趋势词
      /\d+(\.\d+)?倍/g, // 倍数
      /[0-9]+年|[0-9]+月|[0-9]+日/g, // 日期
    ];

    const matches: string[] = [];
    for (const pattern of patterns) {
      const found = text.match(pattern);
      if (found) matches.push(...found);
    }

    // 去重
    const uniqueMatches = [...new Set(matches)];

    // 至少匹配到2个数据点才触发
    if (uniqueMatches.length >= 2) {
      this.updateCooldown(sessionId, 'data_mention');
      return {
        type: 'data_mention',
        confidence: Math.min(0.6 + uniqueMatches.length * 0.1, 1.0),
        triggerSegmentIds: segments.map((s) => s.id),
        context: text,
        metadata: {
          matches: uniqueMatches.slice(0, 10), // 最多保留10个
        },
      };
    }

    return null;
  }

  /**
   * 决策检测 - 使用关键词
   */
  private detectDecision(
    sessionId: string,
    segments: ContextSegment[],
    text: string,
  ): AnalysisResult | null {
    if (this.isInCooldown(sessionId, 'decision_point')) return null;

    const keywords = [
      '决定',
      '确定',
      '定了',
      '就这样',
      '达成共识',
      '同意',
      '通过',
      '敲定',
      '拍板',
      '最终方案',
      '一致认为',
      '结论是',
    ];
    const matched = keywords.filter((kw) => text.includes(kw));

    if (matched.length > 0) {
      this.updateCooldown(sessionId, 'decision_point');
      return {
        type: 'decision_point',
        confidence: Math.min(0.7 + matched.length * 0.1, 1.0),
        triggerSegmentIds: segments.map((s) => s.id),
        context: text,
        metadata: { matches: matched },
      };
    }

    return null;
  }

  /**
   * LLM 检测 - 跑题和冗余
   */
  private async detectWithLLM(
    sessionId: string,
    segments: ContextSegment[],
    text: string,
  ): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];

    // 更新 LLM 检测冷却
    this.updateCooldown(sessionId, 'llm_detection');

    const prompt = `分析以下会议对话片段，判断是否存在问题：

${text.substring(0, 1500)}

请判断：
1. 是否存在跑题（偏离主要议题，讨论无关话题）
2. 是否存在冗余（重复表述相同观点、兜圈子、说了很多但没有实质内容）

返回JSON格式（不要有其他内容）：
{
  "offTopic": { "detected": true或false, "confidence": 0到1之间的数字, "reason": "简短原因" },
  "redundancy": { "detected": true或false, "confidence": 0到1之间的数字, "reason": "简短原因" }
}`;

    try {
      const response = await this.llmAdapter.chatForJson<{
        offTopic: { detected: boolean; confidence: number; reason: string };
        redundancy: { detected: boolean; confidence: number; reason: string };
      }>([
        { role: 'system', content: '你是会议分析专家，擅长识别会议中的问题。只返回JSON，不要有其他内容。' },
        { role: 'user', content: prompt },
      ]);

      if (response?.offTopic?.detected && response.offTopic.confidence >= 0.7) {
        if (!this.isInCooldown(sessionId, 'off_topic')) {
          this.updateCooldown(sessionId, 'off_topic');
          results.push({
            type: 'off_topic',
            confidence: response.offTopic.confidence,
            triggerSegmentIds: segments.map((s) => s.id),
            context: text,
            metadata: { reason: response.offTopic.reason },
          });
        }
      }

      if (
        response?.redundancy?.detected &&
        response.redundancy.confidence >= 0.7
      ) {
        if (!this.isInCooldown(sessionId, 'redundancy')) {
          this.updateCooldown(sessionId, 'redundancy');
          results.push({
            type: 'redundancy',
            confidence: response.redundancy.confidence,
            triggerSegmentIds: segments.map((s) => s.id),
            context: text,
            metadata: { reason: response.redundancy.reason },
          });
        }
      }
    } catch (error) {
      this.logger.warn(`LLM detection parse failed: ${error}`);
    }

    return results;
  }

  // ========== 冷却时间管理 ==========

  private isInCooldown(sessionId: string, type: string): boolean {
    const key = `${sessionId}-${type}`;
    const lastTrigger = this.cooldowns.get(key) || 0;
    const cooldownMs =
      this.COOLDOWNS[type as keyof typeof this.COOLDOWNS] || 60000;
    return Date.now() - lastTrigger < cooldownMs;
  }

  private updateCooldown(sessionId: string, type: string): void {
    this.cooldowns.set(`${sessionId}-${type}`, Date.now());
  }

  private shouldRunLLMDetection(sessionId: string): boolean {
    return !this.isInCooldown(sessionId, 'llm_detection');
  }

  /**
   * 清理会话的冷却记录
   */
  clearCooldowns(sessionId: string): void {
    const keysToDelete: string[] = [];
    this.cooldowns.forEach((_, key) => {
      if (key.startsWith(`${sessionId}-`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => this.cooldowns.delete(key));
  }
}
