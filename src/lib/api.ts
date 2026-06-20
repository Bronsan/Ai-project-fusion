// API 封装 - 双模式：Wails 桌面调用 Go 绑定 / Web 模式调用 fetch
// 桌面模式下所有请求走 Go 后端，无需 Express 服务器

import type {
  Project,
  PreviewScore,
  FusionTask,
  FusionStrategy,
  FileNode,
} from './types'
import { isWails } from '@/store/useAuthStore'

/** 统一响应格式（仅 Web 模式使用） */
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

/** Web 模式通用请求方法 */
async function request<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json = (await res.json()) as ApiResponse<T>
  if (!json.success) {
    throw new Error(json.error || '请求失败')
  }
  return json.data as T
}

/** 获取项目库列表 */
export async function fetchProjects(): Promise<Project[]> {
  if (isWails) {
    return await window.go.main.App.GetProjects()
  }
  return request<Project[]>('/api/projects')
}

/** 上传项目 zip 压缩包 */
export async function uploadProject(file: File): Promise<Project> {
  if (isWails) {
    // 桌面模式：通过 Wails runtime 读取文件路径后调用 Go
    // Wails v2 提供 window['go'] 但文件路径需通过对话框获取
    // 这里使用 runtime 的文件选择，由调用方传入路径
    throw new Error('桌面模式请使用 uploadProjectByPath')
  }
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/projects/upload', {
    method: 'POST',
    body: formData,
  })
  const json = await res.json()
  if (!json.success) {
    throw new Error(json.error || '上传失败')
  }
  return json.data as Project
}

/** 桌面模式：按文件路径上传项目 */
export async function uploadProjectByPath(filePath: string): Promise<Project> {
  if (!isWails) {
    throw new Error('仅桌面模式支持')
  }
  return await window.go.main.App.UploadProject(filePath)
}

/** 删除上传项目 */
export async function deleteUploadedProject(id: string): Promise<void> {
  if (isWails) {
    await window.go.main.App.DeleteUploadedProject(id)
    return
  }
  await fetch(`/api/projects/${id}`, { method: 'DELETE' })
}

/** 预评分 */
export async function previewScore(projectIds: string[]): Promise<PreviewScore> {
  if (isWails) {
    return await window.go.main.App.PreviewScoreAPI(projectIds)
  }
  return request<PreviewScore>('/api/score/preview', {
    method: 'POST',
    body: JSON.stringify({ projectIds }),
  })
}

/** 创建融合任务 */
export async function createFusionTask(params: {
  projectIds: string[]
  strategy: FusionStrategy
  securityLevel: number
  apiKey?: string
  model?: string
}): Promise<{ taskId: string }> {
  if (isWails) {
    const task = await window.go.main.App.StartFusion(
      params.projectIds,
      params.strategy,
      params.securityLevel,
      params.apiKey || '',
      params.model || ''
    )
    return { taskId: task.id }
  }
  return request<{ taskId: string }>('/api/fusion', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/** 获取任务详情 */
export async function fetchTask(taskId: string): Promise<FusionTask> {
  if (isWails) {
    return await window.go.main.App.GetTask(taskId)
  }
  return request<FusionTask>(`/api/fusion/${taskId}`)
}

/** 获取任务列表 */
export async function fetchTasks(): Promise<FusionTask[]> {
  if (isWails) {
    return await window.go.main.App.ListTasks()
  }
  return request<FusionTask[]>('/api/fusion')
}

/** 获取融合产物文件树 */
export async function fetchArtifacts(taskId: string): Promise<{ files: FileNode[] }> {
  if (isWails) {
    const task = await window.go.main.App.GetTask(taskId)
    return { files: task.report?.files || [] }
  }
  return request<{ files: FileNode[] }>(`/api/fusion/${taskId}/artifacts`)
}

/** 测试 API Key */
export async function testApiKey(apiKey: string, model?: string): Promise<{
  ok: boolean
  message: string
  model?: string
  builtin: boolean
  defaultModel: string
}> {
  if (isWails) {
    // 桌面模式：Go 内置演示 Key，默认可用
    return { ok: true, message: '已启用内置 AI（演示模式）', builtin: true, defaultModel: 'gpt-4o-mini' }
  }
  return request('/api/ai/test', {
    method: 'POST',
    body: JSON.stringify({ apiKey, model }),
  })
}

/** 下载整包 URL（仅 Web 模式） */
export function getDownloadUrl(taskId: string): string {
  return `/api/fusion/${taskId}/download`
}

/** 下载单文件 URL（仅 Web 模式） */
export function getFileDownloadUrl(taskId: string, path: string): string {
  return `/api/fusion/${taskId}/artifacts/${path}`
}
