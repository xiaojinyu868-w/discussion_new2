# 大模型 API 调用指南

> **文档版本**: 1.0  
> **最后更新**: 2024-12-24  
> **适用范围**: 本项目所有大模型调用

本文档详细说明项目中三个大模型 API 的调用方式，方便后续复用。

---

## 目录

1. [Qwen (通义千问) - 文本生成](#1-qwen-通义千问---文本生成)
2. [Gemini Imagen - 图像生成](#2-gemini-imagen---图像生成)
3. [通义听悟 - 流式语音转文本](#3-通义听悟---流式语音转文本)

---

## 1. Qwen (通义千问) - 文本生成

### 1.1 概述

- **用途**: 会议洞察生成、自由问答、会议标题生成等文本生成任务
- **模型**: `qwen3-max` (可配置)
- **API**: 阿里云 DashScope OpenAI 兼容接口
- **代码位置**: `backend/src/modules/llm/llm-adapter.service.ts`

### 1.2 环境变量配置

```bash
# .env 文件
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxx    # 必填：阿里云 DashScope API Key
LLM_MODEL=qwen3-max                       # 可选：模型名称，默认 qwen3-max
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1  # 可选：API 地址
LLM_TEMPERATURE=0.7                       # 可选：生成温度，默认 0.7
LLM_MAX_TOKENS=2000                       # 可选：最大 token 数，默认 2000
```

### 1.3 配置读取

```typescript
// backend/src/shared/configuration.ts
export default () => ({
  llm: {
    apiKey: process.env.DASHSCOPE_API_KEY ?? "",
    model: process.env.LLM_MODEL ?? "qwen3-max",
    baseUrl: process.env.LLM_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
    temperature: Number(process.env.LLM_TEMPERATURE ?? 0.7),
    maxTokens: Number(process.env.LLM_MAX_TOKENS ?? 2000),
  },
});
```

### 1.4 核心代码实现

#### 初始化客户端

```typescript
import OpenAI from "openai";

// 使用 OpenAI SDK（DashScope 兼容 OpenAI 接口）
this.client = new OpenAI({
  apiKey: apiKey ?? "sk-placeholder",
  baseURL: baseURL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
});
```

#### 多轮对话

```typescript
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  stream?: boolean;
}

async chat(messages: ChatMessage[], options?: LLMOptions): Promise<string> {
  const completion = await this.client.chat.completions.create({
    model: this.model,  // qwen3-max
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    temperature: options?.temperature ?? this.defaultTemperature,
    top_p: options?.topP,
    max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
    stream: false,
  });

  return completion.choices[0]?.message?.content ?? "";
}
```

#### 带系统提示词的单轮对话

```typescript
async chatWithPrompt(
  systemPrompt: string,
  userContent: string,
  options?: LLMOptions
): Promise<string> {
  return this.chat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    options
  );
}
```

#### 流式输出

```typescript
async chatStream(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  options?: LLMOptions
): Promise<string> {
  let fullContent = "";

  const stream = await this.client.chat.completions.create({
    model: this.model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    temperature: options?.temperature ?? this.defaultTemperature,
    top_p: options?.topP,
    max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content ?? "";
    if (content) {
      fullContent += content;
      onChunk(content);  // 实时回调
    }
  }

  return fullContent;
}
```

#### JSON 响应解析（带容错）

```typescript
async chatForJson<T>(
  messages: ChatMessage[],
  options?: LLMOptions
): Promise<T | null> {
  const content = await this.chat(messages, options);

  try {
    let jsonStr = content;
    // 移除 markdown 代码块
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    return JSON.parse(jsonStr) as T;
  } catch (error) {
    return null;
  }
}
```

### 1.5 使用示例

```typescript
// 注入服务
constructor(private readonly llmAdapter: LLMAdapterService) {}

// 示例1：生成会议标题
const title = await this.llmAdapter.chatWithPrompt(
  "你是一个会议助手，请生成简洁的会议标题。",
  `根据以下会议内容，生成一个简短的会议标题（10字以内）：\n\n${meetingContent}`,
  { temperature: 0.3, maxTokens: 50 }
);

// 示例2：自由问答
const answer = await this.llmAdapter.chatWithPrompt(
  "你是一个专业的会议助手，帮助用户理解和分析会议内容。",
  `会议内容：\n${context}\n\n用户问题：${question}`,
  { temperature: 0.7, maxTokens: 1000 }
);

// 示例3：检查服务是否可用
if (this.llmAdapter.isAvailable()) {
  // LLM 可用
}
```

### 1.6 获取 API Key

1. 访问 [阿里云 DashScope](https://dashscope.console.aliyun.com/)
2. 注册/登录阿里云账号
3. 开通 DashScope 服务
4. 在「API-KEY 管理」中创建 API Key

---

## 2. Gemini Imagen - 图像生成

### 2.1 概述

- **用途**: 会议可视化、图表生成、创意海报等图像生成任务
- **模型**: `imagen-3.0-generate-001` 或 `gemini-2.5-flash-image`
- **API**: Google Generative AI API
- **代码位置**: `backend/src/modules/image-gen/image-generation-adapter.service.ts`

### 2.2 环境变量配置

```bash
# .env 文件
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxx   # 必填：Google AI API Key
IMAGE_GEN_MODEL=imagen-3.0-generate-001  # 可选：模型名称
IMAGE_GEN_BASE_URL=https://generativelanguage.googleapis.com/v1beta  # 可选：API 地址
IMAGE_GEN_SIZE=1024x1024                 # 可选：图像尺寸
IMAGE_GEN_FORMAT=png                      # 可选：图像格式
IMAGE_GEN_QUALITY=standard               # 可选：图像质量
```

### 2.3 配置读取

```typescript
// backend/src/shared/configuration.ts
export default () => ({
  imageGen: {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.IMAGE_GEN_MODEL ?? "imagen-3.0-generate-001",
    baseUrl: process.env.IMAGE_GEN_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta",
    size: process.env.IMAGE_GEN_SIZE ?? "1024x1024",
    format: process.env.IMAGE_GEN_FORMAT ?? "png",
    quality: process.env.IMAGE_GEN_QUALITY ?? "standard",
  },
});
```

### 2.4 核心代码实现

#### 接口定义

```typescript
export interface ImageGenerationOptions {
  type: "chart" | "creative" | "poster";
  chartType?: string;
  size?: string;       // 如：'1024x1024'
  format?: string;     // 如：'png', 'jpg'
  quality?: string;    // 如：'standard', 'hd'
}

export interface ImageGenerationResult {
  url?: string;        // 图像URL（如果API返回URL）
  base64?: string;     // Base64图像数据（如果返回Base64）
  metadata?: any;      // 其他元数据
}
```

#### 图像生成主方法

```typescript
async generate(
  prompt: string,
  options?: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  if (!this.apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const response = await this.callImageGenerationAPI(prompt, options);
  return this.processResponse(response);
}
```

#### API 调用实现

```typescript
private async callImageGenerationAPI(
  prompt: string,
  options?: ImageGenerationOptions
): Promise<any> {
  // 构建 API URL
  const normalizedBase = this.baseUrl.replace(/\/+$/, "");
  const baseWithVersion = normalizedBase.includes("/v1beta")
    ? normalizedBase
    : `${normalizedBase}/v1beta`;
  const url = `${baseWithVersion}/models/${this.model}:generateContent`;

  // 计算宽高比
  const [width, height] = (options?.size ?? this.defaultSize)
    .split("x")
    .map(Number);
  const aspectRatio = this.getAspectRatio(width, height);

  // 构建请求体
  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],  // 强制输出图像
      aspectRatio: aspectRatio,
    },
  };

  // 发送请求（带重试机制）
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,           // Google 官方认证
          Authorization: `Bearer ${this.apiKey}`,  // 代理认证
        },
        body: JSON.stringify(requestBody),
      });

      if (response.status === 429 || response.status === 503) {
        // 限流，等待后重试
        const backoff = Math.min(4000, 1000 * Math.pow(2, attempt - 1));
        await this.sleep(backoff);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini Image API error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const backoff = Math.min(4000, 1000 * Math.pow(2, attempt - 1));
      await this.sleep(backoff);
    }
  }
}
```

#### 响应处理

```typescript
private processResponse(response: any): ImageGenerationResult {
  // Gemini API 标准格式
  if (response.candidates && response.candidates.length > 0) {
    const candidate = response.candidates[0];
    if (candidate.content && candidate.content.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return {
            base64: part.inlineData.data,
            metadata: {
              mimeType: part.inlineData.mimeType || "image/png",
              finishReason: candidate.finishReason,
            },
          };
        }
      }
    }
  }

  // 兼容旧格式
  if (response.generatedImages && response.generatedImages.length > 0) {
    const imageData = response.generatedImages[0];
    if (imageData.imageBytes) {
      return {
        base64: imageData.imageBytes,
        metadata: { safetyRatings: imageData.safetyRatings },
      };
    }
  }

  throw new Error("Invalid response format from Gemini Image API");
}
```

#### 宽高比计算

```typescript
private getAspectRatio(width: number, height: number): string {
  const ratio = width / height;
  if (Math.abs(ratio - 1.0) < 0.1) return "1:1";
  if (Math.abs(ratio - 4.0 / 3.0) < 0.1) return "4:3";
  if (Math.abs(ratio - 3.0 / 4.0) < 0.1) return "3:4";
  if (Math.abs(ratio - 16.0 / 9.0) < 0.1) return "16:9";
  if (Math.abs(ratio - 9.0 / 16.0) < 0.1) return "9:16";
  return "1:1";  // 默认
}
```

### 2.5 使用示例

```typescript
// 注入服务
constructor(private readonly imageGen: ImageGenerationAdapter) {}

// 示例1：生成图表
const result = await this.imageGen.generate(
  "Create a professional bar chart showing quarterly sales data...",
  { type: "chart", chartType: "bar", size: "1024x768" }
);

// 示例2：生成创意海报
const result = await this.imageGen.generate(
  "Design a modern meeting summary poster with key points...",
  { type: "poster", size: "1080x1920" }
);

// 示例3：使用 Base64 图像
if (result.base64) {
  const imageBuffer = Buffer.from(result.base64, "base64");
  fs.writeFileSync("output.png", imageBuffer);
}

// 示例4：检查服务是否可用
if (this.imageGen.isAvailable()) {
  // 图像生成可用
}
```

### 2.6 获取 API Key

1. 访问 [Google AI Studio](https://aistudio.google.com/)
2. 登录 Google 账号
3. 创建 API Key
4. 注意：Imagen 模型可能需要特定区域或付费账户

---

## 3. 通义听悟 - 流式语音转文本

### 3.1 概述

- **用途**: 实时语音转文本、会议记录
- **API**: 阿里云通义听悟 API
- **代码位置**: 
  - `backend/src/modules/tingwu/tingwu.service.ts` - 任务管理
  - `backend/src/modules/tingwu/audio-relay.service.ts` - 音频流处理

### 3.2 环境变量配置

```bash
# .env 文件
TINGWU_ACCESS_KEY_ID=LTAI5txxxxxxxxxx      # 必填：阿里云 AccessKey ID
TINGWU_ACCESS_KEY_SECRET=xxxxxxxxxxxxxxxx  # 必填：阿里云 AccessKey Secret
TINGWU_APP_KEY=xxxxxxxxxxxxxxxx            # 必填：通义听悟 AppKey
TINGWU_REGION=cn-beijing                   # 可选：区域，默认 cn-beijing
TINGWU_ENDPOINT=tingwu.cn-beijing.aliyuncs.com  # 可选：端点
POLLING_INTERVAL_MS=5000                   # 可选：轮询间隔，默认 5000ms
```

### 3.3 配置读取

```typescript
// backend/src/shared/configuration.ts
export default () => {
  const region = process.env.TINGWU_REGION ?? "cn-beijing";
  const endpoint = process.env.TINGWU_ENDPOINT ?? `tingwu.${region}.aliyuncs.com`;

  return {
    tingwu: {
      region,
      accessKeyId: process.env.TINGWU_ACCESS_KEY_ID ?? "",
      accessKeySecret: process.env.TINGWU_ACCESS_KEY_SECRET ?? "",
      appKey: process.env.TINGWU_APP_KEY ?? "",
      endpoint,
    },
    pollingIntervalMs: Number(process.env.POLLING_INTERVAL_MS ?? 5000),
  };
};
```

### 3.4 核心代码实现

#### 初始化客户端

```typescript
import TingwuClient, {
  CreateTaskRequest,
  CreateTaskRequestInput,
  CreateTaskRequestParameters,
  // ... 其他类型
} from "@alicloud/tingwu20230930";
import * as $OpenApi from "@alicloud/openapi-client";

// 初始化
const openApiConfig = new $OpenApi.Config({
  accessKeyId: config.accessKeyId,
  accessKeySecret: config.accessKeySecret,
  regionId: config.region,
  endpoint: config.endpoint,
});

this.client = new TingwuClient(openApiConfig);
```

#### 创建实时转写任务

```typescript
async createRealtimeTask(body: { meetingId: string; topic?: string }) {
  const request = new CreateTaskRequest({
    appKey: this.appKey,
    type: "realtime",
    input: new CreateTaskRequestInput({
      sourceLanguage: "cn",      // 中英文混合模式
      format: "pcm",
      sampleRate: 16000,         // 仅支持 16000Hz 和 8000Hz
      taskKey: body.meetingId,
    }),
    parameters: new CreateTaskRequestParameters({
      transcription: new CreateTaskRequestParametersTranscription({
        outputLevel: 2,          // 段落级别输出
        diarizationEnabled: false,  // 说话人分离
        diarization: new CreateTaskRequestParametersTranscriptionDiarization({
          speakerCount: 0,       // 0 = 自动识别说话人数量
        }),
      }),
      summarizationEnabled: true,
      summarization: new CreateTaskRequestParametersSummarization({
        types: {
          Paragraph: true,
          Conversational: true,
        },
      }),
      meetingAssistanceEnabled: true,
      meetingAssistance: new CreateTaskRequestParametersMeetingAssistance({
        types: ["Keywords", "Todo", "Important"],
      }),
      autoChaptersEnabled: true,
    }),
  });

  const rawBody = await this.invokeCreateTask(request);
  const data = rawBody?.Data ?? rawBody?.data ?? {};

  return {
    taskId: data.TaskId ?? data.taskId,
    meetingJoinUrl: data.MeetingJoinUrl ?? data.meetingJoinUrl,  // WebSocket URL
  };
}
```

#### WebSocket 音频流处理

```typescript
import WS from "ws";

// 连接到通义听悟 WebSocket
private connectToTingwu(sessionId: string, relay: RelaySession) {
  const socket = new WS(relay.meetingJoinUrl);
  relay.socket = socket;

  socket.on("open", () => {
    relay.isConnected = true;
    // 注意：不在连接时立即发送 StartTranscription
    // 而是等到第一个音频数据到达时再发送，避免 IDLE_TIMEOUT
  });

  socket.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      // 处理转写结果
      if (msg.header?.name === "TranscriptionResultChanged" || 
          msg.header?.name === "SentenceEnd") {
        const rawResult = msg.payload?.result ?? "";
        // 处理转写结果...
      }
    } catch {
      // 二进制数据，忽略
    }
  });

  socket.on("close", (code) => {
    relay.isConnected = false;
    relay.isStarted = false;
  });
}
```

#### 发送开始转写命令

```typescript
private sendStartTranscription(sessionId: string, relay: RelaySession) {
  if (relay.isStarted) return;
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
}
```

#### 音频格式转换（WebM → PCM）

```typescript
import { spawn } from "child_process";
import ffmpeg from "ffmpeg-static";

private startFfmpegStream(sessionId: string, relay: RelaySession) {
  const args = [
    "-loglevel", "error",
    "-f", "webm",
    "-i", "pipe:0",
    "-vn",                    // 禁用视频
    "-af", this.getAudioEnhancementFilters(),  // 音频增强
    "-acodec", "pcm_s16le",   // PCM 16位小端
    "-ar", "16000",           // 采样率 16kHz
    "-ac", "1",               // 单声道
    "-f", "s16le",
    "pipe:1",
  ];

  const proc = spawn(ffmpeg ?? "ffmpeg", args, { stdio: ["pipe", "pipe", "pipe"] });
  relay.ffmpegProcess = proc;

  proc.stdout?.on("data", async (data: Buffer) => {
    await this.sendPcmData(sessionId, relay, data);
  });
}

// 音频增强滤镜
private getAudioEnhancementFilters(): string {
  return [
    "highpass=f=80",           // 高通滤波，去除 80Hz 以下低频噪声
    "lowpass=f=8000",          // 低通滤波，去除 8000Hz 以上高频噪声
    "anlmdn=s=0.0003",         // 非局部均值降噪
    "loudnorm=I=-16:TP=-1.5:LRA=11",  // 音量归一化
    "volume=1.2",              // 音量增益 20%
  ].join(",");
}
```

#### 发送 PCM 数据

```typescript
private async sendPcmData(sessionId: string, relay: RelaySession, pcm: Buffer) {
  const socket = relay.socket;
  if (!socket || socket.readyState !== WS.OPEN) return;
  
  // 在发送第一个音频数据前，先发送 StartTranscription
  this.sendStartTranscription(sessionId, relay);
  
  const chunkSize = 3200;  // 100ms @16k mono
  for (let offset = 0; offset < pcm.length; offset += chunkSize) {
    const slice = pcm.subarray(offset, offset + chunkSize);
    socket.send(slice);
    await new Promise((r) => setTimeout(r, 5));  // 微节流
  }
}
```

#### 停止转写

```typescript
async stop(sessionId: string) {
  const relay = this.sessions.get(sessionId);
  if (!relay) return;
  
  relay.isStopping = true;

  // 结束 ffmpeg 流
  relay.ffmpegProcess?.stdin?.end();
  relay.ffmpegProcess?.kill('SIGKILL');

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
    
    await new Promise((resolve) => setTimeout(resolve, 2000));
    relay.socket.close();
  }

  this.sessions.delete(sessionId);
}
```

#### 获取任务快照（转写结果、摘要）

```typescript
async getTaskSnapshot(taskId: string) {
  const rawBody = await this.invokeGetTaskInfo(taskId);
  const data = rawBody?.Data ?? rawBody?.data ?? rawBody ?? {};

  // 提取转写结果（带置信度过滤）
  const transcription = data.Transcription?.Paragraphs?.map((item: any) => {
    const words = item.Words ?? [];
    const avgConfidence = words.length > 0
      ? words.reduce((sum, word) => sum + (word.Confidence ?? 0), 0) / words.length
      : item.Confidence ?? 1.0;

    return {
      id: item.ParagraphId,
      speakerId: item.SpeakerId,
      startMs: item.Words?.[0]?.Start ?? 0,
      endMs: item.Words?.[item.Words.length - 1]?.End ?? 0,
      text: item.Words?.map((word) => word.Text).join("") ?? "",
      confidence: avgConfidence,
    };
  })?.filter((item) => item.confidence >= 0.6) ?? [];  // 过滤低置信度

  // 提取摘要
  const summaries = [];
  if (data.Summarization?.Paragraph) {
    summaries.push({
      type: "paragraph",
      title: "全文摘要",
      content: data.Summarization.Paragraph?.Content ?? "",
    });
  }
  if (data.MeetingAssistance?.Keywords) {
    summaries.push({
      type: "keywords",
      title: "关键词",
      content: data.MeetingAssistance.Keywords,
    });
  }

  return { transcription, summaries, taskStatus: data.TaskStatus };
}
```

### 3.5 使用示例

```typescript
// 注入服务
constructor(
  private readonly tingwuService: TingwuService,
  private readonly audioRelayService: AudioRelayService,
) {}

// 示例1：创建实时转写会话
const { taskId, meetingJoinUrl } = await this.tingwuService.createRealtimeTask({
  meetingId: "meeting-123",
});

// 示例2：初始化音频中继
this.audioRelayService.create(sessionId, meetingJoinUrl);

// 示例3：发送音频数据（WebM 格式）
const webmBuffer = Buffer.from(base64Chunk, "base64");
await this.audioRelayService.ingestWebmChunk(sessionId, webmBuffer);

// 示例4：发送 PCM 数据
await this.audioRelayService.ingestPcmBuffer(sessionId, pcmBuffer);

// 示例5：停止转写
await this.audioRelayService.stop(sessionId);
await this.tingwuService.stopRealtimeTask(taskId);

// 示例6：获取转写结果
const { transcription, summaries } = await this.tingwuService.getTaskSnapshot(taskId);
```

### 3.6 获取 API Key

1. 访问 [阿里云控制台](https://console.aliyun.com/)
2. 搜索「通义听悟」并开通服务
3. 在「AccessKey 管理」中创建 AccessKey ID 和 Secret
4. 在通义听悟控制台创建应用，获取 AppKey

### 3.7 音频格式要求

| 参数 | 要求 |
|------|------|
| 格式 | PCM (pcm_s16le) |
| 采样率 | 16000Hz 或 8000Hz |
| 声道 | 单声道 (mono) |
| 位深 | 16位 |
| 每包大小 | 建议 3200 字节 (100ms @16k) |

---

## 附录

### A. 依赖包

```json
{
  "dependencies": {
    "openai": "^4.x",                    // Qwen (OpenAI 兼容)
    "@alicloud/tingwu20230930": "^1.x",  // 通义听悟
    "@alicloud/openapi-client": "^0.x",  // 阿里云 OpenAPI
    "ws": "^8.x",                         // WebSocket
    "ffmpeg-static": "^5.x"              // FFmpeg 音频转换
  }
}
```

### B. 错误处理最佳实践

```typescript
// 统一错误处理
try {
  const result = await apiCall();
} catch (error) {
  if (error.status === 429) {
    // 限流，实现指数退避重试
  } else if (error.status === 401) {
    // 认证失败，检查 API Key
  } else {
    // 其他错误
    logger.error(`API call failed: ${error}`);
  }
}
```

### C. 相关文档链接

- [阿里云 DashScope 文档](https://help.aliyun.com/document_detail/2400395.html)
- [Google Generative AI 文档](https://ai.google.dev/gemini-api/docs)
- [通义听悟 API 文档](https://help.aliyun.com/document_detail/2618499.html)

---

> 📝 **维护说明**: 当 API 有更新或发现新的最佳实践时，请及时更新本文档。
