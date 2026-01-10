import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { CreateSessionDto } from "./session.dto";
import { v4 as uuid } from "uuid";
import { DashScopeASRService } from "../dashscope-asr/dashscope-asr.service";
import { SkillService, SkillType } from "../skill/skill.service";
import { AutoPushService } from "../auto-push/auto-push.service";
import { ContextStoreService } from "../context/context-store.service";
import { LLMAdapterService } from "../llm/llm-adapter.service";
import { VisualizationService } from "../visualization/visualization.service";
import { QuotaService } from "../quota/quota.service";
import { UserService } from "../user/user.service";
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
    { userId?: number }
  >();
  private transcripts = new Map<string, Transcript[]>();
  private summaries = new Map<string, any[]>();
  private taskStatuses = new Map<string, string | undefined>();

  constructor(
    private readonly dashScopeASR: DashScopeASRService,
    private readonly skillService: SkillService,
    private readonly autoPushService: AutoPushService,
    private readonly contextStore: ContextStoreService,
    private readonly llmAdapter: LLMAdapterService,
    private readonly visualizationService: VisualizationService,
    private readonly quotaService: QuotaService,
    private readonly userService: UserService,
  ) {}

  async createRealtimeSession(body: CreateSessionDto, userId?: number) {
    const sessionId = uuid();

    // 创建 DashScope ASR 会话
    this.dashScopeASR.create(sessionId);

    this.sessions.set(sessionId, { userId });
    this.taskStatuses.set(sessionId, "NEW");
    
    // 初始化上下文存储
    this.contextStore.initialize(sessionId);
    
    // 如果有登录用户，创建会议记录并关联到上下文
    let meetingId: number | undefined;
    if (userId) {
      try {
        const meeting = this.userService.createMeeting(userId, sessionId);
        meetingId = meeting.id;
        this.contextStore.setMeetingId(sessionId, meeting.id);
        this.logger.log(`Meeting created for user ${userId}, session ${sessionId}, meetingId ${meeting.id}`);
      } catch (error) {
        this.logger.error(`Failed to create meeting record: ${error.message}`);
      }
    }

    return {
      sessionId,
      meetingId,
    };
  }

  async ingestAudioChunk(sessionId: string, base64Chunk: string) {
    if (!this.sessions.has(sessionId)) {
      throw new NotFoundException("Session not found");
    }
    const buffer = Buffer.from(base64Chunk, "base64");
    try {
      await this.dashScopeASR.ingestWebmChunk(sessionId, buffer);
    } catch (error) {
      const relayError = error as Error;
      
      // 处理连接断开的情况
      if (
        relayError?.message.includes("Session not found") ||
        relayError?.message.includes("connection timeout") ||
        relayError?.message.includes("ffmpeg stream not ready")
      ) {
        this.logger.warn(
          `ASR session unavailable for session ${sessionId}, reconnecting...`
        );
        
        try {
          // 重新创建 ASR 会话
          this.dashScopeASR.updateSession(sessionId);
          
          // 重试发送音频数据
          await this.dashScopeASR.ingestWebmChunk(sessionId, buffer);
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
    
    // DashScope ASR 是实时处理的，不需要额外的处理步骤
    // 只需确保会话存在并且连接正常
    const status = this.dashScopeASR.getStatus(sessionId);
    if (status === "failed" || status === "not_found") {
      this.logger.log(`Refreshing ASR session for ${sessionId}...`);
      this.dashScopeASR.updateSession(sessionId);
    }
    
    this.logger.log(`=== processAudio completed for session ${sessionId}, status: ${status} ===`);
    return { ok: true, status };
  }

  async completeSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      // 如果 session 不存在，可能已经被清理，返回成功而不是抛错
      this.logger.warn(`Session ${sessionId} not found during complete, may have been cleaned up`);
      return { ok: true, message: "Session already completed or not found" };
    }
    
    try {
      await this.dashScopeASR.stop(sessionId);
    } catch (e) {
      this.logger.warn(`Failed to stop ASR session for ${sessionId}: ${e}`);
    }
    
    // 强制刷新待持久化的转写内容
    this.contextStore.flushPending(sessionId);
    
    // 自动生成会议标题
    await this.generateMeetingTitle(sessionId);
    
    this.taskStatuses.set(sessionId, "COMPLETED");
    // 注意：不删除 session 数据，以便用户仍可以查看转写结果和生成可视化
    return { ok: true };
  }

  /**
   * 自动生成会议标题
   */
  private async generateMeetingTitle(sessionId: string) {
    try {
      const meeting = this.userService.getMeetingBySessionId(sessionId);
      if (!meeting) return;
      
      const context = this.contextStore.getFullText(sessionId);
      if (!context || context.trim().length < 20) return;
      
      // 取前500字符用于生成标题
      const preview = context.slice(0, 500);
      
      const prompt = `根据以下会议内容，生成一个简短的会议标题（10字以内）：

${preview}

只输出标题，不要其他内容。`;

      const title = await this.llmAdapter.chatWithPrompt(
        "你是一个会议助手，请生成简洁的会议标题。",
        prompt,
        { temperature: 0.3, maxTokens: 50 }
      );
      
      const cleanTitle = title.trim().replace(/["""'']/g, '').slice(0, 20);
      if (cleanTitle) {
        this.userService.updateMeeting(sessionId, { title: cleanTitle });
        this.logger.log(`Generated meeting title: ${cleanTitle}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to generate meeting title: ${error}`);
    }
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

  async triggerSkill(sessionId: string, skill: SkillType, userId?: number, scenario?: 'classroom' | 'meeting') {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException("Session not found");
    }

    // 配额检查（如果有 userId）
    if (userId) {
      const check = this.quotaService.checkQuota(userId, 'insight');
      if (!check.allowed) {
        throw new ForbiddenException(check.message);
      }
    }

    // 检查是否有足够的上下文内容
    const contextStats = this.contextStore.getStats(sessionId);
    if (contextStats.totalTextLength < 20) {
      throw new BadRequestException("内容不足，请先进行一些对话后再分析");
    }

    // 使用新的 SkillService（基于 Qwen3-Max），传递场景参数
    try {
      const result = await this.skillService.triggerSkill(sessionId, skill, scenario || 'meeting');
      const cards = this.skillService.toSummaryCards(sessionId, result);

      // 配额扣减
      if (userId) {
        this.quotaService.consumeQuota(userId, 'insight');
      }

      if (cards.length) {
        const existing = this.summaries.get(sessionId) ?? [];
        const combined = new Map<string, any>();
        [...existing, ...cards].forEach((card) => {
          combined.set(card.id, card);
        });
        this.summaries.set(sessionId, Array.from(combined.values()));
        
        // 持久化洞察到数据库
        const meeting = this.userService.getMeetingBySessionId(sessionId);
        if (meeting) {
          for (const card of cards) {
            this.userService.saveInsight(meeting.id, card.type, JSON.stringify(card.content));
          }
          this.logger.log(`Saved ${cards.length} insights for meeting ${meeting.id}`);
        }
      }

      return { cards };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Skill ${skill} failed: ${errorMessage}`);
      
      // 如果是上下文不足的错误，直接抛出
      if (errorMessage.includes("No context available") || errorMessage.includes("会议内容不足")) {
        throw new BadRequestException("会议内容不足，请先进行一些对话后再分析");
      }
      
      throw new BadRequestException("分析服务暂时不可用，请稍后重试");
    }
  }

  async uploadAudioFile(
    file: Express.Multer.File,
    meetingId?: string
  ): Promise<{ sessionId: string }> {
    if (!file?.buffer || file.size === 0) {
      throw new BadRequestException("文件为空");
    }

    const session = await this.createRealtimeSession({
      meetingId: meetingId ?? `upload-${Date.now()}`,
    });

    // TODO: 实现音频文件上传处理
    // DashScope ASR 主要支持实时流式转录，文件上传需要使用批量 API
    this.logger.warn(`Audio file upload not fully implemented for DashScope ASR`);

    return { sessionId: session.sessionId };
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

  async askQuestion(sessionId: string, question: string, userId?: number, scenario?: 'classroom' | 'meeting') {
    if (!this.sessions.has(sessionId)) {
      throw new NotFoundException("Session not found");
    }

    // 配额检查（如果有 userId）
    if (userId) {
      const check = this.quotaService.checkQuota(userId, 'qa');
      if (!check.allowed) {
        throw new ForbiddenException(check.message);
      }
    }

    const context = this.contextStore.getFullText(sessionId);
    this.logger.log(`[QA] Session ${sessionId}, scenario=${scenario}, context length: ${context?.length || 0} chars`);
    
    if (!context || context.trim().length === 0) {
      const emptyMsg = scenario === 'classroom' 
        ? "当前没有可用的课堂内容，请先开始听课。"
        : "当前没有可用的会议内容，请先开始录音。";
      return {
        answer: emptyMsg,
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

    // 根据场景选择提示词
    const isClassroom = scenario === 'classroom';
    const contentType = isClassroom ? '课堂内容' : '会议内容';
    const roleDesc = isClassroom 
      ? '你是一个耐心的学习助手，帮助学生理解课堂内容。用通俗易懂的方式解答问题，必要时举例说明。'
      : '你是一个专业的会议助手，帮助用户理解和分析会议内容。';
    
    const prompt = `你是一个专业的${isClassroom ? '学习' : '会议'}助手。基于以下${contentType}回答用户的问题。

${contentType}：
${context}

用户问题：${question}

请简洁、准确地回答问题。${isClassroom ? '如果问题涉及课堂外的知识，可以适当拓展但要标明。' : '如果问题与会议内容无关，请礼貌地说明。'}`;

    try {
      const answer = await this.llmAdapter.chatWithPrompt(
        roleDesc,
        prompt,
        { temperature: 0.7, maxTokens: 1000 }
      );

      // 配额扣减
      if (userId) {
        this.quotaService.consumeQuota(userId, 'qa');
      }

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

  // ===== 视觉化功能 (V2) - 仅支持逻辑海报 =====

  async generateVisualization(
    sessionId: string,
    style?: "chiikawa" | "minimal-business",
    userId?: number
  ) {
    if (!this.sessions.has(sessionId)) {
      throw new NotFoundException("Session not found");
    }

    // 配额检查（如果有 userId）
    if (userId) {
      const check = this.quotaService.checkQuota(userId, 'image');
      if (!check.allowed) {
        throw new ForbiddenException(check.message);
      }
    }

    const result = await this.visualizationService.generateVisualization({
      sessionId,
      type: "poster",
      style: style || "chiikawa",
    });

    // 配额扣减
    if (userId) {
      this.quotaService.consumeQuota(userId, 'image');
    }

    // 持久化可视化到数据库
    const meeting = this.userService.getMeetingBySessionId(sessionId);
    if (meeting && result.imageBase64) {
      // 保存图片到本地文件
      const imagePath = `vis-${sessionId}-${Date.now()}.png`;
      const fs = require('fs');
      const path = require('path');
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const imageBuffer = Buffer.from(result.imageBase64, 'base64');
      fs.writeFileSync(path.join(uploadsDir, imagePath), imageBuffer);
      
      this.userService.saveVisualization(meeting.id, "poster", style || "chiikawa", imagePath, result.prompt || '');
      this.logger.log(`Saved visualization for meeting ${meeting.id}: ${imagePath}`);
    }

    return result;
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
