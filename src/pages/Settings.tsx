// 设置中心 - API Key、安全等级、修改密码、版本信息

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Settings as SettingsIcon, Key, Shield, Lock, Loader2,
  CheckCircle2, Sparkles, Info, Sun, Moon,
} from 'lucide-react'
import { useAuthStore, isWails } from '@/store/useAuthStore'
import { testApiKey } from '@/lib/api'
import AuroraBackground from '@/components/AuroraBackground'
import GlassCard from '@/components/GlassCard'
import ThemeToggle from '@/components/ThemeToggle'
import { useThemeStore } from '@/store/useThemeStore'

export default function Settings() {
  const navigate = useNavigate()
  const { username, changePassword, loading, error } = useAuthStore()
  const { mode, setMode } = useThemeStore()
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-4o-mini')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState('')
  const [version, setVersion] = useState('0.13beta')
  const [changelog, setChangelog] = useState('')
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')

  useEffect(() => {
    if (isWails) {
      window.go.main.App.GetVersion().then(setVersion)
      window.go.main.App.GetChangelog().then(setChangelog)
    } else {
      setChangelog(`0.13beta
- 新增：AST 语义级融合引擎（@babel/parser，替代 regex 扫描，支持函数/类/常量/接口/类型/枚举实体提取）
- 新增：intra-entity 3-way merge（同名实体改动不重叠时自动合并函数体，Weave 风格）
- 新增：融合产物安全扫描（硬编码密钥、eval、SQL 注入、调试语句、路径穿越、ReDoS）
- 改进：实体级冲突检测（同名不同种类不再误判，如 class Foo vs function Foo）
- 改进：去重基于 AST 实体 body 哈希，更精准

0.12beta
- 新增：融合引擎升级为真代码融合（同名导出冲突检测与重命名、依赖版本冲突解决、代码级去重）
- 新增：AI 调用降级策略（超时控制、指数退避重试、流式输出支持）
- 新增：评分引擎单元测试（vitest，10+ 测试用例验证评分不写死）
- 新增：上传安全防护（zip 炸弹检测、路径穿越拦截、文件类型白名单）
- 新增：网页端上传限制 50MB，流量异常自动封号 1 小时（速率+流量双限）
- 新增：融合执行取消功能（AbortController，全程可取消）
- 新增：报告页对比视图（融合前后各项目维度对比表）

0.11beta
- 修复：评分引擎不再写死分数，改为基于真实代码 + 评分规则文件打分
- 新增：scoring-rules.json 评分标准规则定义文件（类似 skills 的可配置规则）
- 改进：AI 深度评分传入真实代码摘要（文件数、行数、导出、import、复杂度等）
- 改进：评分维度按权重加权计算总分（架构25%/依赖20%/许可20%/风格20%/文档15%）
- 验证：不同项目组合得到不同分数（64/73/76/80/81 等）

0.10 正式版
- 改进：评分引擎基于真实代码内容（导出分析、import 关系、复杂度）
- 改进：融合引擎真正合并上传源码到 src/modules/，生成真实入口与共享层
- 扩大：上传限制 50MB → 500MB，支持中大型开源项目
- 新增：浅色/深色模式切换（CSS 变量 + localStorage 持久化）
- 新增：主题切换按钮（模块中心 + 设置中心头部）
- 新增：设置中心外观主题卡片（浅色/深色双选）
- 新增：自动配置环境脚本（带进度条，一键安装）
- 整理：所有文件结构规范化，产物文件标记版本号

0.01beta
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
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <SettingsIcon size={22} /> 设置中心
            </h1>
            <p className="text-xs text-dim mt-1">AI 配置、安全与账户管理</p>
          </div>
          <ThemeToggle />
        </div>

        <div className="space-y-6 max-w-2xl">
          {/* 主题切换 */}
          <GlassCard className="p-6">
            <div className="flex items-center gap-2 mb-4">
              {mode === 'dark' ? <Moon size={18} className="text-aurora-cyan" /> : <Sun size={18} className="text-aurora-purple" />}
              <h2 className="text-base font-semibold">外观主题</h2>
            </div>
            <p className="text-xs text-dim mb-4">
              切换浅色或深色模式，设置会自动保存。
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode('light')}
                className="p-4 rounded-xl transition-all"
                style={{
                  background: mode === 'light' ? 'linear-gradient(135deg, #FFF8E7, #FFE5B4)' : 'var(--color-glass)',
                  border: mode === 'light' ? '2px solid var(--color-aurora-1)' : '1px solid var(--color-glass-border)',
                }}
              >
                <Sun size={20} className={mode === 'light' ? 'text-amber-500' : 'text-dim'} />
                <p className="text-sm font-medium mt-2">浅色模式</p>
                <p className="text-[10px] text-dim">明亮舒适</p>
              </button>
              <button
                onClick={() => setMode('dark')}
                className="p-4 rounded-xl transition-all"
                style={{
                  background: mode === 'dark' ? 'linear-gradient(135deg, #0A0E27, #1a1f3a)' : 'var(--color-glass)',
                  border: mode === 'dark' ? '2px solid var(--color-aurora-2)' : '1px solid var(--color-glass-border)',
                }}
              >
                <Moon size={20} className={mode === 'dark' ? 'text-aurora-cyan' : 'text-dim'} />
                <p className="text-sm font-medium mt-2">深色模式</p>
                <p className="text-[10px] text-dim">深邃护眼</p>
              </button>
            </div>
          </GlassCard>

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
