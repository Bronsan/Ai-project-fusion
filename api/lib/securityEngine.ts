// 安全审查引擎 - 检查代码与依赖安全问题

import type { Project, SecurityIssue } from '../types.js'
import { chat } from './aiClient.js'

/**
 * 执行安全审查
 * 结合规则扫描与 AI 分析
 */
export async function runSecurityReview(
  projects: Project[],
  securityLevel: number,
  options: { apiKey?: string; model?: string; baseUrl?: string } = {}
): Promise<{ issues: SecurityIssue[]; passed: boolean }> {
  // 1. 规则扫描：基于项目元数据快速识别常见问题
  const ruleIssues = scanByRules(projects)

  // 2. AI 深度审查
  const aiIssues = await aiSecurityScan(projects, securityLevel, options)

  const allIssues = [...ruleIssues, ...aiIssues]

  // 根据安全级别决定是否通过
  const levelThresholds: Record<number, 'critical' | 'high' | 'medium' | 'low'> = {
    1: 'critical',
    2: 'critical',
    3: 'high',
    4: 'medium',
    5: 'low',
  }
  const blockLevel = levelThresholds[securityLevel] ?? 'high'
  const levelOrder = ['low', 'medium', 'high', 'critical']
  const passed = !allIssues.some((i) => levelOrder.indexOf(i.level) >= levelOrder.indexOf(blockLevel))

  return { issues: allIssues, passed }
}

/** 规则扫描 - 基于元数据的快速检查 */
function scanByRules(projects: Project[]): SecurityIssue[] {
  const issues: SecurityIssue[] = []

  for (const p of projects) {
    // 检查许可证
    if (!p.license || p.license === 'UNLICENSED') {
      issues.push({
        level: 'high',
        file: 'package.json',
        description: `${p.name} 缺少明确的开源许可证`,
        suggestion: '添加 MIT/Apache-2.0 等许可证',
      })
    }
    // 检查 CJS 模块系统
    if (p.structure.moduleSystem === 'cjs') {
      issues.push({
        level: 'medium',
        file: 'package.json',
        description: `${p.name} 使用 CommonJS，与 ESM 项目融合可能存在兼容问题`,
        suggestion: '迁移到 ESM 或使用动态 import 桥接',
      })
    }
    // 检查依赖数量过少（可能不完整）
    if (p.dependencies.length === 0 && p.language === 'TypeScript') {
      issues.push({
        level: 'low',
        file: 'package.json',
        description: `${p.name} 无显式依赖，可能为工具库`,
        suggestion: '确认是否需要补充 peerDependencies',
      })
    }
  }

  return issues
}

/** AI 安全扫描 - 调用大模型分析潜在风险 */
async function aiSecurityScan(
  projects: Project[],
  securityLevel: number,
  options: { apiKey?: string; model?: string; baseUrl?: string }
): Promise<SecurityIssue[]> {
  const projectInfo = projects.map((p) => ({
    name: p.name,
    language: p.language,
    dependencies: p.dependencies,
    moduleSystem: p.structure.moduleSystem,
  }))

  const prompt = `你是安全审查专家。请分析以下开源项目融合时的潜在安全风险，返回 JSON。
项目列表：${JSON.stringify(projectInfo)}
安全审查级别（1-5，越高越严格）：${securityLevel}

返回格式：{"issues":[{"level":"low|medium|high|critical","file":"文件路径","description":"问题描述","suggestion":"修复建议"}]}
只返回 JSON，不要其他文字。`

  try {
    const content = await chat(
      [
        { role: 'system', content: '你是代码安全审查专家，擅长识别依赖漏洞、许可证冲突与代码注入风险。' },
        { role: 'user', content: prompt },
      ],
      { apiKey: options.apiKey, model: options.model, baseUrl: options.baseUrl, temperature: 0.3, maxTokens: 800 }
    )

    const parsed = JSON.parse(extractJson(content)) as { issues: SecurityIssue[] }
    return parsed.issues ?? []
  } catch {
    // AI 不可用时返回空，不阻断流程
    return []
  }
}

/** 从可能包含 markdown 代码块的文本中提取 JSON */
function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()
  return text.trim()
}
