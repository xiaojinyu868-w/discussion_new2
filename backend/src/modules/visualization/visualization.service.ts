import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ContextStoreService } from "../context/context-store.service";
import { DataExtractionService } from "../data-extraction/data-extraction.service";
import {
  ImageGenerationAdapter,
  ImageGenerationOptions,
} from "../image-gen/image-generation-adapter.service";

// 只保留逻辑海报类型
export type VisualizationType = "poster";

// 预设风格类型
export type PosterStyle = "chiikawa" | "minimal-business";

// 风格配置
export const POSTER_STYLES: Record<PosterStyle, { name: string; description: string; keywords: string }> = {
  "chiikawa": {
    name: "Chiikawa",
    description: "可爱治愈风格",
    keywords: "可爱、治愈、软萌、Chiikawa风格、圆润的线条、柔和的配色、萌系角色形象"
  },
  "minimal-business": {
    name: "极简商务",
    description: "简洁专业风格",
    keywords: "极简、商务、专业、简洁大气、干净的线条、现代感、高级灰配色"
  }
};

export interface VisualizationRequest {
  sessionId: string;
  type: VisualizationType;
  style?: PosterStyle; // 海报风格
}

export interface VisualizationResult {
  id: string;
  sessionId: string;
  type: VisualizationType;
  style?: PosterStyle; // 使用的风格
  imageUrl?: string; // 图像URL（如果API返回URL）
  imageBase64?: string; // Base64图像数据（如果返回Base64）
  prompt: string; // 使用的生成提示词
  metadata: {
    styleName?: string; // 风格名称
    description?: string; // 海报描述
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

    // 2. 获取风格配置
    const style = request.style || "chiikawa";
    const styleConfig = POSTER_STYLES[style];

    // 3. 生成逻辑海报提示词（带风格）
    const prompt = await this.dataExtractionService.generatePosterPrompt(
      context,
      styleConfig.keywords
    );
    const metadata = {
      description: prompt,
      styleName: styleConfig.name,
    };

    // 4. 调用图像生成
    const imageResult = await this.imageGenAdapter.generate(prompt, {
      type: "poster",
    });

    // 5. 保存结果
    const result: VisualizationResult = {
      id: `vis-${Date.now()}`,
      sessionId: request.sessionId,
      type: "poster",
      style,
      imageUrl: imageResult.url,
      imageBase64: imageResult.base64,
      prompt,
      metadata: {
        ...metadata,
        mimeType: imageResult.metadata?.mimeType || "image/png",
      },
      createdAt: new Date(),
    };

    // 6. 保存到内存存储
    if (!this.visualizations.has(request.sessionId)) {
      this.visualizations.set(request.sessionId, []);
    }
    this.visualizations.get(request.sessionId)!.push(result);

    // 7. 保存到消息流
    this.contextStore.appendMessage(request.sessionId, {
      id: result.id,
      type: "visualization",
      content: result,
      timestamp: result.createdAt,
    });

    this.logger.log(
      `Poster generated: ${result.id} for session ${request.sessionId} with style ${style}`
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

