// 融合报告页 - 评分卡、审查报告、产物下载

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, Download,
  Shield, FileText, Copy, Check, Loader2,
} from 'lucide-react'
import GlassCard from '@/components/GlassCard'
import RadarChart from '@/components/RadarChart'
import CountUp from '@/components/CountUp'
import FileTree from '@/components/FileTree'
import { fetchTask, getDownloadUrl } from '@/lib/api'
import type { FusionTask, FileNode } from '@/lib/types'

// 风险等级配置
const levelConfig = {
  low: { label: '低', color: '#5CE1E6' },
  medium: { label: '中', color: '#FFB547' },
  high: { label: '高', color: '#FF6EC7' },
  critical: { label: '严重', color: '#FF4D6D' },
}

export default function Report() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [task, setTask] = useState<FusionTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!taskId) return
    fetchTask(taskId)
      .then((t) => {
        setTask(t)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [taskId])

  // 复制文件内容
  const handleCopy = () => {
    if (!selectedFile?.content) return
    navigator.clipboard.writeText(selectedFile.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="page-enter container-narrow py-20 text-center">
        <Loader2 size={40} className="text-aurora-purple mx-auto mb-4 animate-spin" />
        <p className="text-dim">加载报告...</p>
      </div>
    )
  }

  if (!task || !task.report) {
    return (
      <div className="page-enter container-narrow py-20 text-center">
        <AlertCircle size={40} className="text-aurora-pink mx-auto mb-4" />
        <p className="text-dim mb-4">报告不存在或任务未完成</p>
        <button className="btn-ghost" onClick={() => navigate('/')}>返回首页</button>
      </div>
    )
  }

  const report = task.report
  const passed = report.passed

  return (
    <div className="page-enter container-narrow py-10">
      {/* 顶部 */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button className="btn-ghost !p-2" onClick={() => navigate('/')}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-3xl font-bold">融合报告</h1>
            <p className="text-sm text-dim mt-1">
              {new Date(task.createdAt).toLocaleString('zh-CN')} · 任务 ID: {task.id}
            </p>
          </div>
        </div>
        {passed && (
          <button
            className="btn-primary"
            onClick={() => window.open(getDownloadUrl(task.id), '_blank')}
          >
            <Download size={16} /> 下载整包
          </button>
        )}
      </div>

      {/* 评分卡 */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <GlassCard className="p-8 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* 左：总分 */}
            <div className="text-center">
              <div className="text-xs text-dim mb-2">适配性总分</div>
              <div
                className="text-8xl font-bold mb-2"
                style={{ color: passed ? 'var(--color-aurora-cyan)' : 'var(--color-aurora-pink)' }}
              >
                <CountUp end={report.totalScore} duration={1500} />
              </div>
              <div className="text-sm text-dim mb-4">阈值 75 / 100</div>
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
                style={{
                  background: passed ? 'rgba(92, 225, 230, 0.12)' : 'rgba(255, 110, 199, 0.12)',
                  color: passed ? 'var(--color-aurora-cyan)' : 'var(--color-aurora-pink)',
                  border: `1px solid ${passed ? 'rgba(92, 225, 230, 0.3)' : 'rgba(255, 110, 199, 0.3)'}`,
                }}
              >
                {passed ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {passed ? '已通过，融合产物已生成' : '未通过，未生成融合产物'}
              </div>
            </div>

            {/* 右：雷达图 */}
            <div className="flex justify-center">
              <RadarChart dimensions={report.dimensions} size={320} />
            </div>
          </div>

          {/* 维度详情 */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-8 pt-8 border-t border-white/5">
            {report.dimensions.map((d) => (
              <div key={d.name} className="text-center">
                <div
                  className="text-2xl font-bold mb-1"
                  style={{ color: d.score >= 75 ? 'var(--color-aurora-cyan)' : 'var(--color-text)' }}
                >
                  {d.score}
                </div>
                <div className="text-xs text-dim mb-1">{d.name}</div>
                <div className="text-xs text-dim leading-relaxed">{d.comment}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      </motion.div>

      {/* 思考流程摘要 */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
        <GlassCard className="p-6 mb-6">
          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
            <FileText size={16} className="text-aurora-purple" />
            AI 思考流程
          </h3>
          <p className="text-sm text-dim mb-4 leading-relaxed">{report.summary}</p>
          <div className="space-y-2">
            {report.thinkingSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span
                  className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                  style={{ background: 'rgba(124, 92, 255, 0.15)', color: 'var(--color-aurora-purple)' }}
                >
                  {i + 1}
                </span>
                <span className="text-dim pt-0.5">{step}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </motion.div>

      {/* 安全审查报告 */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
        <GlassCard className="p-6 mb-6">
          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
            <Shield size={16} className="text-aurora-pink" />
            安全审查报告
          </h3>
          {report.issues.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 size={32} className="text-aurora-cyan mx-auto mb-2" />
              <p className="text-sm text-dim">未发现安全问题</p>
            </div>
          ) : (
            <div className="space-y-2">
              {report.issues.map((issue, i) => {
                const cfg = levelConfig[issue.level]
                return (
                  <div
                    key={i}
                    className="p-3 rounded-xl flex items-start gap-3"
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <span
                      className="shrink-0 px-2 py-0.5 rounded text-xs font-medium"
                      style={{ background: `${cfg.color}20`, color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm">
                        <span className="text-dim">{issue.file}</span>
                        <span className="ml-2">{issue.description}</span>
                      </div>
                      <div className="text-xs text-dim mt-1">建议：{issue.suggestion}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* 融合产物 */}
      {passed && report.files.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <FileText size={16} className="text-aurora-cyan" />
                融合产物（{countFiles(report.files)} 个文件）
              </h3>
              <button
                className="btn-ghost text-xs"
                onClick={() => window.open(getDownloadUrl(task.id), '_blank')}
              >
                <Download size={12} /> 下载整包
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 文件树 */}
              <div
                className="rounded-xl p-3 overflow-y-auto"
                style={{ background: 'rgba(0, 0, 0, 0.2)', maxHeight: 480 }}
              >
                <FileTree
                  nodes={report.files}
                  onSelect={setSelectedFile}
                  selectedPath={selectedFile?.path}
                />
              </div>

              {/* 文件内容预览 */}
              <div
                className="rounded-xl p-4 overflow-auto"
                style={{ background: 'rgba(0, 0, 0, 0.2)', maxHeight: 480 }}
              >
                {selectedFile ? (
                  <div>
                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5">
                      <span className="text-xs text-dim font-mono">{selectedFile.path}</span>
                      <button
                        className="text-dim hover:text-white transition-colors"
                        onClick={handleCopy}
                      >
                        {copied ? <Check size={14} className="text-aurora-cyan" /> : <Copy size={14} />}
                      </button>
                    </div>
                    <pre className="text-xs font-mono text-dim whitespace-pre-wrap leading-relaxed">
                      {selectedFile.content || '(空文件)'}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText size={28} className="text-dim mx-auto mb-2" />
                    <p className="text-xs text-dim">选择左侧文件查看内容</p>
                  </div>
                )}
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* 底部操作 */}
      <div className="flex items-center justify-between mt-8">
        <button className="btn-ghost" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> 返回首页
        </button>
        <button className="btn-primary" onClick={() => navigate('/select')}>
          开始新融合 <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}

/** 统计文件树中的文件数量 */
function countFiles(nodes: FileNode[]): number {
  let count = 0
  for (const n of nodes) {
    if (n.type === 'file') count++
    if (n.children) count += countFiles(n.children)
  }
  return count
}
