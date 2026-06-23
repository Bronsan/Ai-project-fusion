// AI 配置管理 - 多模型配置增删改查 + JSON 文件直接编辑
// v0.13: 从 Settings 页面拆分独立界面

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Key, Plus, Trash2, Check, Loader2, FolderOpen,
  Sparkles, Edit3, X, AlertCircle, Copy, FileJson,
} from 'lucide-react'
import {
  fetchAIConfig, saveAIConfig, fetchAIConfigPath, testAIProvider,
  type AIProviderConfig,
} from '@/lib/api'
import AuroraBackground from '@/components/AuroraBackground'
import GlassCard from '@/components/GlassCard'
import ThemeToggle from '@/components/ThemeToggle'

interface EditableProvider extends AIProviderConfig {
  isNew?: boolean
}

export default function AIConfig() {
  const navigate = useNavigate()
  const [providers, setProviders] = useState<EditableProvider[]>([])
  const [defaultId, setDefaultId] = useState('builtin')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [configPath, setConfigPath] = useState('')
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({})

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const [config, pathRes] = await Promise.all([fetchAIConfig(), fetchAIConfigPath()])
      setProviders(config.providers)
      setDefaultId(config.defaultId)
      setConfigPath(pathRes.path)
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || '加载配置失败' })
    }
    setLoading(false)
  }

  const handleAdd = () => {
    const newId = `new-${Date.now()}`
    const newProvider: EditableProvider = {
      id: newId,
      name: '新模型配置',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      hasApiKey: false,
      model: 'gpt-4o-mini',
      enabled: true,
      isNew: true,
    }
    setProviders([...providers, newProvider])
    setEditingId(newId)
  }

  const handleDelete = (id: string) => {
    if (providers.length <= 1) {
      setMsg({ type: 'error', text: '至少保留一个配置' })
      return
    }
    if (!confirm('确定删除此配置？')) return
    const filtered = providers.filter((p) => p.id !== id)
    setProviders(filtered)
    if (defaultId === id) {
      setDefaultId(filtered[0].id)
    }
    setMsg({ type: 'info', text: '已删除，点击"保存配置"生效' })
  }

  const handleUpdate = (id: string, patch: Partial<EditableProvider>) => {
    setProviders(providers.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  const handleSetDefault = (id: string) => {
    setDefaultId(id)
    setProviders(providers.map((p) => ({ ...p, isDefault: p.id === id })))
    setMsg({ type: 'info', text: '已设为默认，点击"保存配置"生效' })
  }

  const handleSave = async () => {
    setSaving(true)
    setMsg(null)
    try {
      await saveAIConfig({
        defaultId,
        providers: providers.map(({ hasApiKey: _hasApiKey, isNew: _isNew, ...rest }) => rest),
      })
      setMsg({ type: 'success', text: '配置已保存' })
      await loadConfig()
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || '保存失败' })
    }
    setSaving(false)
  }

  const handleTest = async (provider: EditableProvider) => {
    setTestingId(provider.id)
    try {
      const res = await testAIProvider({
        apiKey: provider.apiKey,
        model: provider.model,
        baseUrl: provider.baseUrl,
      })
      setTestResults({ ...testResults, [provider.id]: { ok: res.ok, message: res.message } })
    } catch (err: any) {
      setTestResults({ ...testResults, [provider.id]: { ok: false, message: err?.message || '测试失败' } })
    }
    setTestingId(null)
  }

  const handleCopyPath = () => {
    navigator.clipboard.writeText(configPath)
    setMsg({ type: 'success', text: '路径已复制' })
  }

  const handleOpenFolder = async () => {
    // Wails 桌面端：调用 Go 打开文件夹
    if (typeof window !== 'undefined' && (window as any).go?.backend?.App?.OpenFolder) {
      try {
        await (window as any).go.backend.App.OpenFolder(configPath)
        return
      } catch {
        // 降级到提示
      }
    }
    // Web 模式：无法直接打开文件夹，提示用户手动操作
    setMsg({ type: 'info', text: 'Web 模式无法直接打开文件夹，请复制路径手动打开' })
  }

  return (
    <div className="min-h-screen">
      <AuroraBackground />
      <div className="container-narrow py-8">
        {/* 头部 */}
        <div className="flex items-center gap-3 mb-8">
          <button className="btn-ghost !p-2" onClick={() => navigate('/settings')}>
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Key size={22} /> AI 配置管理
            </h1>
            <p className="text-xs text-dim mt-1">管理多个大模型配置，或直接编辑 JSON 文件</p>
          </div>
          <ThemeToggle />
        </div>

        <div className="space-y-6 max-w-3xl">
          {/* JSON 文件直接编辑入口 */}
          <GlassCard className="p-5">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--color-aurora-purple), var(--color-aurora-cyan))' }}
              >
                <FileJson size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold mb-1">直接编辑 JSON 文件</h2>
                <p className="text-xs text-dim mb-2">
                  也可以直接在文件管理器中打开配置文件，手动编辑 JSON 内容。
                </p>
                <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <code className="text-xs text-aurora-cyan flex-1 truncate">{configPath || 'api/ai-config.json'}</code>
                  <button
                    onClick={handleCopyPath}
                    className="btn-ghost !p-1.5"
                    title="复制路径"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={handleOpenFolder}
                    className="btn-ghost !p-1.5"
                    title="打开所在文件夹"
                  >
                    <FolderOpen size={14} />
                  </button>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* 消息提示 */}
          <AnimatePresence>
            {msg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 rounded-xl flex items-center gap-2 text-xs"
                style={{
                  background: msg.type === 'success' ? 'rgba(34, 197, 94, 0.1)'
                    : msg.type === 'error' ? 'rgba(239, 68, 68, 0.1)'
                    : 'rgba(34, 211, 238, 0.1)',
                  border: `1px solid ${msg.type === 'success' ? 'rgba(34, 197, 94, 0.3)'
                    : msg.type === 'error' ? 'rgba(239, 68, 68, 0.3)'
                    : 'rgba(34, 211, 238, 0.3)'}`,
                }}
              >
                {msg.type === 'error' ? <AlertCircle size={14} /> : <Sparkles size={14} />}
                <span>{msg.text}</span>
                <button onClick={() => setMsg(null)} className="ml-auto opacity-60 hover:opacity-100">
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 配置列表 */}
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-aurora-cyan" />
              </div>
            ) : (
              <>
                {providers.map((provider) => (
                  <GlassCard key={provider.id} className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button
                          onClick={() => handleSetDefault(provider.id)}
                          className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                            defaultId === provider.id
                              ? 'ring-2 ring-aurora-purple'
                              : 'opacity-40 hover:opacity-80'
                          }`}
                          style={{
                            background: defaultId === provider.id
                              ? 'linear-gradient(135deg, var(--color-aurora-purple), var(--color-aurora-cyan))'
                              : 'var(--color-glass)',
                          }}
                          title={defaultId === provider.id ? '默认配置' : '设为默认'}
                        >
                          {defaultId === provider.id && <Check size={12} className="text-white" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          {editingId === provider.id ? (
                            <input
                              type="text"
                              value={provider.name}
                              onChange={(e) => handleUpdate(provider.id, { name: e.target.value })}
                              className="input !py-1 !text-sm font-semibold"
                              placeholder="配置名称"
                            />
                          ) : (
                            <h3 className="text-sm font-semibold truncate">
                              {provider.name}
                              {defaultId === provider.id && (
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(124, 92, 255, 0.2)' }}>
                                  默认
                                </span>
                              )}
                              {!provider.enabled && (
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(148, 163, 184, 0.2)' }}>
                                  已禁用
                                </span>
                              )}
                            </h3>
                          )}
                          <p className="text-xs text-dim mt-0.5 truncate">
                            {provider.model} · {provider.baseUrl}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => setEditingId(editingId === provider.id ? null : provider.id)}
                          className="btn-ghost !p-1.5"
                          title={editingId === provider.id ? '收起' : '编辑'}
                        >
                          {editingId === provider.id ? <X size={14} /> : <Edit3 size={14} />}
                        </button>
                        <button
                          onClick={() => handleDelete(provider.id)}
                          className="btn-ghost !p-1.5 hover:!text-red-400"
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* 展开编辑区 */}
                    <AnimatePresence>
                      {editingId === provider.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-3 pt-3 border-t" style={{ borderColor: 'var(--color-glass-border)' }}>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-dim mb-1.5 block">模型名称</label>
                                <input
                                  type="text"
                                  value={provider.model}
                                  onChange={(e) => handleUpdate(provider.id, { model: e.target.value })}
                                  className="input"
                                  placeholder="gpt-4o-mini"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-dim mb-1.5 block">API 端点</label>
                                <input
                                  type="text"
                                  value={provider.baseUrl}
                                  onChange={(e) => handleUpdate(provider.id, { baseUrl: e.target.value })}
                                  className="input"
                                  placeholder="https://api.openai.com/v1"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-dim mb-1.5 block">
                                API Key
                                {provider.hasApiKey && provider.apiKey.includes('***') && (
                                  <span className="ml-2 text-[10px] text-aurora-cyan">（已配置，留空保持不变）</span>
                                )}
                              </label>
                              <input
                                type="password"
                                value={provider.apiKey.includes('***') ? '' : provider.apiKey}
                                onChange={(e) => handleUpdate(provider.id, { apiKey: e.target.value, hasApiKey: !!e.target.value })}
                                className="input"
                                placeholder={provider.hasApiKey ? '已配置（留空保持不变）' : 'sk-...'}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-2 text-xs cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={provider.enabled}
                                  onChange={(e) => handleUpdate(provider.id, { enabled: e.target.checked })}
                                  className="w-3.5 h-3.5"
                                />
                                <span>启用此配置</span>
                              </label>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleTest(provider)}
                                disabled={testingId === provider.id}
                                className="btn-ghost !py-1.5 !px-3 text-xs"
                              >
                                {testingId === provider.id ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Sparkles size={12} />
                                )}
                                测试连接
                              </button>
                              {testResults[provider.id] && (
                                <span
                                  className="text-xs flex items-center gap-1"
                                  style={{ color: testResults[provider.id].ok ? '#22c55e' : '#ef4444' }}
                                >
                                  {testResults[provider.id].ok ? <Check size={12} /> : <AlertCircle size={12} />}
                                  {testResults[provider.id].message}
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </GlassCard>
                ))}

                {/* 添加按钮 */}
                <button
                  onClick={handleAdd}
                  className="w-full p-4 rounded-xl border-2 border-dashed transition-all hover:border-aurora-purple/60 hover:bg-aurora-purple/5"
                  style={{ borderColor: 'var(--color-glass-border)' }}
                >
                  <Plus size={18} className="mx-auto mb-1 text-aurora-purple" />
                  <span className="text-xs text-dim">添加新模型配置</span>
                </button>
              </>
            )}
          </div>

          {/* 底部操作栏 */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => navigate('/settings')}
              className="btn-ghost"
            >
              返回
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="btn-primary"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              保存配置
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
