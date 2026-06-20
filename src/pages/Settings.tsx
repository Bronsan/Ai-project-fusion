// 设置中心 - API Key、安全等级、修改密码、版本信息

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Settings as SettingsIcon, Key, Shield, Lock, Loader2,
  CheckCircle2, Sparkles, Info,
} from 'lucide-react'
import { useAuthStore, isWails } from '@/store/useAuthStore'
import { testApiKey } from '@/lib/api'
import AuroraBackground from '@/components/AuroraBackground'
import GlassCard from '@/components/GlassCard'

export default function Settings() {
  const navigate = useNavigate()
  const { username, changePassword, loading, error } = useAuthStore()
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-4o-mini')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState('')
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')
  const [version, setVersion] = useState('0.01beta')
  const [changelog, setChangelog] = useState('')

  useEffect(() => {
    if (isWails) {
      window.go.main.App.GetVersion().then(setVersion)
      window.go.main.App.GetChangelog().then(setChangelog)
    } else {
      setChangelog(`0.01beta
- 新增：可自行上传项目文件（zip 压缩包）进行融合
- 新增：用户登录与注册，密码 bcrypt 加密存储
- 新增：一键登录（记住密码），30 天免登录
- 新增：模块化独立区块布局
- 初始版本：AI 驱动的开源项目智能融合工坊`)
    }
  }, [])

  const handleTestKey = async () => {
    setTesting(true)
    setTestResult('')
    try {
      const res = await testApiKey(apiKey, model)
      setTestResult(res.message)
    } catch (err: any) {
      setTestResult(err?.message || '测试失败')
    }
    setTesting(false)
  }

  const handleChangePwd = async () => {
    setPwdMsg('')
    if (newPwd.length < 6) {
      setPwdMsg('新密码至少 6 个字符')
      return
    }
    const ok = await changePassword(oldPwd, newPwd)
    if (ok) {
      setPwdMsg('密码修改成功')
      setOldPwd('')
      setNewPwd('')
    } else {
      setPwdMsg(error || '修改失败')
    }
  }

  return (
    <div className="min-h-screen">
      <AuroraBackground />
      <div className="container-narrow py-8">
        <div className="flex items-center gap-3 mb-8">
          <button className="btn-ghost !p-2" onClick={() => navigate('/modules')}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <SettingsIcon size={22} /> 设置中心
            </h1>
            <p className="text-xs text-dim mt-1">AI 配置、安全与账户管理</p>
          </div>
        </div>

        <div className="space-y-6 max-w-2xl">
          {/* AI 配置 */}
          <GlassCard className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Key size={18} className="text-aurora-purple" />
              <h2 className="text-base font-semibold">AI 引擎配置</h2>
            </div>
            <p className="text-xs text-dim mb-4">
              内置演示 AI 已就绪。如需更强能力，可填入自有 OpenAI 兼容 API Key。
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-dim mb-1.5 block">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="input"
                  placeholder="sk-...（留空使用内置演示）"
                />
              </div>
              <div>
                <label className="text-xs text-dim mb-1.5 block">模型</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="input"
                  placeholder="gpt-4o-mini"
                />
              </div>
              <button className="btn-primary" onClick={handleTestKey} disabled={testing}>
                {testing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                测试连接
              </button>
              {testResult && (
                <p className="text-xs text-aurora-cyan flex items-center gap-1.5">
                  <CheckCircle2 size={12} /> {testResult}
                </p>
              )}
            </div>
          </GlassCard>

          {/* 修改密码 */}
          <GlassCard className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lock size={18} className="text-aurora-cyan" />
              <h2 className="text-base font-semibold">修改密码</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-dim mb-1.5 block">当前账户：{username}</label>
              </div>
              <div>
                <label className="text-xs text-dim mb-1.5 block">原密码</label>
                <input
                  type="password"
                  value={oldPwd}
                  onChange={(e) => setOldPwd(e.target.value)}
                  className="input"
                  placeholder="输入当前密码"
                />
              </div>
              <div>
                <label className="text-xs text-dim mb-1.5 block">新密码</label>
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  className="input"
                  placeholder="至少 6 个字符"
                />
              </div>
              <button className="btn-primary" onClick={handleChangePwd} disabled={loading}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                确认修改
              </button>
              {pwdMsg && (
                <p className="text-xs text-aurora-cyan">{pwdMsg}</p>
              )}
            </div>
          </GlassCard>

          {/* 版本信息 */}
          <GlassCard className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Info size={18} className="text-aurora-pink" />
              <h2 className="text-base font-semibold">版本信息</h2>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, var(--color-aurora-purple), var(--color-aurora-cyan))' }}
              >
                <Sparkles size={18} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold">ProjectFusion</p>
                <p className="text-xs text-dim">版本 {version}</p>
              </div>
            </div>
            {changelog && (
              <div className="text-xs text-dim whitespace-pre-line leading-relaxed p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                {changelog}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
