// 实体合并器 - v0.13
// 实现 Weave 风格的 intra-entity 3-way merge
// 当两个项目都修改了同名实体时：
// 1. 若函数体改动不重叠 → 自动合并
// 2. 若改动重叠 → 按策略重命名（降级到 v0.12 行为）
// 3. 若实现完全相同 → 去重保留一份

import type { CodeEntity } from './astParser.js'
import { diffEntityBodies } from './astParser.js'

/** 合并决策结果 */
export type MergeDecision =
  | 'merged' // 已自动合并函数体
  | 'deduplicated' // 实现相同，去重
  | 'renamed' // 改动重叠，重命名隔离
  | 'no_conflict' // 无冲突（仅一方有此实体）

/** 实体合并结果 */
export interface EntityMergeResult {
  /** 合并后的实体源码（merged 时为合并体，否则为保留方） */
  mergedSource: string
  /** 决策类型 */
  decision: MergeDecision
  /** 决策说明（写入融合报告） */
  reason: string
  /** 被去重/重命名的实体列表 */
  affectedEntities: string[]
}

/**
 * 尝试合并两个同名实体
 * @param entityA 项目 A 的实体
 * @param entityB 项目 B 的实体
 * @param strategy 融合策略
 * @param projectAName 项目 A 名称（用于重命名）
 * @param projectBName 项目 B 名称
 */
export function mergeEntities(
  entityA: CodeEntity,
  entityB: CodeEntity,
  strategy: 'conservative' | 'balanced' | 'aggressive',
  projectAName: string,
  projectBName: string
): EntityMergeResult {
  // 1. 先判断是否实现完全相同 → 去重
  const bodyA = entityA.body.replace(/\s+/g, ' ').trim()
  const bodyB = entityB.body.replace(/\s+/g, ' ').trim()
  if (bodyA === bodyB) {
    return {
      mergedSource: entityA.source,
      decision: 'deduplicated',
      reason: `${projectAName}.${entityA.name} 与 ${projectBName}.${entityB.name} 实现完全相同，保留 ${projectAName} 版本`,
      affectedEntities: [`${projectBName}.${entityB.name}`],
    }
  }

  // 2. 尝试 intra-entity 3-way merge
  const diff = diffEntityBodies(entityA.body, entityB.body)
  if (diff.canAutoMerge) {
    const merged = mergeNonOverlappingChanges(entityA, entityB, diff)
    return {
      mergedSource: merged,
      decision: 'merged',
      reason: `${projectAName}.${entityA.name} 与 ${projectBName}.${entityB.name} 改动不重叠，已自动合并函数体`,
      affectedEntities: [`${projectAName}.${entityA.name}`, `${projectBName}.${entityB.name}`],
    }
  }

  // 3. 改动重叠 → 降级为重命名
  const renameA = generateRename(entityA.name, projectAName, strategy)
  const renameB = generateRename(entityB.name, projectBName, strategy)
  return {
    mergedSource: '', // 重命名场景下不合并，由 mergeEngine 分别保留
    decision: 'renamed',
    reason: `${entityA.name} 在两项目中改动重叠，重命名为 ${renameA}（${projectAName}）和 ${renameB}（${projectBName}）`,
    affectedEntities: [`${projectAName}.${entityA.name}→${renameA}`, `${projectBName}.${entityB.name}→${renameB}`],
  }
}

/**
 * 合并不重叠的改动
 * 策略：以 A 为基底，把 B 独有的改动行追加/替换进来
 */
function mergeNonOverlappingChanges(
  entityA: CodeEntity,
  entityB: CodeEntity,
  diff: { changedLinesA: Set<number>; changedLinesB: Set<number> }
): string {
  const linesA = entityA.body.split('\n')
  const linesB = entityB.body.split('\n')
  const maxLen = Math.max(linesA.length, linesB.length)
  const result: string[] = []

  for (let i = 0; i < maxLen; i++) {
    const a = linesA[i]
    const b = linesB[i]
    const aChanged = diff.changedLinesA.has(i)
    const bChanged = diff.changedLinesB.has(i)

    if (a === undefined) {
      // A 没有这行，B 有 → 追加 B 的行
      result.push(b)
    } else if (b === undefined) {
      // B 没有这行，A 有 → 保留 A 的行
      result.push(a)
    } else if (aChanged && !bChanged) {
      // A 改了，B 没改 → 用 A
      result.push(a)
    } else if (bChanged && !aChanged) {
      // B 改了，A 没改 → 用 B
      result.push(b)
    } else if (!aChanged && !bChanged) {
      // 都没改 → 用 A（基底）
      result.push(a)
    } else {
      // 理论上不会到这里（canAutoMerge 已过滤重叠）
      result.push(a)
    }
  }

  return result.join('\n')
}

/** 生成重命名（与 mergeEngine 保持一致） */
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
  // aggressive: 加短哈希
  const hash = simpleHash(`${safe}::${name}`).slice(0, 4)
  return `${name}_${hash}`
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

/** 合并统计 - 写入融合报告 */
export interface MergeStats {
  merged: number
  deduplicated: number
  renamed: number
  details: EntityMergeResult[]
}

/** 创建空统计 */
export function emptyMergeStats(): MergeStats {
  return { merged: 0, deduplicated: 0, renamed: 0, details: [] }
}

/** 累加统计 */
export function recordMergeResult(stats: MergeStats, result: EntityMergeResult): void {
  if (result.decision === 'merged') stats.merged++
  else if (result.decision === 'deduplicated') stats.deduplicated++
  else if (result.decision === 'renamed') stats.renamed++
  stats.details.push(result)
}
