// 上传安全防护引擎 - v0.12beta
// 防护：
// 1. zip 炸弹检测（压缩比 > 100:1 阻断）
// 2. 路径穿越检测（含 .. 或绝对路径阻断）
// 3. 文件类型白名单校验
// 4. 文件数量上限（防 DoS）
// 5. 流量异常封号（基于 IP 的速率限制 + 累计流量阈值）

/** 网页端上传大小上限 50MB */
export const WEB_UPLOAD_LIMIT = 50 * 1024 * 1024

/** 桌面端上传大小上限 500MB */
export const DESKTOP_UPLOAD_LIMIT = 500 * 1024 * 1024

/** 压缩比阈值 - 超过视为 zip 炸弹 */
const COMPRESSION_RATIO_LIMIT = 100

/** 单次上传文件数量上限 */
const MAX_FILE_COUNT = 5000

/** 单个解压文件大小上限 1MB */
const MAX_ENTRY_SIZE = 1 * 1024 * 1024

/** 速率限制：每 IP 每分钟最多上传次数 */
const RATE_LIMIT_PER_MINUTE = 5

/** 流量阈值：每 IP 每小时累计上传字节数 */
const TRAFFIC_LIMIT_PER_HOUR = 200 * 1024 * 1024 // 200MB

/** 封号时长：1 小时 */
const BAN_DURATION_MS = 60 * 60 * 1000

/** 文件类型白名单 */
const ALLOWED_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.vue', '.json', '.md', '.txt',
  '.css', '.scss', '.less', '.html', '.yml', '.yaml', '.xml',
  '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.sh',
  '.toml', '.ini', '.conf',
]

/** 路径穿越检测 - 拒绝含 .. 或绝对路径的条目 */
export function isPathTraversal(entryPath: string): boolean {
  const normalized = entryPath.replace(/\\/g, '/')
  // 含 ..
  if (normalized.includes('..')) return true
  // Windows 绝对路径
  if (/^[a-zA-Z]:/.test(normalized)) return true
  // Unix 绝对路径
  if (normalized.startsWith('/')) return true
  return false
}

/** zip 炸弹检测 - 压缩比异常 */
export function isZipBomb(
  compressedSize: number,
  uncompressedSize: number
): boolean {
  if (compressedSize === 0) return false
  const ratio = uncompressedSize / compressedSize
  return ratio > COMPRESSION_RATIO_LIMIT
}

/** 文件类型白名单校验 */
export function isAllowedFileType(filePath: string): boolean {
  const lower = filePath.toLowerCase()
  // 无扩展名但常见配置文件
  if (lower.endsWith('license') || lower.endsWith('readme') || lower.endsWith('makefile')) {
    return true
  }
  // 必须有扩展名且在白名单
  const ext = lower.substring(lower.lastIndexOf('.'))
  if (!ext) return false
  return ALLOWED_EXTENSIONS.includes(ext)
}

/** 上传安全校验结果 */
export interface SecurityCheckResult {
  ok: boolean
  reason?: string
  /** 详细诊断信息 */
  details?: string[]
}

/** 综合安全校验 - 对解压后的文件列表进行检查 */
export function validateExtractedFiles(
  entries: { entryName: string; size: number; content?: string }[],
  compressedSize: number
): SecurityCheckResult {
  const details: string[] = []

  // 1. 文件数量检查
  if (entries.length > MAX_FILE_COUNT) {
    return {
      ok: false,
      reason: `文件数量超限：${entries.length} > ${MAX_FILE_COUNT}`,
      details,
    }
  }

  // 2. 累计解压大小与压缩比检查
  const totalUncompressed = entries.reduce((sum, e) => sum + e.size, 0)
  if (isZipBomb(compressedSize, totalUncompressed)) {
    return {
      ok: false,
      reason: `检测到 zip 炸弹：压缩比 ${Math.round(totalUncompressed / compressedSize)}:1 超过阈值 ${COMPRESSION_RATIO_LIMIT}:1`,
      details,
    }
  }

  // 3. 路径穿越检查
  for (const entry of entries) {
    if (isPathTraversal(entry.entryName)) {
      return {
        ok: false,
        reason: `检测到路径穿越攻击：${entry.entryName}`,
        details,
      }
    }
  }

  // 4. 单文件大小检查
  for (const entry of entries) {
    if (entry.size > MAX_ENTRY_SIZE) {
      details.push(`跳过过大文件：${entry.entryName} (${Math.round(entry.size / 1024)}KB)`)
    }
  }

  return { ok: true, details }
}

// ========== 速率限制与封号 ==========

interface IpRecord {
  /** 上传时间戳列表（用于速率限制） */
  uploads: number[]
  /** 累计上传字节数 */
  totalBytes: number
  /** 当前小时窗口起点 */
  hourWindowStart: number
  /** 封号到期时间戳 */
  bannedUntil?: number
}

const ipRecords = new Map<string, IpRecord>()

/** 检查 IP 是否被封禁 */
export function isIpBanned(ip: string): boolean {
  const record = ipRecords.get(ip)
  if (!record?.bannedUntil) return false
  if (Date.now() > record.bannedUntil) {
    // 封禁到期，清除记录
    record.bannedUntil = undefined
    return false
  }
  return true
}

/** 封禁 IP */
export function banIp(ip: string, reason: string): void {
  let record = ipRecords.get(ip)
  if (!record) {
    record = { uploads: [], totalBytes: 0, hourWindowStart: Date.now() }
    ipRecords.set(ip, record)
  }
  record.bannedUntil = Date.now() + BAN_DURATION_MS
  console.warn(`[Security] IP ${ip} 已被封禁 1 小时，原因：${reason}`)
}

/**
 * 检查上传速率与流量
 * 返回 ok=true 时表示允许上传，同时会更新计数
 */
export function checkRateLimit(ip: string, uploadBytes: number): SecurityCheckResult {
  if (isIpBanned(ip)) {
    return {
      ok: false,
      reason: 'IP 已被封禁（流量异常），请 1 小时后再试',
    }
  }

  const now = Date.now()
  let record = ipRecords.get(ip)
  if (!record) {
    record = { uploads: [], totalBytes: 0, hourWindowStart: now }
    ipRecords.set(ip, record)
  }

  // 清理 1 分钟前的上传记录
  record.uploads = record.uploads.filter((t) => now - t < 60_000)

  // 速率限制：每分钟最多 5 次
  if (record.uploads.length >= RATE_LIMIT_PER_MINUTE) {
    banIp(ip, `速率超限：1 分钟内上传 ${record.uploads.length} 次`)
    return {
      ok: false,
      reason: `上传过于频繁（1 分钟内 ${record.uploads.length} 次），IP 已被封禁 1 小时`,
    }
  }

  // 流量窗口检查：每小时重置
  if (now - record.hourWindowStart > 60 * 60 * 1000) {
    record.hourWindowStart = now
    record.totalBytes = 0
  }

  // 流量限制：每小时累计 200MB
  if (record.totalBytes + uploadBytes > TRAFFIC_LIMIT_PER_HOUR) {
    banIp(ip, `流量超限：1 小时内累计 ${record.totalBytes + uploadBytes} 字节`)
    return {
      ok: false,
      reason: `流量异常（1 小时内累计超过 ${TRAFFIC_LIMIT_PER_HOUR / 1024 / 1024}MB），IP 已被封禁 1 小时`,
    }
  }

  // 通过检查，更新计数
  record.uploads.push(now)
  record.totalBytes += uploadBytes

  return { ok: true }
}

/** 获取客户端 IP - 从 express request 中提取 */
export function getClientIp(req: { ip?: string; headers?: Record<string, any> }): string {
  // 优先从 X-Forwarded-For 取（反向代理场景）
  const xff = req.headers?.['x-forwarded-for']
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim()
  }
  return req.ip || 'unknown'
}

/** 获取封禁状态（用于 API 查询） */
export function getBanStatus(ip: string): { banned: boolean; remainingMs?: number } {
  const record = ipRecords.get(ip)
  if (!record?.bannedUntil) return { banned: false }
  if (Date.now() > record.bannedUntil) {
    record.bannedUntil = undefined
    return { banned: false }
  }
  return { banned: true, remainingMs: record.bannedUntil - Date.now() }
}
