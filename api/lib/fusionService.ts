// 融合服务 - 编排思考流程、安全审查、评分、拼接的完整流程

import type {
  FusionTask,
  FusionReport,
  LogEntry,
  Project,
  ScoreDimension,
} from '../types.js'
import { runThinkingProcess, runVerificationThinking } from './thinkEngine.js'
import { runSecurityReview } from './securityEngine.js'
import { runMerge } from './mergeEngine.js'
import { calculatePreviewScore, SCORE_THRESHOLD } from './scoreEngine.js'
import { chat } from './aiClient.js'
import { saveTask } from './taskRepo.js'

/** 任务执行上下文 */
interface FusionContext {
  task: FusionTask
  projects: Project[]
  apiKey?: string
  model?: string
}

/**
 * 执行完整融合流程
 * 思考流程 → 安全审查 → 适配性评分 → （>75）拼接 → 二次校验 → 报告
 */
export async function executeFusion(ctx: FusionContext): Promise<void> {
  const { task, projects } = ctx

  try {
    // 阶段 1：思考流程分析
    updateStatus(task, 'thinking', 'AI 思考流程：分析项目结构')
    log(task, 'thinking', 'info', `开始分析 ${projects.map((p) => p.name).join('、')}`)
    await delay(800)

    const thinking = await runThinkingProcess(projects, task.strategy, {
      apiKey: ctx.apiKey,
      model: ctx.model,
    })
    for (const step of thinking.steps) {
      log(task, 'thinking', 'info', step)
      await delay(400)
    }
    log(task, 'thinking', 'success', thinking.summary)

    // 阶段 2：安全审查
    updateStatus(task, 'reviewing', '安全审查：扫描代码与依赖')
    log(task, 'reviewing', 'info', '启动安全审查引擎')
    await delay(600)

    const review = await runSecurityReview(projects, task.securityLevel, {
      apiKey: ctx.apiKey,
      model: ctx.model,
    })
    for (const issue of review.issues) {
      const levelIcon = { low: '⚠️', medium: '⚠️', high: '🔴', critical: '🚨' }[issue.level]
      log(task, 'reviewing', issue.level === 'low' ? 'info' : 'warn',
        `${levelIcon} [${issue.level}] ${issue.file}: ${issue.description}`)
    }
    log(task, 'reviewing', review.passed ? 'success' : 'error',
      review.passed ? '安全审查通过' : '安全审查未通过，存在阻断级风险')

    // 阶段 3：适配性正式评分
    updateStatus(task, 'scoring', '适配性评分：计算融合可行性')
    await delay(500)

    const dimensions = await aiScoreDimensions(projects, task.strategy, ctx)
    const totalScore = Math.round(
      dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length
    )
    task.score = totalScore
    log(task, 'scoring', totalScore > SCORE_THRESHOLD ? 'success' : 'warn',
      `适配性评分：${totalScore} 分（阈值 ${SCORE_THRESHOLD}）`)

    // 阶段 4：判断是否进入拼接
    if (totalScore <= SCORE_THRESHOLD) {
      log(task, 'scoring', 'error', `评分未超过 ${SCORE_THRESHOLD}，终止拼接流程`)
      task.report = buildReport(task, thinking, dimensions, review.issues, [], false)
      task.status = 'failed'
      task.currentStep = '评分未达标，流程终止'
      return
    }

    // 阶段 5：代码拼接
    updateStatus(task, 'merging', '代码拼接：生成融合项目文件')
    log(task, 'merging', 'info', '开始生成融合产物')
    await delay(700)

    const files = await runMerge(projects, thinking.mergePlan, task.strategy, {
      apiKey: ctx.apiKey,
      model: ctx.model,
    })
    const flatFiles = flattenFiles(files)
    log(task, 'merging', 'success', `已生成 ${flatFiles.length} 个文件`)

    // 阶段 6：二次校验
    updateStatus(task, 'verifying', '二次校验：运行思考流程检查融合产物')
    await delay(500)

    const verify = await runVerificationThinking(flatFiles, {
      apiKey: ctx.apiKey,
      model: ctx.model,
    })
    for (const note of verify.notes) {
      log(task, 'verifying', 'info', note)
    }
    log(task, 'verifying', verify.passed ? 'success' : 'warn',
      verify.passed ? '二次校验通过' : '二次校验发现注意事项')

    // 阶段 7：生成报告
    task.report = buildReport(task, thinking, dimensions, review.issues, files, true)
    task.status = 'done'
    task.currentStep = '融合完成'
    log(task, 'verifying', 'success', '融合任务完成，可下载产物')
  } catch (err: any) {
    task.status = 'failed'
    task.currentStep = '流程异常'
    log(task, task.status, 'error', `执行失败：${err?.message ?? '未知错误'}`)
  }
}

/** AI 深度评分 - 调用大模型生成维度评分 */
async function aiScoreDimensions(
  projects: Project[],
  strategy: string,
  ctx: FusionContext
): Promise<ScoreDimension[]> {
  // 先用规则评分作为基础
  const base = calculatePreviewScore(projects).dimensions

  const prompt = `你是项目评估专家。请对以下项目融合的适配性进行深度评分，返回 JSON。
项目：${JSON.stringify(projects.map((p) => ({ name: p.name, framework: p.structure.framework, deps: p.dependencies })))}
策略：${strategy}
基础评分参考：${JSON.stringify(base)}

返回格式：{"dimensions":[{"name":"维度名","score":0-100,"comment":"说明"}]}
维度包括：架构兼容性、依赖冲突、许可证兼容、代码风格、文档完整度
只返回 JSON。`

  try {
    const content = await chat(
      [
        { role: 'system', content: '你是项目评估专家，擅长评估开源项目的融合可行性。' },
        { role: 'user', content: prompt },
      ],
      { apiKey: ctx.apiKey, model: ctx.model, temperature: 0.3, maxTokens: 600 }
    )
    const parsed = JSON.parse(extractJson(content)) as { dimensions: ScoreDimension[] }
    return parsed.dimensions ?? base
  } catch {
    return base
  }
}

/** 更新任务状态 */
function updateStatus(task: FusionTask, status: FusionTask['status'], step: string) {
  task.status = status
  task.currentStep = step
  task.updatedAt = new Date().toISOString()
  // 持久化到文件，保证服务重启后状态不丢失
  saveTask(task).catch(() => {})
}

/** 追加日志 */
function log(task: FusionTask, step: string, level: LogEntry['level'], message: string) {
  task.logs.push({
    time: new Date().toISOString(),
    step,
    level,
    message,
  })
  // 日志变更也持久化
  saveTask(task).catch(() => {})
}

/** 构建融合报告 */
function buildReport(
  task: FusionTask,
  thinking: { steps: string[]; summary: string },
  dimensions: ScoreDimension[],
  issues: any[],
  files: any[],
  passed: boolean
): FusionReport {
  return {
    taskId: task.id,
    totalScore: task.score ?? 0,
    summary: thinking.summary,
    thinkingSteps: thinking.steps,
    dimensions,
    issues,
    files,
    passed,
  }
}

/** 扁平化文件树 */
function flattenFiles(nodes: any[]): { path: string; content: string }[] {
  const result: { path: string; content: string }[] = []
  for (const n of nodes) {
    if (n.type === 'file' && n.content) {
      result.push({ path: n.path, content: n.content })
    }
    if (n.children) result.push(...flattenFiles(n.children))
  }
  return result
}

/** 延迟工具 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 从可能包含 markdown 代码块的文本中提取 JSON */
function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()
  return text.trim()
}
