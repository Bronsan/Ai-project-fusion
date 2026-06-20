// 项目选择页 - 多选项目、适配性预评分雷达图

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Star, CheckCircle2, AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import GlassCard from '@/components/GlassCard'
import RadarChart from '@/components/RadarChart'
import CountUp from '@/components/CountUp'
import { useFusionStore } from '@/store/useFusionStore'

export default function Select() {
  const navigate = useNavigate()
  const {
    projects, projectsLoading, loadProjects,
    selectedIds, toggleSelect, clearSelection,
    preview, previewLoading, computePreview,
  } = useFusionStore()

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // 选择变化时重新计算预评分
  useEffect(() => {
    computePreview()
  }, [selectedIds, computePreview])

  const canProceed = selectedIds.length >= 2

  return (
    <div className="page-enter container-narrow py-10">
      {/* 顶部 */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button className="btn-ghost !p-2" onClick={() => navigate('/')}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-3xl font-bold">选择融合项目</h1>
            <p className="text-sm text-dim mt-1">至少选择 2 个项目，系统将自动计算适配性预评分</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-dim">已选 {selectedIds.length} 个</span>
          {selectedIds.length > 0 && (
            <button className="text-xs text-dim hover:text-white transition-colors" onClick={clearSelection}>
              清空
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 项目网格 - 占 2 列 */}
        <div className="lg:col-span-2">
          {projectsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="glass p-5 animate-pulse" style={{ height: 180 }}>
                  <div className="h-4 w-1/2 bg-white/10 rounded mb-3" />
                  <div className="h-3 w-full bg-white/5 rounded mb-2" />
                  <div className="h-3 w-2/3 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((project, i) => {
                const selected = selectedIds.includes(project.id)
                return (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.04 }}
                  >
                    <GlassCard
                      className="p-5 h-full cursor-pointer"
                      hover
                      selected={selected}
                      onClick={() => toggleSelect(project.id)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-base font-semibold mb-1 flex items-center gap-2">
                            {project.name}
                            {selected && <CheckCircle2 size={14} className="text-aurora-cyan" />}
                          </h3>
                          <span className="text-xs text-dim">{project.language} · {project.license}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-dim">
                          <Star size={12} />
                          {(project.stars / 1000).toFixed(1)}k
                        </div>
                      </div>
                      <p className="text-sm text-dim leading-relaxed mb-3 line-clamp-2">{project.description}</p>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {project.tags.slice(0, 4).map((tag) => (
                          <span key={tag} className="tag">{tag}</span>
                        ))}
                      </div>
                      <div className="text-xs text-dim border-t border-white/5 pt-3">
                        框架: {project.structure.framework} · 构建: {project.structure.buildTool} · 模块: {project.structure.moduleSystem}
                      </div>
                    </GlassCard>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* 预评分侧栏 - 占 1 列 */}
        <div className="lg:sticky lg:top-24 h-fit">
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">适配性预评分</h3>
              <button
                className="text-dim hover:text-white transition-colors"
                onClick={computePreview}
                disabled={previewLoading || !canProceed}
              >
                <RefreshCw size={14} className={previewLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {!canProceed ? (
              <div className="text-center py-12">
                <AlertTriangle size={32} className="text-dim mx-auto mb-3" />
                <p className="text-sm text-dim">至少选择 2 个项目才能计算预评分</p>
              </div>
            ) : previewLoading ? (
              <div className="text-center py-12">
                <Loader2 size={32} className="text-aurora-purple mx-auto mb-3 animate-spin" />
                <p className="text-sm text-dim">计算中...</p>
              </div>
            ) : preview ? (
              <div>
                {/* 总分 */}
                <div className="text-center mb-6">
                  <div
                    className="text-6xl font-bold mb-1"
                    style={{ color: preview.totalScore >= 75 ? 'var(--color-aurora-cyan)' : preview.totalScore >= 60 ? 'var(--color-aurora-purple)' : 'var(--color-aurora-pink)' }}
                  >
                    <CountUp end={preview.totalScore} duration={1000} />
                  </div>
                  <div className="text-xs text-dim">总分 / 100</div>
                  <div
                    className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-xs"
                    style={{
                      background: preview.feasible ? 'rgba(92, 225, 230, 0.12)' : 'rgba(255, 110, 199, 0.12)',
                      color: preview.feasible ? 'var(--color-aurora-cyan)' : 'var(--color-aurora-pink)',
                    }}
                  >
                    {preview.feasible ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                    {preview.feasible ? '建议尝试融合' : '适配性较低，建议调整'}
                  </div>
                </div>

                {/* 雷达图 */}
                {preview.dimensions.length > 0 && (
                  <div className="flex justify-center mb-4">
                    <RadarChart dimensions={preview.dimensions} size={280} />
                  </div>
                )}

                {/* 维度列表 */}
                <div className="space-y-2">
                  {preview.dimensions.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <span className="text-dim">{d.name}</span>
                      <span
                        className="font-semibold"
                        style={{ color: d.score >= 75 ? 'var(--color-aurora-cyan)' : 'var(--color-text)' }}
                      >
                        {d.score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </GlassCard>
        </div>
      </div>

      {/* 底部固定操作栏 */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40"
        style={{
          background: 'rgba(10, 14, 39, 0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div className="container-narrow flex items-center justify-between py-4">
          <div className="text-sm">
            <span className="text-dim">已选 </span>
            <span className="font-semibold text-white">{selectedIds.length}</span>
            <span className="text-dim"> / 至少 2 个项目</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-ghost" onClick={() => navigate('/')}>
              取消
            </button>
            <button
              className="btn-primary"
              disabled={!canProceed}
              onClick={() => navigate('/configure')}
            >
              下一步：配置 <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
      {/* 占位避免内容被遮挡 */}
      <div style={{ height: 80 }} />
    </div>
  )
}
