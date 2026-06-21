// 认证状态管理 - 登录态、用户信息、记住密码 token

import { create } from 'zustand'

// 检测是否在 Wails 桌面环境
export const isWails = typeof window !== 'undefined' && !!(window as any).go?.main?.App

// Wails 绑定类型声明
declare global {
  interface Window {
    go?: {
      main?: {
        App?: {
          RegisterUser: (username: string, password: string) => Promise<any>
          Login: (username: string, password: string, remember: boolean) => Promise<any>
          LoginWithToken: (token: string) => Promise<any>
          Logout: (username: string) => Promise<void>
          ChangePassword: (username: string, oldPwd: string, newPwd: string) => Promise<any>
          GetVersion: () => Promise<string>
          GetChangelog: () => Promise<string>
          GetUserInfo: (username: string) => Promise<any>
          // 业务方法
          GetProjects: () => Promise<any[]>
          PreviewScoreAPI: (ids: string[]) => Promise<any>
          DeleteUploadedProject: (id: string) => Promise<boolean>
          UploadProject: (filePath: string) => Promise<any>
          StartFusion: (ids: string[], strategy: string, level: number, apiKey: string, model: string) => Promise<any>
          GetTask: (id: string) => Promise<any>
          ListTasks: () => Promise<any[]>
          CancelFusion: (taskId: string) => Promise<{ cancelled: boolean }>
        }
      }
    }
  }
}

interface AuthState {
  isLoggedIn: boolean
  username: string
  token: string
  loading: boolean
  error: string | null
  // 登录
  login: (username: string, password: string, remember: boolean) => Promise<boolean>
  // 一键登录（用记住的 token）
  autoLogin: () => Promise<boolean>
  // 注册
  register: (username: string, password: string) => Promise<boolean>
  // 登出
  logout: () => Promise<void>
  // 修改密码
  changePassword: (oldPwd: string, newPwd: string) => Promise<boolean>
}

// 本地存储 key
const TOKEN_KEY = 'pf_remember_token'
const USER_KEY = 'pf_username'

export const useAuthStore = create<AuthState>((set, get) => ({
  isLoggedIn: false,
  username: '',
  token: '',
  loading: false,
  error: null,

  login: async (username, password, remember) => {
    set({ loading: true, error: null })
    try {
      if (isWails) {
        // 桌面模式：调用 Go 绑定
        const res = await window.go.main.App.Login(username, password, remember)
        if (res.success) {
          if (remember && res.token) {
            localStorage.setItem(TOKEN_KEY, res.token)
            localStorage.setItem(USER_KEY, username)
          }
          set({ isLoggedIn: true, username, token: res.token || '', loading: false })
          return true
        }
        set({ loading: false, error: res.error || '登录失败' })
        return false
      } else {
        // Web 模式：本地模拟（无后端认证）
        if (username && password.length >= 6) {
          if (remember) {
            localStorage.setItem(TOKEN_KEY, 'web-mock-token')
            localStorage.setItem(USER_KEY, username)
          }
          set({ isLoggedIn: true, username, loading: false })
          return true
        }
        set({ loading: false, error: '用户名或密码无效' })
        return false
      }
    } catch (err: any) {
      set({ loading: false, error: err?.message || '登录失败' })
      return false
    }
  },

  autoLogin: async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    const username = localStorage.getItem(USER_KEY)
    if (!token || !username) return false

    set({ loading: true })
    try {
      if (isWails) {
        const res = await window.go.main.App.LoginWithToken(token)
        if (res.success) {
          localStorage.setItem(TOKEN_KEY, res.token || token)
          set({ isLoggedIn: true, username: res.username || username, token: res.token || token, loading: false })
          return true
        }
        // token 失效，清除
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        set({ loading: false })
        return false
      } else {
        // Web 模式直接放行
        set({ isLoggedIn: true, username, loading: false })
        return true
      }
    } catch {
      set({ loading: false })
      return false
    }
  },

  register: async (username, password) => {
    set({ loading: true, error: null })
    try {
      if (isWails) {
        const res = await window.go.main.App.RegisterUser(username, password)
        if (res.success) {
          set({ loading: false })
          return true
        }
        set({ loading: false, error: res.error || '注册失败' })
        return false
      } else {
        // Web 模式模拟
        if (username.length >= 2 && password.length >= 6) {
          set({ loading: false })
          return true
        }
        set({ loading: false, error: '用户名至少 2 字符，密码至少 6 字符' })
        return false
      }
    } catch (err: any) {
      set({ loading: false, error: err?.message || '注册失败' })
      return false
    }
  },

  logout: async () => {
    const { username } = get()
    if (isWails) {
      try {
        await window.go.main.App.Logout(username)
      } catch {
        // 忽略
      }
    }
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    set({ isLoggedIn: false, username: '', token: '' })
  },

  changePassword: async (oldPwd, newPwd) => {
    const { username } = get()
    set({ loading: true, error: null })
    try {
      if (isWails) {
        const res = await window.go.main.App.ChangePassword(username, oldPwd, newPwd)
        if (res.success) {
          set({ loading: false })
          return true
        }
        set({ loading: false, error: res.error || '修改失败' })
        return false
      }
      set({ loading: false })
      return true
    } catch (err: any) {
      set({ loading: false, error: err?.message || '修改失败' })
      return false
    }
  },
}))
