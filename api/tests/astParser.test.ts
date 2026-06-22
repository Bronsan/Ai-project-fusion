// astParser 单元测试 - v0.13
// 验证基于 @babel/parser 的语义级实体提取与 body 差异计算

import { describe, it, expect } from 'vitest'
import { parseFile, isAstParseable, diffEntityBodies } from '../lib/astParser.js'

describe('astParser', () => {
  it('isAstParseable 应识别可解析文件', () => {
    expect(isAstParseable('foo.ts')).toBe(true)
    expect(isAstParseable('foo.tsx')).toBe(true)
    expect(isAstParseable('foo.js')).toBe(true)
    expect(isAstParseable('foo.jsx')).toBe(true)
    expect(isAstParseable('foo.py')).toBe(false)
    expect(isAstParseable('foo.md')).toBe(false)
    expect(isAstParseable('foo.go')).toBe(false)
    expect(isAstParseable('Makefile')).toBe(false)
  })

  it('parseFile 应识别 export function', () => {
    const content = 'export function foo() { return 1 }'
    const result = parseFile('test.ts', content)
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].kind).toBe('function')
    expect(result.entities[0].name).toBe('foo')
    expect(result.entities[0].isExported).toBe(true)
    expect(result.entities[0].isDefault).toBe(false)
  })

  it('parseFile 应识别 export const', () => {
    const content = 'export const bar = 42'
    const result = parseFile('test.ts', content)
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].kind).toBe('constant')
    expect(result.entities[0].name).toBe('bar')
    expect(result.entities[0].isExported).toBe(true)
  })

  it('parseFile 应识别 export class', () => {
    const content = 'export class Baz { constructor() {} }'
    const result = parseFile('test.ts', content)
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].kind).toBe('class')
    expect(result.entities[0].name).toBe('Baz')
    expect(result.entities[0].isExported).toBe(true)
  })

  it('parseFile 应识别 export interface（TS）', () => {
    const content = 'export interface IFoo { x: number }'
    const result = parseFile('test.ts', content)
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].kind).toBe('interface')
    expect(result.entities[0].name).toBe('IFoo')
    expect(result.entities[0].isExported).toBe(true)
  })

  it('parseFile 应识别 export type（TS）', () => {
    const content = 'export type TFoo = string | number'
    const result = parseFile('test.ts', content)
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].kind).toBe('type')
    expect(result.entities[0].name).toBe('TFoo')
    expect(result.entities[0].isExported).toBe(true)
  })

  it('parseFile 应识别 export default function', () => {
    const content = 'export default function foo() { return 1 }'
    const result = parseFile('test.ts', content)
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].kind).toBe('function')
    expect(result.entities[0].name).toBe('foo')
    expect(result.entities[0].isExported).toBe(true)
    expect(result.entities[0].isDefault).toBe(true)
  })

  it('parseFile 非 export 的声明不被识别为 isExported', () => {
    const content = 'function foo() { return 1 }'
    const result = parseFile('test.ts', content)
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].kind).toBe('function')
    expect(result.entities[0].name).toBe('foo')
    expect(result.entities[0].isExported).toBe(false)
    expect(result.entities[0].isDefault).toBe(false)
  })

  it('parseFile 解析错误时返回空 entities + errors，不抛异常', () => {
    const content = 'export function {'
    let result: ReturnType<typeof parseFile>
    expect(() => {
      result = parseFile('test.ts', content)
    }).not.toThrow()
    expect(result!).toBeDefined()
    expect(result!.entities).toHaveLength(0)
    expect(result!.errors.length).toBeGreaterThan(0)
    expect(result!.errors[0]).toContain('test.ts')
  })

  it('parseFile 同名不同种类（class Foo vs function Foo）产生不同 id', () => {
    const content = 'export class Foo {}\nexport function Foo() {}'
    const result = parseFile('test.ts', content)
    expect(result.entities).toHaveLength(2)
    const ids = result.entities.map((e) => e.id)
    expect(ids).toContain('test.ts:class:Foo')
    expect(ids).toContain('test.ts:function:Foo')
    expect(new Set(ids).size).toBe(2)
  })

  it('diffEntityBodies 相同内容 canAutoMerge 为 true', () => {
    const body = 'line1\nline2\nline3'
    const result = diffEntityBodies(body, body)
    expect(result.canAutoMerge).toBe(true)
    expect(result.changedLinesA.size).toBe(0)
    expect(result.changedLinesB.size).toBe(0)
  })

  it('diffEntityBodies 完全不同内容 canAutoMerge 为 false', () => {
    const result = diffEntityBodies('aaa\nbbb', 'ccc\nddd')
    expect(result.canAutoMerge).toBe(false)
    expect(result.changedLinesA.size).toBeGreaterThan(0)
    expect(result.changedLinesB.size).toBeGreaterThan(0)
  })

  it('diffEntityBodies 非重叠改动（一方含额外行）canAutoMerge 为 true', () => {
    // bodyA 比 bodyB 多一行，差异行不重叠 → 可自动合并
    const bodyA = 'line1\nline2\nline3'
    const bodyB = 'line1\nline2'
    const result = diffEntityBodies(bodyA, bodyB)
    expect(result.canAutoMerge).toBe(true)
    expect(result.changedLinesA.size).toBeGreaterThan(0)
    // 改动行集合不相交
    const overlap = [...result.changedLinesA].filter((i) => result.changedLinesB.has(i))
    expect(overlap).toHaveLength(0)
  })
})
