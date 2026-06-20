// 项目上传路由 - 接收 zip 压缩包，解压并解析项目元数据

import { Router } from 'express'
import multer from 'multer'
import AdmZip from 'adm-zip'
import {
  addUploadedProject,
  removeUploadedProject,
  generateProjectId,
  loadProjects,
} from '../lib/taskRepo.js'
import type { Project } from '../types.js'

const router = Router()

// multer 配置：仅接收单个 zip 文件，存内存
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB 上限
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed' || file.originalname.toLowerCase().endsWith('.zip')) {
      cb(null, true)
    } else {
      cb(new Error('仅支持 .zip 压缩包'))
    }
  },
})

/** 上传项目 - 解压 zip 并解析元数据 */
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: '未收到文件' })
    return
  }

  try {
    const zip = new AdmZip(req.file.buffer)
    const entries = zip.getEntries()

    if (entries.length === 0) {
      res.status(400).json({ success: false, error: '压缩包为空' })
      return
    }

    // 收集所有文件路径与内容
    const files: { path: string; content: string }[] = []
    for (const entry of entries) {
      if (entry.isDirectory) continue
      // 跳过 node_modules、.git 等无关目录
      const entryPath = entry.entryName
      if (shouldSkip(entryPath)) continue
      try {
        const content = entry.getData().toString('utf-8')
        // 仅保留文本文件，跳过二进制
        if (isTextFile(entryPath) && content.length < 200000) {
          files.push({ path: normalizePath(entryPath), content })
        }
      } catch {
        // 解析失败的文件跳过
      }
    }

    // 解析项目元数据
    const meta = parseProjectMeta(files, req.file.originalname)

    const project: Project = {
      id: generateProjectId(),
      name: meta.name,
      description: meta.description,
      language: meta.language,
      tags: meta.tags,
      stars: 0,
      license: meta.license,
      source: 'uploaded',
      readme: meta.readme,
      structure: meta.structure,
      dependencies: meta.dependencies,
      files,
    }

    addUploadedProject(project)

    res.json({ success: true, data: project })
  } catch (err: any) {
    res.status(500).json({ success: false, error: `解析失败：${err?.message ?? '未知错误'}` })
  }
})

/** 删除上传项目 */
router.delete('/:id', async (req, res) => {
  const ok = removeUploadedProject(req.params.id)
  if (!ok) {
    res.status(404).json({ success: false, error: '项目不存在或非上传项目' })
    return
  }
  res.json({ success: true })
})

/** 获取全部项目（内置 + 上传） */
router.get('/', async (_req, res) => {
  const projects = await loadProjects()
  res.json({ success: true, data: projects })
})

/** 判断路径是否应跳过 */
function shouldSkip(p: string): boolean {
  const skip = ['node_modules/', '.git/', 'dist/', 'build/', '.next/', '__pycache__/', '.DS_Store']
  return skip.some((s) => p.includes(s))
}

/** 判断是否为文本文件 */
function isTextFile(p: string): boolean {
  const textExt = [
    '.ts', '.tsx', '.js', '.jsx', '.vue', '.json', '.md', '.txt',
    '.css', '.scss', '.less', '.html', '.yml', '.yaml', '.xml',
    '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.sh',
    '.env', '.gitignore', '.toml', '.ini', '.conf',
  ]
  const lower = p.toLowerCase()
  // 无扩展名但常见配置文件
  if (lower.endsWith('license') || lower.endsWith('readme') || lower.endsWith('makefile')) return true
  return textExt.some((ext) => lower.endsWith(ext))
}

/** 规范化路径 - 去除顶层目录前缀 */
function normalizePath(p: string): string {
  const parts = p.split('/')
  // 如果有顶层目录，去掉一层
  if (parts.length > 1) {
    return parts.slice(1).join('/')
  }
  return p
}

/** 从文件列表解析项目元数据 */
function parseProjectMeta(files: { path: string; content: string }[], filename: string) {
  // 默认值
  let name = filename.replace(/\.zip$/i, '')
  let description = `用户上传的项目（来自 ${filename}）`
  let language = 'TypeScript'
  let license = 'MIT'
  let readme = ''
  const tags: string[] = ['uploaded']
  const dependencies: string[] = []
  const structure = {
    framework: 'unknown',
    buildTool: 'unknown',
    packageManager: 'npm',
    moduleSystem: 'esm',
    testFramework: 'unknown',
  }

  // 解析 package.json
  const pkgFile = files.find((f) => f.path === 'package.json' || f.path.endsWith('/package.json'))
  if (pkgFile) {
    try {
      const pkg = JSON.parse(pkgFile.content)
      if (pkg.name) name = pkg.name
      if (pkg.description) description = pkg.description
      if (pkg.license) license = pkg.license
      if (pkg.type === 'module') structure.moduleSystem = 'esm'
      else if (pkg.type === 'commonjs') structure.moduleSystem = 'cjs'
      // 合并 dependencies 与 devDependencies
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
      Object.keys(deps).forEach((d) => dependencies.push(d))
      // 推断框架
      if (deps.react) { structure.framework = 'react'; language = 'TypeScript' }
      else if (deps.vue) { structure.framework = 'vue'; language = 'TypeScript' }
      else if (deps.express) { structure.framework = 'express'; language = 'TypeScript' }
      else if (deps.next) { structure.framework = 'next'; language = 'TypeScript' }
      // 推断构建工具
      if (deps.vite) structure.buildTool = 'vite'
      else if (deps.webpack) structure.buildTool = 'webpack'
      else if (deps.typescript) structure.buildTool = 'tsc'
      // 推断测试框架
      if (deps.vitest) structure.testFramework = 'vitest'
      else if (deps.jest) structure.testFramework = 'jest'
      else if (deps.mocha) structure.testFramework = 'mocha'
      // 推断包管理器
      if (deps.pnpm) structure.packageManager = 'pnpm'
      // 从依赖提取标签
      const tagCandidates = ['react', 'vue', 'express', 'next', 'vite', 'tailwindcss', 'zustand', 'typescript']
      tagCandidates.forEach((t) => {
        if (deps[t]) tags.push(t)
      })
    } catch {
      // package.json 解析失败时忽略
    }
  }

  // 解析 README
  const readmeFile = files.find((f) => f.path.toLowerCase() === 'readme.md' || f.path.toLowerCase().endsWith('/readme.md'))
  if (readmeFile) {
    readme = readmeFile.content.slice(0, 2000)
  }

  // 推断语言（基于文件扩展名统计）
  const langCount: Record<string, number> = {}
  for (const f of files) {
    const ext = f.path.split('.').pop()?.toLowerCase()
    if (!ext) continue
    const langMap: Record<string, string> = {
      ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
      vue: 'Vue', py: 'Python', go: 'Go', rs: 'Rust', java: 'Java',
    }
    if (langMap[ext]) langCount[langMap[ext]] = (langCount[langMap[ext]] || 0) + 1
  }
  const topLang = Object.entries(langCount).sort((a, b) => b[1] - a[1])[0]
  if (topLang) language = topLang[0]

  return { name, description, language, license, readme, tags, dependencies, structure }
}

export default router
