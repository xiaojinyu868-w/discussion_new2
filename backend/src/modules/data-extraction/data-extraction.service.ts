import { Injectable, Logger } from "@nestjs/common";
import { LLMAdapterService } from "../llm/llm-adapter.service";

@Injectable()
export class DataExtractionService {
  private readonly logger = new Logger(DataExtractionService.name);

  constructor(private readonly llmAdapter: LLMAdapterService) {}

  /**
   * 生成逻辑海报提示词（带风格）
   * @param context 会议内容
   * @param styleKeywords 风格关键词（如："可爱、治愈、Chiikawa风格"）
   */
  async generatePosterPrompt(context: string, styleKeywords?: string): Promise<string> {
    const prompt = `分析以下会议内容，生成一个逻辑海报的详细描述。

会议内容：
${context}

要求：
1. 提取会议的核心要点（3-5个）
2. 识别逻辑关系（如：因果关系、层级关系、时间顺序等）
3. 设计海报布局（如：思维导图、决策树、要点列表等）
4. 确定视觉风格（如：简洁商务、创意设计、信息图表等）

输出格式：用中文详细描述海报应该呈现的布局、要点、逻辑关系和视觉风格。`;

    const description = await this.llmAdapter.chatWithPrompt(
      "你是一个专业的信息图表设计师，擅长将复杂信息转化为清晰的视觉表达。",
      prompt
    );

    // 构建风格要求部分
    const styleSection = styleKeywords
      ? `
风格要求：

- ${styleKeywords}
- 清晰的视觉层次
- 要点用简洁的标签
- 逻辑关系用箭头或连接线表示
- 保持间距干净平衡
- 强制使用中文`
      : `
风格要求：

- NeurIPS 2024 视觉风格
- 非常浅的背景
- 文本清晰可读
- 连接线短而干净
- 使用一致的间距和色彩`;

    // 转换为图像生成提示词格式
    return `你是一位专业的信息图表设计专家。
绘制一张干净、清晰的信息图表海报。

目标：
创建一张专业的、符合发表质量的信息图表，清晰展示会议的核心要点和逻辑关系。

海报内容（从会议内容提取）：
${description}

全局规则：

- 扁平、干净的信息图表风格
- 一致的细线条权重
- 专业的柔和色调
- 清晰的视觉层次
- 要点用简洁的标签
- 逻辑关系用箭头或连接线表示
- 保持间距干净平衡
- 强制使用中文

布局要求：

- 中心思维导图布局（推荐）
- 或垂直列表布局（如果要点是顺序的）
- 要点整齐对齐
- 逻辑关系清晰可见
${styleSection}

生成最终信息图表海报。`;
  }
}
