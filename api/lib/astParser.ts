// AST 解析器 - v0.13
// 用 @babel/parser 替代 regex，做真正的语义级实体提取
// 支持识别：函数、类、常量、接口、类型、枚举
// 支持语言：TypeScript / JavaScript / TSX / JSX

import { parse, type ParserPlugin } from '@babel/parser'

/** 代码实体 - AST 提取的语义单元 */
export interface CodeEntity {
  /** 实体类型 */
  kind: 'function' | 'class' | 'constant' | 'interface' | 'type' | 'enum'
  /** 实体名称 */
  name: string
  /** 实体 ID（file:type:name）- 跨文件唯一标识 */
  id: string
  /** 源文件路径 */
  filePath: string
  /** 实体在源码中的起始行 */
  startLine: number
  /** 实体在源码中的结束行 */
  endLine: number
  /** 实体完整源码文本（含 export 关键字） */
  source: string
  /** 实体内部源码（不含 export 前缀，用于合并时重生成） */
  body: string
  /** 是否为默认导出 */
  isDefault: boolean
  /** 是否为导出实体 */
  isExported: boolean
  /** 函数参数签名（仅 function 有） */
  params?: string[]
  /** 类的父类/实现接口（仅 class 有） */
  extendsList?: string[]
}

/** 解析结果 */
export interface ParseResult {
  entities: CodeEntity[]
  /** 提取的 import 关系（P1-4 新增，用于依赖图分析） */
  imports: ImportRelation[]
  /** 解析错误（不阻断，降级为空） */
  errors: string[]
}

/** import 关系 - 文件级依赖信息 */
export interface ImportRelation {
  /** 源文件路径 */
  filePath: string
  /** 导入的模块路径（原始字符串） */
  source: string
  /** 导入的具名符号 */
  specifiers: string[]
  /** 是否为默认导入 */
  hasDefault: boolean
  /** 是否为命名空间导入（import * as） */
  hasNamespace: boolean
  /** 是否为动态导入（import()） */
  isDynamic: boolean
}

/** 根据文件扩展名推断 babel 插件 */
function pluginsForFile(filePath: string): ParserPlugin[] {
  const lower = filePath.toLowerCase()
  const plugins: ParserPlugin[] = ['decorators-legacy']
  if (lower.endsWith('.tsx') || lower.endsWith('.ts')) {
    plugins.push('typescript')
  }
  if (lower.endsWith('.jsx') || lower.endsWith('.tsx') || lower.endsWith('.js')) {
    plugins.push('jsx')
  }
  return plugins
}

/** 判断文件是否可被 AST 解析 */
export function isAstParseable(filePath: string): boolean {
  const lower = filePath.toLowerCase()
  return ['.ts', '.tsx', '.js', '.jsx'].some((ext) => lower.endsWith(ext))
}

/**
 * 解析单个文件，提取所有代码实体
 * 解析失败时返回空列表 + 错误信息（不抛异常）
 */
export function parseFile(filePath: string, content: string): ParseResult {
  if (!isAstParseable(filePath)) {
    return { entities: [], imports: [], errors: [] }
  }

  const plugins = pluginsForFile(filePath)
  const isTs = filePath.toLowerCase().endsWith('.ts') || filePath.toLowerCase().endsWith('.tsx')

  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins,
      errorRecovery: true, // 容错：即使部分语法错误也尽量提取
      ranges: true,
      tokens: false,
    })

    const entities: CodeEntity[] = []
    const imports: ImportRelation[] = []
    const lines = content.split('\n')

    for (const node of ast.program.body) {
      const entity = extractEntity(node, filePath, content, lines)
      if (entity) entities.push(entity)
      // 提取 import 关系（P1-4 新增，用于依赖图分析）
      const imp = extractImport(node, filePath)
      if (imp) imports.push(imp)
    }

    return { entities, imports, errors: [] }
  } catch (err) {
    return {
      entities: [],
      imports: [],
      errors: [`${filePath}: ${(err as Error).message}`],
    }
  }
}

/** 从 AST 顶层节点提取 import 关系（P1-4 新增） */
function extractImport(node: any, filePath: string): ImportRelation | null {
  // 静态 import: import { a } from 'b'
  if (node.type === 'ImportDeclaration' && node.source?.value) {
    const specifiers: string[] = []
    let hasDefault = false
    let hasNamespace = false
    for (const spec of node.specifiers || []) {
      if (spec.type === 'ImportDefaultSpecifier') {
        hasDefault = true
        if (spec.local?.name) specifiers.push(spec.local.name)
      } else if (spec.type === 'ImportNamespaceSpecifier') {
        hasNamespace = true
        if (spec.local?.name) specifiers.push(spec.local.name)
      } else if (spec.type === 'ImportSpecifier') {
        if (spec.local?.name) specifiers.push(spec.local.name)
      }
    }
    return {
      filePath,
      source: node.source.value,
      specifiers,
      hasDefault,
      hasNamespace,
      isDynamic: false,
    }
  }

  // 动态 import: import('b').then(...)
  if (node.type === 'ExpressionStatement' &&
      node.expression?.type === 'CallExpression' &&
      node.expression.callee?.type === 'Import') {
    const arg = node.expression.arguments?.[0]
    if (arg?.value) {
      return {
        filePath,
        source: arg.value,
        specifiers: [],
        hasDefault: false,
        hasNamespace: false,
        isDynamic: true,
      }
    }
  }

  // require('b') - CommonJS
  if (node.type === 'ExpressionStatement' &&
      node.expression?.type === 'CallExpression' &&
      node.expression.callee?.name === 'require') {
    const arg = node.expression.arguments?.[0]
    if (arg?.value) {
      return {
        filePath,
        source: arg.value,
        specifiers: [],
        hasDefault: false,
        hasNamespace: false,
        isDynamic: false,
      }
    }
  }

  return null
}

/** 从 AST 顶层节点提取实体 */
function extractEntity(
  node: any,
  filePath: string,
  content: string,
  _lines: string[]
): CodeEntity | null {
  // 处理 ExportNamedDeclaration / ExportDefaultDeclaration 包裹
  let isExported = false
  let isDefault = false
  let inner = node

  if (node.type === 'ExportNamedDeclaration') {
    isExported = true
    inner = node.declaration
    if (!inner) return null // export { a, b } 这类 re-export
  } else if (node.type === 'ExportDefaultDeclaration') {
    isExported = true
    isDefault = true
    inner = node.declaration
    if (!inner) return null
  }

  if (!inner) return null

  const kind = getEntityKind(inner.type)
  if (!kind) return null

  const name = getEntityName(inner)
  if (!name) return null

  const start = inner.start ?? node.start ?? 0
  const end = inner.end ?? node.end ?? content.length
  const source = content.slice(node.start ?? start, node.end ?? end)
  const body = content.slice(start, end)

  const startLine = node.loc?.start?.line ?? 1
  const endLine = node.loc?.end?.line ?? startLine

  const entity: CodeEntity = {
    kind,
    name,
    id: `${filePath}:${kind}:${name}`,
    filePath,
    startLine,
    endLine,
    source,
    body,
    isDefault,
    isExported,
  }

  // 提取函数参数
  if (kind === 'function' && inner.params) {
    entity.params = inner.params.map((p: any) => extractParamName(p)).filter(Boolean)
  }

  // 提取类的继承信息
  if (kind === 'class') {
    entity.extendsList = []
    if (inner.superClass) {
      entity.extendsList.push(extractExpressionName(inner.superClass))
    }
    if (inner.implements) {
      for (const impl of inner.implements) {
        entity.extendsList.push(extractExpressionName(impl.id || impl))
      }
    }
  }

  return entity
}

/** 从 AST 节点类型推断实体种类 */
function getEntityKind(nodeType: string): CodeEntity['kind'] | null {
  switch (nodeType) {
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      return 'function'
    case 'ClassDeclaration':
    case 'ClassExpression':
      return 'class'
    case 'VariableDeclaration':
      return 'constant'
    case 'TSInterfaceDeclaration':
      return 'interface'
    case 'TSTypeAliasDeclaration':
      return 'type'
    case 'TSEnumDeclaration':
      return 'enum'
    default:
      return null
  }
}

/** 从声明节点提取名称 */
function getEntityName(node: any): string | null {
  if (node.id && node.id.name) return node.id.name
  // const a = 1, b = 2; 只取第一个声明名
  if (node.declarations && node.declarations[0]?.id?.name) {
    return node.declarations[0].id.name
  }
  // export default function () {} - 匿名默认导出
  if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
    return node.id?.name ?? 'default'
  }
  return null
}

/** 提取参数名 */
function extractParamName(param: any): string {
  if (!param) return ''
  if (param.name) return param.name
  if (param.left && param.left.name) return param.left.name // 赋默认值
  if (param.properties && param.properties[0]?.key?.name) {
    return `{${param.properties[0].key.name}}` // 解构
  }
  if (param.argument && param.argument.name) return `...${param.argument.name}` // rest
  return ''
}

/** 提取表达式名（用于继承链） */
function extractExpressionName(node: any): string {
  if (!node) return ''
  if (node.name) return node.name
  if (node.id?.name) return node.id.name
  if (node.expression?.name) return node.expression.name
  return ''
}

/**
 * 跨文件实体匹配 - Weave 风格的 ID 对齐
 * 同名同种类实体视为可能冲突
 */
export function matchEntitiesAcrossFiles(
  entityGroups: Map<string, CodeEntity[]>
): Map<string, CodeEntity[]> {
  // 按 (kind, name) 分组
  const matched = new Map<string, CodeEntity[]>()
  for (const [, entities] of entityGroups) {
    for (const e of entities) {
      const key = `${e.kind}:${e.name}`
      if (!matched.has(key)) matched.set(key, [])
      matched.get(key)!.push(e)
    }
  }
  return matched
}

/**
 * 计算两个实体 body 的差异行集合
 * 用于 intra-entity merge 判断改动是否重叠
 */
export function diffEntityBodies(bodyA: string, bodyB: string): {
  changedLinesA: Set<number>
  changedLinesB: Set<number>
  canAutoMerge: boolean
} {
  const linesA = bodyA.split('\n')
  const linesB = bodyB.split('\n')
  const changedA = new Set<number>()
  const changedB = new Set<number>()

  // 简化 LCS：逐行比较，长度不同时标记差异
  const maxLen = Math.max(linesA.length, linesB.length)
  for (let i = 0; i < maxLen; i++) {
    const a = linesA[i]
    const b = linesB[i]
    if (a === undefined) {
      changedB.add(i)
    } else if (b === undefined) {
      changedA.add(i)
    } else if (a.trim() !== b.trim()) {
      changedA.add(i)
      changedB.add(i)
    }
  }

  // 判断是否可自动合并：差异行不重叠
  // 这里简化：如果两边都改了同一行号 → 冲突
  const overlap = [...changedA].filter((i) => changedB.has(i))
  return {
    changedLinesA: changedA,
    changedLinesB: changedB,
    canAutoMerge: overlap.length === 0,
  }
}
