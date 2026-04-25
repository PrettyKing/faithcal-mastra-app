# FaithCal Mastra App

> by chalee

基于 [Mastra](https://mastra.ai/) 框架构建的多智能体 AI 服务，使用 OpenAI `gpt-4o-mini` 驱动，部署在 Cloudflare Workers 上。

## 智能体

### 天气助手 (Weather Agent)
提供全球任意地点的实时天气信息。
- 自动翻译非英文地名
- 返回温度、湿度、风力和降水情况
- 未提供地点时会主动询问

### 翻译助手 (Translator Agent)
支持 100+ 语言的专业多语言翻译。
- 自动识别源语言
- 未指定目标语言时默认翻译为英文
- 保留原文的语气、风格和格式
- 对惯用表达提供字面和自然两种译法
- 标注可能影响语义的文化背景信息

### 汇率助手 (Currency Agent)
提供实时汇率查询和货币换算。
- 支持所有标准 ISO 4217 货币代码（USD、CNY、EUR、JPY、GBP、HKD 等）
- 接受国家名或货币名，自动映射为正确代码
- 清晰展示换算金额和计算过程
- 显示汇率最后更新时间
- 汇率仅供参考，可能与银行实际汇率有所差异

### 网页摘要助手 (Web Summarizer Agent)
抓取网页内容并生成简洁摘要。
- 识别网页主题和核心信息
- 默认生成 150–300 字摘要，可按需调整详细程度
- 根据内容类型自动调整格式：
  - **新闻文章**：时间、地点、人物、事件、原因
  - **技术文档**：用途、使用方法、关键 API 或步骤
  - **产品页面**：功能特性、定价、核心价值
- 以用户使用的语言回复

### 代码审查助手 (Code Review Agent)
审查代码片段并提供建设性的改进建议。
- 识别 Bug、可读性问题和性能瓶颈
- 针对 JavaScript/TypeScript 代码检测内存泄漏，包括：
  - 未被垃圾回收的大型数组或对象
  - 意外持有引用的闭包
  - 未正确移除的事件监听器
  - 循环引用
  - 存储大量数据的全局变量
- 未提供编程语言时会主动询问

### 日程规划助手 (Daily Planner Agent)
帮助用户制定结构化的时间块日程安排。
- 使用艾森豪威尔矩阵（紧急/重要四象限）对任务排优先级
- 归类相似任务，减少上下文切换
- 将深度工作安排在精力高峰期（通常为上午）
- 包含缓冲时间、用餐、运动和休息
- 优先级标识：🔴 关键 / 🟡 重要 / 🟢 可选
- 以用户使用的语言回复

## 技术栈

| 层次 | 技术 |
|------|------|
| AI 框架 | [Mastra](https://mastra.ai/) |
| AI 模型 | OpenAI `gpt-4o-mini` |
| 运行时 | Node.js 20+，TypeScript |
| 部署平台 | Cloudflare Workers |
| 包管理器 | Yarn |

## 开发

```bash
# 安装依赖
yarn install

# 启动本地开发服务器
yarn mastra dev

# 构建生产版本
yarn build

# 部署到 Cloudflare Workers
npx wrangler deploy
```

## 环境变量

| 变量名 | 说明 |
|--------|------|
| `OPENAI_API_KEY` | OpenAI API 密钥 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API 令牌 |
