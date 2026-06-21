// 融合服务 - v0.12beta 加入取消功能
// 编排思考流程、安全审查、评分、拼接的完整流程
// 支持通过 AbortSignal 取消正在执行的融合任务

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
import { scanFusionProduct } from './productSecurityScanner.js'
import { aiDeepScore, SCORE_THRESHOLD } from './scoreEngine.js'
import { saveTask } from './taskRepo.js'

/** 任务执行上下文 */
interface FusionContext {
  task: FusionTask
  projects: Project[]
  apiKey?: string
  model?: string
  /** 取消信号 */
  signal?: AbortSignal
}

/** 全局任务取消控制器注册表 - 用于外部取消 */
const taskControllers = new Map<string, AbortController>()

/** 注册任务控制器 */
export function registerTaskController(taskId: string, controller: AbortController): void {
  taskControllers.set(taskId, controller)
}

/** 注销任务控制器 */
export function unregisterTaskController(taskId: string): void {
  taskControllers.delete(taskId)
}

/** 取消任务 - 返回是否成功发送取消信号 */
export function cancelFusionTask(taskId: string): boolean {
  const controller = taskControllers.get(taskId)
  if (!controller) return false
  controller.abort()
  taskControllers.delete(taskId)
  return true
}

/** 检查任务是否已取消 */
function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('任务已被用户取消')
  }
}

/** 可取消的延迟 */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('任务已被用户取消'))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new Error('任务已被用户取消'))
    }, { once: true })
  })
}

/**
 * 执行完整融合流程
 * 思考流程 → 安全审查 → 适配性评分 → （>75）拼接 → 二次校验 → 报告
 * 全程支持取消
 */
export async function executeFusion(ctx: FusionContext): Promise<void> {
  const { task, projects, signal } = ctx

  // 创建并注册控制器（如果外部未提供 signal）
  let controller: AbortController | undefined
  let effectiveSignal = signal
  if (!effectiveSignal) {
    controller = new AbortController()
    effectiveSignal = controller.signal
    registerTaskController(task.id, controller)
  }

  try {
    // 阶段 1：思考流程分析
    throwIfCancelled(effectiveSignal)
    updateStatus(task, 'thinking', 'AI 思考流程：分析项目结构')
    log(task, 'thinking', 'info', `开始分析 ${projects.map((p) => p.name).join('、')}`)
    await delay(800, effectiveSignal)

    const thinking = await runThinkingProcess(projects, task.strategy, {
      apiKey: ctx.apiKey,
      model: ctx.model,
    })
    throwIfCancelled(effectiveSignal)
    for (const step of thinking.steps) {
      log(task, 'thinking', 'info', step)
      await delay(400, effectiveSignal)
    }
    log(task, 'thinking', 'success', thinking.summary)

    // 阶段 2：安全审查
    throwIfCancelled(effectiveSignal)
    updateStatus(task, 'reviewing', '安全审查：扫描代码与依赖')
    log(task, 'reviewing', 'info', '启动安全审查引擎')
    await delay(600, effectiveSignal)

    const review = await runSecurityReview(projects, task.securityLevel, {
      apiKey: ctx.apiKey,
      model: ctx.model,
    })
    throwIfCancelled(effectiveSignal)
    for (const issue of review.issues) {
      const levelIcon = { low: '⚠️', medium: '⚠️', high: '🔴', critical: '🚨' }[issue.level]
      log(task, 'reviewing', issue.level === 'low' ? 'info' : 'warn',
        `${levelIcon} [${issue.level}] ${issue.file}: ${issue.description}`)
    }
    log(task, 'reviewing', review.passed ? 'success' : 'error',
      review.passed ? '安全审查通过' : '安全审查未通过，存在阻断级风险')

    // 阶段 3：适配性正式评分
    throwIfCancelled(effectiveSignal)
    updateStatus(task, 'scoring', '适配性评分：AI 分析代码并按规则打分')
    await delay(500, effectiveSignal)

    const dimensions = await aiDeepScore(projects, task.strategy, ctx)
    throwIfCancelled(effectiveSignal)
    const totalScore = Math.round(
      dimensions.reduce((sum, d) => {
        const weight = { '架构兼容性': 0.25, '依赖冲突': 0.2, '许可证兼容': 0.2, '代码风格': 0.2, '文档完整度': 0.15 }[d.name] ?? 0.2
        return sum + d.score * weight
      }, 0)
    )
    task.score = totalScore
    log(task, 'scoring', totalScore > SCORE_THRESHOLD ? 'success' : 'warn',
      `适配性评分：${totalScore} 分（阈值 ${SCORE_THRESHOLD}）`)

    // 阶段 4：判断是否进入拼接
    throwIfCancelled(effectiveSignal)
    if (totalScore <= SCORE_THRESHOLD) {
      log(task, 'scoring', 'error', `评分未超过 ${SCORE_THRESHOLD}，终止拼接流程`)
      task.report = buildReport(task, thinking, dimensions, review.issues, [], false)
      task.status = 'failed'
      task.currentStep = '评分未达标，流程终止'
      return
    }
    // 阶段 5：代码拼接
    throwIfCancelled(effectiveSignal)
    updateStatus(task, 'merging', '代码拼接：生成融合项目文件')
    log(task, 'merging', 'info', '开始生成融合产物')
    await delay(700, effectiveSignal)

    const files = await runMerge(projects, thinking.mergePlan, task.strategy, {
      apiKey: ctx.apiKey,
      model: ctx.model,
      signal: effectiveSignal,
    })
    throwIfCancelled(effectiveSignal)
    const flatFiles = flattenFiles(files)
    log(task, 'merging', 'success', `已生成 ${flatFiles.length} 个文件`)

    // 阶段 6：融合产物安全扫描（v0.13 新增）
    throwIfCancelled(effectiveSignal)
    updateStatus(task, 'verifying', '产物安全扫描：检查融合后代码的安全问题')
    log(task, 'verifying', 'info', '启动产物安全扫描引擎')
    await delay(300, effectiveSignal)

    const productScan = scanFusionProduct(files)
    throwIfCancelled(effectiveSignal)
    log(task, 'verifying', 'info', `扫描 ${productScan.scannedFiles} 个文件，发现 ${productScan.issues.length} 个安全问题`)
    for (const issue of productScan.issues) {
      const levelIcon = { low: '⚠️', medium: '⚠️', high: '🔴', critical: '🚨' }[issue.level]
      log(task, 'verifying', issue.level === 'low' ? 'info' : 'warn',
        `${levelIcon} [${issue.level}] ${issue.file}: ${issue.description}`)
    }
    if (productScan.passed) {
      log(task, 'verifying', 'success', '产物安全扫描通过，无 critical/high 级别问题')
    } else {
      log(task, 'verifying', 'warn', '产物安全扫描发现 critical/high 问题，建议修复后再使用')
    }

    // 阶段 7：二次校验
    throwIfCancelled(effectiveSignal)
    updateStatus(task, 'verifying', '二次校验：运行思考流程检查融合产物')
    await delay(500, effectiveSignal)

    const verify = await runVerificationThinking(flatFiles, {
      apiKey: ctx.apiKey,
      model: ctx.model,
    })
    throwIfCancelled(effectiveSignal)
    for (const note of verify.notes) {
      log(task, 'verifying', 'info', note)
    }
    log(task, 'verifying', verify.passed ? 'success' : 'warn',
      verify.passed ? '二次校验通过' : '二次校验发现注意事项')

    // 阶段 7：生成报告
    throwIfCancelled(effectiveSignal)
    task.report = buildReport(task, thinking, dimensions, review.issues, files, true, productScan.issues)
    task.status = 'done'
    task.currentStep = '融合完成'
    log(task, 'verifying', 'success', '融合任务完成，可下载产物')
  } catch (err: any) {
    // 用户取消 - 标记为 cancelled 状态
    if (err?.message?.includes('取消') || effectiveSignal?.aborted) {
      task.status = 'failed'
      task.currentStep = '任务已取消'
      log(task, 'failed', 'warn', '用户已取消融合任务')
    } else {
      task.status = 'failed'
      task.currentStep = '流程异常'
      log(task, task.status, 'error', `执行失败：${err?.message ?? '未知错误'}`)
    }
  } finally {
    // 注销控制器
    if (controller) {
      unregisterTaskController(task.id)
    }
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
  passed: boolean,
  productScanIssues: any[] = []
): FusionReport {
  return {
    taskId: task.id,
    totalScore: task.score ?? 0,
    summary: thinking.summary,
    thinkingSteps: thinking.steps,
    dimensions,
    issues,
    productScanIssues,
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
