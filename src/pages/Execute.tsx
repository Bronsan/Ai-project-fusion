// 融合执行页 - 思考流程可视化、安全审查、日志流

import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Cpu, Shield, GitFork, CheckCircle2, AlertCircle, Loader2,
  ArrowRight, Activity,
} from 'lucide-react'
import GlassCard from '@/components/GlassCard'
import { fetchTask } from '@/lib/api'
import type { FusionTask, FusionStatus } from '@/lib/types'

// 流程步骤定义
const STEPS: { key: FusionStatus; label: string; icon: any; color: string }[] = [
  { key: 'thinking', label: '思考流程', icon: Cpu, color: '#7C5CFF' },
  { key: 'reviewing', label: '安全审查', icon: Shield, color: '#FF6EC7' },
  { key: 'scoring', label: '适配性评分', icon: Activity, color: '#5CE1E6' },
  { key: 'merging', label: '代码拼接', icon: GitFork, color: '#7C5CFF' },
  { key: 'verifying', label: '二次校验', icon: CheckCircle2, color: '#5CE1E6' },
]

// 步骤顺序索引
const stepOrder: FusionStatus[] = ['pending', 'thinking', 'reviewing', 'scoring', 'merging', 'verifying', 'done', 'failed']

export default function Execute() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [task, setTask] = useState<FusionTask | null>(null)
  const [loading, setLoading] = useState(true)
  const logEndRef = useRef<HTMLDivElement>(null)

  // 轮询任务状态
  useEffect(() => {
    if (!taskId) return
    let active = true

    const poll = async () => {
      try {
        const t = await fetchTask(taskId)
        if (!active) return
        setTask(t)
        setLoading(false)
        // 任务完成或失败时跳转报告页
        if (t.status === 'done' || t.status === 'failed') {
          setTimeout(() => navigate(`/report/${taskId}`), 1500)
          return
        }
      } catch {
        if (!active) return
        setLoading(false)
      }
      setTimeout(poll, 1500)
    }

    poll()
    return () => { active = false }
  }, [taskId, navigate])

  // 日志自动滚动到底部
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [task?.logs.length])

  if (loading || !task) {
    return (
      <div className="page-enter container-narrow py-20 text-center">
        <Loader2 size={40} className="text-aurora-purple mx-auto mb-4 animate-spin" />
        <p className="text-dim">加载任务...</p>
      </div>
    )
  }

  const currentStepIndex = stepOrder.indexOf(task.status)

  return (
    <div className="page-enter container-narrow py-10">
      {/* 顶部 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">融合执行中</h1>
        <p className="text-sm text-dim">{task.currentStep}</p>
      </div>

      {/* 流程步骤时间线 */}
      <GlassCard className="p-6 mb-6">
        <div className="flex items-center justify-between relative">
          {/* 进度连线 */}
          <div className="absolute top-5 left-5 right-5 h-0.5 bg-white/5" />
          <div
            className="absolute top-5 left-5 h-0.5 transition-all duration-500"
            style={{
              width: `calc(${(currentStepIndex / (STEPS.length - 1)) * 100}% - ${currentStepIndex === 0 ? 0 : 10}px)`,
              background: 'linear-gradient(90deg, var(--color-aurora-1), var(--color-aurora-2))',
            }}
          />
          {STEPS.map((step, i) => {
            const stepIdx = stepOrder.indexOf(step.key)
            const isDone = currentStepIndex > stepIdx
            const isActive = currentStepIndex === stepIdx
            const Icon = step.icon
            return (
              <div key={step.key} className="relative flex flex-col items-center" style={{ zIndex: 1 }}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500"
                  style={{
                    background: isDone || isActive ? `${step.color}20` : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${isDone || isActive ? step.color : 'rgba(255, 255, 255, 0.1)'}`,
                    boxShadow: isActive ? `0 0 20px ${step.color}60` : 'none',
                  }}
                >
                  {isActive ? (
                    <Loader2 size={16} style={{ color: step.color }} className="animate-spin" />
                  ) : isDone ? (
                    <CheckCircle2 size={16} style={{ color: step.color }} />
                  ) : (
                    <Icon size={16} className="text-dim" />
                  )}
                </div>
                <span
                  className="text-xs mt-2 transition-colors"
                  style={{ color: isDone || isActive ? step.color : 'var(--color-text-dim)' }}
                >
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：当前状态卡 + 评分 */}
        <div className="space-y-6">
          {/* 当前状态 */}
          <GlassCard className="p-6">
            <h3 className="text-sm font-semibold mb-4">当前状态</h3>
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{
                  background: task.status === 'failed' ? 'rgba(255, 110, 199, 0.15)' : 'rgba(124, 92, 255, 0.15)',
                  border: `1px solid ${task.status === 'failed' ? 'rgba(255, 110, 199, 0.3)' : 'rgba(124, 92, 255, 0.3)'}`,
                }}
              >
                {task.status === 'failed' ? (
                  <AlertCircle size={22} className="text-aurora-pink" />
                ) : task.status === 'done' ? (
                  <CheckCircle2 size={22} className="text-aurora-cyan" />
                ) : (
                  <Loader2 size={22} className="text-aurora-purple animate-spin" />
                )}
              </div>
              <div>
                <div className="text-sm font-medium">{task.currentStep}</div>
                <div className="text-xs text-dim mt-0.5">
                  策略: {task.strategy} · 安全级别: {task.securityLevel}
                </div>
              </div>
            </div>
          </GlassCard>

          {/* 评分卡（评分阶段后显示） */}
          {task.score !== undefined && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <GlassCard className="p-6 text-center">
                <h3 className="text-sm font-semibold mb-2">适配性评分</h3>
                <div
                  className="text-6xl font-bold mb-2"
                  style={{ color: task.score > 75 ? 'var(--color-aurora-cyan)' : 'var(--color-aurora-pink)' }}
                >
                  {task.score}
                </div>
                <div className="text-xs text-dim mb-3">阈值 75</div>
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
                  style={{
                    background: task.score > 75 ? 'rgba(92, 225, 230, 0.12)' : 'rgba(255, 110, 199, 0.12)',
                    color: task.score > 75 ? 'var(--color-aurora-cyan)' : 'var(--color-aurora-pink)',
                  }}
                >
                  {task.score > 75 ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                  {task.score > 75 ? '通过，进入拼接' : '未通过，流程终止'}
                </div>
              </GlassCard>
            </motion.div>
          )}
        </div>

        {/* 右侧：日志流 */}
        <div className="lg:col-span-2">
          <GlassCard className="p-0 overflow-hidden h-full flex flex-col" >
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Activity size={14} className="text-aurora-cyan" />
                实时日志
              </h3>
              <span className="text-xs text-dim">{task.logs.length} 条</span>
            </div>
            <div
              className="flex-1 overflow-y-auto p-5 font-mono text-xs space-y-1.5"
              style={{ maxHeight: 480, background: 'rgba(0, 0, 0, 0.2)' }}
            >
              <AnimatePresence initial={false}>
                {task.logs.map((log, i) => {
                  const colorMap = {
                    info: 'var(--color-text-dim)',
                    warn: '#FF6EC7',
                    error: '#FF4D6D',
                    success: 'var(--color-aurora-cyan)',
                  }
                  const iconMap = {
                    info: '·',
                    warn: '⚠',
                    error: '✗',
                    success: '✓',
                  }
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-2"
                    >
                      <span className="text-dim shrink-0">
                        {new Date(log.time).toLocaleTimeString('zh-CN', { hour12: false })}
                      </span>
                      <span style={{ color: colorMap[log.level] }} className="shrink-0">
                        {iconMap[log.level]}
                      </span>
                      <span className="text-dim shrink-0">[{log.step}]</span>
                      <span style={{ color: log.level === 'info' ? 'var(--color-text)' : colorMap[log.level] }}>
                        {log.message}
                      </span>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
              <div ref={logEndRef} />
            </div>
          </GlassCard>
        </div>
      </div>

      {/* 完成提示 */}
      {(task.status === 'done' || task.status === 'failed') && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <GlassCard className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {task.status === 'done' ? (
                <CheckCircle2 size={20} className="text-aurora-cyan" />
              ) : (
                <AlertCircle size={20} className="text-aurora-pink" />
              )}
              <span className="text-sm">
                {task.status === 'done' ? '融合完成，正在跳转报告页...' : '融合失败，正在跳转查看详情...'}
              </span>
            </div>
            <button className="btn-primary text-sm" onClick={() => navigate(`/report/${taskId}`)}>
              查看报告 <ArrowRight size={14} />
            </button>
          </GlassCard>
        </motion.div>
      )}
    </div>
  )
}
