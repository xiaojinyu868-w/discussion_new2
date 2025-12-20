import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";

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

@Injectable()
export class LLMAdapterService {
  private readonly logger = new Logger(LLMAdapterService.name);
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly defaultTemperature: number;
  private readonly defaultMaxTokens: number;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>("llm.apiKey");
    const baseURL = this.configService.get<string>("llm.baseUrl");
    this.model = this.configService.get<string>("llm.model") ?? "qwen3-max";
    this.defaultTemperature =
      this.configService.get<number>("llm.temperature") ?? 0.7;
    this.defaultMaxTokens =
      this.configService.get<number>("llm.maxTokens") ?? 2000;

    if (!apiKey) {
      this.logger.warn(
        "DASHSCOPE_API_KEY not configured, LLM features will not work"
      );
    }

    this.client = new OpenAI({
      apiKey: apiKey ?? "sk-placeholder",
      baseURL:
        baseURL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
    });

    this.logger.log(`LLM Adapter initialized with model: ${this.model}`);
  }

  /**
   * 多轮对话
   */
  async chat(messages: ChatMessage[], options?: LLMOptions): Promise<string> {
    const startTime = Date.now();

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options?.temperature ?? this.defaultTemperature,
        top_p: options?.topP,
        max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
        stream: false,
      });

      const content = completion.choices[0]?.message?.content ?? "";
      const usage = completion.usage;

      this.logger.log(
        `LLM chat completed in ${Date.now() - startTime}ms, ` +
          `tokens: ${usage?.total_tokens ?? "N/A"} ` +
          `(prompt: ${usage?.prompt_tokens ?? "N/A"}, completion: ${usage?.completion_tokens ?? "N/A"})`
      );

      return content;
    } catch (error) {
      this.logger.error(`LLM chat failed: ${error}`);
      throw error;
    }
  }

  /**
   * 使用系统提示词的单轮对话
   */
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

  /**
   * 流式输出
   */
  async chatStream(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    options?: LLMOptions
  ): Promise<string> {
    const startTime = Date.now();
    let fullContent = "";

    try {
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
          onChunk(content);
        }
      }

      this.logger.log(
        `LLM stream completed in ${Date.now() - startTime}ms, ` +
          `total length: ${fullContent.length}`
      );

      return fullContent;
    } catch (error) {
      this.logger.error(`LLM stream failed: ${error}`);
      throw error;
    }
  }

  /**
   * 解析 JSON 响应（带容错）
   */
  async chatForJson<T>(
    messages: ChatMessage[],
    options?: LLMOptions
  ): Promise<T | null> {
    const content = await this.chat(messages, options);

    try {
      // 尝试提取 JSON（处理 markdown 代码块）
      let jsonStr = content;

      // 移除 markdown 代码块
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      return JSON.parse(jsonStr) as T;
    } catch (error) {
      this.logger.warn(`Failed to parse LLM response as JSON: ${error}`);
      this.logger.debug(`Raw content: ${content}`);
      return null;
    }
  }

  /**
   * 检查 LLM 是否可用
   */
  isAvailable(): boolean {
    const apiKey = this.configService.get<string>("llm.apiKey");
    return !!apiKey && apiKey !== "sk-placeholder";
  }
}
