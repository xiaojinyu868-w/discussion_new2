import { Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

/**
 * ASR 转录词语结构（兼容多种 ASR 服务）
 * @deprecated 保留用于向后兼容，新代码应使用 ContextSegment
 */
export interface TingwuWord {
  startTime: number;
  endTime: number;
  text: string;
  fixed?: boolean;
  punc?: string;
}

/**
 * ASR 转录结果结构（兼容多种 ASR 服务）
 * @deprecated 保留用于向后兼容，新代码应直接使用 appendSegment
 */
export interface TingwuTranscriptionPayload {
  result: string;
  words: TingwuWord[];
  index: number;
  time: number;
  confidence: number;
  fixed_result?: string;
}

/**
 * 内部存储结构（简化，不区分说话人）
 */
export interface ContextSegment {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  timestamp: Date;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  type?: "skill" | "qa" | "auto_push";
}

export interface SessionContext {
  sessionId: string;
  meetingId?: number; // 数据库中的会议 ID
  segments: ContextSegment[];
  messages: ChatMessage[];
  meetingPhase: string;
  lastAutoAnalysis: Date | null;
  pendingSegments: ContextSegment[]; // 待持久化的段落
}

@Injectable()
export class ContextStoreService {
  private readonly logger = new Logger(ContextStoreService.name);
  private readonly contexts = new Map<string, SessionContext>();
  private readonly BATCH_SIZE = 10; // 每 10 条持久化一次
  private readonly BATCH_INTERVAL = 5000; // 或每 5 秒持久化一次
  private batchTimers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly db: DatabaseService) {}

  /**
   * 初始化会话上下文
   */
  initialize(sessionId: string, meetingId?: number): void {
    if (this.contexts.has(sessionId)) {
      // 如果已存在，只更新 meetingId
      if (meetingId) {
        const ctx = this.contexts.get(sessionId)!;
        ctx.meetingId = meetingId;
      }
      return;
    }
    this.contexts.set(sessionId, {
      sessionId,
      meetingId,
      segments: [],
      messages: [],
      meetingPhase: "开场",
      lastAutoAnalysis: null,
      pendingSegments: [],
    });
    this.logger.log(`Initialized context for session ${sessionId}${meetingId ? `, meetingId=${meetingId}` : ''}`);
  }

  /**
   * 设置会议 ID（用于后续关联）
   */
  setMeetingId(sessionId: string, meetingId: number): void {
    const context = this.contexts.get(sessionId);
    if (context) {
      context.meetingId = meetingId;
      this.logger.log(`Set meetingId=${meetingId} for session ${sessionId}`);
    }
  }

  /**
   * 获取会议 ID
   */
  getMeetingId(sessionId: string): number | undefined {
    return this.contexts.get(sessionId)?.meetingId;
  }

  /**
   * 从通义听悟格式转换并追加
   */
  appendFromTingwu(
    sessionId: string,
    payload: TingwuTranscriptionPayload
  ): void {
    let context = this.contexts.get(sessionId);
    if (!context) {
      this.initialize(sessionId);
      context = this.contexts.get(sessionId)!;
    }

    const startMs =
      payload.words.length > 0 ? payload.words[0].startTime : payload.time;
    const endMs =
      payload.words.length > 0
        ? payload.words[payload.words.length - 1].endTime
        : payload.time;

    // 优先使用 fixed_result（修正后的结果），提高识别正确率
    // fixed_result 包含听悟的智能修正，如标点、同音字纠错等
    const text = payload.fixed_result || payload.result || "";

    const segment: ContextSegment = {
      id: `seg-${sessionId}-${payload.index}`,
      text: text ?? "",
      startMs,
      endMs,
      timestamp: new Date(),
    };

    // 检查是否已存在相同 index 的段落（更新而非追加）
    const existingIndex = context.segments.findIndex(
      (s) => s.id === segment.id
    );
    if (existingIndex >= 0) {
      context.segments[existingIndex] = segment;
      this.logger.debug(`Updated segment ${segment.id}`);
    } else {
      context.segments.push(segment);
      context.pendingSegments.push(segment);
      this.logger.debug(
        `Appended segment ${segment.id}: "${segment.text.slice(0, 50)}..."`
      );

      // 检查是否需要批量持久化
      this.checkAndPersist(sessionId);
    }
  }

  /**
   * 检查并批量持久化
   */
  private checkAndPersist(sessionId: string): void {
    const context = this.contexts.get(sessionId);
    if (!context || !context.meetingId) return;

    // 如果达到批量大小，立即持久化
    if (context.pendingSegments.length >= this.BATCH_SIZE) {
      this.persistSegments(sessionId);
      return;
    }

    // 否则设置定时器
    if (!this.batchTimers.has(sessionId)) {
      const timer = setTimeout(() => {
        this.persistSegments(sessionId);
        this.batchTimers.delete(sessionId);
      }, this.BATCH_INTERVAL);
      this.batchTimers.set(sessionId, timer);
    }
  }

  /**
   * 持久化待保存的段落
   */
  private persistSegments(sessionId: string): void {
    const context = this.contexts.get(sessionId);
    if (!context || !context.meetingId || context.pendingSegments.length === 0) return;

    const segments = context.pendingSegments;
    context.pendingSegments = [];

    try {
      const stmt = this.db.getDatabase().prepare(
        `INSERT INTO transcripts (meeting_id, start_ms, end_ms, content) VALUES (?, ?, ?, ?)`
      );

      this.db.transaction(() => {
        for (const seg of segments) {
          stmt.run(context.meetingId, seg.startMs, seg.endMs, seg.text);
        }
      });

      this.logger.log(`Persisted ${segments.length} transcripts for meeting ${context.meetingId}`);
    } catch (error) {
      this.logger.error(`Failed to persist transcripts: ${error}`);
      // 失败时放回待持久化队列
      context.pendingSegments.push(...segments);
    }
  }

  /**
   * 强制持久化所有待保存的段落
   */
  flushPending(sessionId: string): void {
    const timer = this.batchTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(sessionId);
    }
    this.persistSegments(sessionId);
  }

  /**
   * 获取完整文本流
   */
  getFullText(sessionId: string): string {
    const context = this.contexts.get(sessionId);
    if (!context) {
      return "";
    }
    return context.segments
      .sort((a, b) => a.startMs - b.startMs)
      .map((s) => s.text)
      .join("\n");
  }

  /**
   * 获取最近N分钟的文本
   */
  getRecentText(sessionId: string, minutes: number): string {
    const context = this.contexts.get(sessionId);
    if (!context || context.segments.length === 0) {
      return "";
    }

    const now = Date.now();
    const cutoffTime = now - minutes * 60 * 1000;

    // 根据 timestamp 过滤最近的段落
    const recentSegments = context.segments.filter(
      (s) => s.timestamp.getTime() >= cutoffTime
    );

    return recentSegments
      .sort((a, b) => a.startMs - b.startMs)
      .map((s) => s.text)
      .join("\n");
  }

  /**
   * 获取所有段落
   */
  getSegments(sessionId: string): ContextSegment[] {
    const context = this.contexts.get(sessionId);
    if (!context) {
      return [];
    }
    return [...context.segments].sort((a, b) => a.startMs - b.startMs);
  }

  /**
   * 追加对话消息
   */
  appendMessage(sessionId: string, message: Omit<ChatMessage, "id">): string {
    let context = this.contexts.get(sessionId);
    if (!context) {
      this.initialize(sessionId);
      context = this.contexts.get(sessionId)!;
    }

    const id = `msg-${sessionId}-${Date.now()}`;
    const fullMessage: ChatMessage = {
      ...message,
      id,
    };
    context.messages.push(fullMessage);
    this.logger.debug(`Appended message ${id} to session ${sessionId}`);
    return id;
  }

  /**
   * 获取所有消息
   */
  getMessages(sessionId: string): ChatMessage[] {
    const context = this.contexts.get(sessionId);
    if (!context) {
      return [];
    }
    return [...context.messages];
  }

  /**
   * 更新会议阶段
   */
  setMeetingPhase(sessionId: string, phase: string): void {
    const context = this.contexts.get(sessionId);
    if (context) {
      context.meetingPhase = phase;
    }
  }

  /**
   * 获取会议阶段
   */
  getMeetingPhase(sessionId: string): string {
    return this.contexts.get(sessionId)?.meetingPhase ?? "开场";
  }

  /**
   * 更新上次自动分析时间
   */
  setLastAutoAnalysis(sessionId: string, time: Date): void {
    const context = this.contexts.get(sessionId);
    if (context) {
      context.lastAutoAnalysis = time;
    }
  }

  /**
   * 获取上次自动分析时间
   */
  getLastAutoAnalysis(sessionId: string): Date | null {
    return this.contexts.get(sessionId)?.lastAutoAnalysis ?? null;
  }

  /**
   * 清理会话上下文
   */
  clear(sessionId: string): void {
    this.contexts.delete(sessionId);
    this.logger.log(`Cleared context for session ${sessionId}`);
  }

  /**
   * 检查会话是否存在
   */
  has(sessionId: string): boolean {
    return this.contexts.has(sessionId);
  }

  /**
   * 获取上下文统计信息
   */
  getStats(sessionId: string): {
    segmentCount: number;
    messageCount: number;
    totalTextLength: number;
  } {
    const context = this.contexts.get(sessionId);
    if (!context) {
      return { segmentCount: 0, messageCount: 0, totalTextLength: 0 };
    }
    return {
      segmentCount: context.segments.length,
      messageCount: context.messages.length,
      totalTextLength: context.segments.reduce(
        (sum, s) => sum + s.text.length,
        0
      ),
    };
  }
}
