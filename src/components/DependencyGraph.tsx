// 依赖图可视化组件 - P1-4 新增
// 用 SVG 力导向布局展示项目间依赖关系，高亮循环依赖与共享依赖

import { useMemo } from 'react'
import { AlertCircle, Box, Share2, Unlink } from 'lucide-react'
import type { DependencyGraphInfo, GraphNodeInfo, GraphEdgeInfo } from '@/lib/types'

interface DependencyGraphProps {
  graph: DependencyGraphInfo
}

// 节点颜色配置
const nodeColors = {
  project: '#7C5CFF',
  module: '#5CE1E6',
  external: '#FFB547',
}

export default function DependencyGraph({ graph }: DependencyGraphProps) {
  // 力导向布局计算（简化版 - 圆形布局）
  const layout = useMemo(() => {
    const { nodes, edges } = graph
    if (nodes.length === 0) return { nodes: [], edges: [] }

    // 项目节点放内圈，外部依赖放外圈
    const projectNodes = nodes.filter((n) => n.type === 'project')
    const externalNodes = nodes.filter((n) => n.type === 'external')

    const cx = 300
    const cy = 250
    const innerRadius = Math.min(120, 60 + projectNodes.length * 15)
    const outerRadius = innerRadius + 100

    const positions = new Map<string, { x: number; y: number }>()

    // 内圈：项目节点均匀分布
    projectNodes.forEach((n, i) => {
      const angle = (i / Math.max(projectNodes.length, 1)) * Math.PI * 2 - Math.PI / 2
      positions.set(n.id, {
        x: cx + innerRadius * Math.cos(angle),
        y: cy + innerRadius * Math.sin(angle),
      })
    })

    // 外圈：外部依赖节点均匀分布
    externalNodes.forEach((n, i) => {
      const angle = (i / Math.max(externalNodes.length, 1)) * Math.PI * 2 - Math.PI / 2
      positions.set(n.id, {
        x: cx + outerRadius * Math.cos(angle),
        y: cy + outerRadius * Math.sin(angle),
      })
    })

    // 为无位置节点兜底
    nodes.forEach((n) => {
      if (!positions.has(n.id)) {
        positions.set(n.id, { x: cx + Math.random() * 100 - 50, y: cy + Math.random() * 100 - 50 })
      }
    })

    return { nodes, edges, positions }
  }, [graph])

  const hasData = graph.nodes.length > 0

  return (
    <div>
      {/* 统计概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={Box}
          label="项目节点"
          value={graph.nodes.filter((n) => n.type === 'project').length}
          color="#7C5CFF"
        />
        <StatCard
          icon={Share2}
          label="共享依赖"
          value={graph.sharedDeps.length}
          color="#5CE1E6"
        />
        <StatCard
          icon={AlertCircle}
          label="循环依赖"
          value={graph.cycles.length}
          color={graph.cycles.length > 0 ? '#FF4D6D' : '#5CE1E6'}
        />
        <StatCard
          icon={Unlink}
          label="孤立模块"
          value={graph.orphans.length}
          color={graph.orphans.length > 0 ? '#FFB547' : '#5CE1E6'}
        />
      </div>

      {/* 循环依赖警告 */}
      {graph.cycles.length > 0 && (
        <div
          className="rounded-xl p-4 mb-4"
          style={{
            background: 'rgba(255, 77, 109, 0.08)',
            border: '1px solid rgba(255, 77, 109, 0.25)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={14} className="text-aurora-pink" />
            <span className="text-xs font-medium text-aurora-pink">
              检测到 {graph.cycles.length} 个循环依赖
            </span>
          </div>
          <div className="space-y-1">
            {graph.cycles.slice(0, 5).map((cycle, i) => (
              <div key={i} className="text-xs font-mono text-dim">
                {cycle.join(' → ')}
              </div>
            ))}
            {graph.cycles.length > 5 && (
              <div className="text-xs text-dim">...还有 {graph.cycles.length - 5} 个</div>
            )}
          </div>
        </div>
      )}

      {/* 孤立模块提示 */}
      {graph.orphans.length > 0 && (
        <div
          className="rounded-xl p-4 mb-4"
          style={{
            background: 'rgba(255, 181, 71, 0.08)',
            border: '1px solid rgba(255, 181, 71, 0.25)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Unlink size={14} style={{ color: '#FFB547' }} />
            <span className="text-xs font-medium" style={{ color: '#FFB547' }}>
              {graph.orphans.length} 个孤立模块（无依赖关系）
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {graph.orphans.map((o, i) => (
              <span
                key={i}
                className="px-2 py-1 rounded text-xs font-mono"
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: 'var(--color-text-dim)',
                }}
              >
                {o}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 依赖图 SVG */}
      {hasData ? (
        <div
          className="rounded-xl p-4"
          style={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
        >
          <svg width="100%" viewBox="0 0 600 500" style={{ maxHeight: 500 }}>
            {/* 边 */}
            {layout.edges.map((edge: GraphEdgeInfo, i: number) => {
              const from = layout.positions.get(edge.from)
              const to = layout.positions.get(edge.to)
              if (!from || !to) return null
              const isCycle = graph.cycles.some((c) =>
                c.includes(edge.from.replace('project:', '')) &&
                c.includes(edge.to.replace('project:', ''))
              )
              return (
                <g key={i}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={isCycle ? '#FF4D6D' : 'rgba(124, 92, 255, 0.3)'}
                    strokeWidth={isCycle ? 2 : 1}
                    strokeDasharray={edge.kind === 'dynamic' ? '4 2' : 'none'}
                  />
                  {/* 箭头 */}
                  <circle cx={to.x} cy={to.y} r={3} fill={isCycle ? '#FF4D6D' : '#7C5CFF'} />
                </g>
              )
            })}

            {/* 节点 */}
            {layout.nodes.map((node: GraphNodeInfo) => {
              const pos = layout.positions.get(node.id)
              if (!pos) return null
              const color = nodeColors[node.type] || '#7C5CFF'
              const radius = node.type === 'project' ? 24 : 16
              return (
                <g key={node.id}>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={radius}
                    fill={`${color}20`}
                    stroke={color}
                    strokeWidth={2}
                  />
                  <text
                    x={pos.x}
                    y={pos.y + radius + 14}
                    textAnchor="middle"
                    fill="var(--color-text-dim)"
                    fontSize={11}
                    fontFamily="monospace"
                  >
                    {node.label.length > 16 ? node.label.slice(0, 14) + '...' : node.label}
                  </text>
                  {node.type === 'project' && (
                    <text
                      x={pos.x}
                      y={pos.y + 4}
                      textAnchor="middle"
                      fill={color}
                      fontSize={10}
                      fontWeight="bold"
                    >
                      P
                    </text>
                  )}
                </g>
              )
            })}
          </svg>

          {/* 图例 */}
          <div className="flex items-center justify-center gap-4 mt-2 text-xs text-dim">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ background: '#7C5CFF' }} />
              项目
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ background: '#FFB547' }} />
              外部依赖
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5" style={{ background: '#FF4D6D' }} />
              循环依赖
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-t border-dashed" style={{ borderColor: '#7C5CFF' }} />
              动态导入
            </span>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <Box size={32} className="text-dim mx-auto mb-2" />
          <p className="text-sm text-dim">无依赖关系数据</p>
          <p className="text-xs text-dim mt-1">项目文件中未检测到 import/require 语句</p>
        </div>
      )}

      {/* 共享依赖列表 */}
      {graph.sharedDeps.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-dim mb-2 font-medium">共享依赖（被多个项目引用）</div>
          <div className="flex flex-wrap gap-1.5">
            {graph.sharedDeps.map((dep, i) => (
              <span
                key={i}
                className="px-2 py-1 rounded text-xs font-mono"
                style={{
                  background: 'rgba(92, 225, 230, 0.1)',
                  color: 'var(--color-aurora-cyan)',
                  border: '1px solid rgba(92, 225, 230, 0.25)',
                }}
              >
                {dep}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** 统计卡片 */
function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any
  label: string
  value: number
  color: string
}) {
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: `${color}10`,
        border: `1px solid ${color}30`,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon size={12} style={{ color }} />
        <span className="text-xs text-dim">{label}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  )
}
