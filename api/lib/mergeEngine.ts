// 拼接引擎 - v0.13 升级为 AST 语义级融合
// v0.12: regex 扫描导出 + 重命名 + 去重
// v0.13: @babel/parser AST 实体提取 + intra-entity 3-way merge + 产物安全扫描
//
// 核心升级：
// 1. AST 替代 regex - 识别函数/类/常量/接口/类型/枚举，支持动态导出与 re-export
// 2. intra-entity merge - 同名实体改动不重叠时自动合并函数体（Weave 风格）
// 3. 实体级冲突检测 - 同名不同种类（class Foo vs function Foo）不再误判

import type { Project, FusionStrategy, FileNode } from '../types.js'
import type { MergePlan } from './thinkEngine.js'
import { chat } from './aiClient.js'
import {
  parseFile,
  isAstParseable,
  type CodeEntity,
} from './astParser.js'
import {
  mergeEntities,
  recordMergeResult,
  emptyMergeStats,
  type MergeStats,
  type EntityMergeResult,
} from './entityMerger.js'
import { buildDependencyGraph } from './dependencyGraph.js'
import type { DependencyGraphInfo } from '../types.js'

/** 融合上下文 - 用于取消与日志 */
export interface MergeContext {
  apiKey?: string
  model?: string
  baseUrl?: string
  signal?: AbortSignal
}

/** 导出符号表 - 用于冲突检测（v0.13 基于 AST） */
interface ExportSymbol {
  name: string
  kind: CodeEntity['kind']
  projectName: string
  filePath: string
  isDefault?: boolean
  /** 实体引用（用于 intra-entity merge） */
  entity?: CodeEntity
}

/** 依赖版本表 - 用于冲突解决 */
interface DepVersion {
  name: string
  version: string
  projectName: string
}

/** 融合产物 - 供安全扫描使用 */
export interface MergeProduct {
  files: FileNode[]
  mergeStats: MergeStats
  conflictReport: string[]
}

/** 融合结果 - 包含文件树、合并统计、依赖图（P1-2/P1-4 新增） */
export interface MergeResult {
  files: FileNode[]
  mergeStats: MergeStats
  dependencyGraph: DependencyGraphInfo
}

/**
 * 执行代码拼接 - 生成融合后的项目文件树
 * v0.13: AST 语义级融合 + intra-entity merge
 * P1-4: 同时返回依赖图分析结果
 */
export async function runMerge(
  projects: Project[],
  plan: MergePlan,
  strategy: FusionStrategy,
  options: { apiKey?: string; model?: string; baseUrl?: string; signal?: AbortSignal } = {}
): Promise<MergeResult> {
  const ctx: MergeContext = { apiKey: options.apiKey, model: options.model, baseUrl: options.baseUrl, signal: options.signal }
  const mergeStats = emptyMergeStats()

  // 1. AST 扫描所有项目的代码实体
  const symbolTable = buildSymbolTable(projects)
  // 2. 检测导出冲突 - 区分"可合并"与"需重命名"
  const { renameMap, mergeResults } = detectExportConflicts(symbolTable, strategy, projects, mergeStats)
  // 3. 收集依赖版本并解决冲突
  const resolvedDeps = resolveDependencyVersions(projects)
  // 4. 代码级去重 - 基于 AST 实体指纹
  const dedupReport = deduplicateSymbols(projects, symbolTable)
  // 5. AI 生成核心文件（传入冲突信息）
  const aiFiles = await aiGenerateFiles(projects, plan, strategy, renameMap, mergeResults, ctx)
  // 6. 规则生成基础文件（使用解决后的依赖）
  const ruleFiles = generateRuleFiles(projects, plan, resolvedDeps, renameMap, dedupReport, mergeStats)
  // 7. 引入上传项目原始文件（应用重命名 + 注入合并后的实体）
  const uploadedFiles = collectUploadedFiles(projects, renameMap, mergeResults)
  // 8. 生成桥接层与冲突报告
  const bridgeFiles = generateBridgeFiles(projects, renameMap, dedupReport, mergeStats)

  const allFiles = [...ruleFiles, ...aiFiles, ...bridgeFiles, ...uploadedFiles]
  const fileTree = buildFileTree(allFiles)

  // P1-4: 构建依赖图
  const dependencyGraph = buildDependencyGraph(projects)

  return { files: fileTree, mergeStats, dependencyGraph }
}

/** AST 扫描所有项目的导出符号 */
function buildSymbolTable(projects: Project[]): ExportSymbol[] {
  const table: ExportSymbol[] = []
  for (const p of projects) {
    if (!p.files) continue
    const safeName = p.name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase() || 'module'
    for (const f of p.files) {
      if (!isAstParseable(f.path)) continue
      const { entities } = parseFile(f.path, f.content)
      for (const e of entities) {
        if (!e.isExported) continue
        table.push({
          name: e.name,
          kind: e.kind,
          projectName: safeName,
          filePath: f.path,
          isDefault: e.isDefault,
          entity: e,
        })
      }
    }
  }
  return table
}

/**
 * 检测同名导出冲突 - v0.13 升级为 AST 实体级
 * 关键改进：同名同种类才视为冲突，同名不同种类（class Foo vs function Foo）不冲突
 * 冲突时优先尝试 intra-entity merge，无法合并才重命名
 */
function detectExportConflicts(
  symbols: ExportSymbol[],
  strategy: FusionStrategy,
  projects: Project[],
  mergeStats: MergeStats
): { renameMap: Map<string, string>; mergeResults: EntityMergeResult[] } {
  const renameMap = new Map<string, string>()
  const mergeResults: EntityMergeResult[] = []

  // 按 (name, kind) 分组 - 同名同种类才冲突
  const groups = new Map<string, ExportSymbol[]>()
  for (const s of symbols) {
    const key = `${s.name}::${s.kind}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(s)
  }

  for (const [, group] of groups) {
    const uniqueProjects = new Set(group.map((s) => s.projectName))
    if (uniqueProjects.size < 2) continue // 同名但只来自一个项目，无冲突

    // 两两尝试合并
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]
        const b = group[j]
        if (!a.entity || !b.entity) continue

        const result = mergeEntities(
          a.entity,
          b.entity,
          strategy,
          a.projectName,
          b.projectName
        )
        recordMergeResult(mergeStats, result)
        mergeResults.push(result)

        // 重命名场景：生成重命名映射
        if (result.decision === 'renamed') {
          const renameA = generateRename(a.name, a.projectName, strategy)
          const renameB = generateRename(b.name, b.projectName, strategy)
          renameMap.set(`${a.projectName}::${a.name}`, renameA)
          renameMap.set(`${b.projectName}::${b.name}`, renameB)
        }
        // merged / deduplicated 场景：不重命名，由 collectUploadedFiles 注入合并体
      }
    }
  }

  return { renameMap, mergeResults }
}

/** 解决依赖版本冲突 - 取最高兼容版本 */
function resolveDependencyVersions(projects: Project[]): Map<string, string> {
  const versionMap = new Map<string, string[]>()

  for (const p of projects) {
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
    for (const dep of p.dependencies) {
      if (!versionMap.has(dep)) versionMap.set(dep, ['latest'])
    }
  }

  const resolved = new Map<string, string>()
  for (const [name, versions] of versionMap) {
    resolved.set(name, pickHighestVersion(versions))
  }
  return resolved
}

function pickHighestVersion(versions: string[]): string {
  if (versions.length === 1) return versions[0]
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

/** 代码级去重 - v0.13 基于 AST 实体 body 哈希 */
function deduplicateSymbols(
  projects: Project[],
  _symbols: ExportSymbol[]
): { duplicates: string[]; removedCount: number } {
  const implHash = new Map<string, { symbol: string; project: string }>()
  const duplicates: string[] = []

  for (const p of projects) {
    if (!p.files) continue
    const safeName = p.name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase() || 'module'
    for (const f of p.files) {
      if (!isAstParseable(f.path)) continue
      const { entities } = parseFile(f.path, f.content)
      for (const e of entities) {
        if (!e.isExported) continue
        // 用 body 归一化哈希
        const normalized = e.body.replace(/\s+/g, ' ').trim()
        const hash = simpleHash(normalized)
        const key = `${e.name}::${e.kind}::${hash}`
        if (implHash.has(key)) {
          duplicates.push(`${safeName}.${e.name} 与 ${implHash.get(key)!.project}.${implHash.get(key)!.symbol} 实现完全相同`)
        } else {
          implHash.set(key, { symbol: e.name, project: safeName })
        }
      }
    }
  }

  return { duplicates, removedCount: duplicates.length }
}

/** AI 生成核心文件 - 传入 AST 合并结果让 AI 知道哪些已自动合并 */
async function aiGenerateFiles(
  projects: Project[],
  plan: MergePlan,
  strategy: FusionStrategy,
  renameMap: Map<string, string>,
  mergeResults: EntityMergeResult[],
  ctx: MergeContext
): Promise<{ path: string; content: string }[]> {
  const conflicts: string[] = []
  for (const [orig, newName] of renameMap) {
    conflicts.push(`${orig} → ${newName}`)
  }
  const merges: string[] = mergeResults
    .filter((r) => r.decision === 'merged')
    .map((r) => r.reason)

  const prompt = `你是代码生成专家。请根据以下信息生成融合项目的核心文件，返回 JSON。
项目：${projects.map((p) => p.name).join(' + ')}
融合策略：${strategy}
目标结构：${JSON.stringify(plan.targetStructure)}
共享依赖：${plan.sharedDeps.join(', ')}

AST 实体合并结果：
- 已自动合并函数体：${merges.length} 处
${merges.length > 0 ? merges.map((m) => '  ' + m).join('\n') : ''}
- 需重命名隔离：${renameMap.size} 处
${renameMap.size > 0 ? conflicts.map((c) => '  ' + c).join('\n') : ''}

请生成以下文件：
1. README.md - 融合项目说明，需列出 AST 合并与冲突处理方式
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
    return fallbackFiles(projects, plan, renameMap, mergeResults)
  }
}

/** 规则生成基础文件 - 使用解决后的依赖版本 */
function generateRuleFiles(
  projects: Project[],
  plan: MergePlan,
  resolvedDeps: Map<string, string>,
  renameMap: Map<string, string>,
  dedupReport: { duplicates: string[]; removedCount: number },
  mergeStats: MergeStats
): { path: string; content: string }[] {
  const projectName = projects.map((p) => p.name).join('-') + '-Fused'

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

  const conflictReport = renameMap.size > 0
    ? `## 导出冲突处理\n\n共检测到 ${renameMap.size} 个同名导出冲突，已按策略重命名：\n` +
      Array.from(renameMap.entries()).map(([orig, n]) => `- \`${orig}\` → \`${n}\``).join('\n')
    : '## 导出冲突处理\n\n未检测到需重命名的同名导出冲突。'

  const dedupReportStr = dedupReport.removedCount > 0
    ? `## 代码去重\n\n识别到 ${dedupReport.removedCount} 处完全相同的实现，已自动去重：\n` +
      dedupReport.duplicates.map((d) => `- ${d}`).join('\n')
    : '## 代码去重\n\n未发现可去重的重复实现。'

  const astMergeReport = mergeStats.merged > 0
    ? `## AST 实体合并（v0.13 新增）\n\n自动合并 ${mergeStats.merged} 处不重叠改动：\n` +
      mergeStats.details.filter((d) => d.decision === 'merged').map((d) => `- ${d.reason}`).join('\n')
    : '## AST 实体合并\n\n无可自动合并的实体改动。'

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
        `  astMerged: ${mergeStats.merged},`,
        `  deduplicated: ${mergeStats.deduplicated + dedupReport.removedCount},`,
        `  renamed: ${mergeStats.renamed},`,
        `};`,
        '',
        'export const sharedDeps = ' + JSON.stringify(plan.sharedDeps, null, 2) + ';',
      ].join('\n'),
    },
    {
      path: 'FUSION_REPORT.md',
      content: `# 融合报告\n\n## 来源项目\n${projects.map((p) => `- ${p.name}`).join('\n')}\n\n${astMergeReport}\n\n${conflictReport}\n\n${dedupReportStr}\n`,
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
  dedupReport: { duplicates: string[]; removedCount: number },
  mergeStats: MergeStats
): { path: string; content: string }[] {
  if (renameMap.size === 0 && dedupReport.removedCount === 0 && mergeStats.merged === 0) {
    return [{
      path: 'src/bridge/index.ts',
      content: '// 桥接层 - 无冲突时为空\nexport {}\n',
    }]
  }

  const byProject = new Map<string, { from: string; to: string }[]>()
  for (const [orig, newName] of renameMap) {
    const [project, original] = orig.split('::')
    if (!byProject.has(project)) byProject.set(project, [])
    byProject.get(project)!.push({ from: original, to: newName })
  }

  const lines: string[] = [
    '// 桥接层 - 处理融合过程中的导出冲突、去重与 AST 合并',
    '// 此文件由 v0.13 AST 融合引擎自动生成',
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

  if (mergeStats.merged > 0) {
    lines.push('// AST 自动合并记录')
    lines.push(`export const astMergedEntities = ${JSON.stringify(
      mergeStats.details.filter((d) => d.decision === 'merged').map((d) => d.reason),
      null, 2
    )};`)
  }

  if (dedupReport.removedCount > 0) {
    lines.push('// 去重记录')
    lines.push(`export const deduplicatedSymbols = ${JSON.stringify(dedupReport.duplicates, null, 2)};`)
  }

  return [{ path: 'src/bridge/index.ts', content: lines.join('\n') }]
}

/** 收集上传项目的原始文件，应用重命名 + 注入 AST 合并体 */
function collectUploadedFiles(
  projects: Project[],
  renameMap: Map<string, string>,
  mergeResults: EntityMergeResult[]
): { path: string; content: string }[] {
  const result: { path: string; content: string }[] = []
  // 收集所有已合并的实体源码，注入到 bridge/merged-entities.ts
  const mergedSources = mergeResults
    .filter((r) => r.decision === 'merged' && r.mergedSource)
    .map((r) => r.mergedSource)

  for (const p of projects) {
    if (p.source !== 'uploaded' || !p.files || p.files.length === 0) continue
    const safeName = p.name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase() || 'module'
    const renames = new Map<string, string>()
    for (const [orig, newName] of renameMap) {
      const [project, original] = orig.split('::')
      if (project === safeName) renames.set(original, newName)
    }

    for (const f of p.files) {
      if (f.content.length > 50000) continue
      if (f.path === 'package.json' || f.path === 'README.md') continue
      let content = f.content
      for (const [from, to] of renames) {
        // AST 级别替换：仅替换 export 声明中的符号名
        const re = new RegExp(`(export\\s+(?:default\\s+)?(?:function|const|let|var|class|interface|type|enum)\\s+)${escapeRegExp(from)}\\b`, 'g')
        content = content.replace(re, `$1${to}`)
      }
      result.push({
        path: `src/modules/${safeName}/${f.path}`,
        content,
      })
    }
  }

  // 注入 AST 合并的实体文件
  if (mergedSources.length > 0) {
    result.push({
      path: 'src/bridge/merged-entities.ts',
      content: [
        '// AST 自动合并的实体 - 两项目改动不重叠，已合并函数体',
        '// v0.13 intra-entity 3-way merge 产物',
        '',
        ...mergedSources,
      ].join('\n\n'),
    })
  }

  return result
}

/** 降级文件生成 */
function fallbackFiles(
  projects: Project[],
  plan: MergePlan,
  renameMap: Map<string, string>,
  mergeResults: EntityMergeResult[]
): { path: string; content: string }[] {
  const conflictNote = renameMap.size > 0
    ? `\n\n## 冲突处理\n已自动重命名 ${renameMap.size} 个冲突导出，详见 src/bridge/index.ts\n`
    : ''
  const mergeNote = mergeResults.some((r) => r.decision === 'merged')
    ? `\n## AST 实体合并\n已自动合并 ${mergeResults.filter((r) => r.decision === 'merged').length} 处不重叠改动，详见 src/bridge/merged-entities.ts\n`
    : ''

  return [
    {
      path: 'README.md',
      content: `# ${projects.map((p) => p.name).join(' + ')} 融合项目\n\n由 ProjectFusion v0.13 自动生成。\n\n## 来源项目\n${projects.map((p) => `- ${p.name}: ${p.description}`).join('\n')}\n\n## 目录结构\n${plan.targetStructure.map((s) => `- \`${s.path}\`: ${s.purpose}`).join('\n')}${conflictNote}${mergeNote}`,
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

/** 生成重命名（与 entityMerger 保持一致） */
function generateRename(
  name: string,
  projectName: string,
  strategy: 'conservative' | 'balanced' | 'aggressive'
): string {
  const safe = projectName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase() || 'module'
  if (strategy === 'conservative') return name
  if (strategy === 'balanced') {
    const cap = safe.charAt(0).toUpperCase() + safe.slice(1)
    return `${cap}_${name}`
  }
  const hash = simpleHash(`${safe}::${name}`).slice(0, 4)
  return `${name}_${hash}`
}

function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()
  return text.trim()
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function simpleHash(s: string): string {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}
