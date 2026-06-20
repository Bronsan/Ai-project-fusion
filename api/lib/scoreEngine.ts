// 评分引擎 - 计算项目适配性评分

import type { Project, ScoreDimension, PreviewScore } from '../types.js'

/** 评分维度权重 */
const DIMENSION_WEIGHTS: Record<string, number> = {
  '架构兼容性': 0.25,
  '依赖冲突': 0.2,
  '许可证兼容': 0.2,
  '代码风格': 0.2,
  '文档完整度': 0.15,
}

/**
 * 计算预评分 - 选择项目后即时调用
 * 基于项目元数据快速估算适配性
 */
export function calculatePreviewScore(projects: Project[]): PreviewScore {
  if (projects.length < 2) {
    return {
      totalScore: 0,
      dimensions: [],
      feasible: false,
    }
  }

  const dimensions: ScoreDimension[] = [
    scoreArchitecture(projects),
    scoreDependencies(projects),
    scoreLicense(projects),
    scoreCodeStyle(projects),
    scoreDocs(projects),
  ]

  const totalScore = Math.round(
    dimensions.reduce((sum, d) => sum + d.score * (DIMENSION_WEIGHTS[d.name] ?? 0.2), 0)
  )

  return {
    totalScore,
    dimensions,
    feasible: totalScore >= 60, // 预评分 60 即可尝试
  }
}

/** 架构兼容性评分 */
function scoreArchitecture(projects: Project[]): ScoreDimension {
  const frameworks = new Set(projects.map((p) => p.structure.framework))
  const buildTools = new Set(projects.map((p) => p.structure.buildTool))
  const moduleSystems = new Set(projects.map((p) => p.structure.moduleSystem))

  let score = 100
  // 框架差异扣分
  if (frameworks.size > 1 && !frameworks.has('agnostic')) score -= 20
  if (frameworks.has('vanilla') && frameworks.has('react')) score -= 15
  // 构建工具差异
  if (buildTools.size > 1) score -= 10
  // 模块系统不兼容（CJS vs ESM）
  if (moduleSystems.has('cjs') && moduleSystems.has('esm')) score -= 25

  score = Math.max(40, Math.min(100, score))
  return {
    name: '架构兼容性',
    score,
    comment: `框架: ${Array.from(frameworks).join('/')}, 构建: ${Array.from(buildTools).join('/')}`,
  }
}

/** 依赖冲突评分 */
function scoreDependencies(projects: Project[]): ScoreDimension {
  const allDeps = projects.flatMap((p) => p.dependencies)
  const depSet = new Set(allDeps)
  const overlap = allDeps.length - depSet.size
  // 共享依赖越多越好，冲突越少越好
  const score = Math.min(100, 60 + overlap * 8)
  return {
    name: '依赖冲突',
    score,
    comment: `共享依赖 ${overlap} 个，去重后 ${depSet.size} 个`,
  }
}

/** 许可证兼容性评分 */
function scoreLicense(projects: Project[]): ScoreDimension {
  const licenses = projects.map((p) => p.license)
  const permissive = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC']
  const allPermissive = licenses.every((l) => permissive.includes(l))
  const allSame = licenses.every((l) => l === licenses[0])

  let score = 100
  if (!allPermissive) score -= 30
  if (!allSame && allPermissive) score -= 5 // MIT + Apache 兼容但需注意

  return {
    name: '许可证兼容',
    score,
    comment: `许可证: ${Array.from(new Set(licenses)).join(' / ')}`,
  }
}

/** 代码风格评分 */
function scoreCodeStyle(projects: Project[]): ScoreDimension {
  const languages = new Set(projects.map((p) => p.language))
  const tsCount = projects.filter((p) => p.language === 'TypeScript').length

  let score = 70
  if (languages.size === 1) score += 20
  if (tsCount === projects.length) score += 10

  return {
    name: '代码风格',
    score: Math.min(100, score),
    comment: `语言: ${Array.from(languages).join('/')}, TS 占比 ${Math.round((tsCount / projects.length) * 100)}%`,
  }
}

/** 文档完整度评分 */
function scoreDocs(projects: Project[]): ScoreDimension {
  const withReadme = projects.filter((p) => p.readme && p.readme.length > 50).length
  const score = Math.round((withReadme / projects.length) * 100)
  return {
    name: '文档完整度',
    score,
    comment: `${withReadme}/${projects.length} 项目有完整 README`,
  }
}

/** 评分阈值 - 高于此值才允许进入拼接阶段 */
export const SCORE_THRESHOLD = 75
