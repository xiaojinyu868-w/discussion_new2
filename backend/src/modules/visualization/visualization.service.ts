import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ContextStoreService } from "../context/context-store.service";
import { DataExtractionService } from "../data-extraction/data-extraction.service";
import {
  ImageGenerationAdapter,
  ImageGenerationOptions,
} from "../image-gen/image-generation-adapter.service";

export type VisualizationType = "chart" | "creative" | "poster";

export interface VisualizationRequest {
  sessionId: string;
  type: VisualizationType;
  chartType?: "radar" | "flowchart" | "architecture" | "bar" | "line"; // 仅当type='chart'时使用
}

export interface VisualizationResult {
  id: string;
  sessionId: string;
  type: VisualizationType;
  imageUrl?: string; // 图像URL（如果API返回URL）
  imageBase64?: string; // Base64图像数据（如果返回Base64）
  prompt: string; // 使用的生成提示词
  metadata: {
    chartType?: string; // 图表类型（如果是图表）
    dataStructure?: any; // 提取的结构化数据（如果是图表）
    description?: string; // 创意描述（如果是创意图像）
  };
  createdAt: Date;
}

@Injectable()
export class VisualizationService {
  private readonly logger = new Logger(VisualizationService.name);
  private visualizations = new Map<string, VisualizationResult[]>();

  constructor(
    private readonly contextStore: ContextStoreService,
    private readonly dataExtractionService: DataExtractionService,
    private readonly imageGenAdapter: ImageGenerationAdapter
  ) {}

  async generateVisualization(
    request: VisualizationRequest
  ): Promise<VisualizationResult> {
    // 1. 获取会议文本流上下文
    const context = this.contextStore.getFullText(request.sessionId);
    if (!context || context.trim().length === 0) {
      throw new NotFoundException(
        "No transcription content found for this session"
      );
    }

    // 2. 根据类型生成提示词
    let prompt: string;
    let metadata: any;

    if (request.type === "chart") {
      if (!request.chartType) {
        throw new Error("chartType is required when type is 'chart'");
      }
      // 提取结构化数据
      const data = await this.dataExtractionService.extractChartData(
        context,
        request.chartType
      );
      // 转换为绘图指令
      prompt = this.dataExtractionService.toChartPrompt(
        data,
        request.chartType
      );
      metadata = { chartType: request.chartType, dataStructure: data };
    } else if (request.type === "creative") {
      // 生成创意图像描述
      prompt = await this.dataExtractionService.generateCreativePrompt(context);
      metadata = { description: prompt };
    } else {
      // 生成逻辑海报描述
      prompt = await this.dataExtractionService.generatePosterPrompt(context);
      metadata = { description: prompt };
    }

    // 3. 调用图像生成
    const imageResult = await this.imageGenAdapter.generate(prompt, {
      type: request.type,
      chartType: request.chartType,
    });

    // 4. 保存结果
    const result: VisualizationResult = {
      id: `vis-${Date.now()}`,
      sessionId: request.sessionId,
      type: request.type,
      imageUrl: imageResult.url,
      imageBase64: imageResult.base64,
      prompt,
      metadata: {
        ...metadata,
        mimeType: imageResult.metadata?.mimeType || "image/png",
      },
      createdAt: new Date(),
    };

    // 5. 保存到内存存储
    if (!this.visualizations.has(request.sessionId)) {
      this.visualizations.set(request.sessionId, []);
    }
    this.visualizations.get(request.sessionId)!.push(result);

    // 6. 保存到消息流
    this.contextStore.appendMessage(request.sessionId, {
      id: result.id,
      type: "visualization",
      content: result,
      timestamp: result.createdAt,
    });

    this.logger.log(
      `Visualization generated: ${result.id} for session ${request.sessionId}`
    );

    return result;
  }

  getVisualizations(sessionId: string): VisualizationResult[] {
    return this.visualizations.get(sessionId) || [];
  }

  getVisualization(
    sessionId: string,
    visId: string
  ): VisualizationResult | undefined {
    const visualizations = this.visualizations.get(sessionId) || [];
    return visualizations.find((v) => v.id === visId);
  }
}

