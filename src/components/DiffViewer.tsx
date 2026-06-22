// 冲突可视化组件 - P1-2 新增
// 展示 AST 实体合并决策详情，支持 diff 视图与决策标注

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GitMerge, Copy, Check, ChevronDown, ChevronRight,
  CheckCircle2, AlertCircle, RefreshCw, Layers,
} from 'lucide-react'
import type { MergeStatsInfo, MergeDetailInfo } from '@/lib/types'

// 决策类型配置
const decisionConfig = {
  merged: {
    label: '已合并',
    color: '#5CE1E6',
    icon: GitMerge,
    bg: 'rgba(92, 225, 230, 0.1)',
    border: 'rgba(92, 225, 230, 0.3)',
  },
  deduplicated: {
    label: '已去重',
    color: '#7C5CFF',
    icon: Layers,
    bg: 'rgba(124, 92, 255, 0.1)',
    border: 'rgba(124, 92, 255, 0.3)',
  },
  renamed: {
    label: '已重命名',
    color: '#FFB547',
    icon: RefreshCw,
    bg: 'rgba(255, 181, 71, 0.1)',
    border: 'rgba(255, 181, 71, 0.3)',
  },
  no_conflict: {
    label: '无冲突',
    color: '#5CE1E6',
    icon: CheckCircle2,
    bg: 'rgba(255, 255, 255, 0.04)',
    border: 'rgba(255, 255, 255, 0.08)',
  },
}

interface DiffViewerProps {
  mergeStats: MergeStatsInfo
}

export default function DiffViewer({ mergeStats }: DiffViewerProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  const toggleExpand = (i: number) => {
    setExpandedIndex(expandedIndex === i ? null : i)
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 统计概览
  const stats = [
    { label: '自动合并', value: mergeStats.merged, color: '#5CE1E6' },
    { label: '去重', value: mergeStats.deduplicated, color: '#7C5CFF' },
    { label: '重命名', value: mergeStats.renamed, color: '#FFB547' },
  ]

  return (
    <div>
      {/* 统计概览 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl p-4 text-center"
            style={{
              background: `${s.color}10`,
              border: `1px solid ${s.color}30`,
            }}
          >
            <div className="text-3xl font-bold mb-1" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="text-xs text-dim">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 决策详情列表 */}
      {mergeStats.details.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle2 size={32} className="text-aurora-cyan mx-auto mb-2" />
          <p className="text-sm text-dim">无实体合并决策记录</p>
          <p className="text-xs text-dim mt-1">所有实体均无冲突，直接保留</p>
        </div>
      ) : (
        <div className="space-y-2">
          {mergeStats.details.map((detail, i) => {
            const cfg = decisionConfig[detail.decision]
            const Icon = cfg.icon
            const isExpanded = expandedIndex === i
            return (
              <div
                key={i}
                className="rounded-xl overflow-hidden"
                style={{
                  background: cfg.bg,
                  border: `1px solid ${cfg.border}`,
                }}
              >
                {/* 决策头部 */}
                <button
                  onClick={() => toggleExpand(i)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors"
                >
                  <div
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `${cfg.color}20` }}
                  >
                    <Icon size={16} style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ background: `${cfg.color}20`, color: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                      <span className="text-xs text-dim">
                        {detail.affectedEntities.length} 个实体
                      </span>
                    </div>
                    <p className="text-xs text-dim truncate">{detail.reason}</p>
                  </div>
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-dim shrink-0" />
                  ) : (
                    <ChevronRight size={16} className="text-dim shrink-0" />
                  )}
                </button>

                {/* 展开详情 */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-white/5"
                    >
                      <div className="p-4 space-y-3">
                        {/* 受影响实体 */}
                        <div>
                          <div className="text-xs text-dim mb-2 font-medium">受影响实体</div>
                          <div className="flex flex-wrap gap-1.5">
                            {detail.affectedEntities.map((e, j) => (
                              <span
                                key={j}
                                className="px-2 py-1 rounded text-xs font-mono"
                                style={{
                                  background: 'rgba(0, 0, 0, 0.3)',
                                  color: 'var(--color-text-dim)',
                                  border: '1px solid rgba(255, 255, 255, 0.06)',
                                }}
                              >
                                {e}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* 合并后的源码（仅 merged 决策） */}
                        {detail.mergedSource && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-xs text-dim font-medium">合并后源码</div>
                              <button
                                className="text-dim hover:text-white transition-colors"
                                onClick={() => handleCopy(detail.mergedSource!)}
                              >
                                {copied ? (
                                  <Check size={12} className="text-aurora-cyan" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            </div>
                            <pre
                              className="text-xs font-mono p-3 rounded-lg overflow-auto max-h-64"
                              style={{
                                background: 'rgba(0, 0, 0, 0.4)',
                                color: 'var(--color-text-dim)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                              }}
                            >
                              {detail.mergedSource}
                            </pre>
                          </div>
                        )}

                        {/* 决策说明 */}
                        <div className="flex items-start gap-2 text-xs">
                          <AlertCircle size={12} className="text-dim shrink-0 mt-0.5" />
                          <span className="text-dim leading-relaxed">{detail.reason}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
