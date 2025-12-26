import { Injectable, Logger } from "@nestjs/common";
import { LLMAdapterService } from "../llm/llm-adapter.service";

export interface ChartData {
  type: "radar" | "flowchart" | "architecture" | "bar" | "line";
  data: any; // 根据类型不同，数据结构不同
}

@Injectable()
export class DataExtractionService {
  private readonly logger = new Logger(DataExtractionService.name);

  constructor(private readonly llmAdapter: LLMAdapterService) {}

  /**
   * 提取图表数据
   */
  async extractChartData(
    context: string,
    chartType: string
  ): Promise<ChartData> {
    const prompt = this.buildExtractionPrompt(context, chartType);
    const response = await this.llmAdapter.chatForJson<ChartData>([
      {
        role: "system",
        content: "你是一个数据分析专家，擅长从会议文本中提取结构化数据。",
      },
      {
        role: "user",
        content: prompt,
      },
    ]);

    // chatForJson 已经返回解析后的对象，不需要再次 JSON.parse
    if (!response) {
      this.logger.error("LLM returned null or failed to parse JSON");
      throw new Error("Failed to extract chart data: LLM response is null");
    }

    // 验证返回的数据结构
    if (!response.type || !response.data) {
      this.logger.error("Invalid chart data structure", {
        response,
        expected: "ChartData with type and data fields",
      });
      throw new Error(
        "Failed to extract chart data: invalid data structure from LLM"
      );
    }

    return response as ChartData;
  }

  /**
   * 转换为图表生成提示词
   */
  toChartPrompt(data: ChartData, chartType: string): string {
    switch (chartType) {
      case "radar":
        return this.buildRadarChartPrompt(data);
      case "flowchart":
        return this.buildFlowchartPrompt(data);
      case "architecture":
        return this.buildArchitecturePrompt(data);
      default:
        return this.buildGenericChartPrompt(data, chartType);
    }
  }

  /**
   * 生成创意图像提示词
   */
  async generateCreativePrompt(context: string): Promise<string> {
    const prompt = `分析以下会议内容，提取核心情绪、愿景和关键观点，生成一个高质量的图像生成提示词。

会议内容：
${context}

要求：
1. 识别会议的核心主题和情绪（如：创新、协作、挑战、成功等）
2. 提取关键视觉元素（如：概念、隐喻、象征）
3. 确定色彩方案（如：温暖色调、科技蓝、高对比度等）
4. 确定图像风格（如：现代商务、创意插画、科技感等）
5. 确定构图要求（如：居中、对称、动态等）

输出格式：直接输出图像生成提示词，用中文详细描述图像应该呈现的内容、风格、色彩和构图。`;

    const description = await this.llmAdapter.chatWithPrompt(
      "你是一个专业的图像生成提示词工程师，擅长将抽象概念转化为视觉描述。",
      prompt
    );

    // 转换为Nano Banana Pro格式
    return `你是一位专业的机器学习插图专家。
使用 Nano Banana Pro 绘制一张符合以下描述的创意图像。

目标：
创建一张专业的、具有传播价值的图像，准确反映会议的核心情绪和愿景。

图像描述（从会议内容提取）：
${description}

风格要求：

- 现代商务风格或创意插画风格（根据描述选择）
- 专业的色彩方案
- 清晰的构图和视觉层次
- 适合社交媒体和组织内部传播
- 保持专业性和美观性

生成最终图像。`;
  }

  /**
   * 生成逻辑海报提示词
   */
  async generatePosterPrompt(context: string): Promise<string> {
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

    // 转换为Nano Banana Pro格式
    return `你是一位专业的机器学习插图专家。
使用 Nano Banana Pro 绘制一张干净、符合 NeurIPS/ICLR 风格的信息图表海报。

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

风格要求：

- NeurIPS 2024 视觉风格
- 非常浅的背景
- 文本清晰可读
- 连接线短而干净
- 使用一致的间距和色彩

生成最终信息图表海报。`;
  }

  private buildExtractionPrompt(context: string, chartType: string): string {
    switch (chartType) {
      case "radar":
        return `你是一个数据分析专家，擅长从会议文本中提取结构化数据。

任务：从以下会议内容中提取雷达图所需的数据。

会议内容：
${context}

要求：
1. 识别会议中讨论的多个维度（如：技术、市场、团队、资源等）
2. 为每个维度评估数值或评分（0-100分）
3. 提取维度名称和对应的数值

输出JSON格式：
{
  "type": "radar",
  "data": {
    "dimensions": [
      {"name": "技术", "value": 85},
      {"name": "市场", "value": 70},
      {"name": "团队", "value": 90}
    ]
  }
}`;

      case "flowchart":
        return `你是一个流程分析专家，擅长从会议文本中提取流程逻辑。

任务：从以下会议内容中提取流程图所需的数据。

会议内容：
${context}

要求：
1. 识别流程的各个节点（开始、过程、决策、结束）
2. 识别节点之间的连接关系
3. 识别决策点的判断条件

输出JSON格式：
{
  "type": "flowchart",
  "data": {
    "nodes": [
      {"id": "start", "type": "start", "label": "开始"},
      {"id": "process1", "type": "process", "label": "流程1"},
      {"id": "decision1", "type": "decision", "label": "判断条件"}
    ],
    "edges": [
      {"from": "start", "to": "process1"},
      {"from": "process1", "to": "decision1"}
    ]
  }
}`;

      case "architecture":
        return `你是一个系统架构分析专家，擅长从会议文本中提取系统架构信息。

任务：从以下会议内容中提取架构图所需的数据。

会议内容：
${context}

要求：
1. 识别系统的各个组件或模块
2. 识别组件之间的层级关系和依赖关系
3. 识别数据流向和交互关系

输出JSON格式：
{
  "type": "architecture",
  "data": {
    "components": [
      {"id": "comp1", "name": "组件1", "level": 1, "type": "service"},
      {"id": "comp2", "name": "组件2", "level": 2, "type": "database"}
    ],
    "relationships": [
      {"from": "comp1", "to": "comp2", "type": "depends_on"}
    ]
  }
}`;

      default:
        return `你是一个数据分析专家，擅长从会议文本中提取结构化数据。

任务：从以下会议内容中提取${chartType}图表所需的数据。

会议内容：
${context}

要求：
1. 识别数据维度或分类
2. 提取数值或统计数据
3. 识别数据之间的关系

输出JSON格式，包含type和data字段。`;
    }
  }

  private buildRadarChartPrompt(data: ChartData): string {
    const dimensions = data.data?.dimensions || [];
    const dimensionList = dimensions
      .map((d: any) => `${d.name}: ${d.value}`)
      .join("\n");

    return `你是一位专业的数据可视化专家。
使用 Nano Banana Pro 绘制一张干净、符合 NeurIPS/ICLR 风格的雷达图。

目标：
创建一张专业的、符合发表质量的雷达图，严格按照下方数据维度列表。
不要发明数据，不要重新解释，不要添加创意。
严格遵循提供的数据。

全局规则：

- 扁平、干净的 NeurIPS 风格（无渐变、无光泽、无阴影）
- 一致的细线条权重
- 专业的柔和色调
- 清晰的坐标轴和网格线
- 数据点用简洁的标记
- 不使用长句子，仅使用简短标签
- 保持间距干净平衡

数据维度列表（根据会议内容填充）：

维度：
${dimensionList}

数值范围：0-100

风格要求：

- NeurIPS 2024 视觉风格
- 非常浅的背景
- 坐标轴标签清晰可读
- 数据区域用半透明填充
- 使用一致的色彩方案
- 图例简洁明了

生成最终雷达图。`;
  }

  private buildFlowchartPrompt(data: ChartData): string {
    const nodes = data.data?.nodes || [];
    const edges = data.data?.edges || [];

    const nodeList = nodes
      .map((n: any) => `- ${n.label} (${n.type})`)
      .join("\n");

    const edgeList = edges
      .map((e: any) => `- ${e.from} → ${e.to}`)
      .join("\n");

    return `你是一位专业的机器学习插图专家。
使用 Nano Banana Pro 绘制一张干净、符合 NeurIPS/ICLR 风格的学术图表。

目标：
创建一张专业的、符合发表质量的图表，严格按照下方模块列表中的结构和逻辑。
不要发明组件，不要重新解释，不要添加创意。
严格遵循逻辑流程。

全局规则：

- 扁平、干净的 NeurIPS 风格（无渐变、无光泽、无阴影）
- 一致的细线条权重
- 专业的柔和色调
- 圆角矩形表示模块
- 箭头必须清晰指示数据流向
- 不使用长句子，仅使用简短标签
- 保持间距干净平衡
- 所有模块必须恰好出现一次（除非特别指定）

布局：

- 水平从左到右布局（推荐）
- 或垂直从上到下布局（如果模块本质上是顺序的）
- 组件整齐对齐成直线
- 严格按照列表中的模块顺序

模块列表：

${nodeList}

连接关系：
${edgeList}

风格要求：

- NeurIPS 2024 视觉风格
- 非常浅的背景
- 文本在模块内左对齐
- 箭头短而干净
- 使用一致的垂直间距

生成最终图表。`;
  }

  private buildArchitecturePrompt(data: ChartData): string {
    const components = data.data?.components || [];
    const relationships = data.data?.relationships || [];

    const componentList = components
      .map((c: any) => `- ${c.name} (层级${c.level}, 类型: ${c.type})`)
      .join("\n");

    const relationshipList = relationships
      .map((r: any) => `- ${r.from} ${r.type} ${r.to}`)
      .join("\n");

    return `你是一位专业的机器学习插图专家。
使用 Nano Banana Pro 绘制一张干净、符合 NeurIPS/ICLR 风格的系统架构图。

目标：
创建一张专业的、符合发表质量的架构图，严格按照下方组件列表中的结构和层级关系。
不要发明组件，不要重新解释，不要添加创意。
严格遵循架构逻辑。

全局规则：

- 扁平、干净的 NeurIPS 风格（无渐变、无光泽、无阴影）
- 一致的细线条权重
- 专业的柔和色调
- 圆角矩形表示组件
- 箭头必须清晰指示依赖关系和数据流向
- 不使用长句子，仅使用简短标签
- 保持间距干净平衡
- 所有组件必须恰好出现一次

布局：

- 分层布局（顶层 → 中间层 → 底层）
- 或水平从左到右布局（如果架构是顺序的）
- 组件整齐对齐成直线
- 严格按照层级关系排列

组件列表：

${componentList}

依赖关系：
${relationshipList}

风格要求：

- NeurIPS 2024 视觉风格
- 非常浅的背景
- 文本在组件内左对齐
- 箭头短而干净，清晰表示依赖方向
- 使用一致的垂直和水平间距
- 层级之间用水平线分隔

生成最终架构图。`;
  }

  private buildGenericChartPrompt(
    data: ChartData,
    chartType: string
  ): string {
    return `你是一位专业的数据可视化专家。
使用 Nano Banana Pro 绘制一张干净、符合 NeurIPS/ICLR 风格的${chartType}图表。

目标：
创建一张专业的、符合发表质量的图表，严格按照提供的数据。
不要发明数据，不要重新解释，不要添加创意。

数据：
${JSON.stringify(data.data, null, 2)}

风格要求：

- NeurIPS 2024 视觉风格
- 非常浅的背景
- 清晰的坐标轴和标签
- 使用一致的色彩方案
- 保持间距干净平衡

生成最终图表。`;
  }
}

