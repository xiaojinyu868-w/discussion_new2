import { Injectable, Logger } from '@nestjs/common';
import { ContextStoreService } from '../context/context-store.service';
import { ContentAnalyzerService } from './content-analyzer.service';
import { ActionDispatcherService } from './action-dispatcher.service';
import { AgentInsight, AgentSessionState, AgentStatusResponse } from './types';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly sessions = new Map<string, AgentSessionState>();

  // Agent 配置
  private readonly CYCLE_INTERVAL_MS = 10000; // 每10秒运行一次 Agent 循环
  private readonly SUMMARY_INTERVAL_MS = 30000; // 每30秒生成周期性总结

  constructor(
    private readonly contextStore: ContextStoreService,
    private readonly contentAnalyzer: ContentAnalyzerService,
    private readonly actionDispatcher: ActionDispatcherService,
  ) {}

  /**
   * 启动 Agent 监控
   */
  startAgent(sessionId: string): void {
    if (this.sessions.has(sessionId)) {
      this.logger.warn(`Agent already running for session ${sessionId}`);
      return;
    }

    this.sessions.set(sessionId, {
      intervalId: null,
      enabled: true,
      lastAnalyzedIndex: 0,
      lastSummaryTime: Date.now() - this.SUMMARY_INTERVAL_MS, // 让第一次总结可以立即触发
      insights: [],
    });

    // 立即执行第一次分析
    this.runAgentCycle(sessionId).catch(err => {
      this.logger.error(`Initial agent cycle failed: ${err}`);
    });

    // 设置定时循环
    const intervalId = setInterval(async () => {
      await this.runAgentCycle(sessionId);
    }, this.CYCLE_INTERVAL_MS);

    const session = this.sessions.get(sessionId);
    if (session) {
      session.intervalId = intervalId;
    }

    this.logger.log(`Agent started for session ${sessionId}`);
  }

  /**
   * 停止 Agent 监控
   */
  stopAgent(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.intervalId) {
        clearInterval(session.intervalId);
      }
      // 清理内容分析器的冷却记录
      this.contentAnalyzer.clearCooldowns(sessionId);
      this.sessions.delete(sessionId);
      this.logger.log(`Agent stopped for session ${sessionId}`);
    }
  }

  /**
   * 获取 Agent 状态
   */
  getAgentStatus(sessionId: string): AgentStatusResponse {
    const session = this.sessions.get(sessionId);
    return {
      enabled: session?.enabled ?? false,
      insightCount: session?.insights.length ?? 0,
      lastAnalyzedIndex: session?.lastAnalyzedIndex ?? 0,
      lastSummaryTime: session?.lastSummaryTime ?? 0,
    };
  }

  /**
   * 获取 Agent 生成的洞察
   */
  getAgentInsights(sessionId: string): AgentInsight[] {
    return this.sessions.get(sessionId)?.insights ?? [];
  }

  /**
   * 获取新的 Agent 洞察（自上次获取后新增的）
   */
  getNewInsights(sessionId: string, afterId?: string): AgentInsight[] {
    const insights = this.getAgentInsights(sessionId);
    if (!afterId) {
      return insights;
    }

    const afterIndex = insights.findIndex((i) => i.id === afterId);
    if (afterIndex === -1) {
      return insights;
    }

    return insights.slice(afterIndex + 1);
  }

  /**
   * Agent 主循环
   */
  private async runAgentCycle(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session?.enabled) {
      return;
    }

    try {
      // 1. 获取新的转写内容
      const segments = this.contextStore.getSegments(sessionId);
      this.logger.log(`Agent cycle: session=${sessionId}, total segments=${segments.length}, lastAnalyzed=${session.lastAnalyzedIndex}`);
      
      const newSegments = segments.slice(session.lastAnalyzedIndex);

      if (newSegments.length > 0) {
        this.logger.debug(
          `Processing ${newSegments.length} new segments for session ${sessionId}`,
        );

        // 2. 内容分析
        const analysisResults = await this.contentAnalyzer.analyze(
          sessionId,
          newSegments,
        );

        // 3. 根据分析结果分发动作
        for (const result of analysisResults) {
          const insight = await this.actionDispatcher.dispatch(
            sessionId,
            result,
          );
          if (insight) {
            session.insights.push(insight);
            this.logger.log(
              `New insight generated: ${insight.type} for session ${sessionId}`,
            );
          }
        }

        // 4. 更新分析进度
        session.lastAnalyzedIndex = segments.length;
      }

      // 5. 检查是否需要周期性总结（每30秒）
      const now = Date.now();
      if (now - session.lastSummaryTime >= this.SUMMARY_INTERVAL_MS) {
        const summaryInsight =
          await this.actionDispatcher.dispatchPeriodicSummary(sessionId);
        if (summaryInsight) {
          session.insights.push(summaryInsight);
          this.logger.log(`Periodic summary generated for session ${sessionId}`);
        }
        session.lastSummaryTime = now;
      }
    } catch (error) {
      this.logger.error(`Agent cycle failed for session ${sessionId}: ${error}`);
    }
  }

  /**
   * 手动触发一次 Agent 分析（用于测试或即时分析）
   */
  async triggerAnalysis(sessionId: string): Promise<AgentInsight[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.warn(`No agent session found for ${sessionId}`);
      return [];
    }

    const previousInsightCount = session.insights.length;
    await this.runAgentCycle(sessionId);
    return session.insights.slice(previousInsightCount);
  }

  /**
   * 清理所有会话（应用关闭时调用）
   */
  cleanupAll(): void {
    this.sessions.forEach((session, sessionId) => {
      if (session.intervalId) {
        clearInterval(session.intervalId);
      }
      this.contentAnalyzer.clearCooldowns(sessionId);
    });
    this.sessions.clear();
    this.logger.log('All agent sessions cleaned up');
  }
}
