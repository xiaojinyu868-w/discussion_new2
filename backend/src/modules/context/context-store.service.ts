import { Injectable, Logger } from "@nestjs/common";

/**
 * 通义听悟 WebSocket 返回格式（TranscriptionResultChanged）
 */
export interface TingwuWord {
  startTime: number;
  endTime: number;
  text: string;
  fixed?: boolean;
  punc?: string;
}

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
  segments: ContextSegment[];
  messages: ChatMessage[];
  meetingPhase: string;
  lastAutoAnalysis: Date | null;
}

@Injectable()
export class ContextStoreService {
  private readonly logger = new Logger(ContextStoreService.name);
  private readonly contexts = new Map<string, SessionContext>();

  /**
   * 初始化会话上下文
   */
  initialize(sessionId: string): void {
    if (this.contexts.has(sessionId)) {
      return;
    }
    this.contexts.set(sessionId, {
      sessionId,
      segments: [],
      messages: [],
      meetingPhase: "开场",
      lastAutoAnalysis: null,
    });
    this.logger.log(`Initialized context for session ${sessionId}`);
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

    // 严格模式：实时转写只使用原始result，不使用fixed_result
    // 确保转写结果严格遵循语音输入，不进行自动修正
    const text = payload.result ?? "";

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
      this.logger.debug(
        `Appended segment ${segment.id}: "${segment.text.slice(0, 50)}..."`
      );
    }
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
