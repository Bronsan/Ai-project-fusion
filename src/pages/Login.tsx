// 登录/注册页 - 玻璃质感，支持一键登录与记住密码

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, User, Eye, EyeOff, Loader2, Sparkles, LogIn, UserPlus, Zap } from 'lucide-react'
import { useAuthStore, isWails } from '@/store/useAuthStore'
import AuroraBackground from '@/components/AuroraBackground'

export default function Login() {
  const navigate = useNavigate()
  const { login, register, autoLogin, loading, error } = useAuthStore()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState('')
  const [autoChecking, setAutoChecking] = useState(true)

  // 启动时尝试一键登录
  useEffect(() => {
    const tryAuto = async () => {
      const ok = await autoLogin()
      if (ok) {
        navigate('/modules', { replace: true })
        return
      }
      setAutoChecking(false)
    }
    tryAuto()
  }, [autoLogin, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setLocalError('两次输入的密码不一致')
        return
      }
      const ok = await register(username, password)
      if (ok) {
        // 注册成功后自动登录
        await login(username, password, remember)
        navigate('/modules', { replace: true })
      }
    } else {
      const ok = await login(username, password, remember)
      if (ok) {
        navigate('/modules', { replace: true })
      }
    }
  }

  // 一键登录中
  if (autoChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AuroraBackground />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <Loader2 size={40} className="text-aurora-purple mx-auto mb-4 animate-spin" />
          <p className="text-sm text-dim">正在尝试一键登录...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <AuroraBackground />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        {/* 玻璃质感登录卡片 */}
        <div
          className="glass p-8 rounded-3xl"
          style={{
            boxShadow: '0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{
                background: 'linear-gradient(135deg, var(--color-aurora-purple), var(--color-aurora-cyan))',
                boxShadow: '0 8px 24px rgba(124, 92, 255, 0.4)',
              }}
            >
              <Sparkles size={28} className="text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold">ProjectFusion</h1>
            <p className="text-xs text-dim mt-1">AI 驱动的开源项目智能融合工坊 · 0.13beta</p>
          </div>

          {/* 模式切换 */}
          <div className="flex gap-2 p-1 rounded-xl mb-6" style={{ background: 'rgba(255,255,255,0.04)' }}>
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setLocalError('') }}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all relative"
                style={{ color: mode === m ? 'white' : 'var(--color-dim)' }}
              >
                {mode === m && (
                  <motion.div
                    layoutId="authMode"
                    className="absolute inset-0 rounded-lg"
                    style={{ background: 'linear-gradient(135deg, rgba(124,92,255,0.3), rgba(92,225,230,0.2))' }}
                  />
                )}
                <span className="relative z-10 flex items-center justify-center gap-1.5">
                  {m === 'login' ? <LogIn size={14} /> : <UserPlus size={14} />}
                  {m === 'login' ? '登录' : '注册'}
                </span>
              </button>
            ))}
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 用户名 */}
            <div>
              <label className="text-xs text-dim mb-1.5 block">用户名</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input pl-10"
                  placeholder="至少 2 个字符"
                  required
                  minLength={2}
                />
              </div>
            </div>

            {/* 密码 */}
            <div>
              <label className="text-xs text-dim mb-1.5 block">密码</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10 pr-10"
                  placeholder="至少 6 个字符"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* 确认密码（注册模式） */}
            <AnimatePresence>
              {mode === 'register' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label className="text-xs text-dim mb-1.5 block">确认密码</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input pl-10"
                      placeholder="再次输入密码"
                      required
                      minLength={6}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 记住密码（登录模式） */}
            {mode === 'login' && (
              <label className="flex items-center gap-2 cursor-pointer text-xs text-dim">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="accent-aurora-purple"
                />
                <Zap size={12} className="text-aurora-purple" />
                记住密码（30 天内一键登录）
              </label>
            )}

            {/* 错误提示 */}
            <AnimatePresence>
              {(error || localError) && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="p-3 rounded-xl text-xs flex items-center gap-2"
                  style={{
                    background: 'rgba(255, 110, 199, 0.08)',
                    border: '1px solid rgba(255, 110, 199, 0.25)',
                    color: 'var(--color-aurora-pink)',
                  }}
                >
                  {localError || error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center !py-3"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : mode === 'login' ? (
                <>
                  <LogIn size={16} /> 登录
                </>
              ) : (
                <>
                  <UserPlus size={16} /> 注册并登录
                </>
              )}
            </button>
          </form>

          {/* 安全提示 */}
          <p className="text-[10px] text-dim text-center mt-6 leading-relaxed">
            {isWails ? '密码使用 bcrypt 加密存储于本地 SQLite 数据库' : 'Web 演示模式，密码仅本地校验'}
            <br />
            桌面客户端登录后可使用全部功能
          </p>
        </div>
      </motion.div>
    </div>
  )
}
