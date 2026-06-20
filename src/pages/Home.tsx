// 工作台首页 - Hero 区、项目库、任务时间线

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sparkles, ArrowRight, Star, GitFork, Shield, Cpu,
  CheckCircle2, Clock, AlertCircle, Loader2,
} from 'lucide-react'
import GlassCard from '@/components/GlassCard'
import { useFusionStore } from '@/store/useFusionStore'
import type { FusionStatus } from '@/lib/types'

// 状态徽章配置
const statusConfig: Record<FusionStatus, { label: string; color: string; icon: any }> = {
  pending: { label: '等待中', color: '#8B92B8', icon: Clock },
  thinking: { label: '思考中', color: '#7C5CFF', icon: Loader2 },
  reviewing: { label: '审查中', color: '#FF6EC7', icon: Shield },
  scoring: { label: '评分中', color: '#5CE1E6', icon: Cpu },
  merging: { label: '拼接中', color: '#7C5CFF', icon: GitFork },
  verifying: { label: '校验中', color: '#5CE1E6', icon: CheckCircle2 },
  done: { label: '已完成', color: '#5CE1E6', icon: CheckCircle2 },
  failed: { label: '已失败', color: '#FF6EC7', icon: AlertCircle },
}

export default function Home() {
  const navigate = useNavigate()
  const { projects, projectsLoading, loadProjects, tasks, loadTasks, toggleSelect, selectedIds } = useFusionStore()

  useEffect(() => {
    loadProjects()
    loadTasks()
  }, [loadProjects, loadTasks])

  return (
    <div className="page-enter">
      {/* ===== Hero 区 ===== */}
      <section className="container-narrow pt-20 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          {/* AI 状态指示 */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-8">
            <span className="breathing-dot" />
            <span className="text-xs text-dim">AI 引擎已就绪 · 内置 API Key</span>
          </div>

          {/* 主标题 */}
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
            <span className="text-gradient">让开源项目</span>
            <br />
            <span className="text-gradient-aurora">智能融合为一个</span>
          </h1>

          <p className="text-lg text-dim max-w-2xl mx-auto mb-10 leading-relaxed">
            选择至少两个开源项目，AI 将通过思考流程分析、安全审查与适配性评分，
            <br />
            自动拼接出全新的融合项目。评分高于 75 分即可启动代码融合。
          </p>

          {/* CTA 按钮 */}
          <div className="flex items-center justify-center gap-4">
            <button className="btn-primary" onClick={() => navigate('/select')}>
              <Sparkles size={18} />
              开始融合
              <ArrowRight size={16} />
            </button>
            <button className="btn-ghost" onClick={() => navigate('/configure')}>
              查看配置
            </button>
          </div>
        </motion.div>

        {/* 特性卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-20">
          {[
            { icon: Cpu, title: 'AI 思考流程', desc: '大模型分析项目结构，规划融合方案' },
            { icon: Shield, title: '安全审查', desc: '规则扫描 + AI 深度审查，识别依赖与许可证风险' },
            { icon: GitFork, title: '智能拼接', desc: '评分 > 75 自动生成融合项目文件树' },
          ].map((feat, i) => {
            const Icon = feat.icon
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
              >
                <GlassCard className="p-6" hover>
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                    style={{
                      background: 'linear-gradient(135deg, rgba(124, 92, 255, 0.2), rgba(92, 225, 230, 0.1))',
                      border: '1px solid rgba(124, 92, 255, 0.3)',
                    }}
                  >
                    <Icon size={20} className="text-aurora-purple" />
                  </div>
                  <h3 className="text-base font-semibold mb-2">{feat.title}</h3>
                  <p className="text-sm text-dim leading-relaxed">{feat.desc}</p>
                </GlassCard>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* ===== 项目库 ===== */}
      <section className="container-narrow py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">项目库</h2>
            <p className="text-sm text-dim">已选 {selectedIds.length} 个项目 · 至少选择 2 个</p>
          </div>
          <button
            className="btn-ghost text-sm"
            onClick={() => navigate('/select')}
            disabled={selectedIds.length < 2}
          >
            前往选择 <ArrowRight size={14} />
          </button>
        </div>

        {projectsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="glass p-5 animate-pulse" style={{ height: 180 }}>
                <div className="h-4 w-1/2 bg-white/10 rounded mb-3" />
                <div className="h-3 w-full bg-white/5 rounded mb-2" />
                <div className="h-3 w-2/3 bg-white/5 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.slice(0, 6).map((project, i) => {
              const selected = selectedIds.includes(project.id)
              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                >
                  <GlassCard className="p-5 h-full" hover selected={selected} onClick={() => toggleSelect(project.id)}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-base font-semibold mb-1">{project.name}</h3>
                        <span className="text-xs text-dim">{project.language} · {project.license}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-dim">
                        <Star size={12} />
                        {(project.stars / 1000).toFixed(1)}k
                      </div>
                    </div>
                    <p className="text-sm text-dim leading-relaxed mb-4 line-clamp-2">{project.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {project.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                    {selected && (
                      <div className="mt-3 flex items-center gap-1 text-xs text-aurora-cyan">
                        <CheckCircle2 size={12} /> 已加入融合
                      </div>
                    )}
                  </GlassCard>
                </motion.div>
              )
            })}
          </div>
        )}
      </section>

      {/* ===== 任务时间线 ===== */}
      <section className="container-narrow py-16">
        <h2 className="text-3xl font-bold mb-8">最近融合任务</h2>
        {tasks.length === 0 ? (
          <GlassCard className="p-12 text-center">
            <div className="text-dim text-sm">暂无融合任务，点击上方"开始融合"创建第一个任务</div>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {tasks.slice(0, 5).map((task, i) => {
              const cfg = statusConfig[task.status]
              const Icon = cfg.icon
              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                >
                  <GlassCard
                    className="p-4 flex items-center justify-between cursor-pointer"
                    onClick={() => navigate(task.status === 'done' || task.status === 'failed' ? `/report/${task.id}` : `/execute/${task.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: `${cfg.color}20`, border: `1px solid ${cfg.color}40` }}
                      >
                        <Icon size={18} style={{ color: cfg.color }} className={task.status === 'thinking' || task.status === 'reviewing' || task.status === 'scoring' || task.status === 'merging' || task.status === 'verifying' ? 'animate-spin' : ''} />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{task.currentStep}</div>
                        <div className="text-xs text-dim mt-0.5">
                          {new Date(task.createdAt).toLocaleString('zh-CN')} · 策略 {task.strategy}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {task.score !== undefined && (
                        <span className="text-2xl font-bold" style={{ color: task.score > 75 ? 'var(--color-aurora-cyan)' : 'var(--color-aurora-pink)' }}>
                          {task.score}
                        </span>
                      )}
                      <span
                        className="px-3 py-1 rounded-full text-xs font-medium"
                        style={{ background: `${cfg.color}20`, color: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                  </GlassCard>
                </motion.div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
