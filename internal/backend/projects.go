// Package backend - 项目库管理
// 内置演示项目 + 用户上传 zip 解析

package backend

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// 内置项目缓存
var (
	builtinProjects     []Project
	builtinProjectsOnce sync.Once
	// 上传项目内存存储
	uploadedProjectsMu sync.RWMutex
	uploadedProjects   = map[string]Project{}
)

// loadBuiltinProjects 加载内置项目（从 api/data/projects.json）
func loadBuiltinProjects() []Project {
	builtinProjectsOnce.Do(func() {
		// 尝试多个可能路径
		paths := []string{"api/data/projects.json", "frontend/api/data/projects.json"}
		var data []byte
		var err error
		for _, p := range paths {
			data, err = os.ReadFile(p)
			if err == nil {
				break
			}
		}
		if err != nil {
			// 内置兜底项目
			builtinProjects = fallbackProjects()
			return
		}
		var wrapper struct {
			Projects []Project `json:"projects"`
		}
		if json.Unmarshal(data, &wrapper) == nil {
			for i := range wrapper.Projects {
				wrapper.Projects[i].Source = SourceBuiltin
			}
			builtinProjects = wrapper.Projects
		} else {
			builtinProjects = fallbackProjects()
		}
	})
	return builtinProjects
}

// fallbackProjects 内置兜底项目（当 projects.json 不可用时）
func fallbackProjects() []Project {
	return []Project{
		{
			ID: "p1", Name: "AuroraUI", Description: "极光风格 React 组件库",
			Language: "TypeScript", Tags: []string{"react", "ui", "components"},
			Stars: 8200, License: "MIT", Source: SourceBuiltin,
			Structure: ProjectStructure{Framework: "react", BuildTool: "vite", PackageManager: "npm", ModuleSystem: "esm", TestFramework: "vitest"},
			Dependencies: []string{"react", "react-dom", "vite", "tailwindcss"},
			Readme: "# AuroraUI\n极光风格 React 组件库，提供玻璃质感与流光动画组件。",
		},
		{
			ID: "p2", Name: "NexusAPI", Description: "高性能 Go API 框架",
			Language: "Go", Tags: []string{"go", "api", "backend"},
			Stars: 15400, License: "MIT", Source: SourceBuiltin,
			Structure: ProjectStructure{Framework: "express", BuildTool: "tsc", PackageManager: "npm", ModuleSystem: "esm", TestFramework: "jest"},
			Dependencies: []string{"express", "zod", "dotenv"},
			Readme: "# NexusAPI\n高性能 API 框架。",
		},
	}
}

// GetProjects 获取全部项目（内置 + 上传）
func (a *App) GetProjects() []Project {
	uploadedProjectsMu.RLock()
	uploaded := make([]Project, 0, len(uploadedProjects))
	for _, p := range uploadedProjects {
		uploaded = append(uploaded, p)
	}
	uploadedProjectsMu.RUnlock()

	builtin := loadBuiltinProjects()
	// 上传项目排前面
	return append(uploaded, builtin...)
}

// getProjectByID 按 ID 获取项目
func (a *App) getProjectByID(id string) (*Project, error) {
	uploadedProjectsMu.RLock()
	if p, ok := uploadedProjects[id]; ok {
		uploadedProjectsMu.RUnlock()
		return &p, nil
	}
	uploadedProjectsMu.RUnlock()

	for _, p := range loadBuiltinProjects() {
		if p.ID == id {
			return &p, nil
		}
	}
	return nil, fmt.Errorf("项目不存在")
}

// PreviewScoreAPI 预评分接口
func (a *App) PreviewScoreAPI(projectIDs []string) (PreviewScore, error) {
	var projects []Project
	for _, id := range projectIDs {
		p, err := a.getProjectByID(id)
		if err != nil || p == nil {
			continue
		}
		projects = append(projects, *p)
	}
	return CalculatePreviewScore(projects), nil
}

// DeleteUploadedProject 删除上传项目
func (a *App) DeleteUploadedProject(id string) bool {
	uploadedProjectsMu.Lock()
	defer uploadedProjectsMu.Unlock()
	if _, ok := uploadedProjects[id]; ok {
		delete(uploadedProjects, id)
		return true
	}
	return false
}

// UploadProjectFromBytes 从 zip 字节流解析上传项目
// 返回解析后的项目，并存入内存库
func (a *App) UploadProjectFromBytes(filename string, data []byte) (Project, error) {
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return Project{}, fmt.Errorf("无法读取 zip：%v", err)
	}

	var files []ProjectFile
	for _, f := range reader.File {
		if f.FileInfo().IsDir() {
			continue
		}
		if shouldSkipPath(f.Name) {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			continue
		}
		content, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			continue
		}
		if isTextFile(f.Name) && len(content) < 200000 {
			files = append(files, ProjectFile{
				Path:    normalizePath(f.Name),
				Content: string(content),
			})
		}
	}

	meta := parseProjectMeta(files, filename)
	project := Project{
		ID:           "up_" + generateID(),
		Name:         meta.Name,
		Description:  meta.Description,
		Language:     meta.Language,
		Tags:         meta.Tags,
		Stars:        0,
		License:      meta.License,
		Source:       SourceUploaded,
		Readme:       meta.Readme,
		Structure:    meta.Structure,
		Dependencies: meta.Dependencies,
		Files:        files,
	}

	uploadedProjectsMu.Lock()
	uploadedProjects[project.ID] = project
	uploadedProjectsMu.Unlock()

	return project, nil
}

// UploadProject Wails 绑定方法 - 接收前端选择的文件路径
// Wails 前端通过 runtime 打开文件选择对话框获取路径
func (a *App) UploadProject(filePath string) (Project, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return Project{}, fmt.Errorf("读取文件失败：%v", err)
	}
	filename := filepath.Base(filePath)
	return a.UploadProjectFromBytes(filename, data)
}

// shouldSkipPath 判断路径是否应跳过
func shouldSkipPath(p string) bool {
	skips := []string{"node_modules/", ".git/", "dist/", "build/", ".next/", "__pycache__/", ".DS_Store"}
	for _, s := range skips {
		if strings.Contains(p, s) {
			return true
		}
	}
	return false
}

// isTextFile 判断是否为文本文件
func isTextFile(p string) bool {
	lower := strings.ToLower(p)
	if strings.HasSuffix(lower, "license") || strings.HasSuffix(lower, "readme") || strings.HasSuffix(lower, "makefile") {
		return true
	}
	textExts := []string{".ts", ".tsx", ".js", ".jsx", ".vue", ".json", ".md", ".txt",
		".css", ".scss", ".less", ".html", ".yml", ".yaml", ".xml",
		".py", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".sh",
		".env", ".toml", ".ini", ".conf"}
	for _, ext := range textExts {
		if strings.HasSuffix(lower, ext) {
			return true
		}
	}
	// .gitignore 等无扩展名配置
	if strings.HasSuffix(lower, ".gitignore") || strings.HasSuffix(lower, ".env") {
		return true
	}
	return false
}

// normalizePath 规范化路径 - 去除顶层目录前缀
func normalizePath(p string) string {
	parts := strings.Split(p, "/")
	if len(parts) > 1 {
		return strings.Join(parts[1:], "/")
	}
	return p
}

// projectMeta 解析出的项目元数据
type projectMeta struct {
	Name         string
	Description  string
	Language     string
	License      string
	Readme       string
	Tags         []string
	Dependencies []string
	Structure    ProjectStructure
}

// parseProjectMeta 从文件列表解析项目元数据
func parseProjectMeta(files []ProjectFile, filename string) projectMeta {
	meta := projectMeta{
		Name:         strings.TrimSuffix(filename, ".zip"),
		Description:  fmt.Sprintf("用户上传的项目（来自 %s）", filename),
		Language:     "TypeScript",
		License:      "MIT",
		Tags:         []string{"uploaded"},
		Structure:    ProjectStructure{Framework: "unknown", BuildTool: "unknown", PackageManager: "npm", ModuleSystem: "esm", TestFramework: "unknown"},
	}

	// 解析 package.json
	for _, f := range files {
		if f.Path == "package.json" || strings.HasSuffix(f.Path, "/package.json") {
			var pkg struct {
				Name        string            `json:"name"`
				Description string            `json:"description"`
				License     string            `json:"license"`
				Type        string            `json:"type"`
				Dependencies map[string]string `json:"dependencies"`
				DevDeps     map[string]string `json:"devDependencies"`
			}
			if json.Unmarshal([]byte(f.Content), &pkg) == nil {
				if pkg.Name != "" {
					meta.Name = pkg.Name
				}
				if pkg.Description != "" {
					meta.Description = pkg.Description
				}
				if pkg.License != "" {
					meta.License = pkg.License
				}
				if pkg.Type == "module" {
					meta.Structure.ModuleSystem = "esm"
				} else if pkg.Type == "commonjs" {
					meta.Structure.ModuleSystem = "cjs"
				}
				deps := map[string]string{}
				for k, v := range pkg.Dependencies {
					deps[k] = v
				}
				for k, v := range pkg.DevDeps {
					deps[k] = v
				}
				for d := range deps {
					meta.Dependencies = append(meta.Dependencies, d)
				}
				// 推断框架
				if deps["react"] != "" {
					meta.Structure.Framework = "react"
				} else if deps["vue"] != "" {
					meta.Structure.Framework = "vue"
				} else if deps["express"] != "" {
					meta.Structure.Framework = "express"
				} else if deps["next"] != "" {
					meta.Structure.Framework = "next"
				}
				if deps["vite"] != "" {
					meta.Structure.BuildTool = "vite"
				} else if deps["webpack"] != "" {
					meta.Structure.BuildTool = "webpack"
				}
				if deps["vitest"] != "" {
					meta.Structure.TestFramework = "vitest"
				} else if deps["jest"] != "" {
					meta.Structure.TestFramework = "jest"
				}
				// 标签
				for _, t := range []string{"react", "vue", "express", "next", "vite", "tailwindcss", "zustand", "typescript"} {
					if deps[t] != "" {
						meta.Tags = append(meta.Tags, t)
					}
				}
			}
			break
		}
	}

	// 解析 README
	for _, f := range files {
		lower := strings.ToLower(f.Path)
		if lower == "readme.md" || strings.HasSuffix(lower, "/readme.md") {
			if len(f.Content) > 2000 {
				meta.Readme = f.Content[:2000]
			} else {
				meta.Readme = f.Content
			}
			break
		}
	}

	// 推断语言
	langCount := map[string]int{}
	for _, f := range files {
		parts := strings.Split(f.Path, ".")
		if len(parts) < 2 {
			continue
		}
		ext := strings.ToLower(parts[len(parts)-1])
		langMap := map[string]string{
			"ts": "TypeScript", "tsx": "TypeScript", "js": "JavaScript", "jsx": "JavaScript",
			"vue": "Vue", "py": "Python", "go": "Go", "rs": "Rust", "java": "Java",
		}
		if lang, ok := langMap[ext]; ok {
			langCount[lang]++
		}
	}
	maxCount := 0
	for lang, c := range langCount {
		if c > maxCount {
			maxCount = c
			meta.Language = lang
		}
	}

	return meta
}
