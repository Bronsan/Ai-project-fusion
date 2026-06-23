// 融合配置页 - 策略、安全级别、API Key

import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Shield, Cpu, Key, Loader2,
  CheckCircle2, AlertCircle, Sparkles,
} from 'lucide-react'
import GlassCard from '@/components/GlassCard'
import { useFusionStore } from '@/store/useFusionStore'
import type { FusionStrategy } from '@/lib/types'

// 融合策略配置
const strategies: { value: FusionStrategy; label: string; desc: string }[] = [
  { value: 'conservative', label: '保守', desc: '保留原始结构，最小化桥接' },
  { value: 'balanced', label: '平衡', desc: '重构共享层，合并相似模块' },
  { value: 'aggressive', label: '激进', desc: '深度重构，最大化代码复用' },
]

// 安全级别说明
const securityLabels = ['极宽松', '宽松', '默认', '严格', '极严格']

export default function Configure() {
  const navigate = useNavigate()
  const {
    selectedIds, projects,
    strategy, setStrategy,
    securityLevel, setSecurityLevel,
    apiKey, setApiKey,
    model, setModel,
    baseUrl, setBaseUrl,
    customModel, setCustomModel,
    keyTesting, keyTestResult, testKey,
    startFusion,
  } = useFusionStore()

  const selectedProjects = projects.filter((p) => selectedIds.includes(p.id))
  const canStart = selectedIds.length >= 2
  // 是否为自定义模式（model === 'custom'）
  const isCustomMode = model === 'custom'

  // 启动融合
  const handleStart = async () => {
    const taskId = await startFusion()
    if (taskId) {
      navigate(`/execute/${taskId}`)
    }
  }

  return (
    <div className="page-enter container-narrow py-10">
      {/* 顶部 */}
      <div className="flex items-center gap-3 mb-8">
        <button className="btn-ghost !p-2" onClick={() => navigate('/select')}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-3xl font-bold">融合配置</h1>
          <p className="text-sm text-dim mt-1">设置融合策略、安全级别与 AI 模型</p>
        </div>
      </div>

      {/* 已选项目摘要 */}
      <GlassCard className="p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">已选项目（{selectedProjects.length}）</h3>
          <button className="text-xs text-dim hover:text-white" onClick={() => navigate('/select')}>
            修改选择
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedProjects.map((p, i) => (
            <span key={p.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
              style={{ background: 'rgba(124, 92, 255, 0.12)', border: '1px solid rgba(124, 92, 255, 0.25)' }}>
              <span className="text-aurora-purple">{i + 1}</span>
              {p.name}
            </span>
          ))}
          {selectedProjects.length < 2 && (
            <span className="text-xs text-aurora-pink flex items-center gap-1">
              <AlertCircle size={12} /> 至少需要 2 个项目
            </span>
          )}
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左列：策略与安全级别 */}
        <div className="space-y-6">
          {/* 融合策略 */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <GlassCard className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={16} className="text-aurora-purple" />
                <h3 className="text-base font-semibold">融合策略</h3>
              </div>
              <div className="space-y-2">
                {strategies.map((s) => {
                  const active = strategy === s.value
                  return (
                    <button
                      key={s.value}
                      onClick={() => setStrategy(s.value)}
                      className="w-full text-left p-4 rounded-xl transition-all"
                      style={{
                        background: active ? 'rgba(124, 92, 255, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                        border: active ? '1px solid rgba(124, 92, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{s.label}</span>
                        {active && <CheckCircle2 size={14} className="text-aurora-cyan" />}
                      </div>
                      <p className="text-xs text-dim">{s.desc}</p>
                    </button>
                  )
                })}
              </div>
            </GlassCard>
          </motion.div>

          {/* 安全级别 */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <GlassCard className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={16} className="text-aurora-pink" />
                <h3 className="text-base font-semibold">安全审查级别</h3>
              </div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-dim">级别</span>
                  <span className="text-sm font-semibold text-aurora-cyan">{securityLevel} · {securityLabels[securityLevel - 1]}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={securityLevel}
                  onChange={(e) => setSecurityLevel(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: 'var(--color-aurora-purple)' }}
                />
                <div className="flex justify-between text-xs text-dim mt-1">
                  <span>宽松</span>
                  <span>严格</span>
                </div>
              </div>
              <p className="text-xs text-dim leading-relaxed">
                级别越高，安全审查越严格。高级别会阻断 medium 及以上风险项目的拼接。
              </p>
            </GlassCard>
          </motion.div>
        </div>

        {/* 右列：API Key 配置 */}
        <div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
            <GlassCard className="p-6 h-full">
              <div className="flex items-center gap-2 mb-4">
                <Key size={16} className="text-aurora-cyan" />
                <h3 className="text-base font-semibold">AI 模型配置</h3>
              </div>

              {/* 内置 Key 提示 */}
              <div
                className="flex items-center gap-2 p-3 rounded-xl mb-4 text-xs"
                style={{
                  background: 'rgba(92, 225, 230, 0.08)',
                  border: '1px solid rgba(92, 225, 230, 0.2)',
                  color: 'var(--color-aurora-cyan)',
                }}
              >
                <CheckCircle2 size={14} />
                系统已内置 API Key，留空则使用内置 Key（演示模式）
              </div>

              {/* API Key 输入 */}
              <label className="block text-xs text-dim mb-2">自定义 API Key（可选）</label>
              <input
                type="password"
                className="input-glass mb-4"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />

              {/* 模型选择 */}
              <label className="block text-xs text-dim mb-2">模型</label>
              <select
                className="input-glass mb-4"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value="gpt-4o-mini">gpt-4o-mini（推荐，快速）</option>
                <option value="gpt-4o">gpt-4o（更强，较慢）</option>
                <option value="gpt-4-turbo">gpt-4-turbo</option>
                <option value="gpt-3.5-turbo">gpt-3.5-turbo（经济）</option>
                <option value="custom">自定义（自填服务商与端点）</option>
              </select>

              {/* 自定义模式：填写服务商端点与模型名 */}
              {isCustomMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-4 space-y-3 overflow-hidden"
                >
                  <div
                    className="flex items-center gap-2 p-3 rounded-xl text-xs"
                    style={{
                      background: 'rgba(124, 92, 255, 0.08)',
                      border: '1px solid rgba(124, 92, 255, 0.2)',
                      color: 'var(--color-aurora-purple)',
                    }}
                  >
                    <Sparkles size={14} />
                    自定义模式：自行填写 OpenAI 兼容服务商的 API 端点与模型名
                  </div>
                  <div>
                    <label className="block text-xs text-dim mb-2">API 端点（Base URL）</label>
                    <input
                      type="text"
                      className="input-glass"
                      placeholder="https://api.openai.com/v1"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-dim mb-2">模型名</label>
                    <input
                      type="text"
                      className="input-glass"
                      placeholder="gpt-4o-mini"
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                    />
                  </div>
                </motion.div>
              )}

              {/* 测试按钮 */}
              <button
                className="btn-ghost w-full text-sm"
                onClick={testKey}
                disabled={keyTesting}
              >
                {keyTesting ? (
                  <><Loader2 size={14} className="animate-spin" /> 测试中...</>
                ) : (
                  <><Cpu size={14} /> 测试连接</>
                )}
              </button>

              {/* 测试结果 */}
              {keyTestResult && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 p-3 rounded-xl text-xs flex items-center gap-2"
                  style={{
                    background: keyTestResult.ok ? 'rgba(92, 225, 230, 0.08)' : 'rgba(255, 110, 199, 0.08)',
                    border: `1px solid ${keyTestResult.ok ? 'rgba(92, 225, 230, 0.2)' : 'rgba(255, 110, 199, 0.2)'}`,
                    color: keyTestResult.ok ? 'var(--color-aurora-cyan)' : 'var(--color-aurora-pink)',
                  }}
                >
                  {keyTestResult.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {keyTestResult.message}
                </motion.div>
              )}

              {/* 说明 */}
              <div className="mt-6 pt-6 border-t border-white/5">
                <h4 className="text-xs font-semibold mb-2 text-dim">融合流程说明</h4>
                <ol className="text-xs text-dim space-y-1.5 leading-relaxed list-decimal pl-4">
                  <li>AI 思考流程分析项目结构与依赖</li>
                  <li>安全审查扫描代码与依赖风险</li>
                  <li>计算适配性正式评分（5 维度）</li>
                  <li>评分 &gt; 75 才进入代码拼接阶段</li>
                  <li>拼接后运行二次校验思考流程</li>
                  <li>输出融合产物与完整报告</li>
                </ol>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </div>

      {/* 底部操作 */}
      <div className="flex items-center justify-between mt-8">
        <button className="btn-ghost" onClick={() => navigate('/select')}>
          <ArrowLeft size={16} /> 上一步
        </button>
        <button
          className="btn-primary"
          disabled={!canStart}
          onClick={handleStart}
        >
          <Sparkles size={16} /> 启动融合 <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}
