// 融合任务路由

import { Router } from 'express'
import type { CreateFusionRequest, FusionTask } from '../types.js'
import {
  loadProjects,
  getTask,
  saveTask,
  loadTasks,
  generateTaskId,
} from '../lib/taskRepo.js'
import { executeFusion } from '../lib/fusionService.js'
import { calculatePreviewScore } from '../lib/scoreEngine.js'

const router = Router()

/** 获取任务列表 */
router.get('/', async (_req, res) => {
  const tasks = await loadTasks()
  res.json({ success: true, data: tasks })
})

/** 创建融合任务 - 异步启动执行流程 */
router.post('/', async (req, res) => {
  const body = req.body as CreateFusionRequest
  if (!Array.isArray(body.projectIds) || body.projectIds.length < 2) {
    res.status(400).json({ success: false, error: '至少选择 2 个项目' })
    return
  }

  const allProjects = await loadProjects()
  const selected = allProjects.filter((p) => body.projectIds.includes(p.id))
  if (selected.length < 2) {
    res.status(400).json({ success: false, error: '部分项目不存在' })
    return
  }

  const now = new Date().toISOString()
  const task: FusionTask = {
    id: generateTaskId(),
    projectIds: body.projectIds,
    strategy: body.strategy || 'balanced',
    securityLevel: body.securityLevel ?? 3,
    model: body.model || 'gpt-4o-mini',
    status: 'pending',
    currentStep: '任务已创建，等待启动',
    logs: [{
      time: now,
      step: 'pending',
      level: 'info',
      message: `创建融合任务：${selected.map((p) => p.name).join(' + ')}`,
    }],
    createdAt: now,
    updatedAt: now,
  }

  await saveTask(task)

  // 异步执行融合流程，不阻塞响应
  executeFusion({
    task,
    projects: selected,
    apiKey: body.apiKey,
    model: body.model,
  }).catch((err) => {
    task.status = 'failed'
    task.currentStep = '执行异常'
    task.logs.push({
      time: new Date().toISOString(),
      step: 'failed',
      level: 'error',
      message: `执行失败：${err?.message ?? '未知错误'}`,
    })
    saveTask(task).catch(() => {})
  })

  res.json({ success: true, data: { taskId: task.id } })
})

/** 获取任务状态与日志 */
router.get('/:taskId', async (req, res) => {
  const task = await getTask(req.params.taskId)
  if (!task) {
    res.status(404).json({ success: false, error: '任务不存在' })
    return
  }
  res.json({ success: true, data: task })
})

/** 获取融合产物文件树 */
router.get('/:taskId/artifacts', async (req, res) => {
  const task = await getTask(req.params.taskId)
  if (!task) {
    res.status(404).json({ success: false, error: '任务不存在' })
    return
  }
  if (!task.report) {
    res.status(400).json({ success: false, error: '任务尚未完成' })
    return
  }
  res.json({ success: true, data: { files: task.report.files } })
})

/** 下载单个文件 */
router.get('/:taskId/artifacts/*', async (req, res) => {
  const task = await getTask(req.params.taskId)
  if (!task || !task.report) {
    res.status(404).json({ success: false, error: '任务或产物不存在' })
    return
  }
  const filePath = req.params[0]
  const flat = flattenFiles(task.report.files)
  const file = flat.find((f) => f.path === filePath)
  if (!file) {
    res.status(404).json({ success: false, error: '文件不存在' })
    return
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${file.path.split('/').pop()}"`)
  res.send(file.content)
})

/** 下载整包（JSON 格式，包含所有文件） */
router.get('/:taskId/download', async (req, res) => {
  const task = await getTask(req.params.taskId)
  if (!task || !task.report) {
    res.status(404).json({ success: false, error: '任务或产物不存在' })
    return
  }
  const flat = flattenFiles(task.report.files)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="fusion-${task.id}.json"`)
  res.send(JSON.stringify({
    taskId: task.id,
    projectIds: task.projectIds,
    score: task.score,
    files: flat,
  }, null, 2))
})

/** 扁平化文件树 */
function flattenFiles(nodes: any[]): { path: string; content: string }[] {
  const result: { path: string; content: string }[] = []
  for (const n of nodes) {
    if (n.type === 'file' && n.content) {
      result.push({ path: n.path, content: n.content })
    }
    if (n.children) result.push(...flattenFiles(n.children))
  }
  return result
}

export default router
