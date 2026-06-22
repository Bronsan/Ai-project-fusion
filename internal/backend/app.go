// Package backend - App 结构体
// Wails 绑定核心，暴露给前端的方法

package backend

import (
	"context"
)

// AppVersion 应用版本号常量 - 所有产物文件标记使用此版本
const AppVersion = "0.13beta"

// App 应用结构体 - 所有导出方法可通过 Wails 绑定被前端调用
type App struct {
	ctx context.Context
	db  *DB
}

// NewApp 创建应用实例
func NewApp() *App {
	return &App{}
}

// Startup 应用启动时调用
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	// 初始化数据库
	db, err := NewDB()
	if err != nil {
		// 数据库初始化失败不阻断启动，认证功能降级
		return
	}
	a.db = db
}

// Shutdown 应用关闭时调用
func (a *App) Shutdown(ctx context.Context) {
	if a.db != nil {
		a.db.Close()
	}
}

// GetVersion 获取应用版本号
func (a *App) GetVersion() string {
	return AppVersion
}

// GetChangelog 获取更新日志
func (a *App) GetChangelog() string {
	return `0.13beta
- 新增：AST 语义级融合引擎（@babel/parser，替代 regex 扫描，支持函数/类/常量/接口/类型/枚举实体提取）
- 新增：intra-entity 3-way merge（同名实体改动不重叠时自动合并函数体，Weave 风格）
- 新增：融合产物安全扫描（硬编码密钥、eval、SQL 注入、调试语句、路径穿越、ReDoS）
- 改进：实体级冲突检测（同名不同种类不再误判，如 class Foo vs function Foo）
- 改进：去重基于 AST 实体 body 哈希，更精准

0.12beta
- 新增：融合引擎升级为真代码融合（同名导出冲突检测与重命名、依赖版本冲突解决、代码级去重）
- 新增：AI 调用降级策略（超时控制、指数退避重试、流式输出支持）
- 新增：评分引擎单元测试（vitest，10+ 测试用例验证评分不写死）
- 新增：上传安全防护（zip 炸弹检测、路径穿越拦截、文件类型白名单）
- 新增：网页端上传限制 50MB，流量异常自动封号 1 小时（速率+流量双限）
- 新增：融合执行取消功能（AbortController，全程可取消）
- 新增：报告页对比视图（融合前后各项目维度对比表）

0.11beta
- 修复：评分引擎不再写死分数，改为基于真实代码 + 评分规则文件打分
- 新增：scoring-rules.json 评分标准规则定义文件（类似 skills 的可配置规则）
- 改进：AI 深度评分传入真实代码摘要（文件数、行数、导出、import、复杂度等）
- 改进：评分维度按权重加权计算总分（架构25%/依赖20%/许可20%/风格20%/文档15%）
- 验证：不同项目组合得到不同分数（64/73/76/80/81 等）

0.10 正式版
- 改进：评分引擎基于真实代码内容（导出分析、import 关系、复杂度）
- 改进：融合引擎真正合并上传源码到 src/modules/，生成真实入口与共享层
- 扩大：上传限制 50MB → 500MB，支持中大型开源项目
- 新增：浅色/深色模式切换（CSS 变量 + localStorage 持久化）
- 新增：主题切换按钮（模块中心 + 设置中心头部）
- 新增：设置中心外观主题卡片（浅色/深色双选）
- 新增：自动配置环境脚本（带进度条，一键安装）
- 整理：所有文件结构规范化，产物文件标记版本号

0.01beta
- 新增：可自行上传项目文件（zip 压缩包）进行融合
- 新增：用户登录与注册，密码 bcrypt 加密存储
- 新增：一键登录（记住密码），30 天免登录
- 新增：模块化独立区块布局
- 初始版本：AI 驱动的开源项目智能融合工坊`
}

// GetUserInfo 获取当前登录用户信息（前端校验登录态）
func (a *App) GetUserInfo(username string) map[string]string {
	if a.db == nil {
		return map[string]string{"error": "数据库未初始化"}
	}
	user, err := a.db.GetUserByUsername(username)
	if err != nil || user == nil {
		return map[string]string{"error": "用户不存在"}
	}
	return map[string]string{
		"username":  user.Username,
		"createdAt": user.CreatedAt,
	}
}
