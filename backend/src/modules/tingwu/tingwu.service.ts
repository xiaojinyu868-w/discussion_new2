import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import TingwuClient, {
  CreateTaskRequest,
  CreateTaskRequestInput,
  CreateTaskRequestParameters,
  CreateTaskRequestParametersMeetingAssistance,
  CreateTaskRequestParametersSummarization,
  CreateTaskRequestParametersTranscription,
  CreateTaskRequestParametersTranscriptionDiarization,
  CreateTranscriptionPhrasesRequest,
} from "@alicloud/tingwu20230930";
import * as $OpenApi from "@alicloud/openapi-client";
import * as $Util from "@alicloud/tea-util";
import OpenApiUtil from "@alicloud/openapi-util";
import {
  ScenePreset,
  SCENE_HOTWORDS,
  SCENE_LABELS,
  normalizeScene,
} from "./scene-presets";

@Injectable()
export class TingwuService {
  private readonly logger = new Logger(TingwuService.name);
  private readonly appKey: string;
  private readonly client: TingwuClient;
  private readonly phraseIdCache = new Map<ScenePreset, string>();

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.get("tingwu");

    this.appKey = config.appKey;

    const openApiConfig = new $OpenApi.Config({
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      regionId: config.region,
      endpoint: config.endpoint,
    });

    this.client = new TingwuClient(openApiConfig);
  }

  async createRealtimeTask(body: {
    meetingId: string;
    topic?: string;
    scene?: string;
  }) {//创建实时转写任务
    try {
      const scene = normalizeScene(body.scene);
      const phraseId = await this.ensurePhraseId(scene);
      const request = new CreateTaskRequest({
        appKey: this.appKey,
        type: "realtime",
        input: new CreateTaskRequestInput({
          sourceLanguage: "cn", // 中英文混合模式：保持cn，通义听悟会自动识别中英文混合
          format: "pcm",
          sampleRate: 16000, // 通义听悟实时转写API仅支持16000Hz和8000Hz，不支持48000Hz
          taskKey: body.meetingId,
        }),
        parameters: new CreateTaskRequestParameters({
          transcription: new CreateTaskRequestParametersTranscription({
            outputLevel: 2, // 段落级别输出
            diarizationEnabled: false, // 说话人分离（可根据需要启用）
            diarization:
              new CreateTaskRequestParametersTranscriptionDiarization({
                speakerCount: 0, // 0表示自动识别说话人数量
              }),
            phraseId,
            // 注意：实时转写采用严格模式，严格遵循语音输入，不进行自动修正
            // 修正功能仅在总结和分析部分使用
          }),
          summarizationEnabled: true,
          summarization: new CreateTaskRequestParametersSummarization({
            types: {
              Paragraph: true,
              Conversational: true,
            },
          }),
          meetingAssistanceEnabled: true,
          meetingAssistance:
            new CreateTaskRequestParametersMeetingAssistance({
              types: ["Keywords", "Todo", "Important"],
            }),
          autoChaptersEnabled: true,
        }),
      });

      const rawBody = await this.invokeCreateTask(request);
      this.logger.debug(
        `CreateTask raw response: ${JSON.stringify(rawBody)}`
      );
      const data = (rawBody?.Data ?? rawBody?.data ?? {}) as Record<
        string,
        any
      >;

      const taskId = data.TaskId ?? data.taskId;
      let meetingJoinUrl =
        data.MeetingJoinUrl ??
        data.meetingJoinUrl ??
        data.MeetingJoinUrlWs ??
        data.meetingJoinUrlWs ??
        this.extractMeetingJoinUrl(rawBody);

      if (!meetingJoinUrl && taskId) {
        this.logger.warn(
          `MeetingJoinUrl missing in initial response for task ${taskId}, entering polling fallback`
        );
        meetingJoinUrl = await this.waitForMeetingJoinUrl(taskId);
      }

      if (!taskId || !meetingJoinUrl) {
        this.logger.error(
          `Realtime task created but missing essential data: ${JSON.stringify(
            data
          )}`
        );
        throw new InternalServerErrorException(
          "Realtime task missing required fields"
        );
      }

      return {
        taskId,
        meetingJoinUrl,
      };
    } catch (error) {
      this.logger.error(
        "Failed to create realtime task",
        (error as any)?.body ?? error
      );
      throw new InternalServerErrorException("Create realtime task failed");
    }
  }


  private async ensurePhraseId(
    scene: ScenePreset
  ): Promise<string | undefined> {
    if (scene === "default") {
      return undefined;
    }

    const cached = this.phraseIdCache.get(scene);
    if (cached) {
      return cached;
    }

    const hotwords = SCENE_HOTWORDS[scene] ?? [];
    if (hotwords.length === 0) {
      return undefined;
    }

    try {
      const request = new CreateTranscriptionPhrasesRequest({
        name: `scene-${scene}-${Date.now()}`,
        description: `Scene preset ${SCENE_LABELS[scene]}`,
        wordWeights: this.buildWordWeights(hotwords),
      });
      const response = await this.client.createTranscriptionPhrases(request);
      const phraseId =
        response?.body?.data?.phraseId ??
        response?.body?.Data?.PhraseId ??
        response?.body?.Data?.phraseId;
      if (phraseId) {
        this.phraseIdCache.set(scene, phraseId);
        return phraseId;
      }
      this.logger.warn(`Phrase created but missing phraseId for scene ${scene}`);
    } catch (error) {
      this.logger.warn(
        `Failed to create phrase list for scene ${scene}`,
        (error as any)?.body ?? error
      );
    }
    return undefined;
  }

  private buildWordWeights(words: string[]): string {
    return words.map((word) => `${word} 1`).join("\n");
  }

  async triggerCustomPrompt(taskId: string, type: "inner_os" | "brainstorm") {//触发自定义提示词
    const prompt =
      type === "inner_os"
        ? {
            Title: "内心OS",
            Prompt:
              '请根据上下文逻辑，自动修正原文中可能的同音错别字（如将"部署"修正为"部署"）后再进行分析。基于最近2分钟发言，用第一人称生成3条内心独白，输出JSON数组[{ "emotion": "...", "thought": "..." }]',
            ContextWindowMinutes: 2,
          }
        : {
            Title: "头脑风暴",
            Prompt:
              '请根据上下文逻辑，自动修正原文中可能的同音错别字（如将"部署"修正为"部署"）后再进行分析。结合最近5分钟对话与会议要点，输出不少于3条创意，格式[{ "idea": "...", "rationale": "...", "references": [] }]',
            ContextWindowMinutes: 5,
          };

    try {
      const runtime = new $Util.RuntimeOptions({});
      const headers: Record<string, string> = {};
      const body = {
        CustomPromptEnabled: true,
        CustomPrompt: prompt,
      };
      const request = new $OpenApi.OpenApiRequest({
        headers,
        body: OpenApiUtil.parseToMap(body),
      });
      const params = new $OpenApi.Params({
        action: "SubmitCustomPrompt",
        version: "2023-09-30",
        protocol: "HTTPS",
        pathname: `/openapi/tingwu/v2/tasks/${taskId}/custom-prompt`,
        method: "POST",
        authType: "AK",
        style: "ROA",
        reqBodyType: "json",
        bodyType: "json",
      });
      const response = await this.client.callApi(params, request, runtime);
      return response.body;
    } catch (error) {
      this.logger.error(
        "Failed to trigger custom prompt",
        (error as any)?.body ?? error
      );
      throw new InternalServerErrorException("Trigger custom prompt failed");
    }
  }

  async getTaskSnapshot(taskId: string) {//获取任务快照（转写、摘要、状态）
    try {
      const rawBody = await this.invokeGetTaskInfo(taskId);
      const data = (rawBody?.Data ?? rawBody?.data ?? rawBody ?? {}) as any;
      const taskStatus =
        data.TaskStatus ??
        data.taskStatus ??
        data.Status ??
        data.status ??
        undefined;
      if (taskStatus && taskStatus !== "ONGOING") {
        this.logger.debug(`Task ${taskId} current status: ${taskStatus}`);
      }
      // 提取转写结果，加入置信度过滤（阈值0.6）
      const transcription =
        data.Transcription?.Paragraphs?.map((item: any) => {
          // 计算段落平均置信度
          const words = item.Words ?? [];
          const avgConfidence =
            words.length > 0
              ? words.reduce(
                  (sum: number, word: any) => sum + (word.Confidence ?? 0),
                  0
                ) / words.length
              : item.Confidence ?? 1.0;

          return {
            id: item.ParagraphId,
            speakerId: item.SpeakerId,
            startMs: item.Words?.[0]?.Start ?? 0,
            endMs: item.Words?.[item.Words.length - 1]?.End ?? 0,
            text: item.Words?.map((word: any) => word.Text).join("") ?? "",
            confidence: avgConfidence, // 添加置信度字段
            words: words.map((word: any) => ({
              text: word.Text,
              startMs: word.Start,
              endMs: word.End,
              confidence: word.Confidence ?? 1.0,
            })), // 添加词级详细信息
          };
        })
          ?.filter((item: any) => item.confidence >= 0.6) ?? []; // 过滤置信度低于0.6的结果

      const summaries: any[] = [];
      if (data.Summarization?.Paragraph) {
        summaries.push({
          id: `${taskId}-paragraph`,
          type: "paragraph",
          title: "全文摘要",
          content: data.Summarization.Paragraph?.Content ?? "",
          updatedAt: new Date().toISOString(),
        });
      }
      if (data.Summarization?.Conversational) {
        summaries.push({
          id: `${taskId}-conversational`,
          type: "conversational",
          title: "发言总结",
          content: data.Summarization.Conversational?.map(
            (item: any) => `${item.SpeakerId}: ${item.Content}`
          ),
          updatedAt: new Date().toISOString(),
        });
      }
      if (data.MeetingAssistance?.Keywords) {
        summaries.push({
          id: `${taskId}-keywords`,
          type: "keywords",
          title: "关键词",
          content: data.MeetingAssistance.Keywords,
          updatedAt: new Date().toISOString(),
        });
      }
      if (data.AutoChapters) {
        summaries.push({
          id: `${taskId}-chapters`,
          type: "chapter",
          title: "章节速览",
          content: data.AutoChapters?.map(
            (item: any) => `${item.StartTime}s ${item.Title}`
          ),
          updatedAt: new Date().toISOString(),
        });
      }

      return {
        transcription,
        summaries,
        taskStatus,
      };
    } catch (error) {
      this.logger.error(
        "Failed to fetch task snapshot",
        (error as any)?.body ?? error
      );
      throw new InternalServerErrorException("Fetch task snapshot failed");
    }
  }

  async stopRealtimeTask(taskId: string) {//停止实时转写任务
    try {
      const request = new CreateTaskRequest({
        type: "realtime",
        operation: "stop",
        input: new CreateTaskRequestInput({
          taskId,
        }),
      });
      await this.invokeCreateTask(request);
    } catch (error) {
      this.logger.error(
        `Failed to stop realtime task ${taskId}`,
        (error as any)?.body ?? error
      );
      throw new InternalServerErrorException("Stop realtime task failed");
    }
  }

  private async invokeCreateTask(
    request: CreateTaskRequest
  ): Promise<Record<string, any>> {
    const runtime = new $Util.RuntimeOptions({});
    const query: Record<string, any> = {};
    if (request.type) {
      query.type = request.type;
    }
    if (request.operation) {
      query.operation = request.operation;
    }

    const bodyMap = request.toMap() as Record<string, any>;
    delete bodyMap.type;
    delete bodyMap.operation;

    const apiRequest = new $OpenApi.OpenApiRequest({
      query: OpenApiUtil.query(query),
      body: OpenApiUtil.parseToMap(bodyMap),
    });
    const params = new $OpenApi.Params({
      action: "CreateTask",
      version: "2023-09-30",
      protocol: "HTTPS",
      pathname: `/openapi/tingwu/v2/tasks`,
      method: "PUT",
      authType: "AK",
      style: "ROA",
      reqBodyType: "json",
      bodyType: "json",
    });
    const response = await this.client.callApi(params, apiRequest, runtime);
    return (response?.body ?? {}) as Record<string, any>;
  }

  private async invokeGetTaskInfo(
    taskId: string
  ): Promise<Record<string, any>> {
    const runtime = new $Util.RuntimeOptions({});
    const apiRequest = new $OpenApi.OpenApiRequest({
      headers: {},
    });
    const params = new $OpenApi.Params({
      action: "GetTaskInfo",
      version: "2023-09-30",
      protocol: "HTTPS",
      pathname: `/openapi/tingwu/v2/tasks/${OpenApiUtil.getEncodeParam(taskId)}`,
      method: "GET",
      authType: "AK",
      style: "ROA",
      reqBodyType: "json",
      bodyType: "json",
    });
    const response = await this.client.callApi(params, apiRequest, runtime);
    return (response?.body ?? {}) as Record<string, any>;
  }

  private async waitForMeetingJoinUrl(taskId: string) {
    const attempts = 12;
    for (let index = 0; index < attempts; index += 1) {
      const url = await this.fetchMeetingJoinUrl(taskId);
      if (url) {
        return url;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return undefined;
  }

  private async fetchMeetingJoinUrl(taskId: string) {
    try {
      const rawBody = await this.invokeGetTaskInfo(taskId);
      const data = (rawBody?.Data ?? rawBody?.data ?? rawBody ?? {}) as any;
      return this.extractMeetingJoinUrl(data);
    } catch (error) {
      this.logger.warn(
        `Failed to fetch meeting join url for task ${taskId}`,
        (error as any)?.body ?? error
      );
      return undefined;
    }
  }

  private extractMeetingJoinUrl(
    data: any,
    seen: WeakSet<object> = new WeakSet()
  ): string | undefined {
    if (!data) return undefined;
    if (typeof data === "string") {
      if (data.startsWith("ws://") || data.startsWith("wss://")) {
        return data;
      }
      return undefined;
    }
    if (typeof data !== "object") {
      return undefined;
    }
    if (seen.has(data as object)) {
      return undefined;
    }
    seen.add(data as object);

    const direct =
      data?.MeetingJoinUrlWs ??
      data?.meetingJoinUrlWs ??
      data?.MeetingJoinUrl ??
      data?.meetingJoinUrl ??
      data?.RealtimeMeetingJoinUrl ??
      data?.realtimeMeetingJoinUrl ??
      data?.WsUrl ??
      data?.wsUrl;
    if (typeof direct === "string" && direct.length > 0) {
      return direct;
    }
    const nestedSources = [
      data?.MeetingInfo,
      data?.RealtimeMeeting,
      data?.meetingInfo,
      data?.realtimeMeeting,
    ];
    for (const source of nestedSources) {
      const value = this.extractMeetingJoinUrl(source, seen);
      if (value) return value;
    }

    if (Array.isArray(data)) {
      for (const item of data) {
        const nested = this.extractMeetingJoinUrl(item, seen);
        if (nested) return nested;
      }
      return undefined;
    }

    for (const value of Object.values(data)) {
      const nested = this.extractMeetingJoinUrl(value, seen);
      if (nested) return nested;
    }

    return undefined;
  }
}
