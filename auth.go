// Package main - 用户认证模块
// 密码使用 bcrypt 加密存储，记住密码通过随机 token 实现

package main

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// User 用户结构
type User struct {
	ID           int    `json:"id"`
	Username     string `json:"username"`
	PasswordHash string `json:"-"` // 不返回前端
	CreatedAt    string `json:"createdAt"`
}

// LoginResult 登录结果
type LoginResult struct {
	Success  bool   `json:"success"`
	Token    string `json:"token,omitempty"`    // 记住密码 token
	Username string `json:"username,omitempty"`
	Error    string `json:"error,omitempty"`
}

// RegisterResult 注册结果
type RegisterResult struct {
	Success  bool   `json:"success"`
	Username string `json:"username,omitempty"`
	Error    string `json:"error,omitempty"`
}

// RegisterUser 注册新用户 - 密码 bcrypt 加密后存储
func (a *App) RegisterUser(username, password string) RegisterResult {
	if len(username) < 2 {
		return RegisterResult{Error: "用户名至少 2 个字符"}
	}
	if len(password) < 6 {
		return RegisterResult{Error: "密码至少 6 个字符"}
	}

	// 检查用户名是否已存在
	existing, _ := a.db.GetUserByUsername(username)
	if existing != nil {
		return RegisterResult{Error: "用户名已存在"}
	}

	// bcrypt 加密密码（cost=10）
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 10)
	if err != nil {
		return RegisterResult{Error: "密码加密失败"}
	}

	user := User{
		Username:     username,
		PasswordHash: string(hash),
		CreatedAt:    time.Now().Format(time.RFC3339),
	}
	if err := a.db.CreateUser(&user); err != nil {
		return RegisterResult{Error: "创建用户失败"}
	}
	return RegisterResult{Success: true, Username: username}
}

// Login 登录验证 - 校验 bcrypt 密码
func (a *App) Login(username, password string, remember bool) LoginResult {
	user, err := a.db.GetUserByUsername(username)
	if err != nil || user == nil {
		return LoginResult{Error: "用户名或密码错误"}
	}

	// bcrypt 比对
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return LoginResult{Error: "用户名或密码错误"}
	}

	result := LoginResult{Success: true, Username: username}

	// 记住密码：生成随机 token 存库
	if remember {
		token := generateToken(32)
		expires := time.Now().Add(30 * 24 * time.Hour) // 30 天有效
		if err := a.db.SaveRememberToken(user.ID, token, expires.Format(time.RFC3339)); err == nil {
			result.Token = token
		}
	}
	return result
}

// LoginWithToken 一键登录 - 通过记住密码 token 自动登录
func (a *App) LoginWithToken(token string) LoginResult {
	if token == "" {
		return LoginResult{Error: "token 为空"}
	}
	user, err := a.db.GetUserByRememberToken(token)
	if err != nil || user == nil {
		return LoginResult{Error: "token 已失效，请重新登录"}
	}
	// 刷新 token 有效期
	newToken := generateToken(32)
	expires := time.Now().Add(30 * 24 * time.Hour)
	a.db.SaveRememberToken(user.ID, newToken, expires.Format(time.RFC3339))
	return LoginResult{Success: true, Token: newToken, Username: user.Username}
}

// Logout 登出 - 清除记住密码 token
func (a *App) Logout(username string) error {
	user, _ := a.db.GetUserByUsername(username)
	if user == nil {
		return errors.New("用户不存在")
	}
	return a.db.ClearRememberToken(user.ID)
}

// ChangePassword 修改密码
func (a *App) ChangePassword(username, oldPassword, newPassword string) RegisterResult {
	if len(newPassword) < 6 {
		return RegisterResult{Error: "新密码至少 6 个字符"}
	}
	user, err := a.db.GetUserByUsername(username)
	if err != nil || user == nil {
		return RegisterResult{Error: "用户不存在"}
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(oldPassword)) != nil {
		return RegisterResult{Error: "原密码错误"}
	}
	hash, _ := bcrypt.GenerateFromPassword([]byte(newPassword), 10)
	if err := a.db.UpdatePassword(user.ID, string(hash)); err != nil {
		return RegisterResult{Error: "更新密码失败"}
	}
	return RegisterResult{Success: true, Username: username}
}

// generateToken 生成随机 hex token
func generateToken(bytes int) string {
	b := make([]byte, bytes)
	rand.Read(b)
	return hex.EncodeToString(b)
}
