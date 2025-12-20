# V2 前后端联调测试指南

## 前置准备

### 1. 配置环境变量

在 `backend/.env` 文件中确保已配置以下内容：

```env
# 通义听悟配置（V1已有）
TINGWU_REGION=cn-beijing
TINGWU_ACCESS_KEY_ID=your_access_key_id
TINGWU_ACCESS_KEY_SECRET=your_access_key_secret
TINGWU_APP_KEY=your_app_key

# LLM配置（V1已有）
DASHSCOPE_API_KEY=your_dashscope_api_key
LLM_MODEL=qwen3-max
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# 图像生成配置（V2新增）
GEMINI_API_KEY=your_gemini_api_key_here
IMAGE_GEN_MODEL=imagen-3.0-generate-001
IMAGE_GEN_BASE_URL=https://generativelanguage.googleapis.com/v1beta
IMAGE_GEN_SIZE=1024x1024
IMAGE_GEN_FORMAT=png
IMAGE_GEN_QUALITY=standard

# 服务端口
PORT=4000
```

### 2. 安装依赖

```bash
# 进入后端目录
cd backend

# 安装依赖（如果还没安装）
npm install
```

---

## 启动服务

### 步骤1：启动后端服务

```bash
# 在 backend 目录下
cd backend
npm start
```

**预期输出：**
```
Backend listening on port 4000
```

**如果看到错误：**
- 检查 `.env` 文件是否存在且配置正确
- 检查端口 4000 是否被占用
- 检查依赖是否已安装

### 步骤2：打开前端页面

有两种方式打开前端页面：

**方式1：直接打开HTML文件**
- 在文件管理器中找到 `demo_show/index.html`
- 双击打开（使用浏览器）

**方式2：使用本地服务器（推荐）**
```bash
# 在项目根目录下
# 使用Python（如果已安装）
cd demo_show
python -m http.server 8080

# 或使用Node.js http-server（需要先安装：npm install -g http-server）
http-server -p 8080

# 然后在浏览器访问：http://localhost:8080
```

**推荐使用方式2**，因为直接打开HTML文件可能会遇到CORS问题。

---

## 测试流程

### 测试1：后端健康检查

1. **打开浏览器开发者工具**（F12）
2. **访问前端页面**：`http://localhost:8080` 或直接打开 `index.html`
3. **查看连接状态**：
   - 页面右上角应显示"已连接"（绿色圆点）
   - 如果显示"未连接"，点击"测试连接"按钮

**预期结果：**
- 连接状态显示"已连接"
- 控制台无错误信息

---

### 测试2：V1功能回归测试

确保V1功能正常工作：

1. **创建会话**
   - 点击"开始录音"按钮
   - 或上传音频文件进行转写

2. **测试技能按钮**
   - 等待有转写内容后
   - 点击"内心OS"、"头脑风暴"、"别再说了"按钮
   - 检查是否正常返回结果

3. **测试自动推送**
   - 开启"自动推送分析"开关
   - 等待1分钟后检查是否有自动分析结果

4. **测试问答功能**
   - 在问答输入框输入问题
   - 检查是否正常返回回答

**预期结果：**
- 所有V1功能正常工作
- 无错误提示

---

### 测试3：V2视觉化功能测试

#### 3.1 基础功能测试

1. **检查视觉化卡片是否显示**
   - 在右侧面板中，应该能看到"视觉化共识"卡片（带V2标签）
   - 应该有三个类型按钮：科研图表、创意图像、逻辑海报

2. **测试类型选择**
   - 点击不同的类型按钮，检查按钮状态是否正确切换
   - 选择"科研图表"时，应该显示图表类型选择器（下拉框）
   - 选择其他类型时，图表类型选择器应该隐藏

3. **检查生成按钮状态**
   - 没有会话时，生成按钮应该是禁用状态
   - 有转写内容后，生成按钮应该变为可用状态

#### 3.2 生成视觉化内容测试

**测试流程：**

1. **准备测试数据**
   - 先开始录音或上传音频文件
   - 等待有转写内容（至少几句话）

2. **生成科研图表**
   - 选择"科研图表"类型
   - 选择图表类型（如：雷达图）
   - 点击"生成视觉化"按钮
   - 观察状态提示："正在生成视觉化内容，请稍候..."
   - 等待生成完成（可能需要10-30秒）

3. **检查生成结果**
   - 生成成功后，应该自动切换到"AI 总结"标签页
   - 应该能看到视觉化结果卡片
   - 卡片中应该显示图像预览
   - 应该能看到"查看"、"下载"、"分享"按钮

4. **测试图像操作**
   - 点击"查看"按钮，应该弹出大图模态框
   - 点击"下载"按钮，应该下载图像文件
   - 点击"分享"按钮，应该触发分享功能

5. **测试其他类型**
   - 选择"创意图像"类型，生成创意图像
   - 选择"逻辑海报"类型，生成逻辑海报

**预期结果：**
- 生成按钮状态正确
- 生成过程有状态提示
- 生成成功后正确显示结果
- 图像操作功能正常

---

### 测试4：错误处理测试

1. **测试无转写内容时生成**
   - 创建会话但不录音
   - 尝试生成视觉化
   - 应该提示"请先开始录音或上传音频文件"

2. **测试API错误**
   - 如果API Key无效或API调用失败
   - 应该显示错误提示："生成失败，请稍后重试"

3. **测试网络错误**
   - 停止后端服务
   - 尝试生成视觉化
   - 应该显示连接错误

---

## 调试技巧

### 1. 查看后端日志

后端服务启动后，会在控制台输出日志：
- 服务启动信息
- API调用日志
- 错误信息

**关键日志：**
- `Image Generation Adapter initialized with model: imagen-3.0-generate-001`
- `Calling Imagen API with prompt: ...`
- `Visualization generated: vis-xxx for session xxx`

### 2. 查看前端控制台

打开浏览器开发者工具（F12），查看：
- **Console标签**：JavaScript错误和日志
- **Network标签**：API请求和响应

**关键请求：**
- `POST /sessions/:id/visualization` - 生成视觉化
- `GET /sessions/:id/visualizations` - 获取视觉化列表

### 3. 常见问题排查

**问题1：生成按钮一直禁用**
- 检查是否有转写内容
- 检查 `updateVisualizationButtonState()` 函数是否被调用
- 在控制台执行：`console.log(state.sessionId, state.transcription)`

**问题2：生成失败**
- 检查后端日志，查看具体错误信息
- 检查 `GEMINI_API_KEY` 是否配置正确
- 检查API端点是否正确
- 在Network标签查看API响应

**问题3：图像不显示**
- 检查API返回的数据格式
- 检查 `imageBase64` 或 `imageUrl` 字段是否存在
- 在控制台查看返回的数据结构

**问题4：V1功能受影响**
- 检查是否有JavaScript错误
- 检查是否有CSS冲突
- 检查是否有API调用失败

---

## 快速测试脚本

创建一个简单的测试脚本，快速验证API：

```bash
# 在项目根目录创建 test-visualization.sh (Linux/Mac) 或 test-visualization.bat (Windows)
```

### Windows测试脚本

创建 `test-visualization.bat`：

```batch
@echo off
echo ========================================
echo V2 视觉化功能快速测试
echo ========================================
echo.

echo [1] 测试后端健康检查...
curl -X GET http://localhost:4000/sessions/health
echo.
echo.

echo [2] 创建测试会话...
curl -X POST http://localhost:4000/sessions -H "Content-Type: application/json" -d "{\"meetingId\":\"test-vis-001\"}"
echo.
echo.

echo 请手动执行以下步骤：
echo 1. 打开浏览器访问前端页面
echo 2. 开始录音或上传音频文件
echo 3. 等待有转写内容
echo 4. 在视觉化卡片中选择类型并点击生成
echo.
echo 测试完成！
pause
```

### 使用Postman/curl测试API

**1. 创建会话：**
```bash
curl -X POST http://localhost:4000/sessions \
  -H "Content-Type: application/json" \
  -d '{"meetingId": "test-vis-001"}'
```

**2. 上传一些转写内容（模拟）：**
```bash
# 注意：实际需要先有转写内容，这里只是示例
# 真实场景中，转写内容会通过录音或上传音频文件自动生成
```

**3. 生成视觉化：**
```bash
curl -X POST http://localhost:4000/sessions/{sessionId}/visualization \
  -H "Content-Type: application/json" \
  -d '{
    "type": "chart",
    "chartType": "radar"
  }'
```

**4. 获取视觉化列表：**
```bash
curl -X GET http://localhost:4000/sessions/{sessionId}/visualizations
```

---

## 测试检查清单

### V1功能检查 ✅
- [ ] 后端服务正常启动
- [ ] 前端页面正常打开
- [ ] 连接状态显示正常
- [ ] 录音功能正常
- [ ] 转写功能正常
- [ ] 技能按钮（内心OS、头脑风暴、别再说了）正常
- [ ] 自动推送功能正常
- [ ] 问答功能正常

### V2功能检查 ✅
- [ ] 视觉化卡片显示正常
- [ ] 类型选择器工作正常
- [ ] 图表类型选择器显示/隐藏正常
- [ ] 生成按钮状态更新正常
- [ ] 生成科研图表成功
- [ ] 生成创意图像成功
- [ ] 生成逻辑海报成功
- [ ] 视觉化结果正确显示
- [ ] 图像查看功能正常
- [ ] 图像下载功能正常
- [ ] 图像分享功能正常
- [ ] 错误处理正常

---

## 下一步

测试通过后：
1. 根据实际API响应调整代码（如果需要）
2. 优化Prompt模板，提高生成质量
3. 性能优化（如果生成时间过长）
4. UI/UX优化

---

**如有问题，请查看后端日志和浏览器控制台，根据错误信息进行排查。**

