// 融合报告页 - 评分卡、审查报告、产物下载
// v0.12beta: 新增对比视图，展示融合前后各项目维度对比

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, Download,
  Shield, FileText, Copy, Check, Loader2, GitCompare,
  GitMerge, Network,
} from 'lucide-react'
import GlassCard from '@/components/GlassCard'
import RadarChart from '@/components/RadarChart'
import CountUp from '@/components/CountUp'
import FileTree from '@/components/FileTree'
import DiffViewer from '@/components/DiffViewer'
import DependencyGraph from '@/components/DependencyGraph'
import { fetchTask, fetchProjects, getDownloadUrl } from '@/lib/api'
import type { FusionTask, FileNode, Project, ScoreDimension } from '@/lib/types'

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
  const [sourceProjects, setSourceProjects] = useState<Project[]>([])
  const [showCompare, setShowCompare] = useState(false)
  // P1-2/P1-4: 报告标签页
  const [activeTab, setActiveTab] = useState<'overview' | 'conflicts' | 'dependency'>('overview')

  useEffect(() => {
    if (!taskId) return
    fetchTask(taskId)
      .then(async (t) => {
        setTask(t)
        setLoading(false)
        // 加载来源项目用于对比视图
        try {
          const allProjects = await fetchProjects()
          setSourceProjects(allProjects.filter((p) => t.projectIds.includes(p.id)))
        } catch {
          // 忽略
        }
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
        <div className="flex items-center gap-2">
          {sourceProjects.length >= 2 && (
            <button
              className="btn-ghost text-sm"
              onClick={() => setShowCompare(!showCompare)}
              style={showCompare ? { color: 'var(--color-aurora-cyan)' } : undefined}
            >
              <GitCompare size={14} /> {showCompare ? '隐藏对比' : '查看对比'}
            </button>
          )}
          {passed && (
            <button
              className="btn-primary"
              onClick={() => window.open(getDownloadUrl(task.id), '_blank')}
            >
              <Download size={16} /> 下载整包
            </button>
          )}
        </div>
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

      {/* P1-2/P1-4: 标签栏 - 切换总览/冲突详情/依赖图 */}
      {(report.mergeStats || report.dependencyGraph) && (
        <div className="flex items-center gap-1 mb-4 p-1 rounded-xl" style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
          <TabButton
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            icon={FileText}
            label="总览"
          />
          {report.mergeStats && (
            <TabButton
              active={activeTab === 'conflicts'}
              onClick={() => setActiveTab('conflicts')}
              icon={GitMerge}
              label={`冲突详情 (${report.mergeStats.merged + report.mergeStats.deduplicated + report.mergeStats.renamed})`}
            />
          )}
          {report.dependencyGraph && (
            <TabButton
              active={activeTab === 'dependency'}
              onClick={() => setActiveTab('dependency')}
              icon={Network}
              label="依赖图"
            />
          )}
        </div>
      )}

      {/* P1-2: 冲突详情标签页 */}
      {activeTab === 'conflicts' && report.mergeStats && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <GlassCard className="p-6 mb-6">
            <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
              <GitMerge size={16} className="text-aurora-cyan" />
              AST 实体合并决策
            </h3>
            <p className="text-xs text-dim mb-4 leading-relaxed">
              展示融合过程中同名实体的合并决策：自动合并（改动不重叠）、去重（实现相同）、重命名（改动重叠）。
            </p>
            <DiffViewer mergeStats={report.mergeStats} />
          </GlassCard>
        </motion.div>
      )}

      {/* P1-4: 依赖图标签页 */}
      {activeTab === 'dependency' && report.dependencyGraph && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <GlassCard className="p-6 mb-6">
            <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Network size={16} className="text-aurora-purple" />
              依赖关系图
            </h3>
            <p className="text-xs text-dim mb-4 leading-relaxed">
              基于 AST 提取的 import 关系构建的依赖图，检测循环依赖、孤立模块与共享依赖。
            </p>
            <DependencyGraph graph={report.dependencyGraph} />
          </GlassCard>
        </motion.div>
      )}

      {/* 对比视图 - 展示融合前后各项目维度对比 */}
      {showCompare && sourceProjects.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <GlassCard className="p-6 mb-6">
            <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
              <GitCompare size={16} className="text-aurora-cyan" />
              融合前后对比
            </h3>
            <p className="text-xs text-dim mb-4 leading-relaxed">
              展示各来源项目的关键指标与融合后产物的对比，直观呈现融合效果。
            </p>

            {/* 项目元数据对比表 */}
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th className="text-left py-2 px-3 text-dim font-medium">指标</th>
                    {sourceProjects.map((p) => (
                      <th key={p.id} className="text-left py-2 px-3 text-dim font-medium">{p.name}</th>
                    ))}
                    <th
                      className="text-left py-2 px-3 font-medium"
                      style={{ color: 'var(--color-aurora-cyan)' }}
                    >
                      融合产物
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <CompareRow label="语言" values={[...sourceProjects.map((p) => p.language), 'TypeScript']} highlightLast />
                  <CompareRow label="框架" values={[...sourceProjects.map((p) => p.structure.framework), 'multi']} highlightLast />
                  <CompareRow label="构建工具" values={[...sourceProjects.map((p) => p.structure.buildTool), 'vite']} highlightLast />
                  <CompareRow label="模块系统" values={[...sourceProjects.map((p) => p.structure.moduleSystem), 'esm']} highlightLast />
                  <CompareRow label="许可证" values={[...sourceProjects.map((p) => p.license), 'MIT']} highlightLast />
                  <CompareRow label="依赖数" values={[...sourceProjects.map((p) => String(p.dependencies.length)), String(report.files.length)]} highlightLast />
                  <CompareRow label="文件数" values={[...sourceProjects.map((p) => String(p.files?.length ?? 0)), String(countFiles(report.files))]} highlightLast />
                </tbody>
              </table>
            </div>

            {/* 评分维度对比 - 各项目预评分 vs 融合后评分 */}
            <CompareDimensions sourceProjects={sourceProjects} fusedDimensions={report.dimensions} />
          </GlassCard>
        </motion.div>
      )}

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

/** 标签按钮 - P1-2/P1-4 新增 */
function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: any
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{
        background: active ? 'rgba(124, 92, 255, 0.15)' : 'transparent',
        color: active ? 'var(--color-aurora-purple)' : 'var(--color-text-dim)',
      }}
    >
      <Icon size={12} />
      {label}
    </button>
  )
}

/** 对比表格行 - 高亮最后一列（融合产物） */
function CompareRow({ label, values, highlightLast }: { label: string; values: string[]; highlightLast?: boolean }) {
  return (
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <td className="py-2 px-3 text-dim">{label}</td>
      {values.map((v, i) => {
        const isLast = highlightLast && i === values.length - 1
        return (
          <td
            key={i}
            className="py-2 px-3"
            style={isLast ? { color: 'var(--color-aurora-cyan)', fontWeight: 500 } : undefined}
          >
            {v}
          </td>
        )
      })}
    </tr>
  )
}

/** 评分维度对比 - 各项目预评分 vs 融合后评分 */
function CompareDimensions({
  sourceProjects,
  fusedDimensions,
}: {
  sourceProjects: Project[]
  fusedDimensions: ScoreDimension[]
}) {
  // 为每个来源项目计算简化的维度评分（基于项目特征）
  const projectScores = sourceProjects.map((p) => {
    return {
      name: p.name,
      scores: {
        '架构兼容性': scoreFromFramework(p),
        '依赖冲突': scoreFromDeps(p),
        '许可证兼容': scoreFromLicense(p),
        '代码风格': scoreFromLang(p),
        '文档完整度': scoreFromReadme(p),
      } as Record<string, number>,
    }
  })

  const dimensionNames = ['架构兼容性', '依赖冲突', '许可证兼容', '代码风格', '文档完整度']

  return (
    <div>
      <h4 className="text-xs font-semibold mb-3 text-dim">评分维度对比（各项目独立评分 vs 融合后评分）</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th className="text-left py-2 px-3 text-dim font-medium">维度</th>
              {projectScores.map((p) => (
                <th key={p.name} className="text-left py-2 px-3 text-dim font-medium">{p.name}</th>
              ))}
              <th
                className="text-left py-2 px-3 font-medium"
                style={{ color: 'var(--color-aurora-cyan)' }}
              >
                融合后
              </th>
            </tr>
          </thead>
          <tbody>
            {dimensionNames.map((dim) => {
              const fusedScore = fusedDimensions.find((d) => d.name === dim)?.score ?? 0
              return (
                <tr key={dim} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td className="py-2 px-3 text-dim">{dim}</td>
                  {projectScores.map((p) => (
                    <td key={p.name} className="py-2 px-3">{p.scores[dim] ?? '-'}</td>
                  ))}
                  <td
                    className="py-2 px-3 font-medium"
                    style={{ color: 'var(--color-aurora-cyan)' }}
                  >
                    {fusedScore}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-dim mt-3 leading-relaxed">
        注：各项目独立评分基于项目自身特征估算，融合后评分由 AI 按规则真实打分。
      </p>
    </div>
  )
}

/** 基于框架估算架构维度分数 */
function scoreFromFramework(p: Project): number {
  if (p.structure.framework === 'agnostic') return 90
  if (p.structure.framework === 'react') return 85
  if (p.structure.framework === 'vue') return 80
  if (p.structure.framework === 'unknown') return 60
  return 70
}

/** 基于依赖数量估算依赖维度分数 */
function scoreFromDeps(p: Project): number {
  const count = p.dependencies.length
  if (count >= 5) return 85
  if (count >= 2) return 75
  if (count >= 1) return 65
  return 50
}

/** 基于许可证估算许可证维度分数 */
function scoreFromLicense(p: Project): number {
  const permissive = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC']
  if (permissive.includes(p.license)) return 95
  if (p.license.includes('GPL')) return 30
  if (!p.license || p.license === 'UNLICENSED') return 20
  return 60
}

/** 基于语言估算代码风格维度分数 */
function scoreFromLang(p: Project): number {
  if (p.language === 'TypeScript') return 90
  if (p.language === 'JavaScript') return 70
  return 60
}

/** 基于 README 估算文档维度分数 */
function scoreFromReadme(p: Project): number {
  const len = p.readme?.length ?? 0
  if (len > 500) return 90
  if (len > 50) return 70
  return 30
}
