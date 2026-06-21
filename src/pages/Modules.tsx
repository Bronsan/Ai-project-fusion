// 模块中心 - 独立区块导航，无统一主页
// 每个模块独立运作，点击进入对应功能区

import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  GitMerge, Upload, History, Settings, LogOut, Sparkles,
  ArrowUpRight, Shield, Cpu,
} from 'lucide-react'
import { useAuthStore, isWails } from '@/store/useAuthStore'
import AuroraBackground from '@/components/AuroraBackground'
import GlassCard from '@/components/GlassCard'
import ThemeToggle from '@/components/ThemeToggle'

// 模块定义
const MODULES = [
  {
    id: 'fusion',
    title: '项目融合工坊',
    subtitle: 'Project Fusion',
    description: '选择多个项目，AI 思考流程分析 → 安全审查 → 适配性评分 → 自动拼接融合',
    icon: GitMerge,
    color: 'linear-gradient(135deg, #7C5CFF, #5CE1E6)',
    path: '/select',
    badge: '核心',
  },
  {
    id: 'upload',
    title: '项目管理',
    subtitle: 'Project Manager',
    description: '上传自有项目 zip 压缩包，自动解析元数据，与内置演示项目混合参与融合',
    icon: Upload,
    color: 'linear-gradient(135deg, #5CE1E6, #6EFFC7)',
    path: '/select',
    badge: '已更新',
  },
  {
    id: 'history',
    title: '融合历史',
    subtitle: 'Fusion History',
    description: '查看所有融合任务记录，回看产物文件树、评分报告与执行日志',
    icon: History,
    color: 'linear-gradient(135deg, #FF6EC7, #FFB86C)',
    path: '/history',
    badge: '',
  },
  {
    id: 'settings',
    title: '设置中心',
    subtitle: 'Settings',
    description: 'AI API Key 配置、安全等级、修改密码、版本信息与更新日志',
    icon: Settings,
    color: 'linear-gradient(135deg, #FFB86C, #7C5CFF)',
    path: '/settings',
    badge: '',
  },
]

export default function Modules() {
  const navigate = useNavigate()
  const { username, logout } = useAuthStore()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen">
      <AuroraBackground />

      {/* 顶部栏 */}
      <header className="container-narrow py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--color-aurora-purple), var(--color-aurora-cyan))' }}
          >
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">ProjectFusion</h1>
            <p className="text-[10px] text-dim">v0.13beta</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="text-right hidden sm:block">
            <p className="text-xs text-dim">已登录</p>
            <p className="text-sm font-medium">{username}</p>
          </div>
          <button className="btn-ghost !p-2" onClick={handleLogout} title="登出">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* 模块网格 */}
      <main className="container-narrow py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <h2 className="text-4xl font-bold mb-3">
            选择一个模块
            <span className="text-gradient ml-2">开始工作</span>
          </h2>
          <p className="text-sm text-dim">
            每个模块独立运作，互不干扰。{isWails ? '桌面客户端' : 'Web 演示模式'} · 内置 AI 已就绪
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {MODULES.map((mod, i) => {
            const Icon = mod.icon
            return (
              <motion.div
                key={mod.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                whileHover={{ y: -4 }}
                onClick={() => navigate(mod.path)}
                className="cursor-pointer"
              >
                <GlassCard className="p-6 h-full" hover>
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ background: mod.color, boxShadow: '0 8px 20px rgba(0,0,0,0.3)' }}
                    >
                      <Icon size={22} className="text-white" />
                    </div>
                    <div className="flex items-center gap-2">
                      {mod.badge && (
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{
                            background: 'rgba(92, 225, 230, 0.12)',
                            color: 'var(--color-aurora-cyan)',
                            border: '1px solid rgba(92, 225, 230, 0.25)',
                          }}
                        >
                          {mod.badge}
                        </span>
                      )}
                      <ArrowUpRight size={16} className="text-dim" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold mb-1">{mod.title}</h3>
                  <p className="text-[10px] text-dim mb-3 tracking-wider uppercase">{mod.subtitle}</p>
                  <p className="text-sm text-dim leading-relaxed">{mod.description}</p>
                </GlassCard>
              </motion.div>
            )
          })}
        </div>

        {/* 底部特性条 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-dim"
        >
          <span className="flex items-center gap-1.5"><Cpu size={12} /> 内置 AI 引擎</span>
          <span className="flex items-center gap-1.5"><Shield size={12} /> bcrypt 加密</span>
          <span className="flex items-center gap-1.5"><GitMerge size={12} /> 智能融合</span>
        </motion.div>
      </main>
    </div>
  )
}
