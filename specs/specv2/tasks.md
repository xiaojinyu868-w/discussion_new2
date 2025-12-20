# 实施计划: 会议快照 V2 - 视觉化共识

## 任务总览

| 编号 | 任务 | 状态 | 需求 |
|------|------|------|------|
| 1 | Gemini Imagen API 调研与集成 | ✅ 已完成 | 需求1 |
| 2 | 图像生成适配器模块 | ✅ 已完成 | 需求1 |
| 3 | 结构化数据提取服务 | ✅ 已完成 | 需求2 |
| 4 | 创意图像描述生成服务 | ✅ 已完成 | 需求3 |
| 5 | 视觉化服务核心模块 | ✅ 已完成 | 需求1,2,3 |
| 6 | 视觉化内容管理 | ✅ 已完成 | 需求4 |
| 7 | 前端视觉化UI组件 | ✅ 已完成 | 需求1,4 |
| 8 | 集成测试与调优 | ⬜ 待开始 | 全部 |

---

## 详细任务

### [1]. Nano Banana Pro API 调研与集成

**具体要做的事情：**
- [查阅Gemini Nano Banana Pro API 调研与集成](https://ai.google.dev/gemini-api/docs/image-generation?hl=zh-cn)
- 确认 Nano Banana Pro 模型的 API 调用方式
- 确认 API 端点地址、认证方式、请求参数格式
- 确认响应格式（图像URL或Base64）
- 确认支持的图像尺寸、格式、质量参数
- 确认是否需要单独的 API Key 或可复用 DASHSCOPE_API_KEY
- 编写 API 调用测试脚本，验证基本功能
- 记录 API 文档和调用示例

**输出物：**
- API 调用文档（Markdown格式）
- 测试脚本（`backend/temp-image-gen-test.ts`）
- 配置项说明（更新到 design.md）

**需求:** 需求1

---

### [2]. 图像生成适配器模块 ✅

**具体要做的事情：**
- ✅ 创建 `ImageGenerationAdapter` 服务（`backend/src/modules/image-gen/image-generation-adapter.service.ts`）
- ✅ 创建 `ImageGenModule` 模块（`backend/src/modules/image-gen/image-gen.module.ts`）
- ✅ 实现 `generate()` 方法，封装 Google Imagen API 调用
- ✅ 实现请求参数构建（prompt、size、aspect_ratio等）
- ✅ 实现响应处理（提取图像Base64，支持多种响应格式）
- ✅ 添加错误处理和日志记录
- ✅ 添加配置项：`GEMINI_API_KEY`, `IMAGE_GEN_MODEL`, `IMAGE_GEN_BASE_URL`
- ✅ 添加默认参数配置：`IMAGE_GEN_SIZE`, `IMAGE_GEN_FORMAT`, `IMAGE_GEN_QUALITY`
- ✅ 更新 `shared/configuration.ts`，添加图像生成配置

**现有相关代码：**
- ✅ `llm-adapter.service.ts`: 参考LLM适配器的实现方式
- ✅ `shared/configuration.ts`: 已添加图像生成配置项

**需求:** 需求1

---

### [3]. 结构化数据提取服务 ✅

**具体要做的事情：**
- ✅ 创建 `DataExtractionService` 服务（`backend/src/modules/data-extraction/data-extraction.service.ts`）
- ✅ 创建 `DataExtractionModule` 模块（`backend/src/modules/data-extraction/data-extraction.module.ts`）
- ✅ 实现 `extractChartData()` 方法，从会议文本提取结构化数据
- ✅ 实现不同图表类型的数据提取：
  - ✅ 雷达图：提取维度和数值
  - ✅ 流程图：提取节点和连接关系
  - ✅ 架构图：提取组件和层级关系
  - ✅ 柱状图/折线图：提取时间序列或分类数据（通用方法）
- ✅ 实现 `toChartPrompt()` 方法，将结构化数据转换为图表生成提示词
- ✅ 编写不同图表类型的 Prompt 模板（中文，符合NeurIPS风格）
- ✅ 实现数据提取失败的错误处理

**Prompt 模板设计：**
- ✅ 雷达图提取 Prompt
- ✅ 流程图提取 Prompt
- ✅ 架构图提取 Prompt
- ✅ 柱状图/折线图提取 Prompt（通用）
- ✅ 图表生成 Prompt 转换逻辑（符合NeurIPS/ICLR风格）

**现有相关代码：**
- ✅ `llm-adapter.service.ts`: 复用LLM调用能力
- ✅ `context-store.service.ts`: 获取会议文本流

**需求:** 需求2

---

### [4]. 创意图像描述生成服务 ✅

**具体要做的事情：**
- ✅ 在 `DataExtractionService` 中实现 `generateCreativePrompt()` 方法
- ✅ 在 `DataExtractionService` 中实现 `generatePosterPrompt()` 方法
- ✅ 编写创意图像描述生成 Prompt 模板（中文）
- ✅ 编写逻辑海报描述生成 Prompt 模板（中文）
- ✅ 实现描述转换逻辑（将中文描述转换为符合Imagen API要求的Prompt格式）
- ✅ 添加描述生成失败的错误处理

**Prompt 模板设计：**
- ✅ 创意图像描述生成 Prompt（提取情绪、愿景、关键观点）
- ✅ 逻辑海报描述生成 Prompt（提取要点、逻辑关系、布局设计）
- ✅ 两步流程：LLM生成中文描述 → 转换为Imagen API格式

**现有相关代码：**
- ✅ `llm-adapter.service.ts`: 复用LLM调用能力
- ✅ `context-store.service.ts`: 获取会议文本流

**需求:** 需求3

---

### [5]. 视觉化服务核心模块 ✅

**具体要做的事情：**
- ✅ 创建 `VisualizationService` 服务（`backend/src/modules/visualization/visualization.service.ts`）
- ✅ 创建 `VisualizationModule` 模块（`backend/src/modules/visualization/visualization.module.ts`）
- ✅ 实现 `generateVisualization()` 方法，协调数据提取和图像生成
- ✅ 实现不同类型视觉化的处理逻辑：
  - ✅ 图表类型：调用数据提取 → 转换为图表Prompt → 生成图像
  - ✅ 创意图像类型：生成描述Prompt → 生成图像
  - ✅ 逻辑海报类型：生成描述Prompt → 生成图像
- ✅ 实现结果保存到内存存储和消息流
- ✅ 实现视觉化结果的数据结构定义
- ✅ 添加生成失败的错误处理和日志记录

**现有相关代码：**
- ✅ `context-store.service.ts`: 保存视觉化结果到消息流
- ✅ `data-extraction.service.ts`: 调用数据提取服务
- ✅ `image-generation-adapter.service.ts`: 调用图像生成适配器

**需求:** 需求1, 需求2, 需求3

---

### [6]. 视觉化内容管理 ✅

**具体要做的事情：**
- ✅ 在 `SessionService` 中添加视觉化内容管理方法
- ✅ 实现 `getVisualizations()` 方法，获取会话的所有视觉化内容
- ✅ 实现 `getVisualization()` 方法，获取单个视觉化内容详情
- ✅ 实现 `getVisualizationImage()` 方法，获取图像数据（Base64）
- ✅ 在 `SessionController` 中添加相关API端点：
  - ✅ `POST /sessions/:id/visualization` - 生成视觉化内容
  - ✅ `GET /sessions/:id/visualizations` - 获取所有视觉化内容
  - ✅ `GET /sessions/:id/visualizations/:visId` - 获取单个视觉化详情
  - ✅ `GET /sessions/:id/visualizations/:visId/image` - 获取图像数据
- ✅ 实现图像存储逻辑（当前使用内存存储，Base64数据）
- ✅ 实现图像访问权限控制（通过sessionId验证）

**现有相关代码：**
- ✅ `session.service.ts`: 已添加视觉化内容管理方法
- ✅ `session.controller.ts`: 已添加API端点
- ✅ `context-store.service.ts`: 视觉化结果已保存在消息流中
- ✅ `visualization.service.ts`: 视觉化结果存储在内存Map中

**需求:** 需求4

---

### [7]. 前端视觉化UI组件（基于 demo_show/index.html） ✅

**具体要做的事情：**
- ✅ **在 `demo_show/index.html` 中新增视觉化功能区域**
  - ✅ 在 `side-panel` 中，QA Section 之前添加视觉化卡片
  - ✅ 添加视觉化类型选择器（科研图表/创意图像/逻辑海报）
  - ✅ 添加图表类型选择器（雷达图/流程图/架构图等，仅当选择图表时显示）
  - ✅ 添加生成按钮和状态显示
- ✅ **在 `transcription-panel` 的 summary tab 中新增视觉化结果展示区域**
  - ✅ 创建视觉化结果列表容器（`visualizationList`）
  - ✅ 实现视觉化结果卡片（图像预览、元数据、操作按钮）
- ✅ **实现视觉化相关JavaScript函数**
  - ✅ `selectVisualizationType()` - 选择视觉化类型
  - ✅ `generateVisualization()` - 调用API生成视觉化
  - ✅ `displayVisualization()` - 显示视觉化结果
  - ✅ `renderVisualizations()` - 渲染视觉化列表
  - ✅ `viewVisualization()` - 查看大图（模态框）
  - ✅ `downloadVisualization()` - 下载图像
  - ✅ `shareVisualization()` - 分享图像
  - ✅ `updateVisualizationButtonState()` - 更新按钮状态
- ✅ **添加CSS样式**
  - ✅ 视觉化卡片样式
  - ✅ 视觉化类型选择器样式
  - ✅ 视觉化结果卡片样式
  - ✅ 图像查看器模态框样式
- ✅ **确保V1功能不受影响**
  - ✅ 不修改现有V1功能的HTML结构
  - ✅ 不修改现有V1功能的JavaScript代码
  - ✅ 不修改现有V1功能的CSS样式
  - ✅ 仅新增V2相关代码

**UI组件位置：**
- ✅ 视觉化功能卡片：`side-panel` 中，`auto-push-card` 和 `qa-section` 之间
- ✅ 视觉化结果展示：`transcription-panel` 的 `summary` tab 中

**现有相关代码：**
- ✅ `demo_show/index.html`: 已在现有基础上扩展，未修改V1代码
- ✅ 复用现有的API调用模式（`apiCall()`、`state.apiBaseUrl` 等）

**需求:** 需求1, 需求4

---

### [8]. 集成测试与调优

**具体要做的事情：**
- **V1功能回归测试**（重要：确保V1功能不受影响）
  - 测试录音和转写功能是否正常
  - 测试技能按钮（内心OS、头脑风暴、别再说了）是否正常
  - 测试自动推送功能是否正常
  - 测试问答功能是否正常
  - 确保所有V1 API调用正常
- **V2功能端到端测试**
  - 文本流 → 数据提取 → 图像生成 → 结果展示
  - 测试不同图表类型的生成质量
  - 测试创意图像和逻辑海报的生成质量
  - 测试错误处理（API失败、数据提取失败等）
- **调优和优化**
  - 调优 Prompt 模板，提高生成质量
  - 性能测试：图像生成的响应时间
  - 图像质量评估和优化
  - UI/UX优化（加载状态、错误提示等）
- **文档更新**
  - API文档更新
  - 使用说明更新
  - 前端代码注释

**测试场景：**
- **V1回归测试**
  - 录音转写流程完整测试
  - 所有技能按钮功能测试
  - 自动推送功能测试
  - 问答功能测试
- **V2功能测试**
  - 雷达图生成测试（包含多个维度的会议内容）
  - 流程图生成测试（包含流程逻辑的会议内容）
  - 架构图生成测试（包含系统设计的会议内容）
  - 创意图像生成测试（不同情绪和主题的会议内容）
  - 逻辑海报生成测试（包含要点和逻辑关系的会议内容）
  - 错误场景测试（API失败、数据提取失败、图像生成失败）
- **兼容性测试**
  - V1和V2功能同时使用测试
  - 长时间会议测试（V1转写 + V2视觉化）

**需求:** 全部

---

## 执行顺序建议

```
[1] API调研 → [2] 图像生成适配器 → [3] 数据提取服务 → [4] 创意描述生成 → 
[5] 视觉化服务 → [6] 内容管理 → [7] 前端UI → [8] 测试调优
```

**依赖关系：**
- 任务1是基础，必须先完成API调研
- 任务2（图像生成适配器）和任务3（数据提取）可以并行开发
- 任务4依赖任务3的基础设施
- 任务5依赖任务2、3、4
- 任务6依赖任务5
- 任务7依赖任务5、6的后端接口
- 任务8最后执行

---

## 附录：现有代码结构参考

### 后端目录结构（新增模块）

```
backend/src/
├── modules/
│   ├── image-gen/                    # 新增：图像生成模块
│   │   ├── image-generation-adapter.service.ts
│   │   └── image-gen.module.ts
│   ├── data-extraction/              # 新增：数据提取模块
│   │   ├── data-extraction.service.ts
│   │   └── data-extraction.module.ts
│   ├── visualization/                # 新增：视觉化模块
│   │   ├── visualization.service.ts
│   │   └── visualization.module.ts
│   ├── context/                      # 已有：上下文存储
│   ├── llm/                          # 已有：LLM适配器
│   ├── session/                      # 已有：会话管理（需扩展）
│   └── ...
└── shared/
    └── configuration.ts              # 需扩展：添加图像生成配置
```

### 前端文件结构（基于 demo_show/index.html）

```
demo_show/
├── index.html                        # V1已有，V2在此基础上扩展
│   ├── V1功能（保持不变）
│   │   ├── 录音和转写功能
│   │   ├── 技能按钮（内心OS、头脑风暴、别再说了）
│   │   ├── 自动推送开关
│   │   └── 问答功能
│   └── V2新增功能
│       ├── 视觉化功能卡片（在side-panel中）
│       ├── 视觉化类型选择器
│       ├── 图表类型选择器
│       ├── 生成按钮和状态显示
│       ├── 视觉化结果展示区域（在summary tab中）
│       └── JavaScript函数（新增）
│           ├── selectVisualizationType()
│           ├── generateVisualization()
│           ├── displayVisualization()
│           ├── viewVisualization()
│           ├── downloadVisualization()
│           └── shareVisualization()
└── （可选）新增文件
    ├── visualization.css            # 视觉化相关样式（可选，也可内联在index.html）
    └── visualization.js             # 视觉化相关JS（可选，也可内联在index.html）
```

**注意：** 所有V2功能代码可以直接添加到 `index.html` 中，也可以拆分为独立文件。建议先内联在 `index.html` 中，便于测试和维护。

### 关键配置项（backend/.env）

```env
# 已有配置（V1）
TINGWU_APP_KEY=xxx
TINGWU_ACCESS_KEY_ID=xxx
TINGWU_ACCESS_KEY_SECRET=xxx
DASHSCOPE_API_KEY=xxx
LLM_MODEL=qwen3-max
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# V2 新增配置（待确认）
IMAGE_GEN_API_KEY=xxx                 # 可能复用DASHSCOPE_API_KEY
IMAGE_GEN_MODEL=nano-banana-pro       # 待确认
IMAGE_GEN_BASE_URL=https://...        # 待确认
IMAGE_GEN_SIZE=1024x1024
IMAGE_GEN_FORMAT=png
IMAGE_GEN_QUALITY=standard
```

---

## 风险与注意事项

1. **V1功能兼容性**（最重要）
   - 必须确保V1所有功能在V2版本中完全正常工作
   - 不修改V1的HTML结构、JavaScript代码和CSS样式
   - 新增代码与V1代码隔离，避免冲突
   - 测试时必须同时验证V1和V2功能

2. **API 不确定性**
   - Nano Banana Pro 的 API 调用方式需要调研确认，可能影响任务2的实现
   - 需要确认API端点、认证方式、请求/响应格式

3. **图像质量**
   - 生成的图像质量可能不满足预期，需要多次调优 Prompt
   - 需要准备降级方案（生成失败时的处理）

4. **响应时间**
   - 图像生成可能需要较长时间，需要考虑异步处理和加载状态
   - 前端需要显示清晰的加载状态和进度提示

5. **存储成本**
   - 如果API返回Base64，需要存储到文件系统或对象存储，考虑存储成本
   - 需要评估图像存储策略（临时存储 vs 持久化存储）

6. **API 费用**
   - 图像生成API可能有调用费用，需要评估成本
   - 考虑添加使用限制或配额管理

7. **前端代码组织**
   - `index.html` 文件可能变得较大，考虑代码组织方式
   - 建议先内联实现，后续可拆分为独立文件

---

**请确认以上任务拆分是否合理，确认后我将开始执行任务。**

