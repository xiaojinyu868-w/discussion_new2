import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
  Headers,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { SessionService } from "./session.service";
import { CreateSessionDto, UploadAudioChunkDto, AskQuestionDto } from "./session.dto";
import { SkillType } from "../skill/skill.service";
import { AgentService } from "../agent/agent.service";
import { AuthService } from "../auth/auth.service";

@Controller("sessions")
export class SessionController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly agentService: AgentService,
    private readonly authService: AuthService,
  ) {}

  // 辅助方法：从 Authorization header 获取 userId（可选）
  private getUserId(authHeader?: string): number | undefined {
    if (!authHeader) return undefined;
    try {
      const [type, token] = authHeader.split(' ');
      if (type !== 'Bearer' || !token) return undefined;
      const payload = this.authService.verifyToken(token);
      return payload.userId;
    } catch {
      return undefined;
    }
  }

  @Get("health")
  async health() {
    return { ok: true };
  }

  @Post()
  async createSession(
    @Body() body: CreateSessionDto,
    @Headers("authorization") authHeader?: string
  ) {
    const userId = this.getUserId(authHeader);
    return this.sessionService.createRealtimeSession(body, userId);
  }

  @Get(":id/transcripts")
  async getTranscripts(@Param("id") id: string) {
    return this.sessionService.getTranscripts(id);
  }

  @Get(":id/summaries")
  async getSummaries(@Param("id") id: string) {
    return this.sessionService.getSummaries(id);
  }

  @Post(":id/skills/:skillType")
  async triggerSkill(
    @Param("id") id: string,
    @Param("skillType") skillType: SkillType,
    @Headers("authorization") authHeader?: string,
    @Body() body?: { scenario?: 'classroom' | 'meeting' }
  ) {
    const userId = this.getUserId(authHeader);
    return this.sessionService.triggerSkill(id, skillType, userId, body?.scenario);
  }

  @Post(":id/audio")
  async uploadAudioChunk(
    @Param("id") id: string,
    @Body() body: UploadAudioChunkDto
  ) {
    await this.sessionService.ingestAudioChunk(id, body.chunk);
    return { ok: true };
  }

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body("meetingId") meetingId?: string
  ) {
    const result = await this.sessionService.uploadAudioFile(file, meetingId);
    return { ok: true, ...result };
  }

  @Post(":id/process")
  async processAudio(@Param("id") id: string) {
    await this.sessionService.processAudio(id);
    return { ok: true };
  }

  @Post(":id/complete")
  async completeSession(@Param("id") id: string) {
    return this.sessionService.completeSession(id);
  }

  // ===== 自动推送 API =====

  @Post(":id/auto-push/start")
  async startAutoPush(@Param("id") id: string) {
    return this.sessionService.startAutoPush(id);
  }

  @Post(":id/auto-push/stop")
  async stopAutoPush(@Param("id") id: string) {
    return this.sessionService.stopAutoPush(id);
  }

  @Get(":id/auto-push/status")
  async getAutoPushStatus(@Param("id") id: string) {
    return this.sessionService.getAutoPushStatus(id);
  }

  // ===== 自由问答 API =====

  @Post(":id/qa")
  async askQuestion(
    @Param("id") id: string,
    @Body() body: AskQuestionDto & { scenario?: 'classroom' | 'meeting' },
    @Headers("authorization") authHeader?: string
  ) {
    const userId = this.getUserId(authHeader);
    return this.sessionService.askQuestion(id, body.question, userId, body.scenario);
  }

  @Get(":id/messages")
  async getMessages(@Param("id") id: string) {
    return this.sessionService.getMessages(id);
  }

  // ===== 视觉化 API (V2) - 仅支持逻辑海报 =====

  @Post(":id/visualization")
  async generateVisualization(
    @Param("id") id: string,
    @Body()
    body: {
      type?: "poster"; // 只支持 poster 类型
      style?: "chiikawa" | "minimal-business"; // 风格选择
    },
    @Headers("authorization") authHeader?: string
  ) {
    const userId = this.getUserId(authHeader);
    return this.sessionService.generateVisualization(id, body.style, userId);
  }

  @Get(":id/visualizations")
  async getVisualizations(@Param("id") id: string) {
    return this.sessionService.getVisualizations(id);
  }

  @Get(":id/visualizations/:visId")
  async getVisualization(
    @Param("id") id: string,
    @Param("visId") visId: string
  ) {
    return this.sessionService.getVisualization(id, visId);
  }

  @Get(":id/visualizations/:visId/image")
  async getVisualizationImage(
    @Param("id") id: string,
    @Param("visId") visId: string
  ) {
    return this.sessionService.getVisualizationImage(id, visId);
  }

  // ===== Agent API (V3) =====

  @Post(":id/agent/start")
  async startAgent(@Param("id") id: string) {
    this.agentService.startAgent(id);
    return { success: true, message: "Agent started" };
  }

  @Post(":id/agent/stop")
  async stopAgent(@Param("id") id: string) {
    this.agentService.stopAgent(id);
    return { success: true, message: "Agent stopped" };
  }

  @Get(":id/agent/status")
  async getAgentStatus(@Param("id") id: string) {
    return this.agentService.getAgentStatus(id);
  }

  @Get(":id/agent/insights")
  async getAgentInsights(
    @Param("id") id: string,
    @Query("afterId") afterId?: string
  ) {
    const insights = afterId
      ? this.agentService.getNewInsights(id, afterId)
      : this.agentService.getAgentInsights(id);
    console.log(`[Agent] getAgentInsights: sessionId=${id}, afterId=${afterId}, count=${insights.length}`);
    return { insights };
  }

  @Post(":id/agent/trigger")
  async triggerAgentAnalysis(@Param("id") id: string) {
    const insights = await this.agentService.triggerAnalysis(id);
    return { insights };
  }
}
