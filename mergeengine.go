// Package main - 代码拼接引擎
// 生成融合后的项目文件树

package main

import (
	"encoding/json"
	"fmt"
	"path"
	"sort"
	"strings"
)

// RunMerge 执行代码拼接 - 生成融合项目文件树
func RunMerge(projects []Project, plan MergePlan, strategy string, opts ChatOptions) []FileNode {
	// 1. 规则生成基础文件
	ruleFiles := generateRuleFiles(projects, plan, strategy)

	// 2. AI 生成核心文件
	aiFiles := aiGenerateFiles(projects, plan, strategy, opts)

	// 3. 引入上传项目的原始文件
	uploadedFiles := collectUploadedFiles(projects)

	// 4. 合并并构建文件树
	allFiles := append(append(ruleFiles, aiFiles...), uploadedFiles...)
	return buildFileTree(allFiles)
}

// generateRuleFiles 规则生成基础文件
func generateRuleFiles(projects []Project, plan MergePlan, strategy string) []ProjectFile {
	var deps []string
	depSet := map[string]bool{}
	for _, p := range projects {
		for _, d := range p.Dependencies {
			if !depSet[d] {
				depSet[d] = true
				deps = append(deps, d)
			}
		}
	}

	// package.json
	pkgDeps := map[string]string{}
	for _, d := range deps {
		pkgDeps[d] = "^latest"
	}
	pkgJSON := fmt.Sprintf(`{
  "name": "fused-project",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest"
  },
  "dependencies": %s
}`, toJSONMap(pkgDeps))

	// README
	var names []string
	for _, p := range projects {
		names = append(names, p.Name)
	}
	readme := fmt.Sprintf("# Fused Project\n\n由 ProjectFusion 自动融合生成。\n\n## 融合来源\n%s\n\n## 融合策略\n%s\n\n## 目录结构\n- src/ - 源码\n- src/modules/ - 各项目模块\n- src/main.ts - 统一入口\n\n## 使用\n```bash\nnpm install\nnpm run dev\n```\n", strings.Join(names, "\n- "), strategy)

	return []ProjectFile{
		{Path: "package.json", Content: pkgJSON},
		{Path: "README.md", Content: readme},
		{Path: ".gitignore", Content: "node_modules\ndist\n.env\n"},
	}
}

// aiGenerateFiles AI 生成核心文件
func aiGenerateFiles(projects []Project, plan MergePlan, strategy string, opts ChatOptions) []ProjectFile {
	var names []string
	for _, p := range projects {
		names = append(names, p.Name)
	}
	prompt := fmt.Sprintf(`请为融合项目生成核心源码文件，返回 JSON。
融合项目：%s
入口：%s
结构：%s
返回格式：{"files":[{"path":"src/main.ts","content":"代码内容"}]}
只返回 JSON。`, strings.Join(names, ","), plan.Entry, plan.Structure)

	messages := []ChatMessage{
		{Role: "system", Content: "你是全栈工程师，擅长生成项目骨架代码。"},
		{Role: "user", Content: prompt},
	}
	content, err := Chat(messages, opts)
	if err == nil {
		var result struct {
			Files []ProjectFile `json:"files"`
		}
		if json.Unmarshal([]byte(ExtractJSON(content)), &result) == nil && len(result.Files) > 0 {
			return result.Files
		}
	}

	// 默认生成入口文件
	return []ProjectFile{
		{Path: "src/main.ts", Content: fmt.Sprintf(`// 融合项目统一入口
// 由 %s 融合生成
import { initApp } from './app'

initApp()
`, strings.Join(names, " + "))},
		{Path: "src/app.ts", Content: `// 应用初始化
export function initApp() {
  console.log('Fused project started')
  const root = document.getElementById('root')
  if (root) root.innerHTML = '<h1>Fused Project Ready</h1>'
}
`},
		{Path: "src/index.css", Content: `body { font-family: system-ui; margin: 0; }
`},
	}
}

// collectUploadedFiles 收集上传项目原始文件到 src/modules/<项目名>/
func collectUploadedFiles(projects []Project) []ProjectFile {
	var result []ProjectFile
	for _, p := range projects {
		if p.Source != SourceUploaded || len(p.Files) == 0 {
			continue
		}
		safeName := sanitizeName(p.Name)
		for _, f := range p.Files {
			if len(f.Content) > 50000 {
				continue
			}
			if f.Path == "package.json" || f.Path == "README.md" {
				continue
			}
			result = append(result, ProjectFile{
				Path:    "src/modules/" + safeName + "/" + f.Path,
				Content: f.Content,
			})
		}
	}
	return result
}

// buildFileTree 将扁平文件列表构建为树形结构
func buildFileTree(files []ProjectFile) []FileNode {
	root := &FileNode{Path: "", Name: "", Type: "dir"}
	for _, f := range files {
		parts := strings.Split(f.Path, "/")
		current := root
		for i, part := range parts {
			isLast := i == len(parts)-1
			child := findChild(current, part)
			if child == nil {
				child = &FileNode{Name: part, Type: "dir"}
				if isLast {
					child.Type = "file"
					child.Path = f.Path
					child.Content = f.Content
				} else {
					child.Path = strings.Join(parts[:i+1], "/")
				}
				current.Children = append(current.Children, *child)
				// 重新指向新节点
				current = &current.Children[len(current.Children)-1]
			} else {
				current = child
			}
		}
	}
	// 排序：目录在前
	sortTree(root)
	return root.Children
}

// findChild 查找子节点
func findChild(node *FileNode, name string) *FileNode {
	for i := range node.Children {
		if node.Children[i].Name == name {
			return &node.Children[i]
		}
	}
	return nil
}

// sortTree 排序文件树
func sortTree(node *FileNode) {
	sort.Slice(node.Children, func(i, j int) bool {
		if node.Children[i].Type != node.Children[j].Type {
			return node.Children[i].Type == "dir"
		}
		return node.Children[i].Name < node.Children[j].Name
	})
	for i := range node.Children {
		sortTree(&node.Children[i])
	}
}

// sanitizeName 规范化项目名为目录名
func sanitizeName(name string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(name) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
		} else {
			b.WriteRune('-')
		}
	}
	s := b.String()
	if s == "" {
		return "module"
	}
	return s
}

// toJSONMap 简易 map 序列化
func toJSONMap(m map[string]string) string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var b strings.Builder
	b.WriteString("{")
	for i, k := range keys {
		if i > 0 {
			b.WriteString(",")
		}
		b.WriteString(fmt.Sprintf("%q:%q", k, m[k]))
	}
	b.WriteString("}")
	return b.String()
}

// 引用 path 包避免未使用（buildFileTree 内部用 path 拼接的场景预留）
var _ = path.Join
