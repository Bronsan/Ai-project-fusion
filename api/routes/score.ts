// 适配性评分路由

import { Router } from 'express'
import { loadProjects } from '../lib/taskRepo.js'
import { calculatePreviewScore } from '../lib/scoreEngine.js'

const router = Router()

/** 预评分 - 选择项目后即时调用 */
router.post('/preview', async (req, res) => {
  const { projectIds } = req.body as { projectIds: string[] }
  if (!Array.isArray(projectIds) || projectIds.length < 2) {
    res.status(400).json({
      success: false,
      error: '至少选择 2 个项目',
    })
    return
  }

  const allProjects = await loadProjects()
  const selected = allProjects.filter((p) => projectIds.includes(p.id))
  if (selected.length < 2) {
    res.status(400).json({ success: false, error: '部分项目不存在' })
    return
  }

  const score = calculatePreviewScore(selected)
  res.json({ success: true, data: score })
})

export default router
