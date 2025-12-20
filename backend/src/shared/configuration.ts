export default () => {
  const region = process.env.TINGWU_REGION ?? "cn-beijing";
  const endpoint =
    process.env.TINGWU_ENDPOINT ?? `tingwu.${region}.aliyuncs.com`;

  return {
    tingwu: {
      region,
      accessKeyId: process.env.TINGWU_ACCESS_KEY_ID ?? "",
      accessKeySecret: process.env.TINGWU_ACCESS_KEY_SECRET ?? "",
      appKey: process.env.TINGWU_APP_KEY ?? "",
      endpoint,
    },
    pollingIntervalMs: Number(process.env.POLLING_INTERVAL_MS ?? 5000),

    // LLM 配置 (Qwen3-Max)
    llm: {
      apiKey: process.env.DASHSCOPE_API_KEY ?? "",
      model: process.env.LLM_MODEL ?? "qwen3-max",
      baseUrl:
        process.env.LLM_BASE_URL ??
        "https://dashscope.aliyuncs.com/compatible-mode/v1",
      temperature: Number(process.env.LLM_TEMPERATURE ?? 0.7),
      maxTokens: Number(process.env.LLM_MAX_TOKENS ?? 2000),
    },

    // 自动推送配置
    autoPush: {
      intervalMs: Number(process.env.AUTO_PUSH_INTERVAL_MS ?? 60000),
      enabled: process.env.AUTO_PUSH_ENABLED !== "false",
    },

    // 图像生成配置 (Gemini Imagen API)
    imageGen: {
      apiKey: process.env.GEMINI_API_KEY ?? "",
      model: process.env.IMAGE_GEN_MODEL ?? "imagen-3.0-generate-001",
      baseUrl:
        process.env.IMAGE_GEN_BASE_URL ??
        "https://generativelanguage.googleapis.com/v1beta",
      size: process.env.IMAGE_GEN_SIZE ?? "1024x1024",
      format: process.env.IMAGE_GEN_FORMAT ?? "png",
      quality: process.env.IMAGE_GEN_QUALITY ?? "standard",
    },
  };
};
