// AI 配置管理路由 - 多模型配置读写
// v0.13: 支持界面化管理与 JSON 文件直接编辑

import { Router } from 'express'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { testApiKey } from '../lib/aiClient.js'

const router = Router()

const __dirname = dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = join(__dirname, '..', 'ai-config.json')

/** 单个模型提供商配置 */
export interface AIProvider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  model: string
  isDefault?: boolean
  enabled: boolean
}

/** AI 配置文件结构 */
export interface AIConfigFile {
  $schema?: string
  version?: string
  description?: string
  defaultId: string
  providers: AIProvider[]
}

/** 读取配置文件 - 不存在时返回默认配置 */
function readConfig(): AIConfigFile {
  if (!existsSync(CONFIG_PATH)) {
    const fallback: AIConfigFile = {
      defaultId: 'builtin',
      providers: [
        {
          id: 'builtin',
          name: '内置演示 AI',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: '',
          model: 'gpt-4o-mini',
          isDefault: true,
          enabled: true,
        },
      ],
    }
    return fallback
  }
  const raw = readFileSync(CONFIG_PATH, 'utf-8')
  return JSON.parse(raw) as AIConfigFile
}

/** 写入配置文件 */
function writeConfig(config: AIConfigFile): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

/** 生成唯一 ID */
function genId(): string {
  return `prov-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** 获取配置（脱敏 - 不返回 apiKey 明文） */
router.get('/', (_req, res) => {
  const config = readConfig()
  const masked = {
    defaultId: config.defaultId,
    providers: config.providers.map((p) => ({
      ...p,
      // apiKey 脱敏：仅返回前缀与长度提示
      apiKey: p.apiKey ? `${p.apiKey.slice(0, 6)}***${p.apiKey.slice(-4)}` : '',
      hasApiKey: !!p.apiKey,
    })),
  }
  res.json({ success: true, data: masked })
})

/** 保存配置（全量覆盖） */
router.post('/', (req, res) => {
  const body = req.body as {
    defaultId: string
    providers: Array<Omit<AIProvider, 'apiKey'> & { apiKey?: string; hasApiKey?: boolean }>
  }

  // 读取现有配置以保留未提交的 apiKey
  const existing = readConfig()
  const existingMap = new Map(existing.providers.map((p) => [p.id, p]))

  const providers: AIProvider[] = body.providers.map((p) => {
    // 若 apiKey 字段包含 *** 表示前端未修改，保留原值
    let apiKey = p.apiKey || ''
    if (apiKey.includes('***') && existingMap.has(p.id)) {
      apiKey = existingMap.get(p.id)!.apiKey
    }
    return {
      id: p.id || genId(),
      name: p.name,
      baseUrl: p.baseUrl,
      apiKey,
      model: p.model,
      isDefault: p.id === body.defaultId,
      enabled: p.enabled !== false,
    }
  })

  // 若没有 id（新增），生成 id
  const finalProviders = providers.map((p) => ({
    ...p,
    id: p.id.startsWith('prov-') || p.id === 'builtin' ? p.id : genId(),
  }))

  const newConfig: AIConfigFile = {
    $schema: 'ai-config.v1',
    version: '0.13',
    description: 'ProjectFusion 大模型配置 - 可在此文件直接编辑，也可通过 AI 配置管理界面修改',
    defaultId: body.defaultId,
    providers: finalProviders,
  }

  writeConfig(newConfig)
  res.json({ success: true, data: { defaultId: newConfig.defaultId, count: newConfig.providers.length } })
})

/** 获取配置文件绝对路径（用于在文件夹中打开） */
router.get('/path', (_req, res) => {
  res.json({ success: true, data: { path: CONFIG_PATH, exists: existsSync(CONFIG_PATH) } })
})

/** 测试单个配置连通性 */
router.post('/test', async (req, res) => {
  const { apiKey, model, baseUrl } = req.body as { apiKey?: string; model?: string; baseUrl?: string }
  // 若 apiKey 包含 ***，从配置文件读取真实值
  let realKey = apiKey || ''
  if (realKey.includes('***')) {
    const config = readConfig()
    const provider = config.providers.find((p) => p.apiKey === realKey || p.apiKey.startsWith(realKey.slice(0, 6)))
    if (provider) realKey = provider.apiKey
  }
  const result = await testApiKey(realKey, model)
  res.json({
    success: true,
    data: { ...result, baseUrl: baseUrl || 'https://api.openai.com/v1' },
  })
})

export default router
