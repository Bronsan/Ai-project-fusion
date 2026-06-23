/**
 * API 服务器入口 - 项目融合工坊后端
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import projectRoutes from './routes/projects.js'
import scoreRoutes from './routes/score.js'
import fusionRoutes from './routes/fusion.js'
import aiRoutes from './routes/ai.js'
import aiConfigRoutes from './routes/aiConfig.js'

// 加载环境变量
dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API 路由挂载
 */
app.use('/api/projects', projectRoutes)
app.use('/api/score', scoreRoutes)
app.use('/api/fusion', fusionRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/ai-config', aiConfigRoutes)

/**
 * 健康检查
 */
app.use('/api/health', (_req: Request, res: Response): void => {
  res.status(200).json({ success: true, message: 'ok' })
})

/**
 * 错误处理中间件
 */
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API Error]', error)
  res.status(500).json({ success: false, error: '服务器内部错误' })
})

/**
 * 404 处理
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'API 不存在' })
})

export default app
