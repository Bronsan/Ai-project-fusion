// 融合历史页 - 查看所有任务记录

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, History as HistoryIcon, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { fetchTasks } from '@/lib/api'
import { useFusionStore } from '@/store/useFusionStore'
import type { FusionTask } from '@/lib/types'
import AuroraBackground from '@/components/AuroraBackground'
import GlassCard from '@/components/GlassCard'

export default function History() {
  const navigate = useNavigate()
  const { setTaskId } = useFusionStore()
  const [tasks, setTasks] = useState<FusionTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTasks()
      .then((data) => { setTasks(data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const openTask = (id: string) => {
    setTaskId(id)
    navigate(`/report/${id}`)
  }

  const statusIcon = (status: string) => {
    if (status === 'done') return <CheckCircle2 size={16} className="text-aurora-cyan" />
    if (status === 'failed') return <XCircle size={16} className="text-aurora-pink" />
    return <Clock size={16} className="text-aurora-purple" />
  }

  return (
    <div className="min-h-screen">
      <AuroraBackground />
      <div className="container-narrow py-8">
        <div className="flex items-center gap-3 mb-8">
          <button className="btn-ghost !p-2" onClick={() => navigate('/modules')}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <HistoryIcon size={22} /> 融合历史
            </h1>
            <p className="text-xs text-dim mt-1">查看所有融合任务记录</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <Loader2 size={32} className="text-aurora-purple mx-auto mb-3 animate-spin" />
            <p className="text-sm text-dim">加载中...</p>
          </div>
        ) : tasks.length === 0 ? (
          <GlassCard className="p-12 text-center">
            <HistoryIcon size={40} className="text-dim mx-auto mb-4" />
            <p className="text-sm text-dim mb-4">还没有融合任务</p>
            <button className="btn-primary" onClick={() => navigate('/select')}>
              开始第一次融合
            </button>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {tasks.map((task, i) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => openTask(task.id)}
              >
                <GlassCard className="p-4 cursor-pointer" hover>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {statusIcon(task.status)}
                      <div>
                        <p className="text-sm font-medium">{task.id}</p>
                        <p className="text-xs text-dim">
                          {task.projectIds.length} 个项目 · {task.strategy} · {task.currentStep}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {task.score > 0 && (
                        <p className="text-lg font-bold" style={{ color: task.score > 75 ? 'var(--color-aurora-cyan)' : 'var(--color-aurora-pink)' }}>
                          {task.score}
                        </p>
                      )}
                      <p className="text-[10px] text-dim">{task.createdAt.slice(0, 19).replace('T', ' ')}</p>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
