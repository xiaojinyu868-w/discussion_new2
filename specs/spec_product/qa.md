# QA 与对齐验证计划

## 1. 界面对齐
- 启动前端 `expo start --android/--ios`，进入 demo 会话。
- 使用模拟器系统截图功能捕获以下界面：
  1. 录音面板（未录制、录制中两种状态）。
  2. “实时转写”标签展示转写气泡。
  3. “AI 总结”标签展示摘要卡片、内心 OS/头脑风暴卡片。
- 与参考截图比对（建议导入 Figma 或使用 `pixelmatch` 脚本）。若存在偏差，记录颜色/字体/间距差异并回归调整。

## 2. API 调试与日志
- 在后端配置真实 `TINGWU_ACCESS_KEY_ID/SECRET`、`TINGWU_APP_KEY` 后运行 `npm start`。
- `SessionService` 和 `TingwuService` 默认打印关键日志（任务创建、轮询成功/失败、技能触发）。使用 `tail -f logs/app.log` 或控制台观察：
  - 实时任务创建成功日志（含 TaskId）。
  - 轮询成功日志（至少出现一次转写与摘要更新）。
  - 自定义 Prompt 成功日志（inner_os/brainstorm）。
- 遇到失败日志需记录请求和错误码，并验证网络/凭据。

## 3. 推流端到端测试
- 运行前端录音，在 30 秒内发言，确认：
  1. WebSocket 下行实时更新转写（1 秒内出现新内容）。
  2. 后端轮询能在数据库/内存 map 中补全段落。
  3. 触发“内心 OS”“头脑风暴”后，10 秒内新增卡片落入 `summaryCards`。
- 如需自动化，可使用 Node 脚本推送本地 PCM 文件到 `MeetingJoinUrl`（参考 `ws` 发送 `Buffer`），并定时调用 `/sessions/{id}/transcripts` 校验。

## 4. 回归清单
| 项目 | 验证方式 | 结果记录 |
| --- | --- | --- |
| UI 颜色/布局对齐 | 截图对比 |  |
| 音频推流成功 | 控制台日志 & 实时转写刷新 |  |
| 摘要 & 要点 | “AI总结”卡片刷新时间 < 5s |  |
| 内心 OS 卡片 | 点击后出现 3 条情绪洞察 |  |
| 头脑风暴卡片 | 点击后出现 3 条创意，含 references |  |
| 兜底轮询 | 重启前端后拉取历史数据成功 |  |

完成以上检查后，在 `specs/spec_product/tasks.md` 中标记 QA 任务已完成。***
