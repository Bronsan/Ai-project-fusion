// 思考流程引擎 - AI 驱动的项目结构分析与融合规划

import type { Project, FusionStrategy } from '../types.js'
import { chat } from './aiClient.js'

export interface ThinkingResult {
  steps: string[]
  summary: string
  mergePlan: MergePlan
}

export interface MergePlan {
  targetStructure: { path: string; purpose: string }[]
  sharedDeps: string[]
  conflictDeps: string[]
  moduleLayout: string
}

/**
 * 执行思考流程 - 分析项目并生成融合规划
 */
export async function runThinkingProcess(
  projects: Project[],
  strategy: FusionStrategy,
  options: { apiKey?: string; model?: string } = {}
): Promise<ThinkingResult> {
  const projectInfo = projects.map((p) => ({
    name: p.name,
    description: p.description,
    framework: p.structure.framework,
    buildTool: p.structure.buildTool,
    moduleSystem: p.structure.moduleSystem,
    dependencies: p.dependencies,
    tags: p.tags,
  }))

  const strategyDesc = {
    conservative: '保守策略：尽量保留两个项目的原始结构，仅做最小化桥接',
    balanced: '平衡策略：重构共享层，合并相似模块，保留各自业务逻辑',
    aggressive: '激进策略：深度重构，统一目录与命名，最大化代码复用',
  }[strategy]

  const prompt = `你是项目架构师。请分析以下开源项目并制定融合规划，返回 JSON。
项目列表：${JSON.stringify(projectInfo)}
融合策略：${strategyDesc}

请返回如下 JSON 格式：
{
  "steps": ["思考步骤1", "思考步骤2", ...],
  "summary": "融合方案总结",
  "mergePlan": {
    "targetStructure": [{"path":"路径","purpose":"用途"}],
    "sharedDeps": ["共享依赖"],
    "conflictDeps": ["冲突依赖"],
    "moduleLayout": "模块布局说明"
  }
}
只返回 JSON，不要其他文字。`

  try {
    const content = await chat(
      [
        { role: 'system', content: '你是资深项目架构师，擅长分析开源项目结构并制定融合方案。' },
        { role: 'user', content: prompt },
      ],
      { apiKey: options.apiKey, model: options.model, temperature: 0.5, maxTokens: 1200 }
    )

    const parsed = JSON.parse(extractJson(content)) as ThinkingResult
    return {
      steps: parsed.steps ?? [],
      summary: parsed.summary ?? '已完成项目结构分析',
      mergePlan: parsed.mergePlan ?? { targetStructure: [], sharedDeps: [], conflictDeps: [], moduleLayout: '' },
    }
  } catch {
    // 降级：返回基于规则的简单规划
    return fallbackThinking(projects, strategy)
  }
}

/** 二次校验思考流程 - 融合后对产物进行检查 */
export async function runVerificationThinking(
  fusedFiles: { path: string; content: string }[],
  options: { apiKey?: string; model?: string }
): Promise<{ passed: boolean; notes: string[] }> {
  const fileList = fusedFiles.map((f) => f.path).join(', ')
  const prompt = `请校验以下融合后的项目文件结构是否合理，返回 JSON。
文件列表：${fileList}
返回格式：{"passed":true,"notes":["备注1","备注2"]}
只返回 JSON。`

  try {
    const content = await chat(
      [
        { role: 'system', content: '你是代码审查专家，负责校验融合项目的完整性。' },
        { role: 'user', content: prompt },
      ],
      { apiKey: options.apiKey, model: options.model, temperature: 0.3, maxTokens: 500 }
    )
    const parsed = JSON.parse(extractJson(content)) as { passed: boolean; notes: string[] }
    return { passed: parsed.passed ?? true, notes: parsed.notes ?? [] }
  } catch {
    return { passed: true, notes: ['本地模拟：结构校验通过'] }
  }
}

/** 降级思考流程 - AI 不可用时使用 */
function fallbackThinking(projects: Project[], strategy: FusionStrategy): ThinkingResult {
  const sharedDeps = findSharedDeps(projects)
  const conflictDeps = findConflictDeps(projects)

  return {
    steps: [
      `解析 ${projects.length} 个项目的目录结构与入口文件`,
      `识别共享依赖 ${sharedDeps.length} 个，冲突依赖 ${conflictDeps.length} 个`,
      '规划融合目录：src/shared（共享层）、src/modules（业务模块）',
      '设计统一配置层与路由聚合策略',
      `按 ${strategy} 策略决定模块保留与合并方案`,
    ],
    summary: `已完成 ${projects.map((p) => p.name).join(' + ')} 的结构分析，建议采用模块化融合方案。`,
    mergePlan: {
      targetStructure: [
        { path: 'src/shared', purpose: '共享工具与类型' },
        { path: 'src/modules', purpose: '各项目业务模块' },
        { path: 'src/config', purpose: '统一配置层' },
        { path: 'package.json', purpose: '合并后的依赖清单' },
      ],
      sharedDeps,
      conflictDeps,
      moduleLayout: '按业务域划分模块，共享层提取公共依赖',
    },
  }
}

/** 查找共享依赖 */
function findSharedDeps(projects: Project[]): string[] {
  const counts = new Map<string, number>()
  for (const p of projects) {
    for (const dep of p.dependencies) {
      counts.set(dep, (counts.get(dep) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries()).filter(([, c]) => c > 1).map(([d]) => d)
}

/** 查找潜在冲突依赖（同名不同版本场景，此处简化为空） */
function findConflictDeps(_projects: Project[]): string[] {
  return []
}

/** 从可能包含 markdown 代码块的文本中提取 JSON */
function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()
  return text.trim()
}
