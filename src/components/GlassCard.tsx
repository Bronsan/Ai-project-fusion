// 玻璃卡片 - 通用容器组件

import { type ReactNode, useRef, type MouseEvent } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  hover?: boolean       // 是否启用悬停 3D 倾斜
  onClick?: () => void
  selected?: boolean    // 是否选中态
}

export default function GlassCard({
  children,
  className = '',
  hover = false,
  onClick,
  selected = false,
}: GlassCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  // 鼠标移动时计算 3D 倾斜角度
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!hover || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rotateX = (y - centerY) / 30
    const rotateY = (centerX - x) / 30
    ref.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`
  }

  const handleMouseLeave = () => {
    if (!ref.current) return
    ref.current.style.transform = ''
  }

  return (
    <div
      ref={ref}
      className={`glass ${hover ? 'glass-hover' : ''} ${selected ? 'ring-2 ring-aurora-purple/60' : ''} ${className}`}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={hover ? { transition: 'transform 0.2s ease-out' } : undefined}
    >
      {children}
    </div>
  )
}
