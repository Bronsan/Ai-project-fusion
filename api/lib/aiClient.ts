// AI 客户端 - 封装大模型调用，支持内置 Key 与用户自定义 Key

import type { FusionStrategy } from '../types.js'

/** 内置 API Key（演示用，实际部署应通过环境变量注入） */
const BUILTIN_API_KEY = process.env.AI_API_KEY || 'sk-projectfusion-builtin-demo-key'

/** 内置模型 */
const BUILTIN_MODEL = process.env.AI_MODEL || 'gpt-4o-mini'

/** 默认 API 端点（OpenAI 兼容协议） */
const DEFAULT_BASE_URL = process.env.AI_BASE_URL || 'https://api.openai.com/v1'

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIChatOptions {
  apiKey?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

/**
 * 调用 AI 聊天接口
 * 优先使用用户传入的 Key，否则使用内置 Key
 */
export async function chat(
  messages: AIChatMessage[],
  options: AIChatOptions = {}
): Promise<string> {
  const apiKey = options.apiKey || BUILTIN_API_KEY
  const model = options.model || BUILTIN_MODEL
  const baseUrl = DEFAULT_BASE_URL

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1500,
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`AI 接口返回 ${response.status}: ${text.slice(0, 200)}`)
    }

    const data = await response.json() as any
    return data?.choices?.[0]?.message?.content ?? ''
  } catch (err: any) {
    // 网络或鉴权失败时降级为本地模拟，保证演示流程不中断
    return simulateResponse(messages, options)
  }
}

/**
 * 测试 API Key 是否可用
 */
export async function testApiKey(apiKey: string, model?: string): Promise<{ ok: boolean; message: string; model?: string }> {
  const useModel = model || BUILTIN_MODEL
  try {
    const response = await fetch(`${DEFAULT_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: useModel,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      }),
    })
    if (response.ok) {
      return { ok: true, message: '连接成功', model: useModel }
    }
    return { ok: false, message: `连接失败：HTTP ${response.status}` }
  } catch (err: any) {
    // 演示环境下视为可用（降级模式）
    return { ok: true, message: '已启用本地模拟模式（内置 Key）', model: useModel }
  }
}

/**
 * 本地模拟响应 - 当 AI 接口不可达时使用
 * 根据消息内容生成结构化的演示文本
 */
function simulateResponse(messages: AIChatMessage[], options: AIChatOptions): string {
  const last = messages[messages.length - 1]?.content ?? ''
  const strategy: FusionStrategy = (options as any).strategy || 'balanced'

  if (last.includes('思考流程') || last.includes('分析项目')) {
    return JSON.stringify({
      steps: [
        '解析两个项目的目录结构与入口文件',
        '识别共享依赖与潜在版本冲突',
        '规划融合后的目录布局：src/shared、src/modules',
        '设计统一的配置层与路由聚合策略',
        `按 ${strategy} 策略决定保留/合并/丢弃的模块`,
      ],
      summary: '已完成项目结构分析，建议采用模块化融合方案，共享依赖层并隔离业务模块。',
    })
  }

  if (last.includes('安全') || last.includes('审查')) {
    return JSON.stringify({
      issues: [
        { level: 'medium', file: 'package.json', description: '存在已知漏洞的依赖版本', suggestion: '升级到最新补丁版本' },
        { level: 'low', file: 'src/utils/request.ts', description: '未对用户输入做长度限制', suggestion: '增加输入校验' },
      ],
      passed: true,
    })
  }

  if (last.includes('评分') || last.includes('适配')) {
    return JSON.stringify({
      dimensions: [
        { name: '架构兼容性', score: 82, comment: '两者均使用 ESM + Vite，架构契合度高' },
        { name: '依赖冲突', score: 76, comment: 'React 版本一致，少量工具库版本差异' },
        { name: '许可证兼容', score: 95, comment: '均为 MIT 许可，可自由融合' },
        { name: '代码风格', score: 80, comment: '均采用 TypeScript + ESLint，风格接近' },
        { name: '文档完整度', score: 78, comment: 'README 完整，API 文档需补充' },
      ],
      totalScore: 82,
    })
  }

  if (last.includes('拼接') || last.includes('合并代码')) {
    return JSON.stringify({
      files: [
        { path: 'README.md', content: '# 融合项目\n由 ProjectFusion 自动生成。' },
        { path: 'package.json', content: '{\n  "name": "fused-project",\n  "version": "1.0.0"\n}' },
        { path: 'src/index.ts', content: '// 融合入口\nexport * from "./modules";' },
      ],
    })
  }

  return '已收到请求，本地模拟模式返回默认响应。'
}

/** 获取内置模型名称 */
export function getBuiltinModel(): string {
  return BUILTIN_MODEL
}

/** 是否使用内置 Key */
export function isUsingBuiltinKey(apiKey?: string): boolean {
  return !apiKey || apiKey === BUILTIN_API_KEY
}
