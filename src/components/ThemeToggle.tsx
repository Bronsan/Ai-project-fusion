// 主题切换按钮 - 浅色/深色模式切换
// 带动画的太阳/月亮图标切换

import { motion, AnimatePresence } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'
import { useThemeStore } from '@/store/useThemeStore'

interface ThemeToggleProps {
  size?: number
  className?: string
}

export default function ThemeToggle({ size = 18, className = '' }: ThemeToggleProps) {
  const { mode, toggle } = useThemeStore()

  return (
    <button
      onClick={toggle}
      className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-all ${className}`}
      style={{
        background: 'var(--color-glass)',
        border: '1px solid var(--color-glass-border)',
      }}
      title={mode === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
      aria-label="切换主题"
    >
      <AnimatePresence mode="wait" initial={false}>
        {mode === 'dark' ? (
          <motion.div
            key="moon"
            initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.3 }}
          >
            <Moon size={size} className="text-aurora-cyan" />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.3 }}
          >
            <Sun size={size} className="text-aurora-1" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  )
}
