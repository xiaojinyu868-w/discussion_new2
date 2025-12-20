import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ContextStoreService } from "../context/context-store.service";
import { LLMAdapterService } from "../llm/llm-adapter.service";

export interface AutoAnalysisResult {
  phase: string;
  keyPoints: string[];
  blindSpots: string[];
  expertAdvice: string;
  innerOS?: string;
  timestamp: Date;
}

const AUTO_ANALYSIS_PROMPT = `你是一位资深的会议分析师，负责实时监控会议状态。

任务：分析当前会议进展，提供多维度洞察。

重要提示：
1. 会议内容来自实时转写，可能存在同音错别字或识别误差
2. 请根据上下文逻辑，自动修正原文中可能的同音错别字（如将"部署"修正为"部署"）后再进行分析
3. 修正时需保持原意不变，仅修正明显的识别错误
4. 在分析时，可以结合上下文逻辑进行合理的推断和补充

会议内容：
{context}

请分析：
1. 会议阶段（开场/讨论/争论/决策/总结）
2. 3个核心关键点（基于修正后的内容）
3. 潜在的逻辑漏洞或盲点
4. 是否需要专家介入的建议
5. 可选：一句话内心OS洞察

输出JSON格式（不要包含markdown代码块标记）：
{
  "phase": "阶段",
  "keyPoints": ["关键点1", "关键点2", "关键点3"],
  "blindSpots": ["盲点"],
  "expertAdvice": "专家建议",
  "innerOS": "一句话内心OS（可选）"
}`;

type AnalysisCallback = (
  sessionId: string,
  result: AutoAnalysisResult
) => void | Promise<void>;

interface SessionAnalysis {
  intervalId: NodeJS.Timeout;
  callback: AnalysisCallback;
  enabled: boolean;
}

@Injectable()
export class AutoPushService implements OnModuleDestroy {
  private readonly logger = new Logger(AutoPushService.name);
  private readonly intervalMs: number;
  private readonly defaultEnabled: boolean;
  private readonly sessions = new Map<string, SessionAnalysis>();

  constructor(
    private readonly configService: ConfigService,
    private readonly contextStore: ContextStoreService,
    private readonly llmAdapter: LLMAdapterService
  ) {
    this.intervalMs =
      this.configService.get<number>("autoPush.intervalMs") ?? 60000;
    this.defaultEnabled =
      this.configService.get<boolean>("autoPush.enabled") ?? true;

    this.logger.log(
      `AutoPush initialized: interval=${this.intervalMs}ms, defaultEnabled=${this.defaultEnabled}`
    );
  }

  onModuleDestroy() {
    // 清理所有定时器
    for (const [sessionId] of this.sessions) {
      this.stopAutoAnalysis(sessionId);
    }
  }

  /**
   * 开启自动分析
   */
  startAutoAnalysis(sessionId: string, callback: AnalysisCallback): void {
    if (this.sessions.has(sessionId)) {
      this.logger.warn(`Auto analysis already running for session ${sessionId}`);
      return;
    }

    if (!this.llmAdapter.isAvailable()) {
      this.logger.warn(
        `LLM not available, auto analysis disabled for session ${sessionId}`
      );
      return;
    }

    this.logger.log(
      `Starting auto analysis for session ${sessionId}, interval=${this.intervalMs}ms`
    );

    const intervalId = setInterval(async () => {
      const session = this.sessions.get(sessionId);
      if (!session?.enabled) return;

      try {
        const result = await this.analyze(sessionId);
        if (result) {
          await callback(sessionId, result);
        }
      } catch (error) {
        this.logger.error(
          `Auto analysis failed for session ${sessionId}: ${error}`
        );
      }
    }, this.intervalMs);

    this.sessions.set(sessionId, {
      intervalId,
      callback,
      enabled: true,
    });
  }

  /**
   * 停止自动分析
   */
  stopAutoAnalysis(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.logger.log(`Stopping auto analysis for session ${sessionId}`);
    clearInterval(session.intervalId);
    this.sessions.delete(sessionId);
  }

  /**
   * 暂停自动分析
   */
  pauseAutoAnalysis(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.enabled = false;
      this.logger.log(`Paused auto analysis for session ${sessionId}`);
    }
  }

  /**
   * 恢复自动分析
   */
  resumeAutoAnalysis(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.enabled = true;
      this.logger.log(`Resumed auto analysis for session ${sessionId}`);
    }
  }

  /**
   * 检查是否正在运行
   */
  isRunning(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session?.enabled ?? false;
  }

  /**
   * 执行一次分析
   */
  async analyze(sessionId: string): Promise<AutoAnalysisResult | null> {
    const context = this.contextStore.getFullText(sessionId);
    if (!context || context.trim().length === 0) {
      this.logger.debug(
        `No context available for auto analysis, session ${sessionId}`
      );
      return null;
    }

    const stats = this.contextStore.getStats(sessionId);
    this.logger.log(
      `Running auto analysis for session ${sessionId}, ` +
        `segments=${stats.segmentCount}, textLength=${stats.totalTextLength}`
    );

    const prompt = AUTO_ANALYSIS_PROMPT.replace("{context}", context);
    const startTime = Date.now();

    try {
      const response = await this.llmAdapter.chatWithPrompt(
        "你是一个专业的会议分析助手，请按照要求输出JSON格式的结果。",
        prompt,
        { temperature: 0.7, maxTokens: 1500 }
      );

      const result = this.parseAnalysisResponse(response);
      result.timestamp = new Date();

      // 更新会议阶段
      this.contextStore.setMeetingPhase(sessionId, result.phase);
      this.contextStore.setLastAutoAnalysis(sessionId, result.timestamp);

      // 保存到消息流
      this.contextStore.appendMessage(sessionId, {
        role: "assistant",
        content: JSON.stringify(result),
        timestamp: result.timestamp,
        type: "auto_push",
      });

      this.logger.log(
        `Auto analysis completed for session ${sessionId} in ${Date.now() - startTime}ms, ` +
          `phase=${result.phase}`
      );

      return result;
    } catch (error) {
      this.logger.error(`Auto analysis failed: ${error}`);
      return null;
    }
  }

  private parseAnalysisResponse(response: string): AutoAnalysisResult {
    try {
      let jsonStr = response.trim();

      // 移除可能的 markdown 代码块
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr);

      return {
        phase: parsed.phase ?? "讨论",
        keyPoints: parsed.keyPoints ?? [],
        blindSpots: parsed.blindSpots ?? [],
        expertAdvice: parsed.expertAdvice ?? "",
        innerOS: parsed.innerOS,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.warn(`Failed to parse auto analysis response: ${error}`);
      return {
        phase: "未知",
        keyPoints: [],
        blindSpots: [],
        expertAdvice: "分析失败，请稍后重试",
        timestamp: new Date(),
      };
    }
  }

  /**
   * 转换为摘要卡片格式
   */
  toSummaryCard(
    sessionId: string,
    result: AutoAnalysisResult
  ): {
    id: string;
    type: string;
    title: string;
    content: any;
    updatedAt: string;
  } {
    return {
      id: `${sessionId}-auto-${result.timestamp.getTime()}`,
      type: "auto_analysis",
      title: `会议分析 - ${result.phase}`,
      content: {
        phase: result.phase,
        keyPoints: result.keyPoints,
        blindSpots: result.blindSpots,
        expertAdvice: result.expertAdvice,
        innerOS: result.innerOS,
      },
      updatedAt: result.timestamp.toISOString(),
    };
  }
}
