---
name: simplify-visualization-with-styles
overview: 简化思维显影功能，移除数据图表和创意图像，只保留逻辑海报功能，并新增 Chiikawa 和极简商务两种预设风格供用户选择。
todos:
  - id: explore-codebase
    content: 使用 [subagent:code-explorer] 探索项目结构，定位思维显影相关代码
    status: completed
  - id: remove-chart
    content: 移除数据图表（chart）功能的组件、路由和相关代码
    status: completed
    dependencies:
      - explore-codebase
  - id: remove-creative
    content: 移除创意图像（creative）功能的组件、路由和相关代码
    status: completed
    dependencies:
      - explore-codebase
  - id: add-style-config
    content: 创建风格配置文件，定义 Chiikawa 和极简商务两种预设风格
    status: completed
    dependencies:
      - explore-codebase
  - id: add-style-selector
    content: 实现风格选择器组件，集成到逻辑海报生成流程中
    status: completed
    dependencies:
      - add-style-config
  - id: integrate-style-prompt
    content: 将风格词汇注入逻辑海报的提示词生成逻辑
    status: completed
    dependencies:
      - add-style-selector
---

## Product Overview

简化思维显影功能，聚焦逻辑海报生成能力。移除数据图表和创意图像两个子功能，仅保留逻辑海报功能，并新增 Chiikawa 和极简商务两种预设风格，让用户可以快速选择不同视觉风格生成海报。

## Core Features

- 移除数据图表（chart）功能入口和相关代码
- 移除创意图像（creative）功能入口和相关代码
- 保留逻辑海报（poster）功能作为唯一的思维显影方式
- 新增风格选择器，提供 Chiikawa 和极简商务两种预设风格
- 在原有提示词基础上添加风格相关词汇，不改变核心提示词逻辑

## Tech Stack

- 基于现有项目技术栈进行修改
- 需要先探索现有代码结构以确定具体实现方式

## Tech Architecture

### 修改范围分析

- **功能移除**：删除 chart 和 creative 相关的组件、路由、服务代码
- **功能保留**：poster 逻辑海报功能保持不变
- **功能新增**：风格选择器组件和风格配置

### 数据流

用户选择风格 → 风格词汇注入提示词 → 调用现有海报生成逻辑 → 输出带风格的逻辑海报

## Implementation Details

### 修改文件范围

```
project-root/
├── src/
│   ├── components/
│   │   └── StyleSelector.tsx    # 新增：风格选择器组件
│   ├── config/
│   │   └── styles.ts            # 新增：风格配置（Chiikawa、极简商务）
│   └── [待探索]                  # 需要移除 chart 和 creative 相关文件
```

### 关键代码结构

**风格配置接口**：定义预设风格的数据结构，包含风格名称、描述和注入提示词的关键词。

```typescript
interface StylePreset {
  id: string;
  name: string;
  description: string;
  keywords: string[];  // 注入提示词的风格词汇
}
```

**预设风格配置**：

```typescript
const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'chiikawa',
    name: 'Chiikawa',
    description: '可爱治愈风格',
    keywords: ['可爱', '治愈', '软萌', 'Chiikawa风格']
  },
  {
    id: 'minimal-business',
    name: '极简商务',
    description: '简洁专业风格',
    keywords: ['极简', '商务', '专业', '简洁大气']
  }
];
```

### 技术实现要点

1. **风格词汇注入**：在现有提示词末尾追加风格关键词，不修改原有提示词结构
2. **UI 交互**：添加风格选择器，用户可在生成海报前选择风格
3. **代码清理**：彻底移除 chart 和 creative 相关的死代码

## Agent Extensions

### SubAgent

- **code-explorer**
- Purpose: 探索现有项目结构，定位 chart、creative、poster 相关代码文件，了解当前思维显影功能的实现方式
- Expected outcome: 获取完整的代码结构信息，明确需要删除的文件和需要修改的文件列表