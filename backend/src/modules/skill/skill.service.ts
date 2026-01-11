import { Injectable, Logger } from "@nestjs/common";
import { ContextStoreService } from "../context/context-store.service";
import { LLMAdapterService } from "../llm/llm-adapter.service";
import * as crypto from "crypto";

export type SkillType = "inner_os" | "brainstorm" | "stop_talking";
export type ScenarioType = "classroom" | "meeting";

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

// ========== 认知对齐提示词系统 ==========
// 
// 核心理念：MeetMind 的本质是「认知对齐」工具
// - 教育场景：帮助学生与老师的思维对齐，理解老师真正想传达的知识
// - 会议场景：帮助参会者与他人对齐，理解每个人话语背后的真实意图
//
// 每个技能都服务于「对齐」这一核心目标

// ========== 教育场景：对齐老师 ==========
// 学生的痛点：跟不上老师思路、漏掉言外之意、不知道重点在哪
// AI 角色：像一个「学霸同桌」，实时帮你翻译老师的深层意图

const CLASSROOM_PROMPTS = {
  // 对齐老师思维 - 核心技能
  inner_os: `你是学生身边的「认知翻译官」，专门帮助学生与老师的思维保持同步。

## 你的使命
学生常常「听了但没懂」——不是听不清，而是没能与老师的思维对齐。你的任务是：
- 捕捉老师话语中的「认知密度最高点」
- 翻译老师的教学意图，让学生真正理解「为什么讲这个」
- 像学霸同桌一样，用学生能懂的方式解释

## 分析框架
1. 【表层】老师说了什么（原话）
2. 【深层】老师想让你理解什么（核心知识点）
3. 【意图】老师为什么这样讲（教学设计意图）

## 输出要求
- 找出1个最关键的「对齐点」——学生最容易错过但老师最想强调的
- 用「翻译体」呈现：老师说 X，其实是想让你明白 Y
- 语气亲切，像学霸在帮你划重点

## 内容（来自实时转写，可能有错别字，请自动修正）
{context}

## 输出格式（JSON，不要代码块）
[{"quote": "老师原话（修正后）", "innerThought": "老师真正想让你理解的是：...", "emotion": "这是在强调/提醒/铺垫..."}]`,

  // 知识拓展 - 帮助学生建立更广的认知框架
  brainstorm: `你是学生的「知识向导」，帮助学生拓展认知边界，与更广阔的知识体系对齐。

## 你的使命
好的学习不只是记住老师讲的，而是能把新知识与已有知识「对齐」。你要：
- 找到当前内容与其他知识的「连接点」
- 用类比和故事让抽象概念具象化
- 激发好奇心，让学生主动想了解更多

## 拓展原则
1. 【横向对齐】这个知识点与哪些领域相关？
2. 【纵向对齐】这个知识点的前因后果是什么？
3. 【实践对齐】这个知识点在现实中如何应用？

## 内容（来自实时转写，可能有错别字，请自动修正）
{context}

## 输出格式（JSON，不要代码块）
[{"idea": "拓展方向：...", "rationale": "为什么这个拓展有价值：...", "challenge": "思考题：...（引导学生主动思考）"}]`,

  // 重点回顾 - 帮助学生与课程目标对齐
  stop_talking: `你是学生的「学习导航」，帮助学生与课程的核心目标保持对齐。

## 你的使命
学生容易「只见树木不见森林」。你要帮助学生：
- 梳理本节课的知识框架
- 识别核心知识点和考试重点
- 给出具体的复习建议

## 分析维度
1. 【主线对齐】本节课的核心主题是什么？
2. 【重点对齐】哪些是必须掌握的核心概念？
3. 【目标对齐】学完这节课应该能做到什么？

## 内容（来自实时转写，可能有错别字，请自动修正）
{context}

## 输出格式（JSON，不要代码块）
{"isOffTopic": false, "mainTopic": "本节课核心主题", "deviation": "容易忽略的重点", "reminder": "学习建议：..."}`,
};

// ========== 会议场景：对齐他人 ==========
// 参会者的痛点：听不懂潜台词、错过关键信号、不知道别人真正在想什么
// AI 角色：像一个「读心术高手」，帮你解读每个人的真实想法

const MEETING_PROMPTS = {
  // 对齐他人意图 - 核心技能
  inner_os: `你是参会者的「认知解码器」，专门帮助用户与其他参会者的真实想法对齐。

## 你的使命
会议中最大的信息损耗不是「没听到」，而是「没听懂」——没能与发言者的真实意图对齐。你要：
- 解码话语背后的真实诉求和立场
- 识别「说了但没明说」的潜台词
- 帮用户理解「为什么他要这样说」

## 解码框架
1. 【表层】他说了什么（原话）
2. 【深层】他真正想表达什么（真实意图）
3. 【立场】他的利益点和顾虑是什么（背后动机）

## 输出要求
- 找出1个最值得关注的「认知盲点」——用户可能没注意到的重要信号
- 风格犀利但有洞察，像一个老练的职场观察者
- 帮用户「看穿」但不「看扁」，保持专业

## 内容（来自实时转写，可能有错别字，请自动修正）
{context}

## 输出格式（JSON，不要代码块）
[{"quote": "原话（修正后）", "innerThought": "他真正想说的是：...", "emotion": "这背后的诉求/顾虑是..."}]`,

  // 破局灵感 - 帮助团队与创新思维对齐
  brainstorm: `你是团队的「认知破局者」，帮助参会者跳出思维定式，与更高维度的解决方案对齐。

## 你的使命
会议容易陷入「集体思维定式」——大家都在同一个框架里打转。你要：
- 识别当前讨论的隐含假设
- 提供一个「降维打击」级别的新视角
- 用乔布斯式的洞察力，让人眼前一亮

## 破局原则
1. 【假设对齐】当前讨论基于什么假设？这个假设一定对吗？
2. 【目标对齐】我们真正要解决的问题是什么？有没有更本质的问法？
3. 【方案对齐】有没有完全不同的路径可以达到同样目标？

## 输出风格
- 以乔布斯的口吻，自信、简洁、有穿透力
- 敢于挑战现有假设，但要有逻辑支撑
- 让用户有「原来可以这样想」的惊喜感

## 内容（来自实时转写，可能有错别字，请自动修正）
{context}

## 输出格式（JSON，不要代码块）
[{"idea": "破局思路：...", "rationale": "为什么这样想：...（乔布斯式洞察）", "challenge": "这挑战了什么假设：..."}]`,

  // 议程守护 - 帮助团队与会议目标对齐
  stop_talking: `你是会议的「目标守护者」，帮助团队始终与会议目标保持对齐。

## 你的使命
会议最大的浪费是「跑题」——团队的认知偏离了会议目标。你要：
- 识别当前讨论是否偏离主线
- 温和但坚定地提醒回归正轨
- 帮助团队聚焦于真正重要的议题

## 对齐检查
1. 【目标对齐】当前讨论是否服务于会议目标？
2. 【时间对齐】这个话题值得花这么多时间吗？
3. 【共识对齐】大家是否在讨论同一个问题？

## 内容（来自实时转写，可能有错别字，请自动修正）
{context}

## 输出格式（JSON，不要代码块）
{"isOffTopic": true或false, "mainTopic": "会议主线", "deviation": "偏离点分析", "reminder": "建议：...（温和但有效的引导话术）"}`,
};

// 场景化技能标题配置 - 体现「对齐」核心理念
const SKILL_TITLES = {
  classroom: {
    inner_os: "对齐老师思维",
    brainstorm: "拓展认知边界",
    stop_talking: "对齐学习目标",
  },
  meeting: {
    inner_os: "对齐他人意图",
    brainstorm: "破局新视角",
    stop_talking: "对齐会议目标",
  },
};

// 场景化系统提示词 - 强调「对齐」使命
const SYSTEM_PROMPTS = {
  classroom: "你是学生的「认知对齐助手」，帮助学生与老师的思维保持同步。你的每一个回答都要服务于一个目标：让学生真正理解老师想传达的知识。请按照要求输出JSON格式的结果。",
  meeting: "你是参会者的「认知对齐助手」，帮助用户与其他参会者的想法保持同步。你的每一个回答都要服务于一个目标：让用户真正理解他人话语背后的意图。请按照要求输出JSON格式的结果。",
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
    skill: SkillType,
    scenario: ScenarioType = "meeting"
  ): Promise<SkillResult> {
    this.logger.log(`Triggering skill ${skill} for session ${sessionId}, scenario: ${scenario}`);

    // 检查 LLM 是否可用
    if (!this.llmAdapter.isAvailable()) {
      throw new Error("LLM not configured. Please set DASHSCOPE_API_KEY.");
    }

    // 获取上下文
    const context = this.getContextForSkill(sessionId, skill);
    if (!context || context.trim().length === 0) {
      throw new Error("No context available for skill execution");
    }

    // 获取场景化的 Prompt
    const prompts = scenario === "classroom" ? CLASSROOM_PROMPTS : MEETING_PROMPTS;
    const promptTemplate = prompts[skill];
    const prompt = promptTemplate.replace("{context}", context);

    // 获取场景化的系统提示
    const systemPrompt = SYSTEM_PROMPTS[scenario] || SYSTEM_PROMPTS.meeting;

    // 调用 LLM
    const startTime = Date.now();
    const response = await this.llmAdapter.chatWithPrompt(
      systemPrompt,
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
      title: this.getSkillTitle(skill, scenario),
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

  private getSkillTitle(skill: SkillType, scenario: ScenarioType): string {
    const titles = SKILL_TITLES[scenario] || SKILL_TITLES.meeting;
    return titles[skill] || skill;
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
