import { Injectable, Logger } from '@nestjs/common';
import { SkillService } from '../skill/skill.service';
import { VisualizationService } from '../visualization/visualization.service';
import { ContextStoreService } from '../context/context-store.service';
import { LLMAdapterService } from '../llm/llm-adapter.service';
import { AnalysisResult, AgentInsight } from './types';

@Injectable()
export class ActionDispatcherService {
  private readonly logger = new Logger(ActionDispatcherService.name);

  constructor(
    private readonly skillService: SkillService,
    private readonly visualizationService: VisualizationService,
    private readonly contextStore: ContextStoreService,
    private readonly llmAdapter: LLMAdapterService,
  ) {}

  /**
   * 根据分析结果分发动作
   */
  async dispatch(
    sessionId: string,
    result: AnalysisResult,
  ): Promise<AgentInsight | null> {
    this.logger.log(
      `Dispatching action for ${result.type} in session ${sessionId}`,
    );

    try {
      switch (result.type) {
        case 'data_mention':
          return await this.handleDataMention(sessionId, result);
        case 'chart_request':
          return await this.handleChartRequest(sessionId, result);
        case 'skill_request':
          return await this.handleSkillRequest(sessionId, result);
        case 'visualization_request':
          return await this.handleVisualizationRequest(sessionId, result);
        case 'off_topic':
          return await this.handleOffTopic(sessionId, result);
        case 'redundancy':
          return await this.handleRedundancy(sessionId, result);
        case 'decision_point':
          return await this.handleDecision(sessionId, result);
        default:
          this.logger.warn(`Unknown analysis type: ${result.type}`);
          return null;
      }
    } catch (error) {
      this.logger.error(`Action dispatch failed for ${result.type}: ${error}`);
      return null;
    }
  }

  /**
   * 处理用户图表请求 - 用户明确要求生成图表
   */
  private async handleChartRequest(
    sessionId: string,
    result: AnalysisResult,
  ): Promise<AgentInsight> {
    const chartType = result.metadata?.chartType || 'bar';
    this.logger.log(`Handling chart request for session ${sessionId}, chartType: ${chartType}`);

    // 获取最近的上下文用于生成图表
    const recentText = this.contextStore.getRecentText(sessionId, 2); // 最近2分钟

    // 调用视觉化服务生成图表
    let visualization: AgentInsight['visualization'];
    try {
      const visResult = await this.visualizationService.generateVisualization({
        sessionId,
        type: 'chart',
        chartType: chartType as 'radar' | 'flowchart' | 'architecture' | 'bar',
      });

      if (visResult.imageUrl || visResult.imageBase64) {
        visualization = {
          type: 'chart',
          imageUrl: visResult.imageUrl,
          imageBase64: visResult.imageBase64,
        };
        this.logger.log(`Chart generated successfully for session ${sessionId}`);
      }
    } catch (error) {
      this.logger.error(`Chart generation failed for chart request: ${error}`);
    }

    // 生成摘要
    let summary = '已根据您的请求生成数据图表';
    if (recentText && recentText.length > 20) {
      try {
        summary = await this.llmAdapter.chatWithPrompt(
          '你是数据可视化专家，擅长简洁描述图表内容。',
          `用户请求生成图表，以下是相关对话内容：\n\n${recentText.substring(0, 800)}\n\n请用一句话（不超过40字）描述这个图表展示的内容。直接返回描述，不要有引号。`,
        );
      } catch (error) {
        this.logger.warn(`Summary generation failed: ${error}`);
      }
    }

    return {
      id: `agent-chart-${Date.now()}`,
      sessionId,
      type: 'chart_generated',
      triggerSegmentIds: result.triggerSegmentIds,
      content: {
        title: '📊 数据图表',
        summary: summary?.trim() || '已根据您的请求生成数据图表',
        chartType,
      },
      visualization,
      createdAt: new Date(),
      isAuto: true,
    };
  }

  /**
   * 处理技能请求 - 用户请求AI技能（潜台词、灵感、聚焦）
   */
  private async handleSkillRequest(
    sessionId: string,
    result: AnalysisResult,
  ): Promise<AgentInsight> {
    const skillType = result.metadata?.skillType || 'inner_os';
    this.logger.log(`Handling skill request for session ${sessionId}, skillType: ${skillType}`);

    let skillContent: any = {};
    let title = '💡 AI洞察';
    let summary = '';

    try {
      const skillResult = await this.skillService.triggerSkill(sessionId, skillType);
      
      // 根据技能类型处理结果
      if (skillType === 'inner_os') {
        title = '🎭 潜台词分析';
        const items = skillResult.content as any[];
        if (items && items.length > 0) {
          const item = items[0];
          skillContent = {
            quote: item.quote,
            innerThought: item.innerThought,
            emotion: item.emotion,
          };
          summary = item.innerThought || '已分析对话潜台词';
        }
      } else if (skillType === 'brainstorm') {
        title = '💡 灵感激发';
        const items = skillResult.content as any[];
        if (items && items.length > 0) {
          const item = items[0];
          skillContent = {
            idea: item.idea,
            rationale: item.rationale,
            challenge: item.challenge,
          };
          summary = item.idea || '已生成创意灵感';
        }
      } else if (skillType === 'stop_talking') {
        title = '🎯 聚焦分析';
        const content = skillResult.content as any;
        skillContent = {
          isOffTopic: content.isOffTopic,
          mainTopic: content.mainTopic,
          deviation: content.deviation,
          reminder: content.reminder,
        };
        summary = content.reminder || '已分析讨论焦点';
      }
    } catch (error) {
      this.logger.error(`Skill execution failed: ${error}`);
      summary = '技能执行失败，请稍后重试';
    }

    return {
      id: `agent-skill-${Date.now()}`,
      sessionId,
      type: 'skill_result',
      triggerSegmentIds: result.triggerSegmentIds,
      content: {
        title,
        summary,
        skillType,
        ...skillContent,
      },
      createdAt: new Date(),
      isAuto: true,
    };
  }

  /**
   * 处理视觉化请求 - 用户请求创意图像或逻辑海报
   */
  private async handleVisualizationRequest(
    sessionId: string,
    result: AnalysisResult,
  ): Promise<AgentInsight> {
    const visualizationType = result.metadata?.visualizationType || 'creative';
    this.logger.log(`Handling visualization request for session ${sessionId}, type: ${visualizationType}`);

    let visualization: AgentInsight['visualization'];
    let title = '🎨 视觉化';
    let summary = '';

    try {
      const visResult = await this.visualizationService.generateVisualization({
        sessionId,
        type: visualizationType as 'creative' | 'poster',
      });

      if (visResult.imageUrl || visResult.imageBase64) {
        visualization = {
          type: visualizationType as 'creative' | 'poster',
          imageUrl: visResult.imageUrl,
          imageBase64: visResult.imageBase64,
        };

        if (visualizationType === 'creative') {
          title = '🎨 创意图像';
          summary = '已根据会议内容生成创意图像';
        } else if (visualizationType === 'poster') {
          title = '📋 逻辑海报';
          summary = '已根据会议内容生成逻辑海报';
        }

        this.logger.log(`Visualization generated successfully for session ${sessionId}`);
      }
    } catch (error) {
      this.logger.error(`Visualization generation failed: ${error}`);
      summary = '视觉化生成失败，请稍后重试';
    }

    // 如果有上下文，尝试生成更好的描述
    if (visualization) {
      try {
        const recentText = this.contextStore.getRecentText(sessionId, 2);
        if (recentText && recentText.length > 20) {
          const desc = await this.llmAdapter.chatWithPrompt(
            '你是视觉化专家，擅长简洁描述图像内容。',
            `用户请求生成${visualizationType === 'creative' ? '创意图像' : '逻辑海报'}，以下是相关对话内容：\n\n${recentText.substring(0, 500)}\n\n请用一句话（不超过30字）描述这个${visualizationType === 'creative' ? '图像' : '海报'}展示的内容。直接返回描述。`,
          );
          if (desc) {
            summary = desc.trim();
          }
        }
      } catch (error) {
        this.logger.warn(`Summary generation failed: ${error}`);
      }
    }

    return {
      id: `agent-vis-${Date.now()}`,
      sessionId,
      type: 'visualization_generated',
      triggerSegmentIds: result.triggerSegmentIds,
      content: {
        title,
        summary: summary || `已生成${visualizationType === 'creative' ? '创意图像' : '逻辑海报'}`,
        visualizationType,
      },
      visualization,
      createdAt: new Date(),
      isAuto: true,
    };
  }

  /**
   * 处理数据提及 - 自动生成图表
   * 关键：调用现有的 VisualizationService
   */
  private async handleDataMention(
    sessionId: string,
    result: AnalysisResult,
  ): Promise<AgentInsight> {
    const chartType = result.metadata?.chartType || 'bar';

    // 生成数据摘要
    const summary = await this.generateDataSummary(
      result.context,
      result.metadata?.matches || [],
    );

    // 尝试调用现有的视觉化服务生成图表
    let visualization: AgentInsight['visualization'];
    try {
      const visResult = await this.visualizationService.generateVisualization({
        sessionId,
        type: 'chart',
        chartType: chartType as 'radar' | 'flowchart' | 'architecture' | 'bar',
      });

      if (visResult.imageUrl || visResult.imageBase64) {
        visualization = {
          type: 'chart',
          imageUrl: visResult.imageUrl,
          imageBase64: visResult.imageBase64,
        };
        this.logger.log(`Chart generated for session ${sessionId}`);
      }
    } catch (error) {
      this.logger.warn(`Chart generation failed: ${error}`);
      // 图表生成失败，继续生成文字洞察
    }

    return {
      id: `agent-data-${Date.now()}`,
      sessionId,
      type: 'data_chart',
      triggerSegmentIds: result.triggerSegmentIds,
      content: {
        title: '📊 数据洞察',
        summary,
        dataPoints: result.metadata?.matches,
      },
      visualization,
      createdAt: new Date(),
      isAuto: true,
    };
  }

  /**
   * 处理跑题 - 调用现有的 stop_talking 技能
   * 关键：复用 SkillService.triggerSkill
   */
  private async handleOffTopic(
    sessionId: string,
    result: AnalysisResult,
  ): Promise<AgentInsight> {
    let skillContent: any = {};

    try {
      // 调用现有的聚焦技能
      const skillResult = await this.skillService.triggerSkill(
        sessionId,
        'stop_talking',
      );
      // SkillResult.content 对于 stop_talking 是 StopTalkingResult 对象
      if (skillResult.content) {
        skillContent = skillResult.content;
      }
    } catch (error) {
      this.logger.warn(`Stop talking skill failed: ${error}`);
    }

    return {
      id: `agent-focus-${Date.now()}`,
      sessionId,
      type: 'focus_reminder',
      triggerSegmentIds: result.triggerSegmentIds,
      content: {
        title: '🎯 聚焦提醒',
        hint: '检测到话题可能偏离主线',
        reason: result.metadata?.reason || '讨论内容与核心议题相关性较低',
        suggestion: skillContent.reminder || '建议聚焦核心议题，提高讨论效率',
        mainTopic: skillContent.mainTopic,
        ...skillContent,
      },
      createdAt: new Date(),
      isAuto: true,
    };
  }

  /**
   * 处理冗余
   */
  private async handleRedundancy(
    sessionId: string,
    result: AnalysisResult,
  ): Promise<AgentInsight> {
    return {
      id: `agent-redundancy-${Date.now()}`,
      sessionId,
      type: 'redundancy_hint',
      triggerSegmentIds: result.triggerSegmentIds,
      content: {
        title: '💬 精简建议',
        hint: '检测到重复表述',
        reason: result.metadata?.reason || '部分内容存在重复表述',
        suggestion: '建议聚焦核心要点，避免重复，提高表达效率',
      },
      createdAt: new Date(),
      isAuto: true,
    };
  }

  /**
   * 处理决策时刻
   */
  private async handleDecision(
    sessionId: string,
    result: AnalysisResult,
  ): Promise<AgentInsight> {
    const decisionSummary = await this.generateDecisionSummary(result.context);

    return {
      id: `agent-decision-${Date.now()}`,
      sessionId,
      type: 'decision_record',
      triggerSegmentIds: result.triggerSegmentIds,
      content: {
        title: '✅ 决策记录',
        decision: decisionSummary.decision,
        nextSteps: decisionSummary.nextSteps,
        timestamp: new Date().toLocaleTimeString('zh-CN'),
      },
      createdAt: new Date(),
      isAuto: true,
    };
  }

  /**
   * 周期性总结（每30秒）
   */
  async dispatchPeriodicSummary(sessionId: string): Promise<AgentInsight | null> {
    const recentText = this.contextStore.getRecentText(sessionId, 1); // 最近1分钟

    this.logger.log(`Periodic summary check: sessionId=${sessionId}, textLength=${recentText?.length || 0}`);

    if (!recentText || recentText.length < 30) {
      this.logger.debug(`Not enough content for periodic summary in session ${sessionId}`);
      return null;
    }

    try {
      const summary = await this.llmAdapter.chatWithPrompt(
        '你是会议摘要专家，擅长用一句话概括会议进展。',
        `请用一句话（不超过50字）总结以下会议内容的核心进展：

${recentText.substring(0, 1000)}

直接返回总结内容，不要有引号或其他格式。`,
      );

      if (!summary || summary.length < 5) {
        return null;
      }

      return {
        id: `agent-summary-${Date.now()}`,
        sessionId,
        type: 'periodic_summary',
        triggerSegmentIds: [],
        content: {
          title: '📝 阶段小结',
          summary: summary.trim(),
          timestamp: new Date().toLocaleTimeString('zh-CN'),
        },
        createdAt: new Date(),
        isAuto: true,
      };
    } catch (error) {
      this.logger.warn(`Periodic summary generation failed: ${error}`);
      return null;
    }
  }

  // ========== 辅助方法 ==========

  /**
   * 生成数据摘要
   */
  private async generateDataSummary(
    context: string,
    matches: string[],
  ): Promise<string> {
    if (!matches || matches.length === 0) {
      return '检测到关键数据';
    }

    try {
      const prompt = `根据以下对话内容，用一句话（不超过40字）总结提到的数据要点：

${context.substring(0, 800)}

检测到的数据：${matches.slice(0, 5).join(', ')}

直接返回总结，不要有引号。`;

      const summary = await this.llmAdapter.chatWithPrompt(
        '你是数据分析专家，擅长简洁总结数据要点。',
        prompt,
      );

      return summary?.trim() || `检测到关键数据：${matches.slice(0, 3).join(', ')}`;
    } catch (error) {
      return `检测到关键数据：${matches.slice(0, 3).join(', ')}`;
    }
  }

  /**
   * 生成决策摘要
   */
  private async generateDecisionSummary(
    context: string,
  ): Promise<{ decision: string; nextSteps?: string[] }> {
    try {
      const prompt = `从以下对话中提取决策要点：

${context.substring(0, 800)}

返回JSON格式（不要有其他内容）：
{"decision":"决策内容（一句话）","nextSteps":["后续行动1","后续行动2"]}`;

      const result = await this.llmAdapter.chatForJson<{
        decision: string;
        nextSteps?: string[];
      }>([
        { role: 'system', content: '你是会议记录专家，擅长提取决策要点。只返回JSON。' },
        { role: 'user', content: prompt },
      ]);

      return result || { decision: '达成重要决策' };
    } catch (error) {
      return { decision: '达成重要决策' };
    }
  }
}
