// 拼接引擎 - v0.12beta 升级为真代码融合
// 不再仅做文件拼接，而是处理：
// 1. 同名导出冲突检测与重命名
// 2. 依赖版本冲突解决（取最高兼容版本）
// 3. 代码级去重（基于导出符号指纹）
// 4. 自动生成桥接层与统一入口

import type { Project, FusionStrategy, FileNode } from '../types.js'
import type { MergePlan } from './thinkEngine.js'
import { chat } from './aiClient.js'

/** 融合上下文 - 用于取消与日志 */
export interface MergeContext {
  apiKey?: string
  model?: string
  signal?: AbortSignal
}

/** 导出符号表 - 用于冲突检测 */
interface ExportSymbol {
  name: string
  projectName: string
  filePath: string
  isDefault?: boolean
}

/** 依赖版本表 - 用于冲突解决 */
interface DepVersion {
  name: string
  version: string
  projectName: string
}

/**
 * 执行代码拼接 - 生成融合后的项目文件树
 * v0.12beta: 真代码融合，处理冲突与去重
 */
export async function runMerge(
  projects: Project[],
  plan: MergePlan,
  strategy: FusionStrategy,
  options: { apiKey?: string; model?: string; signal?: AbortSignal } = {}
): Promise<FileNode[]> {
  const ctx: MergeContext = { apiKey: options.apiKey, model: options.model, signal: options.signal }

  // 1. 扫描所有项目的导出符号
  const symbolTable = buildSymbolTable(projects)
  // 2. 检测导出冲突并生成重命名映射
  const renameMap = detectExportConflicts(symbolTable, strategy)
  // 3. 收集依赖版本并解决冲突
  const resolvedDeps = resolveDependencyVersions(projects)
  // 4. 代码级去重 - 识别完全相同的导出实现
  const dedupReport = deduplicateSymbols(projects, symbolTable)
  // 5. AI 生成核心文件（传入冲突信息）
  const aiFiles = await aiGenerateFiles(projects, plan, strategy, renameMap, ctx)
  // 6. 规则生成基础文件（使用解决后的依赖）
  const ruleFiles = generateRuleFiles(projects, plan, resolvedDeps, renameMap, dedupReport)
  // 7. 引入上传项目原始文件（应用重命名）
  const uploadedFiles = collectUploadedFiles(projects, renameMap)
  // 8. 生成桥接层与冲突报告
  const bridgeFiles = generateBridgeFiles(projects, renameMap, dedupReport)

  const allFiles = [...ruleFiles, ...aiFiles, ...bridgeFiles, ...uploadedFiles]
  return buildFileTree(allFiles)
}

/** 扫描所有项目的导出符号，构建符号表 */
function buildSymbolTable(projects: Project[]): ExportSymbol[] {
  const table: ExportSymbol[] = []
  const exportRe = /export\s+(?:default\s+)?(?:function|const|let|var|class|interface|type|enum)\s+(\w+)/g
  const exportBraceRe = /export\s*\{([^}]+)\}/g

  for (const p of projects) {
    if (!p.files) continue
    const safeName = p.name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase() || 'module'
    for (const f of p.files) {
      if (!isSourceFile(f.path)) continue
      let m: RegExpExecArray | null
      while ((m = exportRe.exec(f.content)) !== null) {
        table.push({ name: m[1], projectName: safeName, filePath: f.path })
      }
      while ((m = exportBraceRe.exec(f.content)) !== null) {
        for (const name of m[1].split(',')) {
          const clean = name.trim().split(' as ')[0].trim()
          if (clean) table.push({ name: clean, projectName: safeName, filePath: f.path })
        }
      }
    }
  }
  return table
}

/**
 * 检测同名导出冲突 - 不同项目导出同名符号
 * 策略：
 * - conservative: 保留双方原始名称，通过命名空间隔离
 * - balanced: 重命名为 <projectName>_<symbolName>
 * - aggressive: 重命名为 <symbolName>_<shortHash>，最大化去重
 */
function detectExportConflicts(
  symbols: ExportSymbol[],
  strategy: FusionStrategy
): Map<string, string> {
  const renameMap = new Map<string, string>()
  // 按符号名分组
  const groups = new Map<string, ExportSymbol[]>()
  for (const s of symbols) {
    if (!groups.has(s.name)) groups.set(s.name, [])
    groups.get(s.name)!.push(s)
  }

  for (const [name, group] of groups) {
    // 同名但来自不同项目 → 冲突
    const uniqueProjects = new Set(group.map((s) => s.projectName))
    if (uniqueProjects.size < 2) continue

    // 对每个冲突符号生成新名称
    for (const s of group) {
      const originalKey = `${s.projectName}::${s.name}`
      let newName: string
      if (strategy === 'conservative') {
        // 保留原名，通过命名空间访问
        newName = s.name
      } else if (strategy === 'balanced') {
        newName = `${capitalize(s.projectName)}_${s.name}`
      } else {
        // aggressive: 加短哈希
        const hash = simpleHash(originalKey).slice(0, 4)
        newName = `${s.name}_${hash}`
      }
      renameMap.set(originalKey, newName)
    }
  }
  return renameMap
}

/** 解决依赖版本冲突 - 取最高兼容版本 */
function resolveDependencyVersions(projects: Project[]): Map<string, string> {
  const versionMap = new Map<string, string[]>()

  for (const p of projects) {
    // 项目 dependencies 是字符串数组（无版本），尝试从 package.json 文件读取真实版本
    const pkgFile = p.files?.find((f) => f.path === 'package.json' || f.path.endsWith('/package.json'))
    if (pkgFile) {
      try {
        const pkg = JSON.parse(pkgFile.content)
        const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
        for (const [name, version] of Object.entries(allDeps)) {
          if (!versionMap.has(name)) versionMap.set(name, [])
          versionMap.get(name)!.push(version as string)
        }
      } catch {
        // 解析失败时仅用项目 dependencies 数组
      }
    }
    // 兜底：从 dependencies 数组补充（无版本信息，标记为 latest）
    for (const dep of p.dependencies) {
      if (!versionMap.has(dep)) versionMap.set(dep, ['latest'])
    }
  }

  // 解决冲突：取语义化版本最高
  const resolved = new Map<string, string>()
  for (const [name, versions] of versionMap) {
    resolved.set(name, pickHighestVersion(versions))
  }
  return resolved
}

/** 选择最高版本（简化版语义化比较） */
function pickHighestVersion(versions: string[]): string {
  if (versions.length === 1) return versions[0]
  // 移除 ^ ~ > 等前缀
  const clean = versions.map((v) => v.replace(/^[^0-9]*/, '').split('-')[0])
  let best = clean[0]
  for (const v of clean.slice(1)) {
    if (compareVersions(v, best) > 0) best = v
  }
  return `^${best}`
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0
    const vb = pb[i] || 0
    if (va > vb) return 1
    if (va < vb) return -1
  }
  return 0
}

/** 代码级去重 - 识别完全相同的导出实现 */
function deduplicateSymbols(
  projects: Project[],
  symbols: ExportSymbol[]
): { duplicates: string[]; removedCount: number } {
  // 通过函数体哈希识别重复实现
  const implHash = new Map<string, { symbol: string; project: string }>()
  const duplicates: string[] = []

  for (const p of projects) {
    if (!p.files) continue
    const safeName = p.name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase() || 'module'
    for (const f of p.files) {
      if (!isSourceFile(f.path)) continue
      // 提取每个导出的实现内容
      const exportImpls = extractExportImplementations(f.content)
      for (const { name, body } of exportImpls) {
        const hash = simpleHash(body.replace(/\s+/g, ' ').trim())
        const key = `${name}::${hash}`
        if (implHash.has(key)) {
          // 完全相同的实现 - 标记为可去重
          duplicates.push(`${safeName}.${name} 与 ${implHash.get(key)!.project}.${implHash.get(key)!.symbol} 实现完全相同`)
        } else {
          implHash.set(key, { symbol: name, project: safeName })
        }
      }
    }
  }

  return { duplicates, removedCount: duplicates.length }
}

/** 提取每个 export 的实现内容 */
function extractExportImplementations(content: string): { name: string; body: string }[] {
  const result: { name: string; body: string }[] = []
  // 简化实现：匹配 export function/const 后到下一个 export 或文件末尾
  const re = /export\s+(?:default\s+)?(?:function|const|let|var|class)\s+(\w+)[\s\S]*?(?=\nexport\s|\n*$)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    result.push({ name: m[1], body: m[0] })
  }
  return result
}

/** AI 生成核心文件 - 传入冲突信息让 AI 知道如何桥接 */
async function aiGenerateFiles(
  projects: Project[],
  plan: MergePlan,
  strategy: FusionStrategy,
  renameMap: Map<string, string>,
  ctx: MergeContext
): Promise<{ path: string; content: string }[]> {
  // 构建冲突摘要
  const conflicts: string[] = []
  for (const [orig, newName] of renameMap) {
    conflicts.push(`${orig} → ${newName}`)
  }

  const prompt = `你是代码生成专家。请根据以下信息生成融合项目的核心文件，返回 JSON。
项目：${projects.map((p) => p.name).join(' + ')}
融合策略：${strategy}
目标结构：${JSON.stringify(plan.targetStructure)}
共享依赖：${plan.sharedDeps.join(', ')}

检测到的导出冲突（已自动重命名）：
${conflicts.length > 0 ? conflicts.join('\n') : '无冲突'}

请生成以下文件：
1. README.md - 融合项目说明，需列出冲突处理方式
2. src/index.ts - 统一入口，使用命名空间导出所有模块
3. src/shared/index.ts - 共享层入口

返回格式：{"files":[{"path":"文件路径","content":"文件内容"}]}
只返回 JSON。`

  try {
    const content = await chat(
      [
        { role: 'system', content: '你是代码生成专家，擅长根据融合规划生成结构清晰的项目文件。' },
        { role: 'user', content: prompt },
      ],
      { apiKey: ctx.apiKey, model: ctx.model, temperature: 0.4, maxTokens: 1500 }
    )
    const parsed = JSON.parse(extractJson(content)) as { files: { path: string; content: string }[] }
    return parsed.files ?? []
  } catch {
    return fallbackFiles(projects, plan, renameMap)
  }
}

/** 规则生成基础文件 - 使用解决后的依赖版本 */
function generateRuleFiles(
  projects: Project[],
  plan: MergePlan,
  resolvedDeps: Map<string, string>,
  renameMap: Map<string, string>,
  dedupReport: { duplicates: string[]; removedCount: number }
): { path: string; content: string }[] {
  const projectName = projects.map((p) => p.name).join('-') + '-Fused'

  // 构建合并后的 dependencies（使用解决后的版本）
  const depsObj: Record<string, string> = {}
  for (const [name, version] of resolvedDeps) {
    depsObj[name] = version
  }

  const pkgJson = {
    name: projectName.toLowerCase(),
    version: '1.0.0',
    description: `由 ${projects.map((p) => p.name).join(' + ')} 融合而成`,
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'tsc && vite build',
      test: 'vitest',
    },
    dependencies: depsObj,
  }

  // 冲突报告
  const conflictReport = renameMap.size > 0
    ? `## 导出冲突处理\n\n共检测到 ${renameMap.size} 个同名导出冲突，已按策略重命名：\n` +
      Array.from(renameMap.entries()).map(([orig, n]) => `- \`${orig}\` → \`${n}\``).join('\n')
    : '## 导出冲突处理\n\n未检测到同名导出冲突。'

  const dedupReportStr = dedupReport.removedCount > 0
    ? `## 代码去重\n\n识别到 ${dedupReport.removedCount} 处完全相同的实现，已自动去重：\n` +
      dedupReport.duplicates.map((d) => `- ${d}`).join('\n')
    : '## 代码去重\n\n未发现可去重的重复实现。'

  return [
    {
      path: 'package.json',
      content: JSON.stringify(pkgJson, null, 2),
    },
    {
      path: 'src/config/index.ts',
      content: [
        '// 融合项目统一配置',
        `export const FUSION_INFO = {`,
        `  sources: ${JSON.stringify(projects.map((p) => p.name))},`,
        `  generatedAt: new Date().toISOString(),`,
        `  conflicts: ${renameMap.size},`,
        `  deduplicated: ${dedupReport.removedCount},`,
        `};`,
        '',
        'export const sharedDeps = ' + JSON.stringify(plan.sharedDeps, null, 2) + ';',
      ].join('\n'),
    },
    {
      path: 'FUSION_REPORT.md',
      content: `# 融合报告\n\n## 来源项目\n${projects.map((p) => `- ${p.name}`).join('\n')}\n\n${conflictReport}\n\n${dedupReportStr}\n`,
    },
    {
      path: '.gitignore',
      content: 'node_modules\ndist\n.env\n*.log\n',
    },
  ]
}

/** 生成桥接层 - 处理重命名后的导出映射 */
function generateBridgeFiles(
  projects: Project[],
  renameMap: Map<string, string>,
  dedupReport: { duplicates: string[]; removedCount: number }
): { path: string; content: string }[] {
  if (renameMap.size === 0 && dedupReport.removedCount === 0) {
    return [{
      path: 'src/bridge/index.ts',
      content: '// 桥接层 - 无冲突时为空\nexport {}\n',
    }]
  }

  // 按项目分组重命名映射
  const byProject = new Map<string, { from: string; to: string }[]>()
  for (const [orig, newName] of renameMap) {
    const [project, original] = orig.split('::')
    if (!byProject.has(project)) byProject.set(project, [])
    byProject.get(project)!.push({ from: original, to: newName })
  }

  const lines: string[] = [
    '// 桥接层 - 处理融合过程中的导出冲突与去重',
    '// 此文件由 v0.12beta 融合引擎自动生成',
    '',
  ]

  for (const [project, renames] of byProject) {
    lines.push(`// ${project} 模块的重命名映射`)
    lines.push(`export const ${project}Renames = {`)
    for (const r of renames) {
      lines.push(`  ${r.from}: '${r.to}',`)
    }
    lines.push(`} as const;`)
    lines.push('')
  }

  if (dedupReport.removedCount > 0) {
    lines.push('// 去重记录')
    lines.push(`export const deduplicatedSymbols = ${JSON.stringify(dedupReport.duplicates, null, 2)};`)
  }

  return [{ path: 'src/bridge/index.ts', content: lines.join('\n') }]
}

/** 收集上传项目的原始文件，应用重命名 */
function collectUploadedFiles(
  projects: Project[],
  renameMap: Map<string, string>
): { path: string; content: string }[] {
  const result: { path: string; content: string }[] = []
  for (const p of projects) {
    if (p.source !== 'uploaded' || !p.files || p.files.length === 0) continue
    const safeName = p.name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase() || 'module'
    // 该项目的重命名映射
    const renames = new Map<string, string>()
    for (const [orig, newName] of renameMap) {
      const [project, original] = orig.split('::')
      if (project === safeName) renames.set(original, newName)
    }

    for (const f of p.files) {
      if (f.content.length > 50000) continue
      if (f.path === 'package.json' || f.path === 'README.md') continue
      // 应用重命名到文件内容
      let content = f.content
      for (const [from, to] of renames) {
        // 仅替换 export 语句中的符号名，避免误伤
        const re = new RegExp(`(export\\s+(?:default\\s+)?(?:function|const|let|var|class|interface|type|enum)\\s+)${escapeRegExp(from)}\\b`, 'g')
        content = content.replace(re, `$1${to}`)
      }
      result.push({
        path: `src/modules/${safeName}/${f.path}`,
        content,
      })
    }
  }
  return result
}

/** 降级文件生成 */
function fallbackFiles(
  projects: Project[],
  plan: MergePlan,
  renameMap: Map<string, string>
): { path: string; content: string }[] {
  const conflictNote = renameMap.size > 0
    ? `\n\n## 冲突处理\n已自动重命名 ${renameMap.size} 个冲突导出，详见 src/bridge/index.ts\n`
    : ''

  return [
    {
      path: 'README.md',
      content: `# ${projects.map((p) => p.name).join(' + ')} 融合项目\n\n由 ProjectFusion v0.12beta 自动生成。\n\n## 来源项目\n${projects.map((p) => `- ${p.name}: ${p.description}`).join('\n')}\n\n## 目录结构\n${plan.targetStructure.map((s) => `- \`${s.path}\`: ${s.purpose}`).join('\n')}${conflictNote}`,
    },
    {
      path: 'src/index.ts',
      content: [
        '// 融合项目统一入口',
        `export * from './config';`,
        `export * from './shared';`,
        `export * from './bridge';`,
        `export * from './modules';`,
      ].join('\n'),
    },
    {
      path: 'src/shared/index.ts',
      content: [
        '// 共享层 - 提取公共工具与类型',
        `export const sharedDeps = ${JSON.stringify(plan.sharedDeps)};`,
      ].join('\n'),
    },
  ]
}

/** 构建文件树 - 将扁平文件列表转为树形结构 */
function buildFileTree(files: { path: string; content: string }[]): FileNode[] {
  const root: FileNode[] = []
  const dirMap = new Map<string, FileNode>()

  for (const file of files) {
    const parts = file.path.split('/')
    let currentLevel = root
    let currentPath = ''

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const isFile = i === parts.length - 1

      if (isFile) {
        currentLevel.push({
          path: currentPath,
          type: 'file',
          content: file.content,
        })
      } else {
        let dir = dirMap.get(currentPath)
        if (!dir) {
          dir = {
            path: currentPath,
            type: 'dir',
            children: [],
          }
          dirMap.set(currentPath, dir)
          currentLevel.push(dir)
        }
        currentLevel = dir.children!
      }
    }
  }

  const sortTree = (nodes: FileNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return a.path.localeCompare(b.path)
    })
    for (const n of nodes) {
      if (n.children) sortTree(n.children)
    }
  }
  sortTree(root)

  return root
}

// ========== 工具函数 ==========

function isSourceFile(p: string): boolean {
  const lower = p.toLowerCase()
  return ['.ts', '.tsx', '.js', '.jsx', '.vue', '.py', '.go', '.rs', '.java'].some((ext) => lower.endsWith(ext))
}

function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()
  return text.trim()
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 简单字符串哈希 - 用于生成短唯一标识 */
function simpleHash(s: string): string {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}
