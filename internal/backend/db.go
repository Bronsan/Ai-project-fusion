// Package backend - SQLite 数据库模块
// 使用纯 Go 驱动 modernc.org/sqlite，无需 cgo，跨平台

package backend

import (
	"database/sql"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

// DB 数据库封装
type DB struct {
	db *sql.DB
}

// NewDB 初始化数据库 - 数据文件存于用户配置目录
func NewDB() (*DB, error) {
	// 数据目录：用户配置目录下的 ProjectFusion
	dataDir, err := os.UserConfigDir()
	if err != nil {
		dataDir = "."
	}
	dataDir = filepath.Join(dataDir, "ProjectFusion")
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}
	dbPath := filepath.Join(dataDir, "users.db")

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}

	d := &DB{db: db}
	if err := d.initSchema(); err != nil {
		return nil, err
	}
	return d, nil
}

// initSchema 初始化表结构
func (d *DB) initSchema() error {
	_, err := d.db.Exec(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			created_at TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS remember_tokens (
			user_id INTEGER PRIMARY KEY,
			token TEXT NOT NULL,
			expires_at TEXT NOT NULL,
			FOREIGN KEY(user_id) REFERENCES users(id)
		);
	`)
	return err
}

// Close 关闭数据库
func (d *DB) Close() error {
	return d.db.Close()
}

// CreateUser 创建用户
func (d *DB) CreateUser(u *User) error {
	res, err := d.db.Exec(
		"INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
		u.Username, u.PasswordHash, u.CreatedAt,
	)
	if err != nil {
		return err
	}
	id, _ := res.LastInsertId()
	u.ID = int(id)
	return nil
}

// GetUserByUsername 按用户名查询
func (d *DB) GetUserByUsername(username string) (*User, error) {
	u := &User{}
	err := d.db.QueryRow(
		"SELECT id, username, password_hash, created_at FROM users WHERE username = ?",
		username,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

// SaveRememberToken 保存记住密码 token
func (d *DB) SaveRememberToken(userID int, token, expires string) error {
	_, err := d.db.Exec(
		`INSERT INTO remember_tokens (user_id, token, expires_at) VALUES (?, ?, ?)
		 ON CONFLICT(user_id) DO UPDATE SET token=excluded.token, expires_at=excluded.expires_at`,
		userID, token, expires,
	)
	return err
}

// GetUserByRememberToken 通过 token 查询用户（校验有效期）
func (d *DB) GetUserByRememberToken(token string) (*User, error) {
	u := &User{}
	err := d.db.QueryRow(
		`SELECT u.id, u.username, u.password_hash, u.created_at
		 FROM users u JOIN remember_tokens r ON u.id = r.user_id
		 WHERE r.token = ? AND r.expires_at > datetime('now')`,
		token,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

// ClearRememberToken 清除 token
func (d *DB) ClearRememberToken(userID int) error {
	_, err := d.db.Exec("DELETE FROM remember_tokens WHERE user_id = ?", userID)
	return err
}

// UpdatePassword 更新密码
func (d *DB) UpdatePassword(userID int, hash string) error {
	_, err := d.db.Exec("UPDATE users SET password_hash = ? WHERE id = ?", hash, userID)
	return err
}
