// 评分引擎 - 基于真实代码内容 + 评分规则文件计算适配性评分
// v0.12beta: 不再写死分数，AI 读取代码后按 scoring-rules.json 规则打分

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Project, ScoreDimension, PreviewScore } from '../types.js'
import { chat } from './aiClient.js'

// 加载评分规则文件
const __dirname = dirname(fileURLToPath(import.meta.url))
const rulesPath = join(__dirname, '..', 'scoring-rules.json')
const scoringRules = JSON.parse(readFileSync(rulesPath, 'utf-8')) as ScoringRules

/** 评分规则定义 */
interface ScoringRules {
  threshold: number
  dimensions: RuleDimension[]
}

interface RuleDimension {
  id: string
  name: string
  weight: number
  rules: { id: string; name: string; condition: string; score: number; penalty: number }[]
  scoringMethod: string
}

/** 代码分析结果 */
interface CodeAnalysis {
  fileCount: number
  totalLines: number
  exports: string[]
  imports: string[]
  hasTypeScript: boolean
  hasTests: boolean
  avgFileLength: number
  maxFileLength: number
  exportCount: number
  complexityScore: number
}

/**
 * 计算预评分 - 选择项目后即时调用
 * 基于真实代码内容 + 评分规则计算
 */
export function calculatePreviewScore(projects: Project[]): PreviewScore {
  if (projects.length < 2) {
    return { totalScore: 0, dimensions: [], feasible: false }
  }

  // 预先分析每个项目的真实代码
  const analyses = projects.map(analyzeCode)

  const dimensions: ScoreDimension[] = [
    scoreArchitecture(projects, analyses),
    scoreDependencies(projects, analyses),
    scoreLicense(projects),
    scoreCodeStyle(projects, analyses),
    scoreDocs(projects, analyses),
  ]

  const totalScore = Math.round(
    dimensions.reduce((sum, d) => {
      const rule = scoringRules.dimensions.find((r) => r.name === d.name)
      const weight = rule?.weight ?? 0.2
      return sum + d.score * weight
    }, 0)
  )

  return {
    totalScore,
    dimensions,
    feasible: totalScore >= scoringRules.threshold,
  }
}

/**
 * AI 深度评分 - 调用大模型，传入真实代码摘要 + 评分规则
 * AI 必须按规则打分，不能返回固定值
 */
export async function aiDeepScore(
  projects: Project[],
  strategy: string,
  options: { apiKey?: string; model?: string }
): Promise<ScoreDimension[]> {
  const analyses = projects.map(analyzeCode)

  // 构建真实代码摘要
  const codeSummaries = projects.map((p, i) => {
    const a = analyses[i]
    return {
      name: p.name,
      language: p.language,
      framework: p.structure.framework,
      buildTool: p.structure.buildTool,
      moduleSystem: p.structure.moduleSystem,
      license: p.license,
      dependencies: p.dependencies,
      fileCount: a.fileCount,
      totalLines: a.totalLines,
      exportCount: a.exportCount,
      exports: a.exports.slice(0, 15),
      imports: a.imports.slice(0, 20),
      hasTypeScript: a.hasTypeScript,
      hasTests: a.hasTests,
      avgFileLength: a.avgFileLength,
      maxFileLength: a.maxFileLength,
      readmeLength: p.readme?.length ?? 0,
    }
  })

  // 提取规则摘要给 AI
  const rulesSummary = scoringRules.dimensions.map((d) => ({
    dimension: d.name,
    weight: d.weight,
    rules: d.rules.map((r) => ({ name: r.name, condition: r.condition, score: r.score })),
  }))

  const prompt = `你是项目评估专家。请基于以下真实代码分析数据和评分规则，对项目融合的适配性进行评分。

## 评分规则
${JSON.stringify(rulesSummary, null, 2)}

## 真实代码分析数据
${JSON.stringify(codeSummaries, null, 2)}

## 融合策略
${strategy}

## 评分要求
1. 必须根据真实数据匹配规则，不能返回固定分数
2. 每个维度的分数必须反映实际代码差异
3. comment 必须引用具体数据（如文件数、行数、导出数等）
4. 如果项目差异大，分数应该低；如果高度相似，分数应该高

## 返回格式
{"dimensions":[{"name":"维度名","score":0-100,"comment":"引用具体数据的说明"}]}

维度包括：架构兼容性、依赖冲突、许可证兼容、代码风格、文档完整度
只返回 JSON。`

  try {
    const content = await chat(
      [
        { role: 'system', content: '你是项目评估专家，必须基于真实代码数据按规则评分，严禁返回固定分数。' },
        { role: 'user', content: prompt },
      ],
      { apiKey: options.apiKey, model: options.model, temperature: 0.2, maxTokens: 800 }
    )
    const parsed = JSON.parse(extractJson(content)) as { dimensions: ScoreDimension[] }
    if (parsed.dimensions && parsed.dimensions.length === 5) {
      return parsed.dimensions
    }
    // AI 返回不完整时，用规则评分补充
    return calculatePreviewScore(projects).dimensions
  } catch {
    // AI 不可用时用规则评分
    return calculatePreviewScore(projects).dimensions
  }
}

// ========== 代码分析 ==========

/** 分析项目真实代码内容 */
function analyzeCode(p: Project): CodeAnalysis {
  const analysis: CodeAnalysis = {
    fileCount: 0, totalLines: 0, exports: [], imports: [],
    hasTypeScript: false, hasTests: false, avgFileLength: 0,
    maxFileLength: 0, exportCount: 0, complexityScore: 70,
  }

  const exportRe = /export\s+(?:default\s+)?(?:function|const|let|var|class|interface|type|enum)\s+(\w+)/g
  const exportBraceRe = /export\s*\{([^}]+)\}/g
  const importRe = /(?:import|require)\s*(?:\w+\s+from\s+)?['"]([^'"]+)['"]/g

  const exportSet = new Set<string>()
  const importSet = new Set<string>()

  for (const f of p.files ?? []) {
    if (!isSourceFile(f.path)) continue
    analysis.fileCount++

    const lines = f.content.split('\n')
    const lineCount = lines.length
    analysis.totalLines += lineCount
    if (lineCount > analysis.maxFileLength) analysis.maxFileLength = lineCount

    if (f.path.endsWith('.ts') || f.path.endsWith('.tsx')) analysis.hasTypeScript = true
    if (f.path.includes('.test.') || f.path.includes('.spec.') || f.path.includes('/test/') || f.path.includes('/tests/')) {
      analysis.hasTests = true
    }

    let m: RegExpExecArray | null
    while ((m = exportRe.exec(f.content)) !== null) exportSet.add(m[1])
    while ((m = exportBraceRe.exec(f.content)) !== null) {
      for (const name of m[1].split(',')) {
        const clean = name.trim().split(' as ')[0].trim()
        if (clean) exportSet.add(clean)
      }
    }
    while ((m = importRe.exec(f.content)) !== null) {
      if (!m[1].startsWith('.') && !m[1].startsWith('/')) {
        let pkg = m[1]
        if (pkg.startsWith('@')) {
          const parts = pkg.split('/')
          pkg = parts.slice(0, 2).join('/')
        } else {
          pkg = pkg.split('/')[0]
        }
        importSet.add(pkg)
      }
    }
  }

  analysis.exports = Array.from(exportSet)
  analysis.imports = Array.from(importSet)
  analysis.exportCount = exportSet.size

  if (analysis.fileCount > 0) analysis.avgFileLength = Math.round(analysis.totalLines / analysis.fileCount)

  // 复杂度评分
  let complexity = 100
  if (analysis.avgFileLength > 300) complexity -= 30
  else if (analysis.avgFileLength > 200) complexity -= 15
  else if (analysis.avgFileLength > 100) complexity -= 5
  if (analysis.maxFileLength > 500) complexity -= 20
  if (analysis.exportCount === 0 && analysis.fileCount > 0) complexity -= 20
  analysis.complexityScore = Math.max(20, Math.min(100, complexity))

  return analysis
}

function isSourceFile(p: string): boolean {
  const lower = p.toLowerCase()
  return ['.ts', '.tsx', '.js', '.jsx', '.vue', '.py', '.go', '.rs', '.java'].some((ext) => lower.endsWith(ext))
}

// ========== 维度评分（基于规则） ==========

function scoreArchitecture(projects: Project[], analyses: CodeAnalysis[]): ScoreDimension {
  const frameworks = new Set(projects.map((p) => p.structure.framework))
  const buildTools = new Set(projects.map((p) => p.structure.buildTool))
  const moduleSystems = new Set(projects.map((p) => p.structure.moduleSystem))

  const matchedRules: number[] = []

  // 框架规则
  if (frameworks.size === 1) matchedRules.push(100)
  else if (frameworks.has('agnostic')) matchedRules.push(90)
  else if (frameworks.has('vanilla') && frameworks.size > 1) matchedRules.push(60)
  else matchedRules.push(50)

  // 构建工具规则
  if (buildTools.size === 1) matchedRules.push(95)
  else matchedRules.push(65)

  // 模块系统规则
  if (moduleSystems.size === 1 && moduleSystems.has('esm')) matchedRules.push(100)
  else if (moduleSystems.has('cjs') && moduleSystems.has('esm')) matchedRules.push(40)
  else matchedRules.push(75)

  // import 重叠度
  const importSets = analyses.map((a) => new Set(a.imports))
  let overlap = 0
  let total = 0
  if (importSets.length >= 2) {
    for (const imp of importSets[0]) {
      total++
      if (importSets.slice(1).every((s) => s.has(imp))) overlap++
    }
  }
  const overlapRatio = total > 0 ? overlap / total : 0
  if (overlapRatio > 0.5) matchedRules.push(95)
  else if (overlapRatio < 0.2 && total > 0) matchedRules.push(60)
  else if (total > 0) matchedRules.push(75)

  const score = Math.round(matchedRules.reduce((s, v) => s + v, 0) / matchedRules.length)

  const fwList = Array.from(frameworks).join('/')
  const btList = Array.from(buildTools).join('/')
  const comment = `框架: ${fwList}, 构建: ${btList}, import 重叠: ${overlap}/${total} (${Math.round(overlapRatio * 100)}%)`

  return { name: '架构兼容性', score: Math.max(40, Math.min(100, score)), comment }
}

function scoreDependencies(projects: Project[], analyses: CodeAnalysis[]): ScoreDimension {
  const allDeps = projects.flatMap((p) => p.dependencies)
  const depSet = new Set(allDeps)
  const overlap = allDeps.length - depSet.size

  // 真实代码 import 重叠
  const importSets = analyses.map((a) => new Set(a.imports))
  let realOverlap = 0
  const allImports = new Set<string>()
  for (const a of analyses) a.imports.forEach((i) => allImports.add(i))
  if (importSets.length >= 2) {
    for (const imp of importSets[0]) {
      if (importSets.slice(1).every((s) => s.has(imp))) realOverlap++
    }
  }

  const matchedRules: number[] = []
  if (overlap >= 5) matchedRules.push(95)
  else if (overlap >= 2) matchedRules.push(80)
  else if (overlap === 1) matchedRules.push(65)
  else matchedRules.push(50)

  if (realOverlap > 0) matchedRules.push(85)

  const score = matchedRules.length > 0
    ? Math.round(matchedRules.reduce((s, v) => s + v, 0) / matchedRules.length)
    : 50

  const comment = `共享依赖 ${overlap} 个（代码层 ${realOverlap}），去重后 ${depSet.size} 个`

  return { name: '依赖冲突', score: Math.max(30, Math.min(100, score)), comment }
}

function scoreLicense(projects: Project[]): ScoreDimension {
  const licenses = projects.map((p) => p.license)
  const permissive = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC']
  const allPermissive = licenses.every((l) => permissive.includes(l))
  const allSame = licenses.every((l) => l === licenses[0])
  const hasGpl = licenses.some((l) => l.includes('GPL') || l.includes('AGPL') || l.includes('LGPL'))
  const hasUnlicensed = licenses.some((l) => !l || l === 'UNLICENSED')

  let score = 70
  if (allSame && allPermissive) score = 100
  else if (allPermissive) score = 90
  else if (hasGpl) score = 30
  else if (hasUnlicensed) score = 20
  else score = 50

  const uniqueLic = Array.from(new Set(licenses))
  return { name: '许可证兼容', score, comment: `许可证: ${uniqueLic.join(' / ')}` }
}

function scoreCodeStyle(projects: Project[], analyses: CodeAnalysis[]): ScoreDimension {
  const languages = new Set(projects.map((p) => p.language))
  const tsCount = projects.filter((p) => p.language === 'TypeScript').length

  const matchedRules: number[] = []

  // 语言规则
  if (languages.size === 1 && tsCount === projects.length) matchedRules.push(100)
  else if (languages.size === 1) matchedRules.push(75)
  else matchedRules.push(55)

  // 复杂度规则
  const avgComplexity = analyses.filter((a) => a.fileCount > 0).reduce((s, a) => s + a.complexityScore, 0) /
    (analyses.filter((a) => a.fileCount > 0).length || 1)
  if (avgComplexity > 80) matchedRules.push(95)
  else if (avgComplexity < 50) matchedRules.push(50)
  else matchedRules.push(75)

  // 测试规则
  const allHaveTests = analyses.every((a) => a.hasTests)
  if (allHaveTests) matchedRules.push(90)

  // 导出规则
  const noExports = analyses.some((a) => a.fileCount > 0 && a.exportCount === 0)
  if (noExports) matchedRules.push(40)

  const score = matchedRules.length > 0
    ? Math.round(matchedRules.reduce((s, v) => s + v, 0) / matchedRules.length)
    : 70

  const langList = Array.from(languages).join('/')
  const tsPct = Math.round((tsCount / projects.length) * 100)
  const comment = `语言: ${langList}, TS ${tsPct}%, 复杂度 ${Math.round(avgComplexity)}, 测试: ${allHaveTests ? '全有' : '部分缺失'}`

  return { name: '代码风格', score: Math.max(30, Math.min(100, score)), comment }
}

function scoreDocs(projects: Project[], analyses: CodeAnalysis[]): ScoreDimension {
  const matchedRules: number[] = []

  // README 规则
  const allFullReadme = projects.every((p) => (p.readme?.length ?? 0) > 500)
  const allHaveReadme = projects.every((p) => (p.readme?.length ?? 0) > 50)
  if (allFullReadme) matchedRules.push(100)
  else if (allHaveReadme) matchedRules.push(70)
  else matchedRules.push(30)

  // 结构规则
  const allComplete = analyses.every((a) => a.fileCount > 3)
  if (allComplete) matchedRules.push(85)
  else matchedRules.push(60)

  const score = matchedRules.length > 0
    ? Math.round(matchedRules.reduce((s, v) => s + v, 0) / matchedRules.length)
    : 50

  const withReadme = projects.filter((p) => (p.readme?.length ?? 0) > 50).length
  const comment = `${withReadme}/${projects.length} 有 README, 文件数: ${analyses.map((a) => a.fileCount).join('/')}`

  return { name: '文档完整度', score: Math.max(20, Math.min(100, score)), comment }
}

// ========== 工具函数 ==========

function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()
  return text.trim()
}

/** 评分阈值 */
export const SCORE_THRESHOLD = scoringRules.threshold
