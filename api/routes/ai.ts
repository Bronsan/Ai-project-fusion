// AI 测试路由 - 测试 API Key 是否可用

import { Router } from 'express'
import { testApiKey, getBuiltinModel, isUsingBuiltinKey } from '../lib/aiClient.js'

const router = Router()

/** 测试 API Key */
router.post('/test', async (req, res) => {
  const { apiKey, model } = req.body as { apiKey?: string; model?: string }
  const key = apiKey || ''
  const result = await testApiKey(key, model)
  res.json({
    success: true,
    data: {
      ...result,
      builtin: isUsingBuiltinKey(key),
      defaultModel: getBuiltinModel(),
    },
  })
})

/** 获取内置模型信息 */
router.get('/info', (_req, res) => {
  res.json({
    success: true,
    data: {
      builtinModel: getBuiltinModel(),
      hasBuiltinKey: true,
    },
  })
})

export default router
