// 项目上传区域 - 拖拽或点击上传 zip 项目包

import { useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UploadCloud, Loader2, CheckCircle2, AlertCircle, FileArchive } from 'lucide-react'
import { useFusionStore } from '@/store/useFusionStore'
import type { Project } from '@/lib/types'

export default function UploadZone() {
  const { uploadProject, uploading, uploadError } = useFusionStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [success, setSuccess] = useState<Project | null>(null)

  // 处理文件选择
  const handleFile = async (file: File) => {
    setSuccess(null)
    if (!file.name.toLowerCase().endsWith('.zip')) {
      return
    }
    const project = await uploadProject(file)
    if (project) {
      setSuccess(project)
      setTimeout(() => setSuccess(null), 4000)
    }
  }

  // 拖拽事件
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = () => setDragging(false)

  // 点击选择
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // 重置 input 以便重复选择同一文件
    e.target.value = ''
  }

  return (
    <div>
      <div
        className="glass p-6 cursor-pointer transition-all"
        style={{
          borderColor: dragging ? 'rgba(124, 92, 255, 0.6)' : undefined,
          background: dragging ? 'rgba(124, 92, 255, 0.08)' : undefined,
        }}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={handleChange}
        />

        <div className="flex flex-col items-center text-center py-4">
          {uploading ? (
            <>
              <Loader2 size={36} className="text-aurora-purple animate-spin mb-3" />
              <p className="text-sm font-medium">正在解析项目...</p>
              <p className="text-xs text-dim mt-1">解压并分析元数据</p>
            </>
          ) : (
            <>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-transform"
                style={{
                  background: 'linear-gradient(135deg, rgba(124, 92, 255, 0.2), rgba(92, 225, 230, 0.1))',
                  border: '1px solid rgba(124, 92, 255, 0.3)',
                  transform: dragging ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                <UploadCloud size={26} className="text-aurora-purple" />
              </div>
              <p className="text-sm font-medium mb-1">
                {dragging ? '松开以上传' : '拖拽 zip 项目包到此处'}
              </p>
              <p className="text-xs text-dim">
                或点击选择文件 · 支持 .zip 格式 · 最大 500MB
              </p>
              <div className="flex items-center gap-2 mt-3 text-xs text-dim">
                <FileArchive size={12} />
                <span>将自动解析 package.json、README 与文件结构</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 上传成功提示 */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-3 p-3 rounded-xl flex items-center gap-2 text-xs"
            style={{
              background: 'rgba(92, 225, 230, 0.08)',
              border: '1px solid rgba(92, 225, 230, 0.25)',
              color: 'var(--color-aurora-cyan)',
            }}
          >
            <CheckCircle2 size={14} />
            <span>已添加项目「{success.name}」到列表顶部，可选择参与融合</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 上传错误提示 */}
      <AnimatePresence>
        {uploadError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-3 p-3 rounded-xl flex items-center gap-2 text-xs"
            style={{
              background: 'rgba(255, 110, 199, 0.08)',
              border: '1px solid rgba(255, 110, 199, 0.25)',
              color: 'var(--color-aurora-pink)',
            }}
          >
            <AlertCircle size={14} />
            <span>{uploadError}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
