# 会议快照 MVP

这是一个使用 React Native（前端）和 NestJS（后端）开发的「会议快照」最小可行产品。项目复刻了参考 App 的深色界面，通过阿里云通义听悟实现实时语音转写、AI 摘要、内心 OS、头脑风暴等功能。

## 目录结构

```
frontend/   # Expo React Native 客户端
backend/    # NestJS 服务端（通义听悟代理、轮询、技能触发）
specs/      # 需求、设计、任务分解、QA 说明
```

## 功能亮点
- **界面复刻**：录音面板、实时转写/AI 总结标签、技能按钮布局与参考图一致。
- **实时推流**：单 WebSocket 连接完成 16k PCM 音频推送与增量转写下行。
- **兜底轮询**：后端每 5 秒调用通义听悟任务查询，补齐转写与摘要并持久化。
- **AI 能力**：展示全文摘要、发言总结、关键词、章节速览；支持一键触发内心 OS、头脑风暴。
- **完整文档**：需求、技术方案、实施计划、API 要求、QA checklist 已整理。

## 准备工作
- Node.js ≥ 18，npm ≥ 9
- 全局安装 Expo CLI（`npm install -g expo-cli`，可选）
- 阿里云通义听悟账号，并获取 AccessKeyId/Secret、AppKey
- Android 或 iOS 模拟器，或实体设备安装 Expo Go

## 后端运行（`backend/`）

```bash
cd backend
npm install
```

在项目根目录创建 `.env`（或使用系统环境变量）：

```
PORT=4000
TINGWU_REGION=cn-beijing
TINGWU_ACCESS_KEY_ID=你的AK
TINGWU_ACCESS_KEY_SECRET=你的Secret
TINGWU_APP_KEY=你的AppKey
POLLING_INTERVAL_MS=5000
```

启动服务：

```bash
npm start
```

开放接口：
- `POST /sessions` → 创建实时任务，返回 `{ sessionId, taskId, meetingJoinUrl }`
- `GET /sessions/:id/transcripts` → 获取当前会话的转写段落
- `GET /sessions/:id/summaries` → 获取 AI 摘要/要点/章节等卡片
- `POST /sessions/:id/skills/:skillType` → 触发自定义技能（`inner_os` / `brainstorm`）

## 前端运行（`frontend/`）

```bash
cd frontend
npm install
```

设置后端地址（`.env` 或命令行）：

```
EXPO_PUBLIC_API_URL=http://localhost:4000
```

启动 Expo：

```bash
npm run start
```

使用 Expo Go 或模拟器扫码打开。操作流程：
1. 点击“开始录制”后，App 会推流音频并实时刷新“实时转写”。
2. 切换到“AI总结”标签，可查看通义听悟返回的摘要、要点、章节。
3. 点击“内心OS”或“头脑风暴”，约 5–10 秒生成卡片并显示在摘要列表。

## QA 验收
详细流程见 `specs/spec_product/qa.md`，主要包括：
1. 界面截图与参考图比对（录音状态、转写列表、总结卡片）。
2. 检查后端日志（任务创建、轮询成功、技能触发）。
3. 端到端测试：录音 30 秒 → 实时转写刷新 → AI 总结更新 → 技能卡片生成。
4. 重启前端后调用 API，确认历史转写/摘要可恢复。

## 文档索引
- 需求：`specs/spec_product/requirement.md`
- 技术方案：`specs/spec_product/design.md`
- 任务拆分：`specs/spec_product/tasks.md`
- API 对齐：`specs/spec_mvp/llm_api_requirements.md`
- QA 计划：`specs/spec_product/qa.md`

## 后续计划
- 使用真实凭据联调并观察费用/限流策略。
- 若需发布正式安装包，可使用 Expo EAS Build 生成 APK/IPA。
- 增强断线重连、错误提示、数据持久化（替换内存存储为数据库）。

如需扩展自定义技能或离线补录，可在 `TingwuService` 中追加参数配置。欢迎根据业务需求继续迭代。

## 浏览器音频测试工具

为方便在电脑端排查“前端采集”与“后端推流”问题，新增了一个纯前端测试页：

- 文件位置：`tools/web-audio-tester/index.html`
- 打开方式：直接在浏览器中打开该文件，或运行 `npx serve tools/web-audio-tester` 提供本地静态服务
- 使用步骤：
  1. 启动后端（需运行在 `http://localhost:4000` 或自行修改页面中的“后端地址”）
  2. 点击“创建实时任务”获取 `sessionId / taskId`
  3. 选择任意音频文件（支持 AAC/M4A/WAV 等），设置分片大小与间隔，点击“开始推流”
  4. 推流完成后可点击“获取转写 / 摘要”查看后端轮询结果，并根据日志排查问题

该页面会把音频文件分片为 Base64 后调用 `/sessions/:id/audio`，流程与移动端一致，可用于定位阿里云侧异常或验证不同音频格式的兼容性。
