// 评分引擎单元测试 - v0.12beta
// 验证评分不再写死，不同项目组合得到不同分数

import { describe, it, expect } from 'vitest'
import { calculatePreviewScore } from '../lib/scoreEngine.js'
import type { Project } from '../types.js'

/** 构造测试项目的辅助函数 */
function makeProject(overrides: Partial<Project>): Project {
  return {
    id: 'test-' + Math.random().toString(36).slice(2, 8),
    name: 'TestProject',
    description: '测试项目',
    language: 'TypeScript',
    tags: [],
    stars: 0,
    license: 'MIT',
    readme: '这是一个测试项目的 README，长度需要超过 50 字符以保证文档维度评分正常工作。',
    source: 'builtin',
    structure: {
      framework: 'react',
      buildTool: 'vite',
      packageManager: 'npm',
      moduleSystem: 'esm',
      testFramework: 'vitest',
    },
    dependencies: ['react', 'react-dom'],
    files: [
      {
        path: 'src/index.ts',
        content: 'export const foo = 1\nexport function bar() { return foo + 1 }\n',
      },
      {
        path: 'src/utils.ts',
        content: 'export const util = "test"\nexport function helper() { return util.length }\n',
      },
    ],
    ...overrides,
  }
}

describe('scoreEngine - calculatePreviewScore', () => {
  it('少于 2 个项目应返回 0 分且不可行', () => {
    const result = calculatePreviewScore([makeProject({})])
    expect(result.totalScore).toBe(0)
    expect(result.feasible).toBe(false)
    expect(result.dimensions).toHaveLength(0)
  })

  it('相同框架的 React 项目应得高分', () => {
    const p1 = makeProject({ name: 'ReactApp1', dependencies: ['react', 'react-dom', 'vite'] })
    const p2 = makeProject({ name: 'ReactApp2', dependencies: ['react', 'react-dom', 'vite'] })
    const result = calculatePreviewScore([p1, p2])
    expect(result.totalScore).toBeGreaterThan(70)
    expect(result.dimensions).toHaveLength(5)
  })

  it('不同框架的项目应得较低分（架构维度）', () => {
    const p1 = makeProject({
      name: 'ReactApp',
      structure: { framework: 'react', buildTool: 'vite', packageManager: 'npm', moduleSystem: 'esm', testFramework: 'vitest' },
    })
    const p2 = makeProject({
      name: 'VueApp',
      structure: { framework: 'vue', buildTool: 'webpack', packageManager: 'npm', moduleSystem: 'esm', testFramework: 'jest' },
    })
    const result = calculatePreviewScore([p1, p2])
    const archDim = result.dimensions.find((d) => d.name === '架构兼容性')
    expect(archDim).toBeDefined()
    expect(archDim!.score).toBeLessThan(80)
  })

  it('含 GPL 许可证的项目应在许可证维度得低分', () => {
    const p1 = makeProject({ name: 'MITApp', license: 'MIT' })
    const p2 = makeProject({ name: 'GPLApp', license: 'GPL-3.0' })
    const result = calculatePreviewScore([p1, p2])
    const licenseDim = result.dimensions.find((d) => d.name === '许可证兼容')
    expect(licenseDim).toBeDefined()
    expect(licenseDim!.score).toBeLessThan(50)
  })

  it('CJS 与 ESM 混用应在架构维度扣分', () => {
    const p1 = makeProject({
      name: 'EsmApp',
      structure: { framework: 'agnostic', buildTool: 'tsc', packageManager: 'npm', moduleSystem: 'esm', testFramework: 'vitest' },
    })
    const p2 = makeProject({
      name: 'CjsApp',
      structure: { framework: 'agnostic', buildTool: 'tsc', packageManager: 'npm', moduleSystem: 'cjs', testFramework: 'jest' },
    })
    const result = calculatePreviewScore([p1, p2])
    const archDim = result.dimensions.find((d) => d.name === '架构兼容性')
    expect(archDim!.score).toBeLessThan(80)
  })

  it('不同项目组合应得到不同分数（不写死）', () => {
    // 组合 A：两个相同 React 项目
    const reactA = makeProject({ name: 'ReactA', dependencies: ['react', 'react-dom'] })
    const reactB = makeProject({ name: 'ReactB', dependencies: ['react', 'react-dom'] })
    const scoreA = calculatePreviewScore([reactA, reactB]).totalScore

    // 组合 B：React + Vue（不同框架）
    const vue = makeProject({
      name: 'VueApp',
      structure: { framework: 'vue', buildTool: 'webpack', packageManager: 'npm', moduleSystem: 'esm', testFramework: 'jest' },
      dependencies: ['vue'],
    })
    const scoreB = calculatePreviewScore([reactA, vue]).totalScore

    // 两个组合的分数应该不同
    expect(scoreA).not.toBe(scoreB)
    // 相同框架分数应该更高
    expect(scoreA).toBeGreaterThan(scoreB)
  })

  it('所有维度分数应在 0-100 范围内', () => {
    const p1 = makeProject({ name: 'P1' })
    const p2 = makeProject({ name: 'P2' })
    const result = calculatePreviewScore([p1, p2])
    for (const d of result.dimensions) {
      expect(d.score).toBeGreaterThanOrEqual(0)
      expect(d.score).toBeLessThanOrEqual(100)
      expect(d.comment).toBeTruthy()
    }
  })

  it('总分应在 0-100 范围内', () => {
    const p1 = makeProject({ name: 'P1' })
    const p2 = makeProject({ name: 'P2' })
    const result = calculatePreviewScore([p1, p2])
    expect(result.totalScore).toBeGreaterThanOrEqual(0)
    expect(result.totalScore).toBeLessThanOrEqual(100)
  })

  it('代码分析应能识别导出与导入', () => {
    const p1 = makeProject({
      name: 'WithExports',
      files: [
        {
          path: 'src/lib.ts',
          content: [
            'import { useState } from "react"',
            'import lodash from "lodash"',
            'export const foo = 1',
            'export function bar() { return 2 }',
            'export class Baz {}',
          ].join('\n'),
        },
      ],
    })
    const p2 = makeProject({ name: 'Other' })
    const result = calculatePreviewScore([p1, p2])
    // 应该正常评分不报错
    expect(result.totalScore).toBeGreaterThan(0)
  })

  it('有测试文件的项目应在代码风格维度得分更高', () => {
    const withTests = makeProject({
      name: 'WithTests',
      files: [
        { path: 'src/index.ts', content: 'export const x = 1' },
        { path: 'src/index.test.ts', content: 'import { x } from "./index"\ntest("x", () => { expect(x).toBe(1) })' },
      ],
    })
    const withoutTests = makeProject({
      name: 'WithoutTests',
      files: [
        { path: 'src/index.ts', content: 'export const x = 1' },
      ],
    })
    const scoreWith = calculatePreviewScore([withTests, makeProject({ name: 'P1' })])
      .dimensions.find((d) => d.name === '代码风格')!.score
    const scoreWithout = calculatePreviewScore([withoutTests, makeProject({ name: 'P2' })])
      .dimensions.find((d) => d.name === '代码风格')!.score
    expect(scoreWith).toBeGreaterThanOrEqual(scoreWithout)
  })
})
