# 全局开发注意事项 (Development Guidelines)

> **文档性质**：本文档是项目开发的**强制性规范**，所有新功能开发必须遵循。
> 
> **最后更新**：2024-12-23
> 
> **维护者**：项目开发团队

---

## 📋 目录

1. [网络模式与部署](#1-网络模式与部署)
2. [国际化 (i18n)](#2-国际化-i18n)
3. [代码规范](#3-代码规范)
4. [API 设计规范](#4-api-设计规范)
5. [前端开发规范](#5-前端开发规范)
6. [后端开发规范](#6-后端开发规范)
7. [Git 提交规范](#7-git-提交规范)
8. [测试规范](#8-测试规范)
9. [文档维护指南](#9-文档维护指南)

---

## 1. 网络模式与部署

### 1.1 网络模式说明

系统支持三种网络模式：

| 模式 | 访问方式 | 后端地址 | 适用场景 |
|------|----------|----------|----------|
| **本地开发** | `localhost:8080` | `localhost:4000` | 个人开发调试 |
| **局域网演示** | `192.168.x.x:8080` | `192.168.x.x:4000` | 同一网络内多设备演示 |
| **公网访问** | ngrok/域名 | ngrok/域名 | 外网用户访问 |

### 1.2 自动检测机制

前端会自动检测访问地址，并使用相同主机的后端：

```javascript
// demo_show/index.html 中的实现
function getDefaultApiUrl() {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:4000';
  }
  return `http://${hostname}:4000`;
}
```

### 1.3 局域网部署步骤

```bash
# 1. 查看本机局域网 IP
# Windows: ipconfig
# Mac/Linux: ifconfig 或 ip addr

# 2. 启动后端（默认绑定 0.0.0.0，允许外部访问）
cd backend
npm run start:dev

# 3. 启动前端 HTTP 服务
cd demo_show
python -m http.server 8080 --bind 0.0.0.0
# 或
npx serve -l 8080

# 4. 其他设备访问
# 浏览器打开: http://你的IP:8080
```

### 1.4 麦克风权限注意事项

| 访问方式 | 麦克风权限 | 说明 |
|----------|------------|------|
| `localhost` | ✅ 允许 | 浏览器信任 localhost |
| `127.0.0.1` | ✅ 允许 | 同上 |
| `http://IP` | ⚠️ 部分浏览器限制 | Chrome 可能需要设置 |
| `https://` | ✅ 允许 | 推荐生产环境使用 |
| `file://` | ❌ 禁止 | 不能直接打开 HTML 文件 |

**Chrome 允许 HTTP 使用麦克风的方法**：
1. 打开 `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
2. 添加 `http://192.168.x.x:8080`
3. 重启浏览器

### 1.5 外网部署方案（前端 Netlify + 后端本地）

当前端部署在 Netlify 等外网平台，后端运行在本地时，需要使用**内网穿透**：

#### 方案对比

| 工具 | 优点 | 缺点 | 推荐场景 |
|------|------|------|----------|
| **ngrok** | 稳定、速度快 | 免费版有限制 | 正式演示 |
| **localtunnel** | 免费、无需注册 | 不太稳定 | 快速测试 |
| **cloudflared** | 免费、稳定 | 需要 Cloudflare 账号 | 长期使用 |

#### 操作步骤

```bash
# 方案1: ngrok（推荐）
# 1. 下载安装: https://ngrok.com/download
# 2. 注册获取 authtoken
ngrok http 4000
# 得到类似: https://xxxx.ngrok-free.app

# 方案2: localtunnel（无需注册）
npm install -g localtunnel
lt --port 4000

# 方案3: cloudflared
# Windows: winget install cloudflare.cloudflared
cloudflared tunnel --url http://localhost:4000
```

#### 前端配置

前端会自动检测外网部署并弹出设置窗口，用户可以：
1. 点击导航栏的连接状态区域（带⚙️图标）
2. 在弹窗中输入内网穿透获得的公网地址
3. 点击"保存并测试"

或者通过浏览器控制台手动设置：
```javascript
localStorage.setItem('apiBaseUrl', 'https://xxxx.ngrok-free.app');
location.reload();
```

#### 注意事项

1. **CORS 配置**：后端已配置 `origin: true`，允许任意来源
2. **HTTPS**：ngrok 等工具提供 HTTPS，解决麦克风权限问题
3. **地址变化**：免费版 ngrok 每次重启地址会变，需重新配置

---

## 2. 国际化 (i18n)

### 1.1 核心原则

> ⚠️ **强制要求**：所有用户可见的文本必须支持中英文切换，禁止硬编码中文。

### 1.2 实现架构

```
demo_show/index.html
├── i18n 配置对象 (~2800-3070行)
│   ├── zh: { nav, sidebar, toast, ... }
│   └── en: { nav, sidebar, toast, ... }
├── t(key) 翻译函数 (~3071行)
├── updateStaticI18n() - 更新 data-i18n 元素
└── updateDynamicI18nContent() - 更新动态生成内容
```

### 1.3 使用方式

| 场景 | 正确做法 | 错误做法 |
|------|----------|----------|
| Toast 消息 | `showToast(t('toast.success'), 'success')` | `showToast('操作成功', 'success')` |
| 动态 HTML | `` `<div>${t('sidebar.title')}</div>` `` | `'<div>会议记录</div>'` |
| 条件文本 | `state.language === 'zh' ? '中文' : 'English'` | 直接写中文 |
| 静态 HTML | `<span data-i18n="nav.title">标题</span>` | `<span>标题</span>` |

### 1.4 翻译键命名规范

```
模块.功能.具体描述

示例：
- toast.connectionSuccess     // Toast 消息
- sidebar.noMeetings          // 侧边栏
- meetingDetail.title         // 会议详情模块
- toolbar.generateVis         // 工具栏按钮
- panel.transcription         // 面板标题
```

### 1.5 添加新文本的步骤

1. **在 i18n 对象中添加翻译键**（中英文都要添加）
2. **在代码中使用 `t('key')` 引用**
3. **测试中英文切换是否正常**

```javascript
// 步骤 1: 添加翻译键
const i18n = {
  zh: {
    toast: {
      newFeatureSuccess: '新功能操作成功',  // 新增
    }
  },
  en: {
    toast: {
      newFeatureSuccess: 'New feature operation successful',  // 新增
    }
  }
};

// 步骤 2: 使用翻译函数
showToast(t('toast.newFeatureSuccess'), 'success');
```

### 1.6 检查清单

开发新功能时，检查以下位置是否有硬编码文本：

- [ ] `showToast()` 调用
- [ ] `innerHTML` / `textContent` 赋值
- [ ] 模板字符串中的文本
- [ ] `placeholder` / `title` / `alt` 属性
- [ ] 错误消息
- [ ] 按钮文本
- [ ] 状态提示

---

## 2. 代码规范

### 2.1 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 变量/函数 | camelCase | `getUserInfo`, `isLoading` |
| 常量 | UPPER_SNAKE_CASE | `API_BASE_URL`, `MAX_RETRY` |
| 类/组件 | PascalCase | `SessionService`, `MeetingCard` |
| 文件名 | kebab-case 或 camelCase | `session.service.ts`, `index.html` |
| CSS 类 | BEM 或 kebab-case | `meeting-list__item--active` |

### 2.2 注释规范

```javascript
// ========== 模块分隔符 ==========

/**
 * 函数说明
 * @param {string} id - 参数说明
 * @returns {Promise<Object>} 返回值说明
 */
function doSomething(id) { ... }

// 单行注释：解释复杂逻辑
const result = complexCalculation(); // 计算用户配额
```

### 2.3 错误处理

```javascript
// ✅ 正确：有意义的错误处理
try {
  await apiCall();
} catch (error) {
  console.error('API call failed:', error);
  showToast(t('toast.apiFailed'), 'error');
}

// ❌ 错误：空 catch 块
try {
  await apiCall();
} catch (e) {}  // 禁止！

// ✅ 如果确实不需要处理，添加注释说明
try {
  await optionalApiCall();
} catch (e) { /* Optional call, failure is acceptable */ }
```

---

## 3. API 设计规范

### 3.1 RESTful 规范

| 操作 | HTTP 方法 | URL 格式 | 示例 |
|------|-----------|----------|------|
| 获取列表 | GET | `/resources` | `GET /sessions` |
| 获取单个 | GET | `/resources/:id` | `GET /sessions/123` |
| 创建 | POST | `/resources` | `POST /sessions` |
| 更新 | PUT/PATCH | `/resources/:id` | `PUT /sessions/123` |
| 删除 | DELETE | `/resources/:id` | `DELETE /sessions/123` |
| 动作 | POST | `/resources/:id/action` | `POST /sessions/123/complete` |

### 3.2 响应格式

```typescript
// 成功响应
{
  success: true,
  data: { ... },
  message?: string
}

// 错误响应
{
  success: false,
  message: string,
  error?: string
}

// 列表响应
{
  success: true,
  data: [...],
  total: number,
  page?: number,
  limit?: number
}
```

### 3.3 错误码规范

| HTTP 状态码 | 使用场景 |
|-------------|----------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 4. 前端开发规范

### 4.1 状态管理

```javascript
// 全局状态对象
const state = {
  // 连接状态
  isConnected: false,
  apiBaseUrl: '',
  
  // 会话状态
  sessionId: null,
  meetingId: null,
  
  // UI 状态
  language: 'zh',
  isRecording: false,
  
  // 数据
  transcription: [],
  summaries: [],
};
```

**规则**：
- 所有状态变更通过明确的函数进行
- 状态变更后及时更新 UI
- 避免直接操作 DOM，优先更新状态再渲染

### 4.2 DOM 操作

```javascript
// ✅ 推荐：使用缓存的元素引用
const elements = {
  recordBtn: $('recordBtn'),
  transcriptionList: $('transcriptionList'),
};

// ✅ 使用简化的选择器函数
function $(id) { return document.getElementById(id); }

// ❌ 避免：频繁查询 DOM
document.getElementById('recordBtn').disabled = true;
document.getElementById('recordBtn').textContent = '...';
```

### 4.3 事件处理

```javascript
// ✅ 推荐：使用具名函数便于调试
elements.recordBtn.addEventListener('click', handleRecordClick);

// ✅ 清理定时器和事件监听
function cleanup() {
  clearInterval(pollingInterval);
  clearTimeout(debounceTimeout);
}
```

### 4.4 异步操作

```javascript
// ✅ 使用 async/await
async function fetchData() {
  try {
    const response = await apiCall('GET', '/data');
    return response;
  } catch (error) {
    handleError(error);
  }
}

// ✅ 并行请求
const [users, meetings] = await Promise.all([
  fetchUsers(),
  fetchMeetings()
]);
```

---

## 5. 后端开发规范

### 5.1 目录结构

```
backend/src/
├── main.ts                 # 入口文件
├── app.module.ts           # 根模块
└── modules/
    ├── session/            # 会话模块
    │   ├── session.controller.ts
    │   ├── session.service.ts
    │   ├── session.dto.ts
    │   └── session.module.ts
    ├── agent/              # Agent 模块
    ├── auth/               # 认证模块
    └── ...
```

### 5.2 Service 层规范

```typescript
@Injectable()
export class SessionService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly externalApi: ExternalApiService,
  ) {}

  // 公开方法：业务逻辑
  async createSession(dto: CreateSessionDto): Promise<Session> {
    // 1. 参数验证
    // 2. 业务逻辑
    // 3. 数据持久化
    // 4. 返回结果
  }

  // 私有方法：内部辅助
  private validateInput(input: any): boolean { ... }
}
```

### 5.3 Controller 层规范

```typescript
@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post()
  async create(@Body() dto: CreateSessionDto) {
    return this.sessionService.createSession(dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.sessionService.findOne(id);
  }
}
```

### 5.4 DTO 验证

```typescript
// 使用 class-validator 进行参数验证
export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  meetingId: string;

  @IsOptional()
  @IsString()
  title?: string;
}
```

---

## 6. Git 提交规范

### 6.1 Commit Message 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 6.2 Type 类型

| Type | 说明 |
|------|------|
| feat | 新功能 |
| fix | Bug 修复 |
| docs | 文档更新 |
| style | 代码格式（不影响功能） |
| refactor | 重构 |
| perf | 性能优化 |
| test | 测试相关 |
| chore | 构建/工具相关 |

### 6.3 示例

```
feat(i18n): add English translation for toast messages

- Add toast translation keys for zh/en
- Update showToast calls to use t() function
- Add formatDuration i18n support

Closes #123
```

---

## 7. 测试规范

### 7.1 测试优先级

| 优先级 | 测试类型 | 覆盖范围 |
|--------|----------|----------|
| P0 | 核心功能手动测试 | 录音、转写、洞察生成 |
| P1 | API 接口测试 | 所有后端接口 |
| P2 | UI 交互测试 | 按钮、弹窗、切换 |
| P3 | 边界条件测试 | 异常输入、网络错误 |

### 7.2 测试检查清单

- [ ] 功能在中文环境下正常
- [ ] 功能在英文环境下正常
- [ ] 错误情况有友好提示
- [ ] 网络异常时不崩溃
- [ ] 移动端适配正常（如适用）

---

## 8. 文档维护指南

### 8.1 本文档更新时机

以下情况必须更新本文档：

1. **新增全局规范**：如新的代码风格要求
2. **技术栈变更**：如引入新的库或框架
3. **架构调整**：如目录结构变化
4. **发现新的坑**：如某个 API 的特殊用法

### 8.2 更新流程

1. 在对应章节添加/修改内容
2. 更新文档顶部的「最后更新」日期
3. 如有重大变更，在团队内通知

### 8.3 相关文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 产品需求 | `specs/spec_product/` | 产品功能需求 |
| V3 需求 | `specs/specV3/requirement.md` | Agent 功能需求 |
| V3 设计 | `specs/specV3/design.md` | 技术设计文档 |
| V3 任务 | `specs/specV3/tasks.md` | 开发任务拆解 |

---

## 📝 变更日志

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2024-12-23 | 1.0 | 初始版本，包含 i18n、代码规范、API 规范等 | - |

---

> 💡 **提示**：如有疑问或建议，请在团队内讨论后更新本文档。
