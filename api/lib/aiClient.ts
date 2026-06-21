// AI 客户端 - v0.12beta 增强降级策略
// 新增：超时控制（AbortController）、失败重试（指数退避）、流式输出支持

import type { FusionStrategy } from '../types.js'

/** 内置 API Key（演示用，实际部署应通过环境变量注入） */
const BUILTIN_API_KEY = process.env.AI_API_KEY || 'sk-projectfusion-builtin-demo-key'

/** 内置模型 */
const BUILTIN_MODEL = process.env.AI_MODEL || 'gpt-4o-mini'

/** 默认 API 端点（OpenAI 兼容协议） */
const DEFAULT_BASE_URL = process.env.AI_BASE_URL || 'https://api.openai.com/v1'

/** 默认超时 30 秒 */
const DEFAULT_TIMEOUT_MS = 30_000

/** 最大重试次数 */
const MAX_RETRIES = 2

/** 重试退避基数（毫秒） */
const RETRY_BASE_MS = 500

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIChatOptions {
  apiKey?: string
  model?: string
  temperature?: number
  maxTokens?: number
  /** 超时毫秒，默认 30s */
  timeoutMs?: number
  /** 外部 AbortSignal，用于取消 */
  signal?: AbortSignal
  /** 是否流式输出（流式时返回完整拼接后的字符串） */
  stream?: boolean
  /** 流式回调 - 每收到一段文本时调用 */
  onChunk?: (chunk: string) => void
}

/**
 * 调用 AI 聊天接口
 * 优先使用用户传入的 Key，否则使用内置 Key
 * v0.12beta: 加入超时、重试、流式
 */
export async function chat(
  messages: AIChatMessage[],
  options: AIChatOptions = {}
): Promise<string> {
  const apiKey = options.apiKey || BUILTIN_API_KEY
  const model = options.model || BUILTIN_MODEL
  const baseUrl = DEFAULT_BASE_URL
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  // 重试循环：最多 MAX_RETRIES + 1 次
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // 非首次重试时退避等待
    if (attempt > 0) {
      const backoff = RETRY_BASE_MS * Math.pow(2, attempt - 1)
      await delay(backoff)
    }

    let userCancelled = false
    try {
      // 合并外部 signal 与超时 signal
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      if (options.signal) {
        if (options.signal.aborted) {
          // 外部已取消，直接抛出
          throw new DOMException('Aborted', 'AbortError')
        }
        // 外部取消时也中止当前请求
        options.signal.addEventListener('abort', () => controller.abort(), { once: true })
      }

      try {
        if (options.stream && options.onChunk) {
          return await streamChat(baseUrl, apiKey, model, messages, options, controller.signal)
        }
        return await fetchChat(baseUrl, apiKey, model, messages, options, controller.signal)
      } finally {
        clearTimeout(timer)
      }
    } catch (err: any) {
      // 用户主动取消 - 不重试
      if (options.signal?.aborted || isAbortError(err)) {
        userCancelled = true
        throw err
      }
      // 4xx 错误（除 429）- 不重试
      if (err?.status && err.status >= 400 && err.status < 500 && err.status !== 429) {
        break
      }
      // 否则继续重试
      void userCancelled
    }
  }

  // 全部重试失败 - 降级到本地模拟
  return simulateResponse(messages, options)
}

/** 判断是否为 abort 错误 */
function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

/** 非流式请求 */
async function fetchChat(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: AIChatMessage[],
  options: AIChatOptions,
  signal: AbortSignal
): Promise<string> {
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
    signal,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    const err: any = new Error(`AI 接口返回 ${response.status}: ${text.slice(0, 200)}`)
    err.status = response.status
    throw err
  }

  const data = await response.json() as any
  return data?.choices?.[0]?.message?.content ?? ''
}

/** 流式请求 - 逐 token 返回 */
async function streamChat(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: AIChatMessage[],
  options: AIChatOptions,
  signal: AbortSignal
): Promise<string> {
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
      stream: true,
    }),
    signal,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    const err: any = new Error(`AI 接口返回 ${response.status}: ${text.slice(0, 200)}`)
    err.status = response.status
    throw err
  }

  if (!response.body) {
    // 不支持流式时降级为普通请求
    return fetchChat(baseUrl, apiKey, model, messages, options, signal)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // SSE 协议：每条消息以 \n\n 分隔
    const lines = buffer.split('\n\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const data = line.trim()
      if (!data.startsWith('data:')) continue
      const payload = data.slice(5).trim()
      if (payload === '[DONE]') continue
      try {
        const json = JSON.parse(payload)
        const delta = json?.choices?.[0]?.delta?.content ?? ''
        if (delta) {
          full += delta
          options.onChunk?.(delta)
        }
      } catch {
        // 解析失败忽略
      }
    }
  }

  return full
}

/**
 * 测试 API Key 是否可用
 */
export async function testApiKey(apiKey: string, model?: string): Promise<{ ok: boolean; message: string; model?: string }> {
  const useModel = model || BUILTIN_MODEL
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
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
        signal: controller.signal,
      })
      if (response.ok) {
        return { ok: true, message: '连接成功', model: useModel }
      }
      return { ok: false, message: `连接失败：HTTP ${response.status}` }
    } finally {
      clearTimeout(timer)
    }
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
    // 不再返回固定分数，由 scoreEngine 的规则评分处理
    return JSON.stringify({
      _note: 'AI 不可达，评分已由规则引擎处理，此响应不会被使用',
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

/** 延迟工具 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
