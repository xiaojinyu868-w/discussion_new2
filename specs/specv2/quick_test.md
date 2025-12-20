# V2 快速测试指南

## 5分钟快速测试

### 步骤1：启动后端

```bash
cd backend
npm start
```

**等待看到：**
```
Backend listening on port 4000
```

### 步骤2：打开前端

**方式1：直接打开**
- 双击 `demo_show/index.html`

**方式2：使用本地服务器（推荐）**
```bash
# 在 demo_show 目录下
cd demo_show
python -m http.server 8080
# 然后访问 http://localhost:8080
```

### 步骤3：检查连接

1. 打开浏览器开发者工具（F12）
2. 查看页面右上角连接状态
3. 如果显示"未连接"，点击"测试连接"按钮

### 步骤4：准备测试数据

**选项A：使用录音**
1. 点击"开始录音"按钮
2. 说几句话（例如："我们今天讨论三个问题：技术、市场、团队。技术方面得分85分，市场70分，团队90分。"）
3. 等待转写内容出现

**选项B：上传音频文件**
1. 点击"选择文件"，选择一个音频文件
2. 点击"上传并转写"
3. 等待转写完成

### 步骤5：测试视觉化生成

1. **查看视觉化卡片**
   - 在右侧面板找到"视觉化共识"卡片（带V2标签）

2. **选择类型**
   - 点击"科研图表"按钮
   - 应该看到图表类型选择器出现
   - 选择"雷达图"

3. **生成视觉化**
   - 点击"生成视觉化"按钮
   - 观察状态提示："正在生成视觉化内容，请稍候..."
   - 等待10-30秒

4. **查看结果**
   - 生成成功后，自动切换到"AI 总结"标签页
   - 应该能看到视觉化结果卡片
   - 卡片中显示图像预览

5. **测试操作**
   - 点击"查看"按钮 → 应该弹出大图
   - 点击"下载"按钮 → 应该下载图像
   - 点击"分享"按钮 → 应该触发分享

### 步骤6：测试其他类型

1. 选择"创意图像"类型，点击生成
2. 选择"逻辑海报"类型，点击生成

---

## 常见问题

### Q1: 生成按钮一直禁用？

**A:** 检查是否有转写内容。生成按钮只有在有转写内容时才会启用。

**解决方法：**
- 确保已开始录音或上传音频文件
- 等待转写内容出现
- 在浏览器控制台执行：`console.log(state.transcription)`

### Q2: 生成失败，显示错误？

**A:** 检查以下几点：

1. **API Key配置**
   - 检查 `backend/.env` 中的 `GEMINI_API_KEY` 是否配置
   - 检查API Key是否有效

2. **后端日志**
   - 查看后端控制台输出
   - 查找错误信息

3. **网络问题**
   - 检查是否能访问Google API
   - 检查防火墙设置

### Q3: 图像不显示？

**A:** 检查以下几点：

1. **API响应格式**
   - 在浏览器Network标签查看API响应
   - 检查返回的数据结构

2. **Base64数据**
   - 检查 `imageBase64` 字段是否存在
   - 检查数据格式是否正确

### Q4: V1功能受影响？

**A:** 检查以下几点：

1. **JavaScript错误**
   - 打开浏览器控制台
   - 查看是否有错误信息

2. **API调用**
   - 检查V1的API是否正常
   - 检查后端服务是否正常运行

---

## 调试命令

### 检查后端状态

```bash
# 测试健康检查
curl http://localhost:4000/sessions/health

# 应该返回：{"ok":true}
```

### 检查前端状态

在浏览器控制台执行：

```javascript
// 检查连接状态
console.log('Connected:', state.isConnected);
console.log('Session ID:', state.sessionId);
console.log('Transcription:', state.transcription);

// 检查视觉化状态
console.log('Visualization Type:', state.currentVisualizationType);
console.log('Chart Type:', state.currentChartType);
```

### 手动测试API

```bash
# 1. 创建会话
SESSION_ID=$(curl -s -X POST http://localhost:4000/sessions \
  -H "Content-Type: application/json" \
  -d '{"meetingId":"test"}' | jq -r '.sessionId')

# 2. 生成视觉化（需要先有转写内容）
curl -X POST http://localhost:4000/sessions/$SESSION_ID/visualization \
  -H "Content-Type: application/json" \
  -d '{"type": "chart", "chartType": "radar"}'

# 3. 获取视觉化列表
curl http://localhost:4000/sessions/$SESSION_ID/visualizations
```

---

## 测试成功标志

✅ **后端服务正常启动**
- 控制台显示：`Backend listening on port 4000`
- 无错误信息

✅ **前端页面正常打开**
- 页面完整显示
- 连接状态显示"已连接"

✅ **V1功能正常**
- 录音/转写正常
- 技能按钮正常
- 自动推送正常
- 问答功能正常

✅ **V2功能正常**
- 视觉化卡片显示
- 类型选择正常
- 生成功能正常
- 结果正确显示
- 图像操作正常

---

**如果所有测试通过，说明前后端联调成功！** 🎉

