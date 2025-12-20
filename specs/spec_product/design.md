# 技术方案：会议快照 MVP 前端复刻与语音 AI 集成

## 1. 概述
本方案基于既有会议快照架构，聚焦前端 UI 复刻与通义听悟实时语音/大模型能力接入。系统包含 React Native 客户端、Node.js 后端服务以及通义听悟云服务。客户端负责录音、推流与界面渲染；后端负责任务管理、API 调用、数据持久化。

## 2. 整体架构
```mermaid
flowchart LR
    subgraph Client[React Native App]
        Recorder[音频采集器]
        UI[会话界面\n(实时转写/AI总结)]
        SkillPanel[技能按钮区]
    end

    subgraph Backend[NestJS 服务]
        SessionSvc[Session Service]
        TingwuProxy[通义听悟代理]
        TaskPoller[任务轮询器]
        Store[(PostgreSQL)]
    end

    subgraph Tingwu[通义听悟云]
        RealtimeAPI[/Realtime Task/]
        OfflineAPI[/Offline Task/]
    end

    Recorder -- WebSocket --> RealtimeAPI
    UI <-- WebSocket --> RealtimeAPI
    SkillPanel -- HTTPS --> SessionSvc
    UI -- HTTPS --> SessionSvc
    SessionSvc --> Store
    SessionSvc --> TingwuProxy
    TingwuProxy --> RealtimeAPI
    TingwuProxy --> OfflineAPI
    TaskPoller --> RealtimeAPI
    TaskPoller --> SessionSvc
    SessionSvc --> UI
```

## 3. 技术选型
- **客户端**：React Native + Expo；UI 采用 Styled Components 还原深色主题，Reanimated 用于波形与过渡。音频采集使用 `react-native-webrtc` 或 `expo-av`（需支持 16k PCM 输出）；下行数据通过同一 WebSocket 处理增量转写。
- **后端**：NestJS + TypeScript；HTTP 客户端使用 Axios；WebSocket 推流采用 `ws` 库；任务轮询基于 BullMQ + Redis。
- **存储**：PostgreSQL 存储会话、转写段落、AI 卡片；Redis 用于轮询任务和技能请求去重。
- **第三方**：阿里通义听悟 API（实时任务、离线任务、自定义 Prompt）。

## 4. 模块设计
### 4.1 客户端
- **录音模块**：采集 16k PCM；负责连接 `MeetingJoinUrl`，按帧发送音频；处理断线重连与心跳保活。
- **下行处理模块**：监听 WebSocket 下行消息，解析增量 `Transcription`、`Summarization`、`MeetingAssistance`，按消息序列号写入本地 store，并驱动 UI 流式刷新。
- **界面模块**：复刻顶部录音卡、双标签页、米黄色转写气泡、底部技能按钮；状态管理使用 Zustand 保存任务状态与最新转写/摘要。
- **技能触发**：点击按钮调用后端 `POST /sessions/{id}/skills/{type}`，展示加载动效，等待响应。

### 4.2 后端服务
- **Session Service**：创建实时任务、保存 TaskId、向客户端下发 `MeetingJoinUrl`；提供轮询数据接口供前端刷新。
- **TingwuProxy**：封装实时、离线、CustomPrompt 调用；统一鉴权、日志、错误映射。
- **TaskPoller**：每 5 秒调用 `GET /openapi/tingwu/v2/tasks/{TaskId}`，用于兜底同步 `Transcription`、`Summarization`、`MeetingAssistance`、`AutoChapters`、`CustomPrompt` 等字段，确保持久化完整。
- **WebSocket Relay（可选）**：当客户端网络受限时，提供服务端中转 WebSocket；默认直接由客户端连接官方服务。
- **Skill Controller**：处理内心 OS/头脑风暴请求，根据配置选择对应 Prompt 模板，写入 `custom_prompt_requests` 表，异步等待结果。

## 5. 数据模型（简化）
```text
sessions
  id uuid
  task_id text
  status text
  created_at timestamp

transcripts
  id uuid
  session_id uuid
  speaker_id text
  start_ms int
  end_ms int
  text text

summary_cards
  id uuid
  session_id uuid
  type text  -- paragraph/conversational/keywords/todo/etc
  payload jsonb
  created_at timestamp

custom_prompt_results
  id uuid
  session_id uuid
  prompt_type text  -- inner_os / brainstorming
  payload jsonb
  created_at timestamp
```

## 6. 接口设计
- `POST /sessions`：创建实时任务，返回 `TaskId`、`MeetingJoinUrl`。
- `POST /sessions/{id}/skills/{type}`：触发自定义 Prompt（type=inner_os|brainstorm），防重逻辑依赖 Redis 锁。
- `GET /sessions/{id}/transcripts` / `GET /sessions/{id}/summaries`：供前端轮询获取最新内容。
- `POST /sessions/{id}/complete`：结束任务，触发离线补录。

## 7. 测试策略
- **单元测试**：对 TingwuProxy 参数构造、Prompt 模板填充、轮询解析进行覆盖。
- **集成测试**：模拟通义听悟返回数据，验证转写更新与前端渲染 API。
- **端到端测试**：使用本地音频推流脚本，验证实时转写、摘要、技能卡片完整链路。
- **UI 对齐测试**：创建截图对比（Storybook 截图或 Detox 自动化）确保颜色、字体、布局一致。

## 8. 安全与监控
- AccessKey 保存在服务端环境变量；请求全程 HTTPS。
- 记录 API 调用耗时、错误码；设置超时重试与熔断。
- 前端与后端通信需携带用户身份 Token，避免未授权访问。
- **数据流节奏**：
  - 前端推流与下行：单 WebSocket 持续发送音频帧并接收增量结果（<1 秒 UI 刷新）。
  - 后端轮询：5 秒一次，校验数据完整并写库。
  - 自定义技能：即时 HTTP 调用，设定 10 秒超时。
