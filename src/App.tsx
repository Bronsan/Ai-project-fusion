// 应用根组件 - 路由配置与登录守卫
// 桌面客户端模块化布局：登录 → 模块中心 → 各独立功能区

import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import Login from '@/pages/Login'
import Modules from '@/pages/Modules'
import Select from '@/pages/Select'
import Configure from '@/pages/Configure'
import Execute from '@/pages/Execute'
import Report from '@/pages/Report'
import History from '@/pages/History'
import Settings from '@/pages/Settings'

/** 登录守卫 - 未登录重定向到登录页 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAuthStore()
  const location = useLocation()
  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <>{children}</>
}

export default function App() {
  const { isLoggedIn } = useAuthStore()
  const [ready, setReady] = useState(false)

  // 等待自动登录检测完成（authStore 内部处理）
  useEffect(() => {
    // 给 autoLogin 一点时间，避免闪烁
    const t = setTimeout(() => setReady(true), 100)
    return () => clearTimeout(t)
  }, [])

  if (!ready) {
    return <div className="min-h-screen" style={{ background: 'var(--color-bg)' }} />
  }

  return (
    <Router>
      <Routes>
        {/* 登录页 */}
        <Route path="/login" element={isLoggedIn ? <Navigate to="/modules" replace /> : <Login />} />

        {/* 模块中心（登录后入口） */}
        <Route path="/modules" element={<RequireAuth><Modules /></RequireAuth>} />

        {/* 各功能模块 - 均需登录 */}
        <Route path="/select" element={<RequireAuth><Select /></RequireAuth>} />
        <Route path="/configure" element={<RequireAuth><Configure /></RequireAuth>} />
        <Route path="/execute/:taskId" element={<RequireAuth><Execute /></RequireAuth>} />
        <Route path="/report" element={<RequireAuth><Report /></RequireAuth>} />
        <Route path="/report/:taskId" element={<RequireAuth><Report /></RequireAuth>} />
        <Route path="/history" element={<RequireAuth><History /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />

        {/* 默认跳转 */}
        <Route path="/" element={<Navigate to={isLoggedIn ? '/modules' : '/login'} replace />} />
        <Route path="*" element={<Navigate to={isLoggedIn ? '/modules' : '/login'} replace />} />
      </Routes>
    </Router>
  )
}
