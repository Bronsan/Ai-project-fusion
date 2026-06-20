// API 封装 - 统一处理后端请求

import type {
  Project,
  PreviewScore,
  FusionTask,
  FusionStrategy,
  FileNode,
} from './types'

/** 统一响应格式 */
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

/** 通用请求方法 */
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
export function fetchProjects(): Promise<Project[]> {
  return request<Project[]>('/api/projects')
}

/** 预评分 */
export function previewScore(projectIds: string[]): Promise<PreviewScore> {
  return request<PreviewScore>('/api/score/preview', {
    method: 'POST',
    body: JSON.stringify({ projectIds }),
  })
}

/** 创建融合任务 */
export function createFusionTask(params: {
  projectIds: string[]
  strategy: FusionStrategy
  securityLevel: number
  apiKey?: string
  model?: string
}): Promise<{ taskId: string }> {
  return request<{ taskId: string }>('/api/fusion', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/** 获取任务详情 */
export function fetchTask(taskId: string): Promise<FusionTask> {
  return request<FusionTask>(`/api/fusion/${taskId}`)
}

/** 获取任务列表 */
export function fetchTasks(): Promise<FusionTask[]> {
  return request<FusionTask[]>('/api/fusion')
}

/** 获取融合产物文件树 */
export function fetchArtifacts(taskId: string): Promise<{ files: FileNode[] }> {
  return request<{ files: FileNode[] }>(`/api/fusion/${taskId}/artifacts`)
}

/** 测试 API Key */
export function testApiKey(apiKey: string, model?: string): Promise<{
  ok: boolean
  message: string
  model?: string
  builtin: boolean
  defaultModel: string
}> {
  return request('/api/ai/test', {
    method: 'POST',
    body: JSON.stringify({ apiKey, model }),
  })
}

/** 下载整包 URL */
export function getDownloadUrl(taskId: string): string {
  return `/api/fusion/${taskId}/download`
}

/** 下载单文件 URL */
export function getFileDownloadUrl(taskId: string, path: string): string {
  return `/api/fusion/${taskId}/artifacts/${path}`
}
