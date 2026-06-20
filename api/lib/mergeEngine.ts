// 拼接引擎 - 根据融合规划生成融合后的项目文件

import type { Project, FusionStrategy, FileNode } from '../types.js'
import type { MergePlan } from './thinkEngine.js'
import { chat } from './aiClient.js'

/**
 * 执行代码拼接 - 生成融合后的项目文件树
 */
export async function runMerge(
  projects: Project[],
  plan: MergePlan,
  strategy: FusionStrategy,
  options: { apiKey?: string; model?: string } = {}
): Promise<FileNode[]> {
  // 1. AI 生成核心文件内容
  const aiFiles = await aiGenerateFiles(projects, plan, strategy, options)

  // 2. 规则生成基础文件
  const ruleFiles = generateRuleFiles(projects, plan)

  // 3. 合并并构建文件树
  const allFiles = [...ruleFiles, ...aiFiles]
  return buildFileTree(allFiles)
}

/** AI 生成核心文件 */
async function aiGenerateFiles(
  projects: Project[],
  plan: MergePlan,
  strategy: FusionStrategy,
  options: { apiKey?: string; model?: string }
): Promise<{ path: string; content: string }[]> {
  const prompt = `你是代码生成专家。请根据以下信息生成融合项目的核心文件，返回 JSON。
项目：${projects.map((p) => p.name).join(' + ')}
融合策略：${strategy}
目标结构：${JSON.stringify(plan.targetStructure)}
共享依赖：${plan.sharedDeps.join(', ')}

请生成以下文件：
1. README.md - 融合项目说明
2. src/index.ts - 统一入口，导出所有模块
3. src/shared/index.ts - 共享层入口

返回格式：{"files":[{"path":"文件路径","content":"文件内容"}]}
只返回 JSON。`

  try {
    const content = await chat(
      [
        { role: 'system', content: '你是代码生成专家，擅长根据融合规划生成结构清晰的项目文件。' },
        { role: 'user', content: prompt },
      ],
      { apiKey: options.apiKey, model: options.model, temperature: 0.4, maxTokens: 1500 }
    )
    const parsed = JSON.parse(extractJson(content)) as { files: { path: string; content: string }[] }
    return parsed.files ?? []
  } catch {
    return fallbackFiles(projects, plan)
  }
}

/** 规则生成基础文件 */
function generateRuleFiles(
  projects: Project[],
  plan: MergePlan
): { path: string; content: string }[] {
  const mergedDeps = Array.from(new Set(projects.flatMap((p) => p.dependencies)))
  const projectName = projects.map((p) => p.name).join('-') + '-Fused'

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
    dependencies: mergedDeps.reduce((acc, dep) => {
      acc[dep] = '^latest'
      return acc
    }, {} as Record<string, string>),
  }

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
        `};`,
        '',
        'export const sharedDeps = ' + JSON.stringify(plan.sharedDeps, null, 2) + ';',
      ].join('\n'),
    },
    {
      path: '.gitignore',
      content: 'node_modules\ndist\n.env\n*.log\n',
    },
  ]
}

/** 降级文件生成 */
function fallbackFiles(
  projects: Project[],
  plan: MergePlan
): { path: string; content: string }[] {
  return [
    {
      path: 'README.md',
      content: `# ${projects.map((p) => p.name).join(' + ')} 融合项目\n\n由 ProjectFusion 自动生成。\n\n## 来源项目\n${projects.map((p) => `- ${p.name}: ${p.description}`).join('\n')}\n\n## 目录结构\n${plan.targetStructure.map((s) => `- \`${s.path}\`: ${s.purpose}`).join('\n')}\n`,
    },
    {
      path: 'src/index.ts',
      content: [
        '// 融合项目统一入口',
        `export * from './config';`,
        `export * from './shared';`,
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

  // 排序：目录在前，文件在后
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

/** 从可能包含 markdown 代码块的文本中提取 JSON */
function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()
  return text.trim()
}
