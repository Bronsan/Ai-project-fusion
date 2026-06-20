// 任务仓库 - 内存存储 + JSON 文件持久化

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import type { FusionTask, Project } from '../types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR = path.join(__dirname, '..', 'data')
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json')
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json')

// 内存缓存
let builtinProjectsCache: Project[] | null = null
// 用户上传项目（仅存内存，重启后清空）
const uploadedProjects = new Map<string, Project>()
const tasksCache = new Map<string, FusionTask>()

/** 加载内置项目库 */
async function loadBuiltinProjects(): Promise<Project[]> {
  if (builtinProjectsCache) return builtinProjectsCache
  const raw = await fs.readFile(PROJECTS_FILE, 'utf-8')
  const data = JSON.parse(raw) as { projects: Project[] }
  // 标记来源为内置
  builtinProjectsCache = data.projects.map((p) => ({ ...p, source: 'builtin' as const }))
  return builtinProjectsCache!
}

/** 获取全部项目（内置 + 用户上传） */
export async function loadProjects(): Promise<Project[]> {
  const builtin = await loadBuiltinProjects()
  const uploaded = Array.from(uploadedProjects.values())
  // 上传项目排在前面，方便用户优先看到
  return [...uploaded, ...builtin]
}

/** 根据 ID 获取项目 */
export async function getProjectById(id: string): Promise<Project | undefined> {
  // 先查上传项目，再查内置项目
  if (uploadedProjects.has(id)) return uploadedProjects.get(id)
  const builtin = await loadBuiltinProjects()
  return builtin.find((p) => p.id === id)
}

/** 添加用户上传项目 */
export function addUploadedProject(project: Project): void {
  uploadedProjects.set(project.id, project)
}

/** 删除用户上传项目 */
export function removeUploadedProject(id: string): boolean {
  return uploadedProjects.delete(id)
}

/** 加载所有任务 */
export async function loadTasks(): Promise<FusionTask[]> {
  if (tasksCache.size === 0) {
    try {
      const raw = await fs.readFile(TASKS_FILE, 'utf-8')
      const data = JSON.parse(raw) as { tasks: FusionTask[] }
      for (const t of data.tasks) tasksCache.set(t.id, t)
    } catch {
      // 文件不存在时忽略
    }
  }
  return Array.from(tasksCache.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** 获取单个任务 */
export async function getTask(id: string): Promise<FusionTask | undefined> {
  return tasksCache.get(id)
}

/** 保存任务（内存 + 文件） */
export async function saveTask(task: FusionTask): Promise<void> {
  task.updatedAt = new Date().toISOString()
  tasksCache.set(task.id, task)
  await persistTasks()
}

/** 持久化任务列表到文件 */
async function persistTasks(): Promise<void> {
  const tasks = Array.from(tasksCache.values())
  await fs.writeFile(TASKS_FILE, JSON.stringify({ tasks }, null, 2), 'utf-8')
}

/** 生成任务 ID */
export function generateTaskId(): string {
  return 'task_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** 生成上传项目 ID */
export function generateProjectId(): string {
  return 'up_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}
