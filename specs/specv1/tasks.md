# 实施计划: 会议快照 V1

## 任务总览

| 编号 | 任务 | 状态 | 需求 |
|------|------|------|------|
| 1 | 上下文文本流存储 | ✅ 已完成 | 需求1 |
| 2 | LLM 适配器模块 | ✅ 已完成 | 需求2,3,4 |
| 3 | 技能服务重构 | ✅ 已完成 | 需求2 |
| 4 | 自动推送服务 | ✅ 已完成 | 需求3 |
| 5 | 自由问答服务 | ✅ 已完成 | 需求4 |
| 6 | 前端消息流与问答UI | ✅ 已完成 | 需求2,3,4 |
| 7 | 集成测试与调优 | ⬜ 待开始 | 全部 |

---

## 详细任务

### [1]. 上下文文本流存储

**具体要做的事情：**
- 创建 `ContextStore` 服务（`backend/src/modules/context/context-store.service.ts`）
- 定义通义听悟返回格式的 TypeScript 接口（`TingwuTranscriptionPayload`）
- 实现 `appendFromTingwu()` 方法，从通义听悟格式转换并追加
- 实现 `getFullText()` 方法，获取完整文本
- 实现 `getRecentText(minutes)` 方法，获取最近N分钟文本
- 修改 `AudioRelayService`，在收到 `TranscriptionResultChanged` 消息时追加到 ContextStore
- 保留时间戳信息（startTime、endTime），不区分说话人
- **与现有 `SessionService` 的 `transcripts` Map 协作，不替换**

**现有相关代码：**
- `session.service.ts`: 已有 `transcripts` Map 存储转写段落
- `audio-relay.service.ts`: 已有 WebSocket 消息处理，需要在此处调用 ContextStore

**通义听悟返回格式：**
```json
{
  "header": {"name": "TranscriptionResultChanged", ...},
  "payload": {
    "result": "转写文本",
    "words": [{"startTime": 47231, "text": "主要", "endTime": 47839}, ...],
    "index": 2,
    "time": 51240
  }
}
```

**需求:** 需求1

---

### [2]. LLM 适配器模块（Qwen3-Max）

**具体要做的事情：**
- 安装 OpenAI SDK：`npm install openai`
- 创建 `LLMAdapter` 服务，封装 Qwen3-Max 调用
- 配置 OpenAI 兼容端点：`https://dashscope.aliyuncs.com/compatible-mode/v1`
- 实现 `chat()` 方法，支持多轮对话
- 实现 `chatWithPrompt()` 方法，支持系统提示词
- 实现 `chatStream()` 方法，支持流式输出
- 添加配置项：`DASHSCOPE_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL`
- 添加错误处理和重试机制
- 添加 token 使用量日志

**API 调用要点：**
```typescript
const client = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
});

await client.chat.completions.create({
  model: 'qwen3-max',
  messages: [...],
  temperature: 0.7,
  max_tokens: 2000,
});
```

**需求:** 需求2, 需求3, 需求4

---

### [3]. 技能服务重构

**具体要做的事情：**
- **重构** `SessionService.triggerSkill()` 方法，从通义听悟 CustomPrompt 切换到 Qwen3-Max
- 创建 `SkillService` 服务（`backend/src/modules/skill/skill.service.ts`）
- 实现三个技能的 Prompt 模板：
  - `inner_os`: 内心OS（洞察潜台词）
  - `brainstorm`: 头脑风暴（乔布斯风格）
  - `stop_talking`: 别再说了（纠偏功能）**← 新增**
- 从 ContextStore 获取上下文作为 Prompt 输入
- 解析 LLM 返回的 JSON，转换为前端可用的卡片格式
- 保持 API 端点不变：`POST /sessions/:id/skills/:skill`
- 前端新增 `stop_talking` 按钮（已有占位，需激活）

**现有相关代码：**
- `tingwu.service.ts`: `triggerCustomPrompt()` - 需要替换
- `session.service.ts`: `triggerSkill()` - 需要重构
- `HomeScreen.tsx`: 已有三个技能按钮，`stop_talking` 是占位

**需求:** 需求2

---

### [4]. 自动推送服务

**具体要做的事情：**
- 创建 `AutoPushService` 服务
- 实现定时器，每1分钟执行一次分析
- 实现 `startAutoAnalysis()` 和 `stopAutoAnalysis()` 方法
- 编写自动分析 Prompt（会议阶段、关键点、盲点、专家建议）
- 将分析结果存入 ContextStore 的消息流
- 添加 API 端点：`/auto-push/start`, `/auto-push/stop`
- 添加配置项：`AUTO_PUSH_INTERVAL_MS`, `AUTO_PUSH_ENABLED`

**需求:** 需求3

---

### [5]. 自由问答服务

**具体要做的事情：**
- 创建 `QAService` 服务
- 实现 `ask()` 方法，将问题与上下文一起发送给 LLM
- 保留问答历史到 ContextStore
- 添加 API 端点：`POST /sessions/:id/qa`
- 返回回答和消息ID

**需求:** 需求4

---

### [6]. 前端消息流与问答UI

**具体要做的事情：**
- 修改 HomeScreen，添加消息流列表组件
- 消息类型：技能结果、自动推送、问答
- 添加问答输入框组件
- 添加自动推送开关按钮
- **激活 `stop_talking` 按钮**（现有代码是占位：`onPress={() => {}}`）
- 轮询获取最新消息（复用现有轮询机制，间隔4秒）

**现有相关代码：**
- `HomeScreen.tsx`: 已有 `SkillButton` 组件和技能面板
- `handleSkillTrigger()`: 已有技能触发逻辑，需扩展支持 `stop_talking`
- `sessionApi`: 已有 API 调用封装

**需求:** 需求2, 需求3, 需求4

---

### [7]. 集成测试与调优

**具体要做的事情：**
- 端到端测试：录音 → 转写 → 技能触发 → 结果展示
- 测试自动推送时机和内容质量
- 测试问答准确性
- 调优 Prompt 模板
- 性能测试：长时间会议的上下文处理
- 文档更新

**需求:** 全部

---

## 执行顺序建议

```
[1] 上下文存储 → [2] LLM适配器 → [3] 技能服务 → [4] 自动推送 → [5] 问答服务 → [6] 前端UI → [7] 测试
```

任务 1-2 是基础设施，需要先完成；任务 3-5 可以并行开发；任务 6 依赖后端接口；任务 7 最后执行。

---

## 附录：现有代码结构参考

### 后端目录结构
```
backend/src/
├── modules/
│   ├── session/
│   │   ├── session.service.ts    # 会话管理、技能触发（需重构）
│   │   ├── session.controller.ts # API 端点
│   │   └── session.dto.ts
│   ├── tingwu/
│   │   ├── tingwu.service.ts     # 通义听悟 API 封装
│   │   └── audio-relay.service.ts # WebSocket 音频推送
│   └── task-poller/
│       └── poller.service.ts     # 轮询任务状态
└── shared/
    └── configuration.ts          # 配置项
```

### 前端目录结构
```
frontend/src/
├── screens/
│   └── HomeScreen.tsx            # 主界面（技能按钮、调试面板）
├── hooks/
│   ├── useRecorder.ts            # 录音 Hook（1秒分片）
│   └── useAudioUploader.ts       # 音频上传
├── api/
│   └── session.ts                # API 调用封装
├── store/
│   └── useSessionStore.ts        # Zustand 状态管理
└── components/
    ├── TranscriptionList.tsx
    └── SummaryList.tsx
```

### 关键配置项（backend/.env）
```env
# 已有
TINGWU_APP_KEY=xxx
TINGWU_ACCESS_KEY_ID=xxx
TINGWU_ACCESS_KEY_SECRET=xxx
POLLING_INTERVAL_MS=5000

# V1 新增
DASHSCOPE_API_KEY=xxx
LLM_MODEL=qwen3-max
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
AUTO_PUSH_INTERVAL_MS=60000
AUTO_PUSH_ENABLED=true
```

---

**请确认以上任务拆分是否合理，确认后我将开始执行任务。**
