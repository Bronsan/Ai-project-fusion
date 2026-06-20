// 项目库路由

import { Router } from 'express'
import { loadProjects, getProjectById } from '../lib/taskRepo.js'

const router = Router()

/** 获取项目库列表 */
router.get('/', async (_req, res) => {
  const projects = await loadProjects()
  res.json({ success: true, data: projects })
})

/** 获取项目详情 */
router.get('/:id', async (req, res) => {
  const project = await getProjectById(req.params.id)
  if (!project) {
    res.status(404).json({ success: false, error: '项目不存在' })
    return
  }
  res.json({ success: true, data: project })
})

export default router
