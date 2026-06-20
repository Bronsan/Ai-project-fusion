// Package main - App 结构体
// Wails 绑定核心，暴露给前端的方法

package main

import (
	"context"
)

// App 应用结构体 - 所有导出方法可通过 Wails 绑定被前端调用
type App struct {
	ctx context.Context
	db  *DB
}

// NewApp 创建应用实例
func NewApp() *App {
	return &App{}
}

// startup 应用启动时调用
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	// 初始化数据库
	db, err := NewDB()
	if err != nil {
		// 数据库初始化失败不阻断启动，认证功能降级
		return
	}
	a.db = db
}

// shutdown 应用关闭时调用
func (a *App) shutdown(ctx context.Context) {
	if a.db != nil {
		a.db.Close()
	}
}

// GetVersion 获取应用版本号
func (a *App) GetVersion() string {
	return "0.01beta"
}

// GetChangelog 获取更新日志
func (a *App) GetChangelog() string {
	return `0.01beta
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
