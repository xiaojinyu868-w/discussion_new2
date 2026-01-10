---
name: deployment-guide
overview: 为 MeetMind 前端项目创建服务器部署适配指南文档，包含环境变量配置、Nginx 配置、构建部署步骤等内容，确保域名访问正常。
todos:
  - id: analyze-project
    content: 使用 [subagent:code-explorer] 分析项目现有配置结构和部署相关文件
    status: completed
  - id: create-env-guide
    content: 编写环境变量配置章节，说明生产环境变量设置方式
    status: completed
    dependencies:
      - analyze-project
  - id: create-nginx-config
    content: 编写 Nginx 配置章节，包含反向代理和 WebSocket 配置示例
    status: completed
    dependencies:
      - analyze-project
  - id: create-build-deploy
    content: 编写构建部署流程章节，包含完整的部署步骤
    status: completed
    dependencies:
      - create-env-guide
  - id: create-troubleshooting
    content: 编写常见问题排查章节和域名访问检查清单
    status: completed
    dependencies:
      - create-nginx-config
      - create-build-deploy
  - id: assemble-document
    content: 整合所有章节生成完整的 DEPLOYMENT.md 部署指南文档
    status: completed
    dependencies:
      - create-troubleshooting
---

## 产品概述

为 MeetMind 前端项目创建一份完整的服务器部署适配指南文档，帮助开发者和运维人员正确配置生产环境，确保前端应用在域名访问下正常运行。

## 核心功能

- 环境变量配置说明：详细说明 VITE_API_BASE_URL 等环境变量在生产环境的配置方式
- Nginx 反向代理配置：提供完整的 Nginx 配置示例，包含 API 代理和 WebSocket 支持
- 构建部署流程：从代码构建到部署上线的完整步骤指南
- WebSocket 配置：动态 WebSocket 地址配置方案
- 常见问题排查：域名访问异常的排查清单和解决方案