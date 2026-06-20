// 雷达图组件 - SVG 实现，展示评分维度

import type { ScoreDimension } from '@/lib/types'

interface RadarChartProps {
  dimensions: ScoreDimension[]
  size?: number
}

export default function RadarChart({ dimensions, size = 320 }: RadarChartProps) {
  const center = size / 2
  const radius = size / 2 - 50
  const n = dimensions.length

  // 计算每个维度的角度
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2

  // 维度顶点坐标
  const getPoint = (i: number, r: number) => ({
    x: center + Math.cos(angle(i)) * r,
    y: center + Math.sin(angle(i)) * r,
  })

  // 数据多边形点
  const dataPoints = dimensions.map((d, i) => {
    const r = (d.score / 100) * radius
    return getPoint(i, r)
  })
  const dataPath = dataPoints.map((p) => `${p.x},${p.y}`).join(' ')

  // 网格圈（5 圈）
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0]

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(124, 92, 255, 0.5)" />
          <stop offset="100%" stopColor="rgba(92, 225, 230, 0.2)" />
        </radialGradient>
      </defs>

      {/* 网格 */}
      {gridLevels.map((level, idx) => {
        const r = radius * level
        const points = dimensions.map((_, i) => {
          const p = getPoint(i, r)
          return `${p.x},${p.y}`
        }).join(' ')
        return (
          <polygon
            key={idx}
            points={points}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="1"
          />
        )
      })}

      {/* 轴线 */}
      {dimensions.map((_, i) => {
        const p = getPoint(i, radius)
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={p.x}
            y2={p.y}
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="1"
          />
        )
      })}

      {/* 数据多边形 */}
      <polygon
        points={dataPath}
        fill="url(#radarFill)"
        stroke="var(--color-aurora-1)"
        strokeWidth="2"
        style={{ filter: 'drop-shadow(0 0 8px rgba(124, 92, 255, 0.5))' }}
      />

      {/* 数据点 */}
      {dataPoints.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="4"
          fill="var(--color-aurora-2)"
          style={{ filter: 'drop-shadow(0 0 4px var(--color-aurora-2))' }}
        />
      ))}

      {/* 维度标签 */}
      {dimensions.map((d, i) => {
        const labelR = radius + 28
        const p = getPoint(i, labelR)
        return (
          <g key={i}>
            <text
              x={p.x}
              y={p.y - 4}
              textAnchor="middle"
              fill="var(--color-text)"
              fontSize="12"
              fontWeight="500"
            >
              {d.name}
            </text>
            <text
              x={p.x}
              y={p.y + 12}
              textAnchor="middle"
              fill={d.score >= 75 ? 'var(--color-aurora-2)' : 'var(--color-text-dim)'}
              fontSize="13"
              fontWeight="600"
            >
              {d.score}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
