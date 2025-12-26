import { Injectable, Logger } from "@nestjs/common";
import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import WS from "ws";
import ffmpeg from "ffmpeg-static";
import {
  ContextStoreService,
  TingwuTranscriptionPayload,
} from "../context/context-store.service";

type RelaySession = {
  socket: WS | null;
  meetingJoinUrl: string;
  isConnected: boolean;
  isStarted: boolean;
  isStopping: boolean; // 标记是否正在停止
  ffmpegProcess: ChildProcess | null;
  pcmBuffer: Buffer[]; // 已转码的 PCM 待发送队列
  lastDataTime: number; // 最后收到数据的时间戳
  heartbeatTimer: NodeJS.Timeout | null; // 心跳检测定时器
};

@Injectable()
export class AudioRelayService {
  private readonly logger = new Logger(AudioRelayService.name);
  private readonly sessions = new Map<string, RelaySession>();

  constructor(private readonly contextStore: ContextStoreService) {}

  create(sessionId: string, meetingJoinUrl: string) {
    if (this.sessions.has(sessionId)) {
      return;
    }
    this.logger.log(`Creating audio relay session ${sessionId}`);

    // 初始化上下文存储
    this.contextStore.initialize(sessionId);

    const relay: RelaySession = {
      socket: null,
      meetingJoinUrl,
      isConnected: false,
      isStarted: false,
      isStopping: false,
      ffmpegProcess: null,
      pcmBuffer: [],
      lastDataTime: Date.now(),
      heartbeatTimer: null,
    };

    this.sessions.set(sessionId, relay);
    
    // 立即建立 WebSocket 连接
    this.connectToTingwu(sessionId, relay);
  }

  private connectToTingwu(sessionId: string, relay: RelaySession) {
    this.logger.log(`Connecting to Tingwu WebSocket for session ${sessionId}...`);
    
    const socket = new WS(relay.meetingJoinUrl);
    relay.socket = socket;

    socket.on("open", () => {
      this.logger.log(`Tingwu WebSocket connected for session ${sessionId}`);
      relay.isConnected = true;
      // 注意：不再在连接时立即发送 StartTranscription
      // 而是等到第一个音频数据到达时再发送，避免 IDLE_TIMEOUT
    });

    socket.on("error", (error) => {
      this.logger.error(`WebSocket error for session ${sessionId}: ${error.message}`);
      relay.isConnected = false;
    });

    socket.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        
        // 检查是否有转写结果
        if (msg.header?.name === "TranscriptionResultChanged" || 
            msg.header?.name === "SentenceEnd") {
          // 优先使用 fixed_result（修正后的结果），提高识别正确率
          // fixed_result 包含听悟的智能修正，如标点、同音字纠错等
          const rawResult = msg.payload?.result ?? "";
          const fixedResult = msg.payload?.fixed_result ?? "";
          const finalResult = fixedResult || rawResult; // 优先使用修正结果
          
          this.logger.log(`[${sessionId}] Transcription: "${finalResult}"${fixedResult ? ' (fixed)' : ''}`);
          
          // 追加到 ContextStore
          if (msg.payload) {
            const payload: TingwuTranscriptionPayload = {
              result: rawResult,
              words: msg.payload.words ?? [],
              index: msg.payload.index ?? 0,
              time: msg.payload.time ?? 0,
              confidence: msg.payload.confidence ?? 0,
              fixed_result: fixedResult || undefined,
            };
            this.contextStore.appendFromTingwu(sessionId, payload);
          }
        } else if (msg.header?.name === "TranscriptionStarted") {
          this.logger.log(`[${sessionId}] Transcription started`);
        } else if (msg.header?.name === "TranscriptionCompleted") {
          this.logger.log(`[${sessionId}] Transcription completed`);
        } else if (msg.header?.name === "TaskFailed") {
          this.logger.error(
            `[${sessionId}] TaskFailed: ${JSON.stringify({
              header: msg.header,
              payload: msg.payload,
              status: msg.header?.status,
              status_text: msg.header?.status_text,
            })}`
          );
        } else {
          this.logger.debug(`[${sessionId}] Tingwu message: ${msg.header?.name}`);
        }
      } catch {
        // 二进制数据，忽略
      }
    });

    socket.on("close", (code) => {
      this.logger.warn(`WebSocket closed for session ${sessionId}, code=${code}`);
      relay.isConnected = false;
      relay.isStarted = false;
    });
  }

  // 保留空实现以兼容旧调用
  private async flushPcmBuffer(_sessionId: string, _relay: RelaySession) {
    return;
  }

  /**
   * 发送 StartTranscription 命令（延迟发送，避免 IDLE_TIMEOUT）
   */
  private sendStartTranscription(sessionId: string, relay: RelaySession) {
    if (relay.isStarted) return; // 已经发送过了
    if (!relay.socket || relay.socket.readyState !== WS.OPEN) return;

    const startCommand = JSON.stringify({
      header: {
        name: "StartTranscription",
        namespace: "SpeechTranscriber",
      },
      payload: {
        format: "pcm",
        sample_rate: 16000,
      },
    });
    relay.socket.send(startCommand);
    relay.isStarted = true;
    this.logger.log(`[${sessionId}] Sent StartTranscription command (delayed until first audio)`);
  }

  async write(sessionId: string, chunk: Buffer) {
    // 兼容旧调用，直接走实时转码管道
    await this.ingestWebmChunk(sessionId, chunk);
  }

  private async convertToPcm(webmChunk: Buffer, sessionId: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const tempDir = os.tmpdir();
      const inputFile = path.join(tempDir, `${sessionId}-${Date.now()}-input.webm`);
      const outputFile = path.join(tempDir, `${sessionId}-${Date.now()}-output.pcm`);

      try {
        fs.writeFileSync(inputFile, webmChunk);

        const args = [
          "-y",
          "-f",
          "webm",
          "-i",
          inputFile,
          "-vn", // 禁用视频
          "-af",
          this.getAudioEnhancementFilters(), // 应用音频增强滤镜
          "-acodec",
          "pcm_s16le",
          "-ar",
          "16000",
          "-ac",
          "1",
          "-f",
          "s16le",
          outputFile,
        ];

        this.logger.debug(
          `[${sessionId}] ffmpeg start, chunk=${webmChunk.length} bytes, args=${args.join(" ")}`
        );

        const ffmpegProcess = spawn(ffmpeg ?? "ffmpeg", args);

        let stderr = "";
        ffmpegProcess.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        ffmpegProcess.on("close", (code) => {
          try {
            if (code === 0 && fs.existsSync(outputFile)) {
              const pcmData = fs.readFileSync(outputFile);
              if (pcmData.length === 0) {
                this.logger.warn(
                  `[${sessionId}] ffmpeg output is empty, chunk=${webmChunk.length} bytes, stderr_tail=${stderr.slice(-200)}`
                );
              }
              resolve(pcmData);
            } else {
              this.logger.warn(
                `[${sessionId}] ffmpeg exited with code ${code}, chunk=${webmChunk.length} bytes, stderr_head=${stderr.slice(0, 400)}, stderr_tail=${stderr.slice(-400)}`
              );
              resolve(Buffer.alloc(0));
            }
          } finally {
            // 清理临时文件
            try {
              if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
              if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
            } catch {}
          }
        });

        ffmpegProcess.on("error", (error) => {
          try {
            if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
            if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
          } catch {}
          reject(error);
        });
      } catch (error) {
        try {
          if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
          if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
        } catch {}
        reject(error);
      }
    });
  }

  /**
   * 获取音频预处理滤镜参数
   * 平衡版本：保留降噪以提高识别率，移除耗时的loudnorm
   */
  private getAudioEnhancementFilters(): string {
    // 音频增强滤镜链：
    // 1. highpass: 高通滤波，去除低频噪声（80Hz以下）
    // 2. lowpass: 低通滤波，去除高频噪声（8000Hz以上）
    // 3. anlmdn: 非局部均值降噪（保留，对识别率很重要）
    // 4. volume: 音量增益
    // 注：移除了 loudnorm（音量归一化）以降低延迟
    return [
      "highpass=f=80",
      "lowpass=f=8000",
      "anlmdn=s=0.0003", // 降噪，对识别率很重要
      "volume=1.3",
    ].join(",");
  }

  private startFfmpegStream(sessionId: string, relay: RelaySession) {
    if (relay.ffmpegProcess) return;
    const args = [
      "-loglevel",
      "warning", // 改为 warning 以便看到更多信息
      "-f",
      "webm",
      "-i",
      "pipe:0",
      "-vn", // 禁用视频
      "-af",
      this.getAudioEnhancementFilters(), // 应用音频增强滤镜
      "-acodec",
      "pcm_s16le",
      "-ar",
      "16000",
      "-ac",
      "1",
      "-f",
      "s16le",
      "pipe:1",
    ];
    this.logger.log(`[${sessionId}] start ffmpeg streaming converter`);
    const proc = spawn(ffmpeg ?? "ffmpeg", args, { stdio: ["pipe", "pipe", "pipe"] });
    relay.ffmpegProcess = proc;

    proc.stdout?.on("data", async (data: Buffer) => {
      try {
        await this.sendPcmData(sessionId, relay, data);
      } catch (err) {
        this.logger.warn(`[${sessionId}] send pcm failed: ${err}`);
      }
    });

    let stderr = "";
    proc.stderr?.on("data", (d) => {
      stderr += d.toString();
      // 检测 WebM header 错误，这通常意味着收到了新的 WebM 流
      if (d.toString().includes("Invalid data") || d.toString().includes("Invalid EBML")) {
        this.logger.warn(`[${sessionId}] Detected new WebM stream, will restart ffmpeg on next chunk`);
        // 标记需要重启
        this.cleanupFfmpeg(sessionId, relay);
      }
    });
    proc.on("close", (code) => {
      if (code !== 0 && !relay.isStopping) {
        this.logger.warn(
          `[${sessionId}] ffmpeg stream closed unexpectedly code=${code}, stderr_tail=${stderr.slice(-400)}`
        );
      }
      relay.ffmpegProcess = null;
    });
    proc.on("error", (err) => {
      this.logger.error(`[${sessionId}] ffmpeg error: ${err.message}`);
      relay.ffmpegProcess = null;
    });
  }

  private async sendPcmData(sessionId: string, relay: RelaySession, pcm: Buffer) {
    const socket = relay.socket;
    if (!socket || socket.readyState !== WS.OPEN) return;
    
    // 在发送第一个音频数据前，先发送 StartTranscription
    this.sendStartTranscription(sessionId, relay);
    
    const chunkSize = 3200; // 100ms @16k mono
    for (let offset = 0; offset < pcm.length; offset += chunkSize) {
      const slice = pcm.subarray(offset, offset + chunkSize);
      socket.send(slice);
      // 减少节流延迟，从5ms改为2ms，提高实时性
      await new Promise((r) => setTimeout(r, 2));
    }
  }

  async ingestWebmChunk(sessionId: string, webmChunk: Buffer) {
    const relay = this.sessions.get(sessionId);
    if (!relay) {
      throw new Error(`Relay not found for session ${sessionId}`);
    }
    
    // 更新最后数据时间
    relay.lastDataTime = Date.now();
    
    // 检查 relay 是否正在停止
    if (relay.isStopping) {
      this.logger.warn(`[${sessionId}] Relay is stopping, ignoring chunk`);
      return;
    }
    
    // 检测是否是新的 WebM 流（检查 EBML header: 0x1A45DFA3）
    // 如果是新流且 ffmpeg 已经在运行，需要重启 ffmpeg
    const isNewWebmStream = webmChunk.length >= 4 && 
                            webmChunk[0] === 0x1A && 
                            webmChunk[1] === 0x45 && 
                            webmChunk[2] === 0xDF && 
                            webmChunk[3] === 0xA3;
    
    if (isNewWebmStream && relay.ffmpegProcess) {
      this.logger.log(`[${sessionId}] Detected new WebM stream (EBML header), restarting ffmpeg`);
      this.cleanupFfmpeg(sessionId, relay);
    }
    
    // 检查 WebSocket 连接状态，如果断开则需要重新连接
    if (!relay.isConnected || !relay.socket || relay.socket.readyState !== WS.OPEN) {
      this.logger.warn(`[${sessionId}] WebSocket disconnected, attempting to reconnect...`);
      
      // 清理旧的 ffmpeg 进程（因为需要重新开始新的流）
      this.cleanupFfmpeg(sessionId, relay);
      
      // 重置状态
      relay.isStarted = false;
      
      // 重新连接 WebSocket
      this.connectToTingwu(sessionId, relay);
    }
    
    // 等待连接就绪
    try {
      await this.waitForConnection(relay);
    } catch (err) {
      this.logger.error(`[${sessionId}] Failed to establish connection: ${err}`);
      throw err;
    }
    
    // 检查 ffmpeg 进程是否健康，如果不健康则重启
    if (relay.ffmpegProcess) {
      const stdinOk = relay.ffmpegProcess.stdin && 
                      !relay.ffmpegProcess.stdin.destroyed && 
                      !relay.ffmpegProcess.stdin.writableEnded;
      if (!stdinOk) {
        this.logger.warn(`[${sessionId}] ffmpeg stdin unhealthy, restarting ffmpeg...`);
        this.cleanupFfmpeg(sessionId, relay);
      }
    }
    
    // 启动新的 ffmpeg 流（如果需要）
    if (!relay.ffmpegProcess) {
      this.startFfmpegStream(sessionId, relay);
    }

    if (!relay.ffmpegProcess || !relay.ffmpegProcess.stdin) {
      throw new Error(`ffmpeg stream not ready for session ${sessionId}`);
    }

    return new Promise<void>((resolve, reject) => {
      relay.ffmpegProcess!.stdin!.write(webmChunk, (err) => {
        if (err) {
          // 忽略 "write after end" 错误，因为这是竞态条件导致的
          if (err.message.includes('write after end')) {
            this.logger.warn(`[${sessionId}] ffmpeg stdin write after end, will restart on next chunk`);
            this.cleanupFfmpeg(sessionId, relay);
            return resolve();
          }
          this.logger.error(`[${sessionId}] ffmpeg stdin write failed: ${err.message}`);
          // 清理 ffmpeg 以便下次重启
          this.cleanupFfmpeg(sessionId, relay);
          return reject(err);
        }
        resolve();
      });
    });
  }
  
  /**
   * 清理 ffmpeg 进程
   */
  private cleanupFfmpeg(sessionId: string, relay: RelaySession): void {
    if (relay.ffmpegProcess) {
      try {
        relay.ffmpegProcess.stdin?.end();
        relay.ffmpegProcess.kill('SIGKILL');
      } catch (e) {
        this.logger.debug(`[${sessionId}] ffmpeg cleanup error (ignored): ${e}`);
      }
      relay.ffmpegProcess = null;
      this.logger.log(`[${sessionId}] ffmpeg process cleaned up`);
    }
  }

  private async waitForConnection(relay: RelaySession, timeoutMs = 5000) {
    if (relay.isConnected && relay.socket?.readyState === WS.OPEN) return;
    await new Promise<void>((resolve, reject) => {
      const start = Date.now();
      const timer = setInterval(() => {
        if (relay.isConnected && relay.socket?.readyState === WS.OPEN) {
          clearInterval(timer);
          resolve();
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(timer);
          reject(new Error("Tingwu socket not ready"));
        }
      }, 50);
    });
  }

  async ingestPcmBuffer(sessionId: string, pcm: Buffer) {
    const relay = this.sessions.get(sessionId);
    if (!relay) throw new Error(`Relay not found for session ${sessionId}`);
    await this.waitForConnection(relay);

    if (!relay.socket || relay.socket.readyState !== WS.OPEN) {
      throw new Error(`Socket not open for session ${sessionId}`);
    }

    // 在发送第一个音频数据前，先发送 StartTranscription
    this.sendStartTranscription(sessionId, relay);

    const chunkSize = 3200; // 100ms @16k mono s16le
    this.logger.log(
      `[${sessionId}] Start sending PCM buffer, total=${pcm.length} bytes`
    );
    for (let offset = 0; offset < pcm.length; offset += chunkSize) {
      const slice = pcm.subarray(offset, offset + chunkSize);
      relay.socket.send(slice);
      await new Promise((r) => setTimeout(r, 10)); // 放松节流，提高实时性
    }
    this.logger.log(
      `[${sessionId}] Finished sending PCM buffer, chunks=${Math.ceil(
        pcm.length / chunkSize
      )}`
    );
  }

  async ingestAudioFile(sessionId: string, fileBuffer: Buffer, inputHint?: string) {
    const relay = this.sessions.get(sessionId);
    if (!relay) throw new Error(`Relay not found for session ${sessionId}`);

    const tempDir = os.tmpdir();
    const inputFile = path.join(
      tempDir,
      `${sessionId}-${Date.now()}-upload${inputHint ? `.${inputHint}` : ""}`
    );
    const outputFile = path.join(tempDir, `${sessionId}-${Date.now()}-upload.pcm`);

    fs.writeFileSync(inputFile, fileBuffer);

    const args = [
      "-y",
      "-i",
      inputFile,
      "-vn", // 禁用视频
      "-af",
      this.getAudioEnhancementFilters(), // 应用音频增强滤镜
      "-acodec",
      "pcm_s16le",
      "-ar",
      "16000",
      "-ac",
      "1",
      "-f",
      "s16le",
      outputFile,
    ];

    this.logger.log(
      `[${sessionId}] ffmpeg transcode upload -> pcm, args=${args.join(" ")}`
    );

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpeg ?? "ffmpeg", args);
      let stderr = "";
      proc.stderr?.on("data", (d) => (stderr += d.toString()));
      proc.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          this.logger.error(
            `[${sessionId}] ffmpeg upload exit ${code}, stderr_tail=${stderr.slice(-400)}`
          );
          reject(new Error(`ffmpeg exit ${code}`));
        }
      });
      proc.on("error", (err) => reject(err));
    });

    if (!fs.existsSync(outputFile)) {
      throw new Error("PCM output missing after transcode");
    }
    const pcm = fs.readFileSync(outputFile);
    try {
      await this.ingestPcmBuffer(sessionId, pcm);
    } finally {
      try {
        if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
      } catch {}
    }
  }

  updateUrl(sessionId: string, meetingJoinUrl: string) {
    const relay = this.sessions.get(sessionId);
    if (relay) {
      // 关闭旧的连接和 ffmpeg 进程
      if (relay.socket) {
        try {
          relay.socket.close();
        } catch {}
        relay.socket = null;
      }
      
      if (relay.ffmpegProcess) {
        try {
          relay.ffmpegProcess.stdin?.end();
          relay.ffmpegProcess.kill('SIGKILL');
        } catch {}
        relay.ffmpegProcess = null;
      }
      
      // 重置状态
      relay.meetingJoinUrl = meetingJoinUrl;
      relay.isConnected = false;
      relay.isStarted = false;
      relay.isStopping = false;
      
      this.logger.log(`Updated meetingJoinUrl for session ${sessionId}, reconnecting...`);
      
      // 重新连接
      this.connectToTingwu(sessionId, relay);
    } else {
      // 如果 relay 不存在，创建新的
      this.logger.log(`Relay not found for session ${sessionId}, creating new one`);
      this.create(sessionId, meetingJoinUrl);
    }
  }

  // 保留旧方法以兼容
  async processAndSend(sessionId: string): Promise<void> {
    this.logger.log(`processAndSend called for session ${sessionId} (now handled in real-time)`);
    // 实时模式下，音频已经在 write() 中处理了
    // 这里只需要确保所有缓冲数据都发送完毕
    const relay = this.sessions.get(sessionId);
    if (relay) {
      await this.flushPcmBuffer(sessionId, relay);
    }
  }

  async stop(sessionId: string) {
    const relay = this.sessions.get(sessionId);
    if (!relay) {
      this.logger.warn(`[${sessionId}] Relay not found during stop, may have been cleaned up`);
      return;
    }
    
    // 如果已经在停止中，避免重复操作
    if (relay.isStopping) {
      this.logger.warn(`[${sessionId}] Relay already stopping, skipping`);
      return;
    }
    
    // 标记为正在停止，防止新的数据写入
    relay.isStopping = true;
    this.logger.log(`Stopping relay for session ${sessionId}`);

    // 清理心跳定时器
    if (relay.heartbeatTimer) {
      clearInterval(relay.heartbeatTimer);
      relay.heartbeatTimer = null;
    }

    // 发送最后的数据
    await this.flushPcmBuffer(sessionId, relay);

    // 结束 ffmpeg 流
    this.cleanupFfmpeg(sessionId, relay);

    // 发送 StopTranscription 命令
    if (relay.socket && relay.socket.readyState === WS.OPEN && relay.isStarted) {
      const stopCommand = JSON.stringify({
        header: {
          name: "StopTranscription",
          namespace: "SpeechTranscriber",
        },
        payload: {},
      });
      relay.socket.send(stopCommand);
      this.logger.log(`Sent StopTranscription command for session ${sessionId}`);
      
      // 等待一会儿让服务端处理完成
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      relay.socket.close();
    }

    this.sessions.delete(sessionId);
  }
}
