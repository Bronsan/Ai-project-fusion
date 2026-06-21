// 融合产物安全扫描器 - v0.13beta
// 对融合后的代码做安全复查（源项目审查只看元数据，这里看真实代码）
// 参考 CodeFlow 的扫描项：
// 1. 硬编码密钥（API key、token、password）
// 2. 危险函数调用（eval、Function、child_process.exec）
// 3. SQL 注入模式（字符串拼接 SQL）
// 4. 调试语句残留（console.log、debugger）
// 5. 路径穿越风险（../ 拼接）
// 6. 不安全的正则（ReDoS 风险）

import type { FileNode, SecurityIssue } from '../types.js'

/** 扫描结果 */
export interface ProductScanResult {
  issues: SecurityIssue[]
  scannedFiles: number
  passed: boolean
}

/** 扫描融合产物 */
export function scanFusionProduct(files: FileNode[]): ProductScanResult {
  const flat = flattenFiles(files)
  const issues: SecurityIssue[] = []

  for (const file of flat) {
    if (!file.content) continue
    if (!isScannableFile(file.path)) continue

    // 1. 硬编码密钥
    issues.push(...scanHardcodedSecrets(file.path, file.content))
    // 2. 危险函数调用
    issues.push(...scanDangerousCalls(file.path, file.content))
    // 3. SQL 注入模式
    issues.push(...scanSqlInjection(file.path, file.content))
    // 4. 调试语句残留
    issues.push(...scanDebugStatements(file.path, file.content))
    // 5. 路径穿越风险
    issues.push(...scanPathTraversal(file.path, file.content))
    // 6. 不安全正则
    issues.push(...scanUnsafeRegex(file.path, file.content))
  }

  // 有 critical/high 即不通过
  const passed = !issues.some((i) => i.level === 'critical' || i.level === 'high')
  return { issues, scannedFiles: flat.length, passed }
}

/** 扁平化文件树 */
function flattenFiles(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = []
  for (const n of nodes) {
    if (n.type === 'file') {
      result.push(n)
    } else if (n.children) {
      result.push(...flattenFiles(n.children))
    }
  }
  return result
}

/** 判断文件是否可扫描 */
function isScannableFile(path: string): boolean {
  const lower = path.toLowerCase()
  return ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.rb', '.php'].some((ext) =>
    lower.endsWith(ext)
  )
}

/** 扫描硬编码密钥 */
function scanHardcodedSecrets(filePath: string, content: string): SecurityIssue[] {
  const issues: SecurityIssue[] = []
  const patterns: { re: RegExp; label: string }[] = [
    { re: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]([a-zA-Z0-9_\-]{20,})['"]/gi, label: 'API Key' },
    { re: /(?:secret|client[_-]?secret)\s*[:=]\s*['"]([a-zA-Z0-9_\-]{16,})['"]/gi, label: 'Secret' },
    { re: /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"]{6,})['"]/gi, label: 'Password' },
    { re: /(?:token|access[_-]?token)\s*[:=]\s*['"]([a-zA-Z0-9_\-\.]{20,})['"]/gi, label: 'Token' },
    { re: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g, label: 'Private Key' },
    { re: /sk_[a-zA-Z0-9]{20,}/g, label: 'Stripe Key' },
    { re: /AKIA[0-9A-Z]{16}/g, label: 'AWS Access Key' },
    { re: /ghp_[a-zA-Z0-9]{36}/g, label: 'GitHub Token' },
  ]

  for (const { re, label } of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(content)) !== null) {
      // 排除明显的占位符
      const matched = m[0]
      if (/your[_-]?key|placeholder|example|xxx+|YOUR_KEY/i.test(matched)) continue
      issues.push({
        level: 'high',
        file: filePath,
        description: `检测到硬编码 ${label}：${matched.slice(0, 40)}...`,
        suggestion: '将敏感信息移到环境变量或密钥管理服务，不要硬编码在源码中',
      })
    }
  }
  return issues
}

/** 扫描危险函数调用 */
function scanDangerousCalls(filePath: string, content: string): SecurityIssue[] {
  const issues: SecurityIssue[] = []
  const patterns: { re: RegExp; level: SecurityIssue['level']; desc: string }[] = [
    {
      re: /\beval\s*\(/g,
      level: 'critical',
      desc: '使用 eval() - 可执行任意代码，存在注入风险',
    },
    {
      re: /new\s+Function\s*\(/g,
      level: 'high',
      desc: '使用 new Function() - 等价于 eval，存在注入风险',
    },
    {
      re: /child_process\.exec\s*\(/g,
      level: 'high',
      desc: '使用 child_process.exec - 命令注入风险，建议用 execFile',
    },
    {
      re: /exec\s*\(\s*['"`].*?\$\{/g,
      level: 'high',
      desc: 'exec 调用拼接字符串 - 命令注入风险',
    },
    {
      re: /\bsetInterval\s*\(\s*['"`]/g,
      level: 'medium',
      desc: 'setInterval 传字符串参数 - 等价于 eval',
    },
    {
      re: /\bsetTimeout\s*\(\s*['"`]/g,
      level: 'medium',
      desc: 'setTimeout 传字符串参数 - 等价于 eval',
    },
    {
      re: /document\.write\s*\(/g,
      level: 'high',
      desc: 'document.write - XSS 风险',
    },
    {
      re: /innerHTML\s*=\s*[^'"]*?\$\{/g,
      level: 'high',
      desc: 'innerHTML 赋值含动态拼接 - XSS 风险',
    },
  ]

  for (const { re, level, desc } of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(content)) !== null) {
      issues.push({
        level,
        file: filePath,
        description: desc,
        suggestion: '使用安全的替代方案，如 JSON.parse、textContent、参数化查询',
      })
    }
  }
  return issues
}

/** 扫描 SQL 注入模式 */
function scanSqlInjection(filePath: string, content: string): SecurityIssue[] {
  const issues: SecurityIssue[] = []
  // 字符串拼接 SQL：`SELECT ... ${var}` 或 "SELECT " + var
  const patterns: RegExp[] = [
    /['"`](?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\s+[\s\S]*?\$\{/gi,
    /['"`](?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\s+[\s\S]*?['"`]\s*\+/gi,
  ]

  for (const re of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(content)) !== null) {
      issues.push({
        level: 'high',
        file: filePath,
        description: `SQL 语句含动态拼接：${m[0].slice(0, 50)}...`,
        suggestion: '使用参数化查询或 ORM 的查询构建器，不要拼接 SQL 字符串',
      })
    }
  }
  return issues
}

/** 扫描调试语句残留 */
function scanDebugStatements(filePath: string, content: string): SecurityIssue[] {
  const issues: SecurityIssue[] = []
  // 跳过测试文件和配置文件
  if (/\.(test|spec)\.(ts|js|tsx|jsx)$/i.test(filePath)) return issues
  if (/\/(__tests__|tests?|spec)\//i.test(filePath)) return issues

  const patterns: { re: RegExp; level: SecurityIssue['level']; desc: string }[] = [
    { re: /\bdebugger\b/g, level: 'high', desc: '残留 debugger 语句' },
    { re: /\bconsole\.log\s*\(/g, level: 'low', desc: '残留 console.log 调试输出' },
    { re: /\bconsole\.debug\s*\(/g, level: 'low', desc: '残留 console.debug 调试输出' },
    { re: /\bprint\s*\(['"`].*?debug/gi, level: 'low', desc: '残留 debug print 语句' },
  ]

  for (const { re, level, desc } of patterns) {
    let m: RegExpExecArray | null
    let count = 0
    while ((m = re.exec(content)) !== null) {
      count++
    }
    if (count > 0) {
      issues.push({
        level,
        file: filePath,
        description: `${desc}（${count} 处）`,
        suggestion: '生产代码应移除调试语句，或使用条件日志',
      })
    }
  }
  return issues
}

/** 扫描路径穿越风险 */
function scanPathTraversal(filePath: string, content: string): SecurityIssue[] {
  const issues: SecurityIssue[] = []
  // 拼接 ../ 或用户输入到路径
  const patterns: RegExp[] = [
    /(?:path\.join|path\.resolve|fs\.\w+)\s*\([\s\S]*?\$\{[\s\S]*?req\./gi,
    /['"`]\.\.\/[\s\S]*?\$\{/g,
    /['"`]\.\.\\[\s\S]*?\$\{/g,
  ]

  for (const re of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(content)) !== null) {
      issues.push({
        level: 'high',
        file: filePath,
        description: `路径拼接含动态变量：${m[0].slice(0, 50)}...`,
        suggestion: '对用户输入做路径规范化与白名单校验，防止路径穿越',
      })
    }
  }
  return issues
}

/** 扫描不安全正则（ReDoS 风险） */
function scanUnsafeRegex(filePath: string, content: string): SecurityIssue[] {
  const issues: SecurityIssue[] = []
  // 嵌套量词：(a+)+ 或 (a*)* 等
  const re = /\(\s*\[[^\]]*\][+*?]\s*\)[+*?]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    issues.push({
      level: 'medium',
      file: filePath,
      description: `潜在 ReDoS 正则：${m[0]}`,
      suggestion: '避免嵌套量词，使用原子组或限制重复次数',
    })
  }
  return issues
}
