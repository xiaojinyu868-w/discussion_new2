# 需求文档：会议快照 MVP 前端复刻与语音 AI 集成

## 介绍
本需求文档描述会议快照 MVP 的首阶段目标：完整复刻参考产品（截图）中的前端视觉与交互，并接入阿里通义听悟实时语音转写及大模型能力，实现实时转写、AI 总结、内心 OS、头脑风暴等功能。交付后，产品应具备与参考界面一致的用户体验，并通过通义听悟 API 获取语音与 AI 输出。

## 需求

### 需求 1 - 前端界面复刻

**用户故事：** 作为使用者，我希望应用界面与参考产品保持一致，以便快速上手并获得熟悉的操作体验。

#### 验收标准
1. While 用户打开会话页面，when 页面完成渲染，the 会议快照 App shall 显示与参考截图一致的深色顶部录音面板（含波形、计时器、录制按钮状态）。
2. While 页面渲染完成，when 用户查看标签区域，the 会议快照 App shall 呈现“实时转写”“AI总结”双标签，视觉样式、字体、间距需与参考产品一致。
3. While 用户滚动内容区，when 浏览会话文本，the 会议快照 App shall 使用米黄色背景与圆角气泡展示转写内容，并支持时间戳与展开按钮交互。
4. While 用户查看页面底部，when 需要触发 AI 能力，the 会议快照 App shall 展示“内心OS”“头脑风暴”“别再说了”等快捷按钮，按钮布局、图标、交互反馈与参考一致。

### 需求 2 - 实时语音推流与转写

**用户故事：** 作为会议记录者，我希望应用能将实时音频发送至通义听悟并返回转写内容，从而在会议进行中看到即时文字。

#### 验收标准
1. While 用户点击“开始录制”按钮，when 录音状态切换为进行中，the 会议快照 App shall 通过单一 WebSocket 连接将 16k PCM 音频流推送至 `MeetingJoinUrl`，并保持连接稳定。
2. While 通义听悟通过 WebSocket 下行推送增量转写片段，when 客户端接收到数据，the 会议快照 App shall 在 1 秒内更新“实时转写”标签文本，保留说话人标识与时间戳，并以流式方式追加内容。
3. While 任务处于进行中，when 后端触发兜底同步，the 会议快照 后端 shall 每 5 秒轮询 `GET /openapi/tingwu/v2/tasks/{TaskId}` 校验并补齐遗漏片段，同时记录 TaskId、耗时与错误码。

### 需求 3 - AI 总结与要点呈现

**用户故事：** 作为用户，我希望在会议进行时实时查看 AI 生成的摘要、关键词和行动项，便于快速理解重点。

#### 验收标准
1. While 实时记录任务开启，when 通义听悟通过 WebSocket 或轮询结果返回 `Summarization` 数据，the 会议快照 App shall 在“AI总结”标签中按照 Paragraph、Conversational 分类实时滚动展示，并显示更新时间。
2. While 接口返回 `MeetingAssistance`（关键词、待办等），when 数据写入完成，the 会议快照 App shall 将其以卡片形式展示在摘要区域，并支持折叠展开与时间戳标记。
3. While 章节速览功能开启，when 接收到 `AutoChapters` 输出，the 会议快照 App shall 按时间顺序显示议程标题与简介，并在内容新增时发送轻量提示。

### 需求 4 - 自定义技能（内心 OS / 头脑风暴）

**用户故事：** 作为用户，我希望通过一键触发“内心 OS”或“头脑风暴”，获得情绪洞察与创意建议。

#### 验收标准
1. While 用户点击“内心OS”按钮，when 后端构造 `CustomPrompt` 请求，the 会议快照 后端 shall 在请求体中携带内心 OS Prompt 模板并标记 `ContextWindowMinutes = 2`，同时确保其他自定义提示词关闭。
2. While 通义听悟返回“内心 OS”结果，when 数据可用，the 会议快照 App shall 将 JSON 数组解析为 3 条情绪卡片（含 emotion 与 thought 字段），并展示在对话流中。
3. While 用户点击“头脑风暴”按钮，when 后端发起 `CustomPrompt` 请求，the 会议快照 后端 shall 传递头脑风暴 Prompt（context window 5 分钟），并在 10 秒内将结果写入对话流，卡片需包含 idea、rationale、references。
4. While 任一技能请求进行中，when 用户重复点击同一按钮，the 会议快照 App shall 提供加载态并阻止重复请求，直到返回结果或超时。
