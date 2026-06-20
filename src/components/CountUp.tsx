// 数字滚动动画组件

import { useEffect, useRef, useState } from 'react'

interface CountUpProps {
  end: number
  duration?: number   // 毫秒
  decimals?: number
  suffix?: string
  className?: string
}

export default function CountUp({
  end,
  duration = 1200,
  decimals = 0,
  suffix = '',
  className = '',
}: CountUpProps) {
  const [value, setValue] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    startTimeRef.current = null
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

    const step = (timestamp: number) => {
      if (startTimeRef.current === null) startTimeRef.current = timestamp
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1)
      const eased = easeOutCubic(progress)
      setValue(end * eased)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        setValue(end)
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [end, duration])

  return (
    <span className={className}>
      {value.toFixed(decimals)}
      {suffix}
    </span>
  )
}
