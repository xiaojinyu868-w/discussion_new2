/**
 * DashScope ASR 服务
 * 百炼实时语音识别服务 (qwen3-asr-flash-realtime)
 * 
 * 基于 MeetMind 项目的实现，适配 NestJS 后端架构
 */

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { spawn, ChildProcess } from "child_process";
import WS from "ws";
import ffmpeg from "ffmpeg-static";
import {
  ContextStoreService,
  ContextSegment,
} from "../context/context-store.service";
import {
  ASRSentence,
  AudioRelaySession,
  DashScopeSessionConfig,
  DashScopeAudioAppendEvent,
  DashScopeCommitEvent,
} from "./dashscope-asr.types";

// DashScope WebSocket 地址
const DASHSCOPE_WSS_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime";
const MAX_RECONNECT_ATTEMPTS = 3;

// 事件 ID 计数器
let eventCounter = 0;
function generateEventId(): string {
  return `event_${Date.now()}_${eventCounter++}`;
}

@Injectable()
export class DashScopeASRService {
  private readonly logger = new Logger(DashScopeASRService.name);
  private readonly sessions = new Map<string, AudioRelaySession>();
  
  // 配置
  private readonly apiKey: string;
  private readonly model: string;
  private readonly sampleRate: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly contextStore: ContextStoreService
  ) {
    this.apiKey = this.configService.get<string>("llm.apiKey") ?? "";
    this.model = process.env.DASHSCOPE_ASR_WS_MODEL ?? "qwen3-asr-flash-realtime";
    this.sampleRate = parseInt(process.env.DASHSCOPE_ASR_WS_SR ?? "16000", 10);
    
    if (!this.apiKey) {
      this.logger.warn("DASHSCOPE_API_KEY not configured, ASR service will not work");
    }
  }

  /**
   * 创建 ASR 会话
   */
  create(sessionId: string): void {
    if (this.sessions.has(sessionId)) {
      this.logger.warn(`Session ${sessionId} already exists`);
      return;
    }

    this.logger.log(`Creating DashScope ASR session ${sessionId}`);

    // 初始化上下文存储
    this.contextStore.initialize(sessionId);

    const session: AudioRelaySession = {
      sessionId,
      socket: null,
      isConnected: false,
      isSessionReady: false,
      isStopping: false,
      isFailed: false,
      ffmpegProcess: null,
      audioQueue: [],
      lastDataTime: Date.now(),
      reconnectAttempts: 0,
      sentenceIndex: 0,
      sessionStartTime: Date.now(),
      lastSentenceEndTime: 0,
    };

    this.sessions.set(sessionId, session);
    
    // 立即建立 WebSocket 连接
    this.connectToDashScope(sessionId, session);
  }

  /**
   * 连接到 DashScope ASR WebSocket
   */
  private connectToDashScope(sessionId: string, session: AudioRelaySession): void {
    if (session.isStopping || session.isFailed) {
      this.logger.warn(`[${sessionId}] Skipping connect: isStopping=${session.isStopping}, isFailed=${session.isFailed}`);
      return;
    }

    if (session.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.logger.error(`[${sessionId}] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached`);
      session.isFailed = true;
      return;
    }

    session.reconnectAttempts++;
    this.logger.log(`[${sessionId}] Connecting to DashScope ASR (attempt ${session.reconnectAttempts})...`);

    if (!this.apiKey) {
      this.logger.error(`[${sessionId}] API Key not configured`);
      session.isFailed = true;
      return;
    }

    try {
      const wsUrl = `${DASHSCOPE_WSS_URL}?model=${encodeURIComponent(this.model)}`;
      
      const socket = new WS(wsUrl, {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
        },
      });

      session.socket = socket as any;

      socket.on("open", () => {
        this.logger.log(`[${sessionId}] Connected to DashScope ASR`);
        session.isConnected = true;
        session.reconnectAttempts = 0;

        // 发送 session.update 配置
        const sessionConfig: DashScopeSessionConfig = {
          event_id: generateEventId(),
          type: "session.update",
          session: {
            input_audio_format: "pcm",
            sample_rate: this.sampleRate,
            input_audio_transcription: {
              language: "zh",
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.2,
              silence_duration_ms: 800,
            },
          },
        };

        this.logger.debug(`[${sessionId}] Sending session.update`);
        socket.send(JSON.stringify(sessionConfig));
      });

      socket.on("message", (data: Buffer) => {
        this.handleDashScopeMessage(sessionId, session, data);
      });

      socket.on("error", (error: Error) => {
        this.logger.error(`[${sessionId}] WebSocket error: ${error.message}`);
        session.isConnected = false;
      });

      socket.on("close", (code: number, reason: Buffer) => {
        this.logger.warn(`[${sessionId}] WebSocket closed: code=${code}, reason=${reason.toString()}`);
        session.isConnected = false;
        session.isSessionReady = false;
      });

    } catch (error) {
      this.logger.error(`[${sessionId}] Failed to connect: ${error}`);
      session.isFailed = true;
    }
  }

  /**
   * 处理 DashScope WebSocket 消息
   */
  private handleDashScopeMessage(sessionId: string, session: AudioRelaySession, data: Buffer): void {
    try {
      const msg = JSON.parse(data.toString());
      const msgType = msg.type;

      this.logger.debug(`[${sessionId}] Event: ${msgType}`);

      switch (msgType) {
        case "session.created":
          this.logger.log(`[${sessionId}] Session created`);
          break;

        case "session.updated":
          this.logger.log(`[${sessionId}] Session updated, ready to receive audio`);
          session.isSessionReady = true;
          session.sessionStartTime = Date.now();
          session.lastSentenceEndTime = 0;
          // 发送队列中的音频
          this.flushAudioQueue(sessionId, session);
          break;

        case "input_audio_buffer.speech_started":
          this.logger.debug(`[${sessionId}] Speech started`);
          break;

        case "input_audio_buffer.speech_stopped":
          this.logger.debug(`[${sessionId}] Speech stopped`);
          break;

        case "conversation.item.input_audio_transcription.completed":
          this.handleTranscriptionCompleted(sessionId, session, msg);
          break;

        case "conversation.item.input_audio_transcription.text":
        case "conversation.item.input_audio_transcription.delta":
          // 中间结果（实时显示）
          const interimText = msg.text || msg.delta || "";
          if (interimText) {
            this.logger.debug(`[${sessionId}] Interim: ${interimText}`);
          }
          break;

        case "error":
          const errorMsg = msg.error?.message || msg.message || "识别错误";
          this.logger.error(`[${sessionId}] Error: ${errorMsg}`);
          break;

        case "response.done":
          this.logger.debug(`[${sessionId}] Response done`);
          break;

        default:
          if (msgType) {
            this.logger.debug(`[${sessionId}] Unhandled event: ${msgType}`);
          }
      }
    } catch (error) {
      this.logger.error(`[${sessionId}] Failed to parse message: ${error}`);
    }
  }

  /**
   * 处理转录完成消息
   */
  private handleTranscriptionCompleted(
    sessionId: string,
    session: AudioRelaySession,
    msg: any
  ): void {
    // 提取文本 - 尝试多种可能的结构
    let finalText = "";
    if (msg.item?.content?.[0]?.text) {
      finalText = msg.item.content[0].text;
    } else if (msg.transcript) {
      finalText = msg.transcript;
    } else if (msg.text) {
      finalText = msg.text;
    }

    if (!finalText) {
      this.logger.warn(`[${sessionId}] Completed but no text found`);
      return;
    }

    // 计算时间戳（使用前端时间戳策略，更准确）
    const now = Date.now();
    const elapsedMs = now - session.sessionStartTime;
    const beginTime = session.lastSentenceEndTime;
    const endTime = elapsedMs;
    session.lastSentenceEndTime = elapsedMs;

    this.logger.log(`[${sessionId}] Transcript: "${finalText}" (${beginTime}ms - ${endTime}ms)`);

    // 创建 ASR 句子结果
    const sentence: ASRSentence = {
      id: `seg-${sessionId}-${session.sentenceIndex++}`,
      text: finalText,
      beginTime,
      endTime,
      isFinal: true,
    };

    // 追加到 ContextStore（适配现有接口）
    this.appendToContextStore(sessionId, sentence);
  }

  /**
   * 追加转录结果到 ContextStore
   */
  private appendToContextStore(sessionId: string, sentence: ASRSentence): void {
    const segment: ContextSegment = {
      id: sentence.id,
      text: sentence.text,
      startMs: sentence.beginTime,
      endMs: sentence.endTime,
      timestamp: new Date(),
    };

    // 直接操作 ContextStore（使用内部方法）
    const context = (this.contextStore as any).contexts?.get(sessionId);
    if (context) {
      const existingIndex = context.segments.findIndex((s: ContextSegment) => s.id === segment.id);
      if (existingIndex >= 0) {
        context.segments[existingIndex] = segment;
      } else {
        context.segments.push(segment);
        context.pendingSegments.push(segment);
        // 触发批量持久化检查
        (this.contextStore as any).checkAndPersist?.(sessionId);
      }
      this.logger.debug(`[${sessionId}] Appended segment: "${segment.text.slice(0, 50)}..."`);
    } else {
      this.logger.warn(`[${sessionId}] Context not found, initializing...`);
      this.contextStore.initialize(sessionId);
    }
  }

  /**
   * 发送音频数据到 DashScope
   */
  private sendAudioToDashScope(session: AudioRelaySession, pcmData: Buffer): void {
    if (!session.socket || (session.socket as any).readyState !== WS.OPEN) {
      return;
    }

    // 将 PCM 数据转为 Base64
    const base64Audio = pcmData.toString("base64");

    // 使用 input_audio_buffer.append 事件发送
    const appendEvent: DashScopeAudioAppendEvent = {
      event_id: generateEventId(),
      type: "input_audio_buffer.append",
      audio: base64Audio,
    };

    (session.socket as any).send(JSON.stringify(appendEvent));
  }

  /**
   * 发送队列中的音频
   */
  private flushAudioQueue(sessionId: string, session: AudioRelaySession): void {
    while (session.audioQueue.length > 0) {
      const audioData = session.audioQueue.shift();
      if (audioData) {
        this.sendAudioToDashScope(session, audioData);
      }
    }
  }

  /**
   * 获取音频预处理滤镜参数
   * 借鉴 MeetMind 的音频优化方案
   */
  private getAudioEnhancementFilters(): string {
    return [
      "highpass=f=80",      // 高通滤波，去除 80Hz 以下低频噪声
      "lowpass=f=8000",     // 低通滤波，去除 8kHz 以上高频噪声
      "anlmdn=s=0.0003",    // 非局部均值降噪（提高识别率）
      "volume=1.3",         // 音量增益 1.3 倍
    ].join(",");
  }

  /**
   * 启动 FFmpeg 流式转码
   */
  private startFfmpegStream(sessionId: string, session: AudioRelaySession): void {
    if (session.ffmpegProcess) return;

    const args = [
      "-loglevel", "warning",
      "-f", "webm",
      "-i", "pipe:0",
      "-vn",  // 禁用视频
      "-af", this.getAudioEnhancementFilters(),
      "-acodec", "pcm_s16le",
      "-ar", String(this.sampleRate),
      "-ac", "1",
      "-f", "s16le",
      "pipe:1",
    ];

    this.logger.log(`[${sessionId}] Starting ffmpeg streaming converter`);
    const proc = spawn(ffmpeg ?? "ffmpeg", args, { stdio: ["pipe", "pipe", "pipe"] });
    session.ffmpegProcess = proc;

    proc.stdout?.on("data", (data: Buffer) => {
      this.handlePcmData(sessionId, session, data);
    });

    let stderr = "";
    proc.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
      // 检测 WebM header 错误
      if (d.toString().includes("Invalid data") || d.toString().includes("Invalid EBML")) {
        this.logger.warn(`[${sessionId}] Detected new WebM stream, will restart ffmpeg`);
        this.cleanupFfmpeg(sessionId, session);
      }
    });

    proc.on("close", (code: number) => {
      if (code !== 0 && !session.isStopping) {
        this.logger.warn(`[${sessionId}] ffmpeg closed unexpectedly: code=${code}`);
      }
      session.ffmpegProcess = null;
    });

    proc.on("error", (err: Error) => {
      this.logger.error(`[${sessionId}] ffmpeg error: ${err.message}`);
      session.ffmpegProcess = null;
    });
  }

  /**
   * 处理 PCM 数据
   */
  private handlePcmData(sessionId: string, session: AudioRelaySession, pcm: Buffer): void {
    if (!session.isSessionReady) {
      // 会话未就绪，加入队列
      session.audioQueue.push(pcm);
      return;
    }

    this.sendAudioToDashScope(session, pcm);
  }

  /**
   * 清理 FFmpeg 进程
   */
  private cleanupFfmpeg(sessionId: string, session: AudioRelaySession): void {
    if (session.ffmpegProcess) {
      try {
        session.ffmpegProcess.stdin?.end();
        session.ffmpegProcess.kill("SIGKILL");
      } catch (e) {
        this.logger.debug(`[${sessionId}] ffmpeg cleanup error (ignored): ${e}`);
      }
      session.ffmpegProcess = null;
      this.logger.log(`[${sessionId}] ffmpeg process cleaned up`);
    }
  }

  /**
   * 等待连接就绪
   */
  private async waitForConnection(session: AudioRelaySession, timeoutMs = 5000): Promise<void> {
    if (session.isConnected && session.isSessionReady) return;

    return new Promise((resolve, reject) => {
      const start = Date.now();
      const timer = setInterval(() => {
        if (session.isConnected && session.isSessionReady) {
          clearInterval(timer);
          resolve();
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(timer);
          reject(new Error("DashScope ASR connection timeout"));
        }
      }, 50);
    });
  }

  /**
   * 接收 WebM 音频块
   */
  async ingestWebmChunk(sessionId: string, webmChunk: Buffer): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // 更新最后数据时间
    session.lastDataTime = Date.now();

    if (session.isStopping) {
      this.logger.warn(`[${sessionId}] Session is stopping, ignoring chunk`);
      return;
    }

    if (session.isFailed) {
      this.logger.warn(`[${sessionId}] Session has failed, ignoring chunk`);
      return;
    }

    // 检测是否是新的 WebM 流（EBML header: 0x1A45DFA3）
    const isNewWebmStream = webmChunk.length >= 4 &&
      webmChunk[0] === 0x1A &&
      webmChunk[1] === 0x45 &&
      webmChunk[2] === 0xDF &&
      webmChunk[3] === 0xA3;

    if (isNewWebmStream && session.ffmpegProcess) {
      this.logger.log(`[${sessionId}] Detected new WebM stream, restarting ffmpeg`);
      this.cleanupFfmpeg(sessionId, session);
    }

    // 检查 WebSocket 连接状态
    if (!session.isConnected || !session.socket || (session.socket as any).readyState !== WS.OPEN) {
      if (session.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        this.logger.warn(`[${sessionId}] Max reconnect attempts reached`);
        session.isFailed = true;
        return;
      }

      this.logger.warn(`[${sessionId}] WebSocket disconnected, reconnecting...`);
      this.cleanupFfmpeg(sessionId, session);
      this.connectToDashScope(sessionId, session);
    }

    if (session.isFailed) {
      return;
    }

    // 等待连接就绪
    try {
      await this.waitForConnection(session);
    } catch (err) {
      this.logger.error(`[${sessionId}] Failed to establish connection: ${err}`);
      throw err;
    }

    // 检查 ffmpeg 进程健康状态
    if (session.ffmpegProcess) {
      const stdinOk = session.ffmpegProcess.stdin &&
        !session.ffmpegProcess.stdin.destroyed &&
        !session.ffmpegProcess.stdin.writableEnded;
      if (!stdinOk) {
        this.logger.warn(`[${sessionId}] ffmpeg stdin unhealthy, restarting...`);
        this.cleanupFfmpeg(sessionId, session);
      }
    }

    // 启动新的 ffmpeg 流
    if (!session.ffmpegProcess) {
      this.startFfmpegStream(sessionId, session);
    }

    if (!session.ffmpegProcess || !session.ffmpegProcess.stdin) {
      throw new Error(`ffmpeg stream not ready for session ${sessionId}`);
    }

    return new Promise<void>((resolve, reject) => {
      session.ffmpegProcess!.stdin!.write(webmChunk, (err: Error | null | undefined) => {
        if (err) {
          if (err.message.includes("write after end")) {
            this.logger.warn(`[${sessionId}] ffmpeg stdin write after end, will restart`);
            this.cleanupFfmpeg(sessionId, session);
            return resolve();
          }
          this.logger.error(`[${sessionId}] ffmpeg stdin write failed: ${err.message}`);
          this.cleanupFfmpeg(sessionId, session);
          return reject(err);
        }
        resolve();
      });
    });
  }

  /**
   * 更新会话（重新连接）
   */
  updateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      // 关闭旧连接
      if (session.socket) {
        try {
          (session.socket as any).close();
        } catch {}
        session.socket = null;
      }

      this.cleanupFfmpeg(sessionId, session);

      // 重置状态
      session.isConnected = false;
      session.isSessionReady = false;
      session.isStopping = false;
      session.isFailed = false;
      session.reconnectAttempts = 0;
      session.sentenceIndex = 0;
      session.sessionStartTime = Date.now();
      session.lastSentenceEndTime = 0;

      this.logger.log(`[${sessionId}] Session reset, reconnecting...`);
      this.connectToDashScope(sessionId, session);
    } else {
      this.logger.log(`[${sessionId}] Session not found, creating new one`);
      this.create(sessionId);
    }
  }

  /**
   * 停止会话
   */
  async stop(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.warn(`[${sessionId}] Session not found during stop`);
      return;
    }

    if (session.isStopping) {
      this.logger.warn(`[${sessionId}] Session already stopping`);
      return;
    }

    session.isStopping = true;
    this.logger.log(`[${sessionId}] Stopping DashScope ASR session`);

    // 清理 ffmpeg
    this.cleanupFfmpeg(sessionId, session);

    // 发送 commit 并关闭连接
    if (session.socket && (session.socket as any).readyState === WS.OPEN) {
      try {
        const commitEvent: DashScopeCommitEvent = {
          event_id: generateEventId(),
          type: "input_audio_buffer.commit",
        };
        (session.socket as any).send(JSON.stringify(commitEvent));
        this.logger.log(`[${sessionId}] Audio buffer committed`);

        // 等待一会儿让服务端处理完成
        await new Promise((resolve) => setTimeout(resolve, 2000));

        (session.socket as any).close(1000, "Session stopped");
      } catch (e) {
        this.logger.debug(`[${sessionId}] Error during stop: ${e}`);
      }
    }

    this.sessions.delete(sessionId);
  }

  /**
   * 检查会话是否存在
   */
  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * 获取会话状态
   */
  getStatus(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) return "not_found";
    if (session.isFailed) return "failed";
    if (session.isStopping) return "stopping";
    if (session.isSessionReady) return "ready";
    if (session.isConnected) return "connected";
    return "connecting";
  }
}
