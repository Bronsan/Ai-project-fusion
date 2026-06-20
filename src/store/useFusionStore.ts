// 融合工坊全局状态 - Zustand

import { create } from 'zustand'
import type {
  Project,
  PreviewScore,
  FusionStrategy,
  FusionTask,
} from '@/lib/types'
import * as api from '@/lib/api'

interface FusionState {
  // 项目库
  projects: Project[]
  projectsLoading: boolean
  loadProjects: () => Promise<void>

  // 已选项目
  selectedIds: string[]
  toggleSelect: (id: string) => void
  clearSelection: () => void

  // 预评分
  preview: PreviewScore | null
  previewLoading: boolean
  computePreview: () => Promise<void>

  // 配置
  strategy: FusionStrategy
  securityLevel: number
  apiKey: string
  model: string
  setStrategy: (s: FusionStrategy) => void
  setSecurityLevel: (n: number) => void
  setApiKey: (k: string) => void
  setModel: (m: string) => void

  // 任务
  tasks: FusionTask[]
  loadTasks: () => Promise<void>
  currentTask: FusionTask | null
  startFusion: () => Promise<string | null>
  refreshCurrentTask: () => Promise<void>

  // API Key 测试
  keyTestResult: { ok: boolean; message: string } | null
  keyTesting: boolean
  testKey: () => Promise<void>
}

export const useFusionStore = create<FusionState>((set, get) => ({
  // ===== 项目库 =====
  projects: [],
  projectsLoading: false,
  loadProjects: async () => {
    set({ projectsLoading: true })
    try {
      const projects = await api.fetchProjects()
      set({ projects, projectsLoading: false })
    } catch {
      set({ projectsLoading: false })
    }
  },

  // ===== 已选项目 =====
  selectedIds: [],
  toggleSelect: (id) => {
    const { selectedIds } = get()
    if (selectedIds.includes(id)) {
      set({ selectedIds: selectedIds.filter((x) => x !== id), preview: null })
    } else {
      set({ selectedIds: [...selectedIds, id], preview: null })
    }
  },
  clearSelection: () => set({ selectedIds: [], preview: null }),

  // ===== 预评分 =====
  preview: null,
  previewLoading: false,
  computePreview: async () => {
    const { selectedIds } = get()
    if (selectedIds.length < 2) {
      set({ preview: null })
      return
    }
    set({ previewLoading: true })
    try {
      const preview = await api.previewScore(selectedIds)
      set({ preview, previewLoading: false })
    } catch {
      set({ previewLoading: false })
    }
  },

  // ===== 配置 =====
  strategy: 'balanced',
  securityLevel: 3,
  apiKey: '',
  model: 'gpt-4o-mini',
  setStrategy: (s) => set({ strategy: s }),
  setSecurityLevel: (n) => set({ securityLevel: n }),
  setApiKey: (k) => set({ apiKey: k }),
  setModel: (m) => set({ model: m }),

  // ===== 任务 =====
  tasks: [],
  loadTasks: async () => {
    try {
      const tasks = await api.fetchTasks()
      set({ tasks })
    } catch {
      // 忽略
    }
  },
  currentTask: null,
  startFusion: async () => {
    const { selectedIds, strategy, securityLevel, apiKey, model } = get()
    if (selectedIds.length < 2) return null
    try {
      const { taskId } = await api.createFusionTask({
        projectIds: selectedIds,
        strategy,
        securityLevel,
        apiKey: apiKey || undefined,
        model,
      })
      return taskId
    } catch {
      return null
    }
  },
  refreshCurrentTask: async () => {
    const { currentTask } = get()
    if (!currentTask) return
    try {
      const task = await api.fetchTask(currentTask.id)
      set({ currentTask: task })
    } catch {
      // 忽略
    }
  },

  // ===== API Key 测试 =====
  keyTestResult: null,
  keyTesting: false,
  testKey: async () => {
    const { apiKey, model } = get()
    set({ keyTesting: true })
    try {
      const result = await api.testApiKey(apiKey, model)
      set({
        keyTesting: false,
        keyTestResult: { ok: result.ok, message: result.message },
      })
    } catch {
      set({
        keyTesting: false,
        keyTestResult: { ok: false, message: '测试失败' },
      })
    }
  },
}))
