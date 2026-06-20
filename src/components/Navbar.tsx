// 顶部导航栏 - 毛玻璃质感

import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Sparkles, Home, Layers, Settings, Activity, FileText } from 'lucide-react'

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()

  const navItems = [
    { path: '/', label: '工作台', icon: Home },
    { path: '/select', label: '选择项目', icon: Layers },
    { path: '/configure', label: '融合配置', icon: Settings },
  ]

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(10, 14, 39, 0.6)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <div className="container-narrow flex items-center justify-between h-16">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, var(--color-aurora-1), var(--color-aurora-2))',
              boxShadow: '0 4px 16px rgba(124, 92, 255, 0.4)',
            }}
          >
            <Sparkles size={18} color="#fff" />
          </div>
          <span className="text-lg font-semibold text-gradient">ProjectFusion</span>
        </Link>

        {/* 导航项 */}
        <div className="flex items-center gap-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all"
                style={{
                  background: active ? 'rgba(124, 92, 255, 0.15)' : 'transparent',
                  color: active ? '#fff' : 'var(--color-text-dim)',
                  border: active ? '1px solid rgba(124, 92, 255, 0.3)' : '1px solid transparent',
                }}
              >
                <Icon size={15} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
