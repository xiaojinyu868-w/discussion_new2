import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { TingwuService } from "../tingwu/tingwu.service";
import { CreateSessionDto } from "./session.dto";
import { v4 as uuid } from "uuid";
import { PollerService } from "../task-poller/poller.service";
import { AudioRelayService } from "../tingwu/audio-relay.service";
import { SkillService, SkillType } from "../skill/skill.service";
import { AutoPushService } from "../auto-push/auto-push.service";
import { ContextStoreService } from "../context/context-store.service";
import { LLMAdapterService } from "../llm/llm-adapter.service";
import { VisualizationService } from "../visualization/visualization.service";
import { Express } from "express";

type Transcript = {
  id: string;
  speakerId: string;
  startMs: number;
  endMs: number;
  text: string;
};

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private sessions = new Map<
    string,
    { taskId: string; meetingJoinUrl: string }
  >();
  private transcripts = new Map<string, Transcript[]>();
  private summaries = new Map<string, any[]>();
  private taskStatuses = new Map<string, string | undefined>();

  constructor(
    private readonly tingwuService: TingwuService,
    private readonly pollerService: PollerService,
    private readonly audioRelayService: AudioRelayService,
    private readonly skillService: SkillService,
    private readonly autoPushService: AutoPushService,
    private readonly contextStore: ContextStoreService,
    private readonly llmAdapter: LLMAdapterService,
    private readonly visualizationService: VisualizationService
  ) {}

  async createRealtimeSession(body: CreateSessionDto) {
    const sessionId = uuid();
    const { taskId, meetingJoinUrl } =
      await this.tingwuService.createRealtimeTask(body);

    this.sessions.set(sessionId, { taskId, meetingJoinUrl });
    this.taskStatuses.set(sessionId, "NEW");
    this.audioRelayService.create(sessionId, meetingJoinUrl);
    this.pollerService.registerTask(sessionId, taskId, async (payload) => {
      if (payload.transcription?.length) {
        const existing = this.transcripts.get(sessionId) ?? [];
        const map = new Map<string, Transcript>();
        [...existing, ...payload.transcription].forEach((segment) => {
          map.set(segment.id, segment);
        });
        const merged = Array.from(map.values()).sort(
          (a, b) => a.startMs - b.startMs
        );
        this.transcripts.set(sessionId, merged);
      }
      if (payload.summaries?.length) {
        const existing = this.summaries.get(sessionId) ?? [];
        const combined = new Map<string, any>();
        [...existing, ...payload.summaries].forEach((card) => {
          combined.set(card.id, card);
        });
        this.summaries.set(sessionId, Array.from(combined.values()));
      }
      if (payload.taskStatus) {
        this.taskStatuses.set(sessionId, payload.taskStatus);
      }
    });

    return {
      sessionId,
      taskId,
      meetingJoinUrl,
    };
  }

  async ingestAudioChunk(sessionId: string, base64Chunk: string) {
    if (!this.sessions.has(sessionId)) {
      throw new NotFoundException("Session not found");
    }
    const buffer = Buffer.from(base64Chunk, "base64");
    try {
      await this.audioRelayService.ingestWebmChunk(sessionId, buffer);
    } catch (error) {
      const relayError = error as Error;
      
      // 处理连接断开或 relay 不存在的情况
      if (
        relayError?.message.includes("Relay not found") ||
        relayError?.message.includes("Relay input closed") ||
        relayError?.message.includes("Tingwu socket not ready") ||
        relayError?.message.includes("Failed to establish connection")
      ) {
        const session = this.sessions.get(sessionId);
        if (!session) {
          throw relayError;
        }
        
        this.logger.warn(
          `Audio relay unavailable for session ${sessionId}, creating new task and reconnecting...`
        );
        
        try {
          // 创建新的通义听悟任务获取新的 meetingJoinUrl
          const { taskId, meetingJoinUrl } = await this.tingwuService.createRealtimeTask({
            meetingId: `meeting-${Date.now()}`,
          });
          
          // 更新 session 信息
          session.taskId = taskId;
          session.meetingJoinUrl = meetingJoinUrl;
          this.sessions.set(sessionId, session);
          
          // 重新注册轮询
          this.pollerService.unregisterTask(sessionId);
          this.pollerService.registerTask(sessionId, taskId, async (payload) => {
            if (payload.transcription?.length) {
              const existing = this.transcripts.get(sessionId) ?? [];
              const map = new Map<string, Transcript>();
              [...existing, ...payload.transcription].forEach((segment) => {
                map.set(segment.id, segment);
              });
              const merged = Array.from(map.values()).sort(
                (a, b) => a.startMs - b.startMs
              );
              this.transcripts.set(sessionId, merged);
            }
            if (payload.summaries?.length) {
              const existing = this.summaries.get(sessionId) ?? [];
              const combined = new Map<string, any>();
              [...existing, ...payload.summaries].forEach((card) => {
                combined.set(card.id, card);
              });
              this.summaries.set(sessionId, Array.from(combined.values()));
            }
            if (payload.taskStatus) {
              this.taskStatuses.set(sessionId, payload.taskStatus);
            }
          });
          
          // 更新 relay 的 URL 并重新创建
          this.audioRelayService.updateUrl(sessionId, meetingJoinUrl);
          
          this.logger.log(`New task created for session ${sessionId}: ${taskId}`);
          
          // 重试发送音频数据
          await this.audioRelayService.ingestWebmChunk(sessionId, buffer);
          return;
        } catch (reconnectError) {
          this.logger.error(`Failed to reconnect for session ${sessionId}: ${reconnectError}`);
          throw reconnectError;
        }
      }
      throw relayError;
    }
  }

  async processAudio(sessionId: string) {
    this.logger.log(`=== processAudio called for session ${sessionId} ===`);
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.error(`Session ${sessionId} not found!`);
      throw new NotFoundException("Session not found");
    }
    
    // 重新创建任务获取新的 meetingJoinUrl（旧的可能已过期）
    this.logger.log(`Refreshing realtime task for session ${sessionId}...`);
    const { taskId, meetingJoinUrl } = await this.tingwuService.createRealtimeTask({
      meetingId: `meeting-${Date.now()}`,
    });
    
    // 更新 session 信息
    session.taskId = taskId;
    session.meetingJoinUrl = meetingJoinUrl;
    this.sessions.set(sessionId, session);
    
    // 更新 relay 的 URL
    this.audioRelayService.updateUrl(sessionId, meetingJoinUrl);
    
    // 重新注册轮询
    this.pollerService.unregisterTask(sessionId);
    this.pollerService.registerTask(sessionId, taskId, async (payload) => {
      if (payload.transcription?.length) {
        const existing = this.transcripts.get(sessionId) ?? [];
        const map = new Map<string, Transcript>();
        [...existing, ...payload.transcription].forEach((segment) => {
          map.set(segment.id, segment);
        });
        const merged = Array.from(map.values()).sort(
          (a, b) => a.startMs - b.startMs
        );
        this.transcripts.set(sessionId, merged);
      }
      if (payload.summaries?.length) {
        const existing = this.summaries.get(sessionId) ?? [];
        const combined = new Map<string, any>();
        [...existing, ...payload.summaries].forEach((card) => {
          combined.set(card.id, card);
        });
        this.summaries.set(sessionId, Array.from(combined.values()));
      }
      if (payload.taskStatus) {
        this.taskStatuses.set(sessionId, payload.taskStatus);
      }
    });
    
    this.logger.log(`New task created: ${taskId}, meetingJoinUrl: ${meetingJoinUrl.slice(0, 50)}...`);
    
    this.logger.log(`Calling audioRelayService.processAndSend for session ${sessionId}...`);
    await this.audioRelayService.processAndSend(sessionId);
    this.logger.log(`=== processAudio completed for session ${sessionId} ===`);
    return { ok: true, taskId };
  }

  async completeSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      // 如果 session 不存在，可能已经被清理，返回成功而不是抛错
      this.logger.warn(`Session ${sessionId} not found during complete, may have been cleaned up`);
      return { ok: true, message: "Session already completed or not found" };
    }
    
    try {
      await this.audioRelayService.stop(sessionId);
    } catch (e) {
      this.logger.warn(`Failed to stop audio relay for ${sessionId}: ${e}`);
    }
    
    this.pollerService.unregisterTask(sessionId);
    
    try {
      await this.tingwuService.stopRealtimeTask(session.taskId);
    } catch (e) {
      this.logger.warn(`Failed to stop Tingwu task for ${sessionId}: ${e}`);
    }
    
    this.taskStatuses.set(sessionId, "COMPLETED");
    // 注意：不删除 session 数据，以便用户仍可以查看转写结果和生成可视化
    return { ok: true };
  }

  async getTranscripts(sessionId: string) {
    // 优先从 ContextStore 获取（实时转写结果）
    const contextSegments = this.contextStore.getSegments(sessionId);
    if (contextSegments.length > 0) {
      const transcription = contextSegments.map((seg) => ({
        id: seg.id,
        speakerId: "speaker-0",
        startMs: seg.startMs,
        endMs: seg.endMs,
        text: seg.text,
      }));
      return {
        sessionId,
        transcription,
        taskStatus: this.taskStatuses.get(sessionId),
      };
    }
    
    // 回退到 transcripts Map（通义听悟轮询结果）
    return {
      sessionId,
      transcription: this.transcripts.get(sessionId) ?? [],
      taskStatus: this.taskStatuses.get(sessionId),
    };
  }

  async getSummaries(sessionId: string) {
    return {
      sessionId,
      summaries: this.summaries.get(sessionId) ?? [],
    };
  }

  async triggerSkill(sessionId: string, skill: SkillType) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException("Session not found");
    }

    // 使用新的 SkillService（基于 Qwen3-Max）
    try {
      const result = await this.skillService.triggerSkill(sessionId, skill);
      const cards = this.skillService.toSummaryCards(sessionId, result);

      if (cards.length) {
        const existing = this.summaries.get(sessionId) ?? [];
        const combined = new Map<string, any>();
        [...existing, ...cards].forEach((card) => {
          combined.set(card.id, card);
        });
        this.summaries.set(sessionId, Array.from(combined.values()));
      }

      return { cards };
    } catch (error) {
      this.logger.error(`Skill ${skill} failed: ${error}`);
      
      // 如果 LLM 不可用，回退到通义听悟 CustomPrompt（仅支持 inner_os 和 brainstorm）
      if (skill !== "stop_talking") {
        this.logger.warn(`Falling back to Tingwu CustomPrompt for ${skill}`);
        return this.triggerSkillFallback(sessionId, skill as "inner_os" | "brainstorm");
      }
      
      throw error;
    }
  }

  async uploadAudioFile(
    file: Express.Multer.File,
    meetingId?: string
  ): Promise<{ sessionId: string; taskId: string }> {
    if (!file?.buffer || file.size === 0) {
      throw new BadRequestException("文件为空");
    }

    const session = await this.createRealtimeSession({
      meetingId: meetingId ?? `upload-${Date.now()}`,
    });

    await this.audioRelayService.ingestAudioFile(
      session.sessionId,
      file.buffer,
      file.mimetype?.split("/")?.[1] ?? undefined
    );

    return { sessionId: session.sessionId, taskId: session.taskId };
  }

  /**
   * 回退到通义听悟 CustomPrompt（旧实现）
   */
  private async triggerSkillFallback(
    sessionId: string,
    skill: "inner_os" | "brainstorm"
  ) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException("Session not found");
    }
    
    const result = await this.tingwuService.triggerCustomPrompt(
      session.taskId,
      skill
    );
    const cards = this.normalizeCustomPrompt(result, skill, session.taskId);
    if (cards.length) {
      const existing = this.summaries.get(sessionId) ?? [];
      const combined = new Map<string, any>();
      [...existing, ...cards].forEach((card) => {
        combined.set(card.id, card);
      });
      this.summaries.set(sessionId, Array.from(combined.values()));
    }
    return { cards };
  }

  private normalizeCustomPrompt(
    raw: any,
    skill: "inner_os" | "brainstorm",
    taskId: string
  ) {
    const data = raw?.Data ?? raw?.data ?? {};
    const result =
      data.Result ??
      data?.results ??
      raw?.result ??
      raw ??
      {};
    const items: any[] =
      result?.Items ??
      result?.items ??
      result ??
      [];
    if (!Array.isArray(items)) {
      return [];
    }
    return items.map((item: any, index: number) => ({
      id: `${taskId}-${skill}-${index}`,
      type: skill === "inner_os" ? "inner_os" : "brainstorm",
      title: skill === "inner_os" ? "内心OS" : "头脑风暴",
      content: item,
      updatedAt: new Date().toISOString(),
    }));
  }

  // ===== 自动推送 =====

  async startAutoPush(sessionId: string) {
    if (!this.sessions.has(sessionId)) {
      throw new NotFoundException("Session not found");
    }

    this.autoPushService.startAutoAnalysis(sessionId, async (sid, result) => {
      const card = this.autoPushService.toSummaryCard(sid, result);
      const existing = this.summaries.get(sid) ?? [];
      const combined = new Map<string, any>();
      [...existing, card].forEach((c) => combined.set(c.id, c));
      this.summaries.set(sid, Array.from(combined.values()));
      this.logger.log(`Auto push result added for session ${sid}`);
    });

    return { ok: true, message: "Auto push started" };
  }

  async stopAutoPush(sessionId: string) {
    if (!this.sessions.has(sessionId)) {
      throw new NotFoundException("Session not found");
    }

    this.autoPushService.stopAutoAnalysis(sessionId);
    return { ok: true, message: "Auto push stopped" };
  }

  async getAutoPushStatus(sessionId: string) {
    if (!this.sessions.has(sessionId)) {
      throw new NotFoundException("Session not found");
    }

    return {
      sessionId,
      running: this.autoPushService.isRunning(sessionId),
      lastAnalysis: this.contextStore.getLastAutoAnalysis(sessionId),
      meetingPhase: this.contextStore.getMeetingPhase(sessionId),
    };
  }

  // ===== 自由问答 =====

  async askQuestion(sessionId: string, question: string) {
    if (!this.sessions.has(sessionId)) {
      throw new NotFoundException("Session not found");
    }

    const context = this.contextStore.getFullText(sessionId);
    if (!context || context.trim().length === 0) {
      return {
        answer: "当前没有可用的会议内容，请先开始录音。",
        messageId: null,
      };
    }

    // 保存用户问题到消息流
    this.contextStore.appendMessage(sessionId, {
      role: "user",
      content: question,
      timestamp: new Date(),
      type: "qa",
    });

    const prompt = `你是一个专业的会议助手。基于以下会议内容回答用户的问题。

会议内容：
${context}

用户问题：${question}

请简洁、准确地回答问题。如果问题与会议内容无关，请礼貌地说明。`;

    try {
      const answer = await this.llmAdapter.chatWithPrompt(
        "你是一个专业的会议助手，帮助用户理解和分析会议内容。",
        prompt,
        { temperature: 0.7, maxTokens: 1000 }
      );

      // 保存回答到消息流
      const messageId = this.contextStore.appendMessage(sessionId, {
        role: "assistant",
        content: answer,
        timestamp: new Date(),
        type: "qa",
      });

      return { answer, messageId };
    } catch (error) {
      this.logger.error(`QA failed for session ${sessionId}: ${error}`);
      return {
        answer: "抱歉，处理问题时出错了，请稍后重试。",
        messageId: null,
      };
    }
  }

  async getMessages(sessionId: string) {
    if (!this.sessions.has(sessionId)) {
      throw new NotFoundException("Session not found");
    }

    return {
      sessionId,
      messages: this.contextStore.getMessages(sessionId),
    };
  }

  // ===== 视觉化功能 (V2) =====

  async generateVisualization(
    sessionId: string,
    type: "chart" | "creative" | "poster",
    chartType?: "radar" | "flowchart" | "architecture" | "bar" | "line"
  ) {
    if (!this.sessions.has(sessionId)) {
      throw new NotFoundException("Session not found");
    }

    return this.visualizationService.generateVisualization({
      sessionId,
      type,
      chartType,
    });
  }

  async getVisualizations(sessionId: string) {
    if (!this.sessions.has(sessionId)) {
      throw new NotFoundException("Session not found");
    }

    return {
      sessionId,
      visualizations: this.visualizationService.getVisualizations(sessionId),
    };
  }

  async getVisualization(sessionId: string, visId: string) {
    if (!this.sessions.has(sessionId)) {
      throw new NotFoundException("Session not found");
    }

    const visualization = this.visualizationService.getVisualization(
      sessionId,
      visId
    );
    if (!visualization) {
      throw new NotFoundException("Visualization not found");
    }

    return visualization;
  }

  async getVisualizationImage(sessionId: string, visId: string) {
    const visualization = await this.getVisualization(sessionId, visId);

    if (visualization.imageBase64) {
      return {
        imageBase64: visualization.imageBase64,
        format: "png",
      };
    } else if (visualization.imageUrl) {
      return {
        imageUrl: visualization.imageUrl,
      };
    } else {
      throw new NotFoundException("Image not found");
    }
  }
}
