// 主题状态管理 - 浅色/深色模式切换
// 持久化到 localStorage，默认深色模式

import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark'

interface ThemeState {
  mode: ThemeMode
  toggle: () => void
  setMode: (mode: ThemeMode) => void
}

const STORAGE_KEY = 'pf_theme_mode'

/** 从 localStorage 读取已保存的主题 */
function loadTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  // 默认深色
  return 'dark'
}

/** 应用主题到 document.documentElement */
function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (mode === 'light') {
    root.classList.add('light')
  } else {
    root.classList.remove('light')
  }
}

// 初始化时应用主题
const initialMode = loadTheme()
applyTheme(initialMode)

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: initialMode,
  toggle: () => {
    const next = get().mode === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    localStorage.setItem(STORAGE_KEY, next)
    set({ mode: next })
  },
  setMode: (mode) => {
    applyTheme(mode)
    localStorage.setItem(STORAGE_KEY, mode)
    set({ mode })
  },
}))
