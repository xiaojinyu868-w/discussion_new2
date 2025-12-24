# 开发快速参考卡片 (Quick Reference)

> 开发时的快速检查清单，详细说明见 [DEVELOPMENT_GUIDELINES.md](./DEVELOPMENT_GUIDELINES.md)

---

## 🌐 网络模式

```bash
# 局域网演示（其他设备可访问）
cd backend && npm run start:dev     # 后端 :4000
cd demo_show && python -m http.server 8080 --bind 0.0.0.0  # 前端 :8080

# 访问地址：http://你的IP:8080
# 前端会自动检测 IP 并连接对应后端
```

**麦克风权限**：HTTP 下 Chrome 需设置 `chrome://flags/#unsafely-treat-insecure-origin-as-secure`

---

## 🌍 外网部署（前端 Netlify + 后端本地）

```bash
# 1. 启动本地后端
cd backend && npm run start:dev

# 2. 使用内网穿透暴露后端
ngrok http 4000                    # 推荐
# 或 lt --port 4000                # 无需注册
# 或 cloudflared tunnel --url http://localhost:4000

# 3. 前端配置
# 点击导航栏连接状态区域 ⚙️ → 输入穿透地址 → 保存并测试
# 或控制台: localStorage.setItem('apiBaseUrl', 'https://xxx.ngrok-free.app')
```

---

## 🌍 i18n 国际化

```javascript
// ✅ 正确
showToast(t('toast.success'), 'success');
innerHTML = `<div>${t('sidebar.title')}</div>`;

// ❌ 错误
showToast('操作成功', 'success');
innerHTML = '<div>会议记录</div>';
```

**添加新文本**：
1. `i18n.zh.模块.键名 = '中文'`
2. `i18n.en.模块.键名 = 'English'`
3. 代码中使用 `t('模块.键名')`

---

## 📁 文件位置速查

| 内容 | 位置 |
|------|------|
| i18n 配置 | `demo_show/index.html` ~2800-3070行 |
| 前端状态 | `demo_show/index.html` state 对象 |
| 后端入口 | `backend/src/main.ts` |
| API 路由 | `backend/src/modules/*/controller.ts` |
| 数据库 | `backend/src/modules/database/` |

---

## 🔌 API 格式

```typescript
// 成功
{ success: true, data: {...} }

// 失败
{ success: false, message: '错误信息' }

// 列表
{ success: true, data: [...], total: 100 }
```

---

## ✅ 提交前检查

- [ ] 无硬编码中文（用 `t()` 函数）
- [ ] 无空 catch 块
- [ ] 错误有友好提示
- [ ] 中英文切换正常
- [ ] console.log 已清理（调试用的）

---

## 🏷️ Git Commit

```
feat(模块): 简短描述
fix(模块): 修复了什么
docs: 文档更新
refactor: 重构
```

---

## 🚨 常见坑

| 问题 | 解决方案 |
|------|----------|
| Toast 显示中文 | 检查是否用了 `t()` |
| 切换语言后文本没变 | 检查 `updateDynamicI18nContent()` |
| API 报 401 | 检查 Authorization header |
| 定时器泄漏 | 确保 `clearInterval/clearTimeout` |

---

> 📖 完整规范：[DEVELOPMENT_GUIDELINES.md](./DEVELOPMENT_GUIDELINES.md)
