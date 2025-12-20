# 实施计划 - 会议快照前端重构

## 任务总览

- 总任务数：7 + 4（Bug修复）
- 预计工时：4-6 小时
- 优先级：按顺序执行

---

- [x] 1. **CSS 设计系统重构** ✅
  — 删除现有 CSS 变量和样式
  — 实现"墨纸"主题配色系统
  — 配置字体系统（思源宋体/黑体）
  — 定义动画缓动曲线和时长变量
  — 添加纸张纹理背景效果
  — 需求: 需求 5

- [x] 2. **录制控制栏重构** ✅
  — 删除现有 `.recording-card` 大区块
  — 创建紧凑型 `.recording-bar` 组件（高度 72px）
  — 实现内联波形动画
  — 将文件上传按钮整合到控制栏右侧
  — 更新 `updateRecordingUI()` 函数适配新结构
  — 需求: 需求 1, 需求 7

- [x] 3. **双栏布局实现** ✅
  — 删除现有 Tab 切换逻辑
  — 创建 CSS Grid 双栏布局
  — 左栏：实时转写面板
  — 右栏：会议洞察面板（原"AI 总结"）
  — 实现独立滚动区域
  — 需求: 需求 2, 需求 3

- [x] 4. **洞察卡片组件重构** ✅
  — 创建 `.insight-card` 组件样式
  — 实现类型映射（中文标题 + 图标）
  — 实现荧光笔高亮效果（`.highlight` 类）
  — 实现引用样式（内心 OS 类型）
  — 实现编号列表样式（头脑风暴类型）
  — 实现警告边框样式（纠偏提醒类型）
  — 修改 `renderSummaries()` 函数
  — 修改 `formatContent()` 函数支持高亮
  — 需求: 需求 3, 需求 4

- [x] 5. **工具栏优化** ✅
  — 重构 AI 技能按钮为图标按钮组
  — 添加 Tooltip 提示
  — 优化问答区域布局
  — 调整视觉化功能区域
  — 需求: 需求 6

- [x] 6. **响应式适配** ✅
  — 实现 >= 1400px 三栏布局
  — 实现 1024px - 1399px 双栏 + 浮动工具栏
  — 实现 < 1024px 单栏 + 底部 Tab
  — 测试各断点切换效果
  — 需求: 需求 8

- [x] 7. **功能验证与调试** ✅
  — 验证后端连接功能
  — 验证录音/暂停/停止功能
  — 验证实时转写显示
  — 验证 AI 技能触发
  — 验证文件上传功能
  — 验证问答功能
  — 验证视觉化生成
  — 修复发现的问题
  — 需求: 全部

---

## Bug 修复（2025-12-20）

- [x] 8. **修复洞察卡片内容显示Bug** ✅
  — 问题：后端返回 `[{quote, innerThought, emotion}]` 对象数组
  — 原因：`formatInsightContent` 函数将数组元素当字符串处理
  — 修复：新增 `formatInsightObject` 函数，按类型定制显示格式
  — 支持 inner_os（引用+内心想法+情绪标签）、brainstorm（想法列表）、stop_talking（警告+建议）

- [x] 9. **优化会议问答区域布局** ✅
  — 问题：问答区域太窄（max-height: 160px）
  — 修复：将工具栏改为横向布局，问答区域扩大到 280px
  — 新增 `.qa-section-wrapper` 独立样式
  — 三栏横向排列：AI技能 | 视觉化 | 问答

- [x] 10. **添加滚动窗口优化** ✅
  — 问题：实时转写和会议洞察内容过多时拖长页面
  — 修复：面板固定高度 480px，支持 CSS resize 调整
  — 新增滚动到底部按钮（自动显示/隐藏）
  — 新增 `setupScrollListeners` 和 `scrollToBottom` 函数
  — 智能滚动：如果用户在底部，新内容自动滚动；否则保持位置

- [x] 11. **其他设计优化** ✅
  — 新增情绪标签样式 `.insight-emotion-tag`
  — 问答消息支持自动换行 `white-space: pre-wrap`
  — 面板添加 `flex-shrink: 0` 防止头部被压缩

---

## 执行注意事项

### 代码保护清单

以下函数/变量**禁止修改**：

```javascript
// State
const state = { ... }

// API
async function apiCall(method, path, body)
async function testConnection()

// Recording
async function startRecording()
async function stopRecording()
function togglePause()

// Skills
async function triggerSkill(skill)
async function toggleAutoPush()

// Upload
async function uploadAndTranscribe()

// QA
async function askQuestion()
function handleQAKeypress(event)

// Polling
function startPolling()
function stopPolling()
async function pollUpdates()

// Visualization
async function generateVisualization()
function displayVisualization(result)
function viewVisualization(visId)
function downloadVisualization(visId)
function shareVisualization(visId)

// Utilities
function blobToBase64(blob)
function formatTime(ms)
function escapeHtml(text)
function showToast(message, type)
```

### 可修改函数

```javascript
// 需要修改以适配新 DOM 结构
function updateRecordingUI()
function renderTranscription()
function renderSummaries()
function formatContent(content)
function updatePanelContent()
function updateConnectionStatus(status)
function enableControls(enabled)
```

### DOM 元素映射

旧元素 ID → 新元素 ID（需更新 `elements` 对象）：

| 旧 ID | 新 ID | 说明 |
|-------|-------|------|
| recordingStatus | recordingBar | 控制栏容器 |
| transcriptionList | transcriptPanel | 转写面板 |
| summaryList | insightPanel | 洞察面板 |
| - | insightList | 洞察卡片列表 |

---

## 验收检查清单

- [ ] 页面加载无 JS 错误
- [ ] 后端连接状态正确显示
- [ ] 录音功能完整可用
- [ ] 实时转写正常显示
- [ ] AI 技能触发正常
- [ ] 洞察卡片格式正确
- [ ] 高亮效果清晰可见
- [ ] 文件上传功能正常
- [ ] 问答功能正常
- [ ] 视觉化功能正常
- [ ] 响应式布局正确
- [ ] 动画流畅无卡顿
- [ ] 字体正确加载
- [ ] 配色符合设计规范
