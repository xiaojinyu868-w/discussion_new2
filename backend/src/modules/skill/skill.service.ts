import { Injectable, Logger } from "@nestjs/common";
import { ContextStoreService } from "../context/context-store.service";
import { LLMAdapterService } from "../llm/llm-adapter.service";
import * as crypto from "crypto";

export type SkillType = "inner_os" | "brainstorm" | "stop_talking";

export interface InnerOSResult {
  quote: string;
  innerThought: string;
  emotion: string;
}

export interface BrainstormResult {
  idea: string;
  rationale: string;
  challenge: string;
}

export interface StopTalkingResult {
  isOffTopic: boolean;
  mainTopic: string;
  deviation: string;
  reminder: string;
}

export interface SkillResult {
  type: SkillType;
  title: string;
  content: InnerOSResult[] | BrainstormResult[] | StopTalkingResult;
  timestamp: Date;
}

const PROMPTS = {
  inner_os: `你是一个洞察力极强、略带毒舌风格的会议观察者。

任务：分析以下会议对话，识别其中的潜台词、话外音和未说出口的想法。

重要提示：
1. 会议内容来自实时转写，可能存在同音错别字或识别误差
2. 请根据上下文逻辑，自动修正原文中可能的同音错别字（如将"部署"修正为"部署"）后再进行分析
3. 修正时需保持原意不变，仅修正明显的识别错误

要求：
1. 找出1个最有趣且最好玩的"内心OS"
2. 每个OS包含：可能的真实想法、对应的原话引用（使用修正后的文本）
3. 风格要犀利但不失幽默

会议内容：
{context}

输出JSON格式（不要包含markdown代码块标记）：
[{"quote": "原话（已修正）", "innerThought": "内心OS", "emotion": "情绪"}]`,

  brainstorm: `你是史蒂夫·乔布斯风格的创意顾问，以颠覆性思维和极简主义著称。

任务：基于当前会议讨论，提供跳跃性的创意建议。

重要提示：
1. 会议内容来自实时转写，可能存在同音错别字或识别误差
2. 请根据上下文逻辑，自动修正原文中可能的同音错别字（如将"部署"修正为"部署"）后再进行分析
3. 修正时需保持原意不变，仅修正明显的识别错误
4. 你要明确的说自己就是乔布斯，用他的风格说话，并且要让用户觉得惊奇，满足用户的底层爽感需求

要求：
1. 提供1个最具突破性且让用户爽到的想法
2. 每个想法要有乔布斯式的洞察
3. 敢于挑战现有假设

会议内容：
{context}

输出JSON格式（不要包含markdown代码块标记）：
[{"idea": "创意", "rationale": "乔布斯式解释", "challenge": "挑战的假设"}]`,

  stop_talking: `你是一位专业的会议主持人，负责确保讨论聚焦于核心议题。

任务：分析当前讨论是否偏离主题，如有需要给出礼貌但坚定的提醒。

会议内容：
{context}

分析要点：
1. 当前讨论的主线是什么
2. 是否有明显的跑题现象
3. 如何优雅地引导回正轨

输出JSON格式（不要包含markdown代码块标记）：
{"isOffTopic": true或false, "mainTopic": "主线", "deviation": "偏离点", "reminder": "提醒话术"}`,
};

@Injectable()
export class SkillService {
  private readonly logger = new Logger(SkillService.name);

  constructor(
    private readonly contextStore: ContextStoreService,
    private readonly llmAdapter: LLMAdapterService
  ) {}

  async triggerSkill(
    sessionId: string,
    skill: SkillType
  ): Promise<SkillResult> {
    this.logger.log(`Triggering skill ${skill} for session ${sessionId}`);

    // 检查 LLM 是否可用
    if (!this.llmAdapter.isAvailable()) {
      throw new Error("LLM not configured. Please set DASHSCOPE_API_KEY.");
    }

    // 获取上下文
    const context = this.getContextForSkill(sessionId, skill);
    if (!context || context.trim().length === 0) {
      throw new Error("No context available for skill execution");
    }

    // 获取对应的 Prompt
    const promptTemplate = PROMPTS[skill];
    const prompt = promptTemplate.replace("{context}", context);

    // 调用 LLM
    const startTime = Date.now();
    const response = await this.llmAdapter.chatWithPrompt(
      "你是一个专业的会议分析助手，请按照要求输出JSON格式的结果。",
      prompt,
      { temperature: 0.7, maxTokens: 2000 }
    );

    this.logger.log(
      `Skill ${skill} completed in ${Date.now() - startTime}ms`
    );

    // 解析结果
    const content = this.parseSkillResponse(skill, response);

    // 保存到消息流
    this.contextStore.appendMessage(sessionId, {
      role: "assistant",
      content: JSON.stringify(content),
      timestamp: new Date(),
      type: "skill",
    });

    return {
      type: skill,
      title: this.getSkillTitle(skill),
      content,
      timestamp: new Date(),
    };
  }

  private getContextForSkill(sessionId: string, skill: SkillType): string {
    switch (skill) {
      case "inner_os":
        // 最近5分钟
        return this.contextStore.getRecentText(sessionId, 5);
      case "brainstorm":
      case "stop_talking":
        // 全部文本
        return this.contextStore.getFullText(sessionId);
      default:
        return this.contextStore.getFullText(sessionId);
    }
  }

  private getSkillTitle(skill: SkillType): string {
    switch (skill) {
      case "inner_os":
        return "内心OS";
      case "brainstorm":
        return "头脑风暴";
      case "stop_talking":
        return "别再说了";
      default:
        return skill;
    }
  }

  private parseSkillResponse(
    skill: SkillType,
    response: string
  ): InnerOSResult[] | BrainstormResult[] | StopTalkingResult {
    try {
      // 尝试提取 JSON
      let jsonStr = response.trim();

      // 移除可能的 markdown 代码块
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr);

      // 验证格式
      if (skill === "stop_talking") {
        return {
          isOffTopic: parsed.isOffTopic ?? false,
          mainTopic: parsed.mainTopic ?? "",
          deviation: parsed.deviation ?? "",
          reminder: parsed.reminder ?? "",
        };
      }

      if (!Array.isArray(parsed)) {
        this.logger.warn(`Expected array for skill ${skill}, got: ${typeof parsed}`);
        return [];
      }

      return parsed;
    } catch (error) {
      this.logger.error(`Failed to parse skill response: ${error}`);
      this.logger.debug(`Raw response: ${response}`);

      // 返回默认值
      if (skill === "stop_talking") {
        return {
          isOffTopic: false,
          mainTopic: "无法解析",
          deviation: "",
          reminder: "抱歉，分析失败，请稍后重试。",
        };
      }
      return [];
    }
  }

  /**
   * 生成内容哈希，用于去重
   */
  private generateContentHash(content: any): string {
    const contentStr = JSON.stringify(content);
    return crypto
      .createHash("md5")
      .update(contentStr)
      .digest("hex")
      .substring(0, 8);
  }

  /**
   * 转换为前端卡片格式
   * 使用内容哈希生成稳定的 ID，确保相同内容不会重复
   */
  toSummaryCards(
    sessionId: string,
    result: SkillResult
  ): Array<{
    id: string;
    type: string;
    title: string;
    content: any;
    updatedAt: string;
  }> {
    if (result.type === "stop_talking") {
      const contentHash = this.generateContentHash(result.content);
      const baseId = `${sessionId}-${result.type}-${contentHash}`;
      return [
        {
          id: baseId,
          type: result.type,
          title: result.title,
          content: result.content,
          updatedAt: result.timestamp.toISOString(),
        },
      ];
    }

    // inner_os 和 brainstorm 返回数组
    const items = result.content as any[];
    return items.map((item) => {
      const contentHash = this.generateContentHash(item);
      return {
        id: `${sessionId}-${result.type}-${contentHash}`,
        type: result.type,
        title: result.title,
        content: item,
        updatedAt: result.timestamp.toISOString(),
      };
    });
  }
}
