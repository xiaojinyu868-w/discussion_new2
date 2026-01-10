export default () => {
  return {
    // DashScope ASR 配置
    dashscopeAsr: {
      apiKey: process.env.DASHSCOPE_API_KEY ?? "",
      model: process.env.DASHSCOPE_ASR_WS_MODEL ?? "qwen3-asr-flash-realtime",
      sampleRate: parseInt(process.env.DASHSCOPE_ASR_WS_SR ?? "16000", 10),
      wsEndpoint: "wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
    },

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
