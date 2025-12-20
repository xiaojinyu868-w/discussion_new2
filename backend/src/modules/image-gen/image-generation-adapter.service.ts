import { Injectable, Logger, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface ImageGenerationOptions {
  type: "chart" | "creative" | "poster";
  chartType?: string;
  size?: string; // 如：'1024x1024'
  format?: string; // 如：'png', 'jpg'
  quality?: string; // 如：'standard', 'hd'
}

export interface ImageGenerationResult {
  url?: string; // 图像URL（如果API返回URL）
  base64?: string; // Base64图像数据（如果返回Base64）
  metadata?: any; // 其他元数据
}

@Injectable()
export class ImageGenerationAdapter {
  private readonly logger = new Logger(ImageGenerationAdapter.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly defaultSize: string;
  private readonly defaultFormat: string;
  private readonly defaultQuality: string;

  constructor(private readonly configService: ConfigService) {
    // 配置从环境变量读取
    this.apiKey = this.configService.get<string>("imageGen.apiKey") ?? "";
    this.baseUrl =
      this.configService.get<string>("imageGen.baseUrl") ??
      "https://generativelanguage.googleapis.com/v1beta";
    // 使用 Gemini Nano Banana 模型（根据文档）
    this.model =
      this.configService.get<string>("imageGen.model") ??
      "gemini-2.5-flash-image";
    this.defaultSize =
      this.configService.get<string>("imageGen.size") ?? "1024x1024";
    this.defaultFormat =
      this.configService.get<string>("imageGen.format") ?? "png";
    this.defaultQuality =
      this.configService.get<string>("imageGen.quality") ?? "standard";

    if (!this.apiKey) {
      this.logger.warn(
        "GEMINI_API_KEY not configured, image generation features will not work"
      );
    }

    this.logger.log(
      `Image Generation Adapter initialized with model: ${this.model}, ` +
      `baseUrl: ${this.baseUrl}, ` +
      `apiKey configured: ${!!this.apiKey}, ` +
      `apiKey prefix: ${this.apiKey ? this.apiKey.substring(0, 8) + '...' : 'N/A'}`
    );
  }

  async generate(
    prompt: string,
    options?: ImageGenerationOptions
  ): Promise<ImageGenerationResult> {
    try {
      if (!this.apiKey) {
        throw new Error("GEMINI_API_KEY not configured");
      }

      // 调用Gemini Imagen API
      const response = await this.callImageGenerationAPI(prompt, options);

      // 处理响应（可能是URL或Base64）
      return this.processResponse(response);
    } catch (error) {
      this.logger.error("Image generation failed", error);
      throw new InternalServerErrorException("Image generation failed");
    }
  }

  private async callImageGenerationAPI(
    prompt: string,
    options?: ImageGenerationOptions
  ): Promise<any> {
    // 使用 Gemini API (Nano Banana) 进行图像生成
    // 参考文档: https://ai.google.dev/gemini-api/docs/image-generation
    // API 端点格式: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
    // 兼容代理：如果 baseUrl 没带 /v1beta 则自动补全；去掉末尾多余斜杠避免 //models
    const normalizedBase = this.baseUrl.replace(/\/+$/, "");
    const baseWithVersion = normalizedBase.includes("/v1beta")
      ? normalizedBase
      : `${normalizedBase}/v1beta`;
    const isUndyingApi = baseWithVersion.includes("undyingapi");
    const url = `${baseWithVersion}/models/${this.model}:generateContent`;
    const urlWithAuth = isUndyingApi && this.apiKey
      ? `${url}?key=${encodeURIComponent(this.apiKey)}`
      : url;

    // 记录实际请求的 URL（隐藏 API key）
    const urlForLog = urlWithAuth.replace(/key=[^&]*/, "key=***");
    this.logger.debug(`Calling Gemini Image API: ${urlForLog}`);

    const [width, height] = (options?.size ?? this.defaultSize)
      .split("x")
      .map(Number);
    const aspectRatio = this.getAspectRatio(width, height);

    // 根据 Gemini API 文档格式构建请求体
    const imageConfig: any = {
      aspectRatio: aspectRatio,
    };

    // Gemini 3 Pro Image 预览版支持 imageSize 参数（1K, 2K, 4K）
    if (this.model === "gemini-3-pro-image-preview") {
      // 根据尺寸推断 imageSize
      const maxDimension = Math.max(width, height);
      if (maxDimension >= 3000) {
        imageConfig.imageSize = "4K";
      } else if (maxDimension >= 2000) {
        imageConfig.imageSize = "2K";
      } else {
        imageConfig.imageSize = "1K";
      }
    }

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
        // 强制输出图像，不要文本回复
        responseModalities: ["IMAGE"],
        ...imageConfig,
      },
    };

    this.logger.debug(`Calling Gemini Image API with prompt: ${prompt.substring(0, 100)}...`);
    // 临时调试：打印实际使用的 key 前 15 位，确认是否与 curl 一致
    this.logger.debug(`[DEBUG] apiKey used: ${this.apiKey.substring(0, 15)}... (len=${this.apiKey.length})`);
    this.logger.debug(`[DEBUG] urlWithAuth: ${urlWithAuth.substring(0, 120)}...`);

    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(urlWithAuth, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // 同时兼容 Google 官方 (x-goog-api-key) 与代理 (Authorization: Bearer)
            "x-goog-api-key": this.apiKey,
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (response.status === 429 || response.status === 503) {
          const errorText = await response.text();
          this.logger.warn(
            `Gemini Image API rate limited (${response.status}), attempt ${attempt}/${maxRetries}, ` +
            `url: ${urlForLog}, detail: ${errorText.substring(0, 200)}`
          );
          lastError = new Error(`Gemini Image API rate limited: ${response.status}`);
          if (attempt < maxRetries) {
            const backoff = Math.min(4000, 1000 * Math.pow(2, attempt - 1));
            await this.sleep(backoff);
            continue;
          }
        }

        // 检查响应状态
        if (!response.ok) {
          const errorText = await response.text();
          this.logger.error(`Gemini Image API error: ${response.status} - ${errorText.substring(0, 500)}`);
          throw new Error(`Gemini Image API error: ${response.status} - ${errorText.substring(0, 200)}`);
        }

        // 检查 Content-Type，确保是 JSON 响应
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          // 克隆响应以便读取文本（响应流只能读取一次）
          const responseClone = response.clone();
          const responseText = await responseClone.text();
          this.logger.error(
            `Gemini Image API returned non-JSON response. Status: ${response.status}, ` +
            `Content-Type: ${contentType}, URL: ${urlForLog}, Response preview: ${responseText.substring(0, 500)}`
          );
          
          // 检查是否是代理服务器返回的 HTML 页面
          if (responseText.includes("<!doctype html") || responseText.includes("<html")) {
            this.logger.error(
              `Detected HTML response from proxy server. ` +
              `Please check IMAGE_GEN_BASE_URL environment variable. ` +
              `Expected: https://generativelanguage.googleapis.com/v1beta, ` +
              `Current: ${this.baseUrl}`
            );
            throw new Error(
              `API endpoint returned HTML instead of JSON. ` +
              `This usually means IMAGE_GEN_BASE_URL is pointing to a proxy server. ` +
              `Please set IMAGE_GEN_BASE_URL=https://generativelanguage.googleapis.com/v1beta ` +
              `or remove it to use the default. Current baseUrl: ${this.baseUrl}`
            );
          }
          
          throw new Error(
            `Gemini Image API returned non-JSON response (likely HTML error page). ` +
            `Status: ${response.status}, Content-Type: ${contentType}. ` +
            `This may indicate an API endpoint error, authentication failure, or incorrect API configuration. ` +
            `Current baseUrl: ${this.baseUrl}`
          );
        }

        // 在解析 JSON 之前克隆响应，以便解析失败时能读取原始文本
        const responseClone = response.clone();
        
        // 安全地解析 JSON
        try {
          return await response.json();
        } catch (jsonError) {
          // 如果 JSON 解析失败，读取原始响应文本
          const responseText = await responseClone.text();
          this.logger.error(
            `Failed to parse Gemini Image API response as JSON. ` +
            `Response preview: ${responseText.substring(0, 500)}`
          );
          throw new Error(
            `Failed to parse Gemini Image API response as JSON. ` +
            `Response may be HTML or invalid JSON. Check API endpoint and authentication. ` +
            `Response preview: ${responseText.substring(0, 200)}`
          );
        }
      } catch (error) {
        lastError = error;
        // 如果是我们抛出的错误，直接抛出
        if (error instanceof Error && (error.message.includes("Gemini Image API") || error.message.includes("Imagen API"))) {
          throw error;
        }
        if (attempt < maxRetries) {
          const backoff = Math.min(4000, 1000 * Math.pow(2, attempt - 1));
          this.logger.warn(`Gemini Image API network/error, retry ${attempt}/${maxRetries} after ${backoff}ms: ${error}`);
          await this.sleep(backoff);
          continue;
        }
        // 最后一次，跳出循环，由下方统一抛出
        break;
      }
    }

    this.logger.error(`Failed to call Gemini Image API after retries: ${lastError}`);
    throw new Error(
      `Failed to call Gemini Image API: ${lastError instanceof Error ? lastError.message : String(lastError)}. ` +
      `Please check API endpoint (${urlWithAuth}), authentication, and network connectivity.`
    );
  }

  private processResponse(response: any): ImageGenerationResult {
    // 调试：打印原始响应结构
    this.logger.debug(`[DEBUG] Raw API response keys: ${Object.keys(response || {}).join(', ')}`);
    this.logger.debug(`[DEBUG] Raw API response preview: ${JSON.stringify(response).substring(0, 500)}`);
    
    // 处理 Gemini API 响应，提取图像Base64数据
    // Gemini API 返回格式（根据官方文档）:
    // {
    //   "candidates": [{
    //     "content": {
    //       "parts": [{
    //         "inlineData": {
    //           "data": "base64_encoded_image",
    //           "mimeType": "image/png"
    //         }
    //       }]
    //     }
    //   }]
    // }
    
    // 处理 Gemini API 标准格式
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
                safetyRatings: candidate.safetyRatings,
              },
            };
          }
          // 有些响应可能包含文本说明
          if (part.text) {
            this.logger.debug(`Gemini API returned text: ${part.text}`);
          }
        }
      }
    }
    
    // 兼容旧格式（如果存在）
    if (response.generatedImages && response.generatedImages.length > 0) {
      const imageData = response.generatedImages[0];
      if (imageData.imageBytes) {
        return {
          base64: imageData.imageBytes,
          metadata: {
            safetyRatings: imageData.safetyRatings,
          },
        };
      }
    }
    
    // 兼容 Vertex AI 格式
    if (response.predictions && response.predictions.length > 0) {
      const prediction = response.predictions[0];
      if (prediction.bytesBase64Encoded) {
        return {
          base64: prediction.bytesBase64Encoded,
          metadata: prediction,
        };
      }
    }

    this.logger.error(`Unexpected response format: ${JSON.stringify(response).substring(0, 500)}`);
    throw new Error("Invalid response format from Gemini Image API");
  }

  private getAspectRatio(width: number, height: number): string {
    const ratio = width / height;
    if (Math.abs(ratio - 1.0) < 0.1) return "1:1";
    if (Math.abs(ratio - 4.0 / 3.0) < 0.1) return "4:3";
    if (Math.abs(ratio - 3.0 / 4.0) < 0.1) return "3:4";
    if (Math.abs(ratio - 16.0 / 9.0) < 0.1) return "16:9";
    if (Math.abs(ratio - 9.0 / 16.0) < 0.1) return "9:16";
    return "1:1"; // 默认
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

