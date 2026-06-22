// productSecurityScanner 单元测试 - v0.13
// 验证融合产物安全扫描器对各类风险模式的识别与计数

import { describe, it, expect } from 'vitest'
import { scanFusionProduct } from '../lib/productSecurityScanner.js'
import type { FileNode } from '../types.js'

/** 构造单文件输入的辅助函数 */
function file(path: string, content: string): FileNode {
  return { path, type: 'file', content }
}

describe('productSecurityScanner', () => {
  it('干净代码应通过扫描', () => {
    const files = [file('src/index.ts', 'export const x = 1')]
    const result = scanFusionProduct(files)
    expect(result.issues).toHaveLength(0)
    expect(result.passed).toBe(true)
  })

  it('eval 应触发 critical', () => {
    const files = [file('src/evil.ts', 'export function run(x) { return eval(x) }')]
    const result = scanFusionProduct(files)
    expect(result.issues.some((i) => i.level === 'critical')).toBe(true)
    expect(result.passed).toBe(false)
  })

  it('硬编码 API key 应触发 high', () => {
    const files = [file('src/cfg.ts', 'export const apiKey = "sk_live_1234567890abcdefghij"')]
    const result = scanFusionProduct(files)
    expect(result.issues.some((i) => i.level === 'high')).toBe(true)
    expect(result.passed).toBe(false)
  })

  it('SQL 拼接应触发 high', () => {
    const files = [file('src/db.ts', 'const q = "SELECT * FROM users WHERE id=" + userId')]
    const result = scanFusionProduct(files)
    expect(result.issues.some((i) => i.level === 'high')).toBe(true)
    expect(result.issues.some((i) => i.description.includes('SQL'))).toBe(true)
    expect(result.passed).toBe(false)
  })

  it('console.log 在非测试文件应触发 low', () => {
    const files = [file('src/app.ts', 'console.log("debug here")')]
    const result = scanFusionProduct(files)
    expect(result.issues.some((i) => i.level === 'low')).toBe(true)
    // low 级别不阻断通过
    expect(result.issues.some((i) => i.level === 'critical' || i.level === 'high')).toBe(false)
  })

  it('debugger 语句应触发 high', () => {
    const files = [file('src/app.ts', 'export function f() { debugger }')]
    const result = scanFusionProduct(files)
    expect(result.issues.some((i) => i.level === 'high')).toBe(true)
    expect(result.passed).toBe(false)
  })

  it('测试文件中的 console.log 不报 issue', () => {
    const files = [file('src/app.test.ts', 'console.log("hi")')]
    const result = scanFusionProduct(files)
    expect(result.issues).toHaveLength(0)
  })

  it('document.write 应触发 high', () => {
    const files = [file('src/dom.ts', 'document.write("<b>hi</b>")')]
    const result = scanFusionProduct(files)
    expect(result.issues.some((i) => i.level === 'high')).toBe(true)
    expect(result.passed).toBe(false)
  })

  it('innerHTML 动态拼接应触发 high', () => {
    const files = [file('src/dom.ts', 'el.innerHTML = `<b>${userinput}</b>`')]
    const result = scanFusionProduct(files)
    expect(result.issues.some((i) => i.level === 'high')).toBe(true)
    expect(result.issues.some((i) => i.description.includes('innerHTML'))).toBe(true)
    expect(result.passed).toBe(false)
  })

  it('scannedFiles 计数应正确（含目录扁平化与非扫描文件）', () => {
    const files: FileNode[] = [
      {
        path: 'src',
        type: 'dir',
        children: [
          file('src/a.ts', 'export const a = 1'),
          file('src/b.ts', 'export const b = 2'),
        ],
      },
      file('readme.md', '# readme'),
    ]
    const result = scanFusionProduct(files)
    // 2 个 ts 文件 + 1 个 md 文件，扁平化后共 3 个
    expect(result.scannedFiles).toBe(3)
  })
})
