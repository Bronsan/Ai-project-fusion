// 依赖图分析 - P1-4 新增
// 基于 AST 提取的 import 关系构建项目间依赖图
// 检测循环依赖、孤立模块、共享依赖

import type { Project } from '../types.js'
import type { DependencyGraphInfo, GraphNodeInfo, GraphEdgeInfo } from '../types.js'
import { parseFile, isAstParseable, type ImportRelation } from './astParser.js'

/**
 * 构建依赖图并分析
 * @param projects 参与融合的项目列表
 * @returns 依赖图信息（节点、边、循环依赖、孤立模块、共享依赖）
 */
export function buildDependencyGraph(projects: Project[]): DependencyGraphInfo {
  const nodes: GraphNodeInfo[] = []
  const edges: GraphEdgeInfo[] = []
  const edgesSet = new Set<string>() // 去重

  // 1. 为每个项目创建节点
  for (const p of projects) {
    const safeName = p.name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase() || 'module'
    nodes.push({
      id: `project:${safeName}`,
      label: p.name,
      type: 'project',
      project: safeName,
    })
  }

  // 2. 收集所有项目的 import 关系
  const allImports: { project: string; imports: ImportRelation[] }[] = []
  for (const p of projects) {
    const safeName = p.name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase() || 'module'
    if (!p.files) continue
    const projectImports: ImportRelation[] = []
    for (const f of p.files) {
      if (!isAstParseable(f.path)) continue
      const { imports } = parseFile(f.path, f.content)
      projectImports.push(...imports)
    }
    allImports.push({ project: safeName, imports: projectImports })
  }

  // 3. 解析 import source，分类为内部模块或外部依赖
  const externalDeps = new Map<string, Set<string>>() // dep -> projects
  const internalEdges = new Map<string, Set<string>>() // project -> projects it depends on

  for (const { project, imports } of allImports) {
    if (!internalEdges.has(project)) internalEdges.set(project, new Set())
    for (const imp of imports) {
      const source = imp.source
      // 判断是否为项目间引用（相对路径或包含其他项目名）
      const isRelative = source.startsWith('.') || source.startsWith('/')
      const targetProject = findTargetProject(source, projects, project)

      if (targetProject) {
        // 项目间依赖
        internalEdges.get(project)!.add(targetProject)
        const edgeKey = `${project}->${targetProject}:${imp.isDynamic ? 'dynamic' : 'import'}`
        if (!edgesSet.has(edgeKey)) {
          edgesSet.add(edgeKey)
          edges.push({
            from: `project:${project}`,
            to: `project:${targetProject}`,
            kind: imp.isDynamic ? 'dynamic' : 'import',
          })
        }
      } else if (!isRelative) {
        // 外部依赖（npm 包）
        const depName = extractPackageName(source)
        if (!externalDeps.has(depName)) externalDeps.set(depName, new Set())
        externalDeps.get(depName)!.add(project)
      }
    }
  }

  // 4. 添加外部依赖节点（仅共享依赖）
  for (const [dep, projectSet] of externalDeps) {
    if (projectSet.size >= 2) {
      // 共享依赖才添加为节点
      nodes.push({
        id: `ext:${dep}`,
        label: dep,
        type: 'external',
        project: 'external',
      })
      for (const project of projectSet) {
        const edgeKey = `${project}->ext:${dep}:import`
        if (!edgesSet.has(edgeKey)) {
          edgesSet.add(edgeKey)
          edges.push({
            from: `project:${project}`,
            to: `ext:${dep}`,
            kind: 'import',
          })
        }
      }
    }
  }

  // 5. 检测循环依赖（DFS 找环）
  const cycles = detectCycles(internalEdges)

  // 6. 检测孤立模块（无入边无出边的项目）
  const orphans = detectOrphans(projects, edges)

  // 7. 共享依赖列表
  const sharedDeps = Array.from(externalDeps.entries())
    .filter(([, s]) => s.size >= 2)
    .map(([d]) => d)
    .sort()

  return { nodes, edges, cycles, orphans, sharedDeps }
}

/** 从 import source 推断目标项目 */
function findTargetProject(
  source: string,
  projects: Project[],
  currentProject: string
): string | null {
  // 相对路径引用其他项目模块（如 ../other-project/...）
  for (const p of projects) {
    const safeName = p.name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase() || 'module'
    if (safeName === currentProject) continue
    if (source.includes(safeName) || source.includes(p.name.toLowerCase())) {
      return safeName
    }
  }
  return null
}

/** 从 import source 提取 npm 包名 */
function extractPackageName(source: string): string {
  // scoped package: @scope/name → @scope/name
  if (source.startsWith('@')) {
    const parts = source.split('/')
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : source
  }
  // 普通包：name/subpath → name
  return source.split('/')[0]
}

/** DFS 检测循环依赖 */
function detectCycles(internalEdges: Map<string, Set<string>>): string[][] {
  const cycles: string[][] = []
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const path: string[] = []

  const dfs = (node: string): void => {
    if (recursionStack.has(node)) {
      // 找到环
      const cycleStart = path.indexOf(node)
      if (cycleStart !== -1) {
        const cycle = path.slice(cycleStart).concat(node)
        cycles.push(cycle)
      }
      return
    }
    if (visited.has(node)) return

    visited.add(node)
    recursionStack.add(node)
    path.push(node)

    const neighbors = internalEdges.get(node)
    if (neighbors) {
      for (const next of neighbors) {
        dfs(next)
      }
    }

    path.pop()
    recursionStack.delete(node)
  }

  for (const [node] of internalEdges) {
    if (!visited.has(node)) dfs(node)
  }

  return cycles
}

/** 检测孤立模块 */
function detectOrphans(
  projects: Project[],
  edges: GraphEdgeInfo[]
): string[] {
  const orphans: string[] = []
  for (const p of projects) {
    const safeName = p.name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase() || 'module'
    const nodeId = `project:${safeName}`
    const hasEdge = edges.some(
      (e) => e.from === nodeId || e.to === nodeId
    )
    if (!hasEdge) orphans.push(safeName)
  }
  return orphans
}
