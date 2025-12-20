# 调用大模型与语音服务需求对齐文档（阿里通义听悟）

## 1. 目标
- 使用通义听悟开放接口完成会议场景的实时语音采集、转写、说话人识别，以及自动纪要/要点/头脑风暴等大模型能力。
- 输出本对齐文档后，研发只需获得有效的 API 访问凭据（AccessKeyId/Secret + AppKey）即可串联整个流程。

## 2. 接入范围
1. **实时记录接口**（`PUT /openapi/tingwu/v2/tasks?type=realtime`）  
   - 用于会议过程中获取实时转写结果、说话人区分、以及章节速览、要点提炼、摘要、头脑风暴等能力。  
   - 需确认是否全量开启以下功能开关：`AutoChapters`, `MeetingAssistance`, `Summarization (Paragraph, Conversational, QuestionsAnswering, MindMap)`, `CustomPrompt`（用于内心 OS/头脑风暴）、`Translation`（如需实时翻译）。  
2. **离线语音转写接口**（`PUT /openapi/tingwu/v2/tasks?type=offline`）  
   - 用于会议结束后的补录或历史音频文件转写，保证与实时结果一致的格式和说话人信息。  
3. **说话人分离**（语音转写参数中的 `Transcription.DiarizationEnabled`）  
   - 需确认默认开关状态与预估说话人数策略（`SpeakerCount = 0` 表示自动判定，`>0` 为限人数）。  

## 3. 请求参数与默认值建议
- **鉴权信息**  
  - AccessKeyId / AccessKeySecret：需由平台方提供，配置为环境变量。  
  - AppKey：从通义听悟控制台获取，请确认是否使用同一个 AppKey 覆盖实时/离线两类任务。  
  - Region：默认 `cn-beijing`（若使用其他区域需提前说明）。  
- **公共输入（`body.Input`）**  
  | 字段 | 默认值 | 说明 |
  | --- | --- | --- |
  | `Format` | `pcm` | 需确保客户端推流或上传的音频编码一致。 |
  | `SampleRate` | `16000` | 推荐统一 16k 采样率。 |
  | `SourceLanguage` | `cn` | MVP 阶段仅支持中文转写。后续如需多语种再改为 `multilingual` 并配置 `LanguageHints`。 |
  | `TaskKey` | 自定义唯一值 | 前端需提供，用于任务幂等与追踪。 |
  | `ProgressiveCallbacksEnabled` | `false` | 若需回调，需同步回调地址与鉴权方式。 |
- **语音识别参数（`Parameters.Transcription`）**  
  - `OutputLevel = 2`（实时返回中间结果 + 完整句子）。  
  - `DiarizationEnabled = true`。  
  - `Diarization.SpeakerCount`：建议默认 `0`（自动判定）；若需要限制固定人数请告知。  
  - `PhraseId`：如需自定义热词表，需要产品侧提供词表 ID。  
  - `Model`：当前可选 `domain-automotive` / `domain-education`。确认是否使用默认通用模型或特定领域模型。  
- **翻译参数（可选）**  
  - `TranslationEnabled = false`（本阶段不启用实时翻译）。  
- **大模型能力开关**（基于需求 2、头脑风暴/内心 OS 功能）：  
  | 能力 | 参数 | 说明 |
  | --- | --- | --- |
  | 章节速览 | `AutoChaptersEnabled` | 生成议程标题/摘要。 |
  | 要点提炼 | `MeetingAssistanceEnabled` | 输出关键词、行动项、重点内容等。 |
  | 摘要总结 | `SummarizationEnabled` + `Summarization.Types` | 需至少包含 `Paragraph`（全文摘要）和 `Conversational`（发言总结）；若使用问答回顾/思维导图需一并开启。 |
  | 自定义提示词 | `CustomPromptEnabled` + `CustomPrompt` | 用于“内心 OS”“头脑风暴”自定义输出，需确认提示词样式和上下文拼接规则。 |
  | 口语书面化 | `TextPolishEnabled` | 如需输出更书面化文本。 |
  | 服务质检 | `ServiceInspectionEnabled` | 如会议无质检需求，可关闭。 |

## 4. 返回结果与数据落地
- 实时记录创建成功将返回 `TaskId` 与 `MeetingJoinUrl`：  
  - 返回的 `MeetingJoinUrl` 采用官方 WebSocket 协议；由我们客户端推送实时音频流到此 URL。  
- 结果查询  
  - 轮询接口：`GET /openapi/tingwu/v2/tasks/{TaskId}`。  
  - MVP 阶段不启用回调；由服务端主动轮询 `GET /openapi/tingwu/v2/tasks/{TaskId}`，推荐间隔 3 秒。  
- 关键字段对接  
  | 字段 | 用途 | 备注 |
  | --- | --- | --- |
  | `Transcription.Paragraphs` | 实时/离线转写的段落结构，用于前端转写视图。 | 包含 `SpeakerId`、字级时间戳。 |
  | `Transcription.AudioSegments` | 有效音频片段范围 | 可用于静音检测或质量分析。 |
  | `Summarization` / `MeetingAssistance` / `AutoChapters` 输出 | 映射到 AI 总结标签页及技能卡片。 | 需确认 JSON 结构并制定存储 schema。 |
  | `CustomPrompt` 产出 | 作为“内心 OS”“头脑风暴”消息来源。 | 需定义字段与 UI 映射。 |

## 5. 安全与运维要求
- API 调用需全程使用 HTTPS。  
- AccessKey 需保存在服务端安全存储，不在客户端暴露。  
- 若需要配置 IP 白名单 / VPC，需提前提供访问出口信息。  
- 需确认接口限流策略（QPS、并发数）；若超限时的降级方案（排队/回退离线）。  
- 日志：保留请求与响应的摘要信息（含 TaskId、请求参数、耗时、错误码），用于追溯。  

## 6. 待确认事项清单
1. 实时翻译：`TranslationEnabled = false`。  
2. 内心 OS / 头脑风暴 Prompt：由产品提供固定模板，见文档附录。  
3. 说话人识别：保持 `DiarizationEnabled = true`，`SpeakerCount = 0`（自动判定）。  
4. 摘要策略：实时阶段获取大模型摘要（无需另启离线任务）。  
5. 接入方式：客户端推送实时音频流到 `MeetingJoinUrl`。  
6. 并发与配额：MVP 阶段不做配额限制，后续接入监控。  
7. 回调：暂不启用，统一采用轮询方式获取结果。  

## 7. Prompt 样例（产品提供）
- **内心 OS**  
  - `CustomPromptEnabled = true`  
  - `CustomPrompt` 示例：  
    ```json
    {
      "Title": "内心OS",
      "Prompt": "基于最近2分钟的发言内容，用第一人称补全3条内心独白，聚焦情绪和潜在顾虑。输出JSON数组，每条包含\"emotion\"和\"thought\"字段。",
      "ContextWindowMinutes": 2
    }
    ```
- **头脑风暴**  
  - `CustomPromptEnabled = true`（与内心 OS 互斥时需在请求里选择其一）  
  - `CustomPrompt` 示例：  
    ```json
    {
      "Title": "头脑风暴",
      "Prompt": "结合最近5分钟对话与会议历史要点，生成不少于3条行动思路，格式为JSON数组，每条含\"idea\"、\"rationale\"、\"references\"（引用的历史要点ID列表）。",
      "ContextWindowMinutes": 5
    }
    ```
> 产品可在此基础上继续修改字段、语气或输出结构。若后续需要同时请求多种自定义提示词，可在应用层轮询调用。


> 编辑提示：请在以上各小节中补充具体开关取值、热词表 ID、Prompt 样例等信息，确认后即可指导后端完成 API 封装与联调。
