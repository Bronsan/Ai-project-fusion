// Package main - Wails 桌面应用入口
// ProjectFusion - AI 驱动的开源项目智能融合工坊
// 版本：0.13beta

package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	"projectfusion/internal/backend"
)

// embed 前端构建产物（dist 目录）
// 构建时 Wails 会自动嵌入 frontend:build 生成的 dist
//
//go:embed all:dist
var assets embed.FS

func main() {
	app := backend.NewApp()

	err := wails.Run(&options.App{
		Title:     "ProjectFusion 0.13beta",
		Width:     1280,
		Height:    820,
		MinWidth:  960,
		MinHeight: 640,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 10, G: 14, B: 39, A: 1},
		OnStartup:        app.Startup,
		OnShutdown:       app.Shutdown,
		Bind: []interface{}{
			app,
		},
	})
	if err != nil {
		panic(err)
	}
}
