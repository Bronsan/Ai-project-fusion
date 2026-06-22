// Package backend - 评分引擎
// 基于真实代码内容计算项目适配性评分，五维度加权
// 分析维度：架构兼容性、依赖冲突、许可证兼容、代码风格、文档完整度

package backend

import (
	"fmt"
	"regexp"
	"strings"
)

// 评分维度权重
var dimensionWeights = map[string]float64{
	"架构兼容性": 0.25,
	"依赖冲突":  0.2,
	"许可证兼容": 0.2,
	"代码风格":  0.2,
	"文档完整度": 0.15,
}

// ScoreThreshold 评分阈值 - 高于此值才允许拼接
const ScoreThreshold = 75

// CalculatePreviewScore 计算预评分（选择项目后即时调用）
// 基于真实代码内容 + 元数据综合评分
func CalculatePreviewScore(projects []Project) PreviewScore {
	if len(projects) < 2 {
		return PreviewScore{Dimensions: []ScoreDimension{}, Feasible: false}
	}

	// 预先分析每个项目的真实代码
	analyses := make([]codeAnalysis, 0, len(projects))
	for _, p := range projects {
		analyses = append(analyses, analyzeCode(p))
	}

	dimensions := []ScoreDimension{
		scoreArchitecture(projects, analyses),
		scoreDependencies(projects, analyses),
		scoreLicense(projects),
		scoreCodeStyle(projects, analyses),
		scoreDocs(projects, analyses),
	}

	total := 0.0
	for _, d := range dimensions {
		w := dimensionWeights[d.Name]
		if w == 0 {
			w = 0.2
		}
		total += float64(d.Score) * w
	}
	totalScore := int(total + 0.5)

	return PreviewScore{
		TotalScore: totalScore,
		Dimensions: dimensions,
		Feasible:   totalScore >= 60,
	}
}

// codeAnalysis 真实代码分析结果
type codeAnalysis struct {
	FileCount      int      // 源码文件数
	TotalLines     int      // 总代码行数
	Exports        []string // 导出的符号名
	Imports        []string // 导入的模块
	HasTypeScript  bool     // 是否含 TypeScript
	HasTests       bool     // 是否含测试文件
	AvgFileLength  int      // 平均文件行数
	MaxFileLength  int      // 最大文件行数
	ExportCount    int      // 导出数量
	ComplexityScore int     // 复杂度评分（0-100，越高越简洁）
}

// analyzeCode 分析项目真实代码内容
func analyzeCode(p Project) codeAnalysis {
	a := codeAnalysis{}

	// 正则：匹配 ES Module 导出
	// export function/name, export const, export default, export { }
	exportRe := regexp.MustCompile(`export\s+(?:default\s+)?(?:function|const|let|var|class|interface|type|enum)\s+(\w+)`)
	exportBraceRe := regexp.MustCompile(`export\s*\{([^}]+)\}`)
	// 匹配 import 语句
	importRe := regexp.MustCompile(`(?:import|require)\s*(?:\w+\s+from\s+)?['"]([^'"]+)['"]`)

	exportSet := map[string]bool{}
	importSet := map[string]bool{}

	for _, f := range p.Files {
		// 只分析源码文件
		if !isSourceFile(f.Path) {
			continue
		}
		a.FileCount++

		lines := strings.Split(f.Content, "\n")
		lineCount := len(lines)
		a.TotalLines += lineCount
		if lineCount > a.MaxFileLength {
			a.MaxFileLength = lineCount
		}

		// 检测 TypeScript
		if strings.HasSuffix(f.Path, ".ts") || strings.HasSuffix(f.Path, ".tsx") {
			a.HasTypeScript = true
		}

		// 检测测试文件
		if strings.Contains(f.Path, ".test.") || strings.Contains(f.Path, ".spec.") || strings.Contains(f.Path, "/test/") || strings.Contains(f.Path, "/tests/") {
			a.HasTests = true
		}

		// 提取导出
		matches := exportRe.FindAllStringSubmatch(f.Content, -1)
		for _, m := range matches {
			if len(m) > 1 {
				exportSet[m[1]] = true
			}
		}
		// export { a, b, c } 形式
		braceMatches := exportBraceRe.FindAllStringSubmatch(f.Content, -1)
		for _, m := range braceMatches {
			if len(m) > 1 {
				for _, name := range strings.Split(m[1], ",") {
					name = strings.TrimSpace(strings.Split(name, " as ")[0])
					if name != "" {
						exportSet[name] = true
					}
				}
			}
		}

		// 提取导入
		importMatches := importRe.FindAllStringSubmatch(f.Content, -1)
		for _, m := range importMatches {
			if len(m) > 1 {
				// 只记录第三方依赖（跳过相对路径）
				if !strings.HasPrefix(m[1], ".") && !strings.HasPrefix(m[1], "/") {
					// 取包名（@scope/name 或 name）
					pkg := m[1]
					if strings.HasPrefix(pkg, "@") {
						parts := strings.SplitN(pkg, "/", 3)
						if len(parts) >= 2 {
							pkg = parts[0] + "/" + parts[1]
						}
					} else {
						pkg = strings.SplitN(pkg, "/", 2)[0]
					}
					importSet[pkg] = true
				}
			}
		}
	}

	// 汇总
	for name := range exportSet {
		a.Exports = append(a.Exports, name)
	}
	for pkg := range importSet {
		a.Imports = append(a.Imports, pkg)
	}
	a.ExportCount = len(exportSet)

	if a.FileCount > 0 {
		a.AvgFileLength = a.TotalLines / a.FileCount
	}

	// 复杂度评分：文件越短越简洁，导出越多说明模块化越好
	complexity := 100
	if a.AvgFileLength > 300 {
		complexity -= 30
	} else if a.AvgFileLength > 200 {
		complexity -= 15
	} else if a.AvgFileLength > 100 {
		complexity -= 5
	}
	if a.MaxFileLength > 500 {
		complexity -= 20
	}
	if a.ExportCount == 0 && a.FileCount > 0 {
		complexity -= 20 // 有文件但无导出，可能是脚本式代码
	}
	a.ComplexityScore = clamp(complexity, 20, 100)

	return a
}

// isSourceFile 判断是否为源码文件
func isSourceFile(p string) bool {
	lower := strings.ToLower(p)
	srcExts := []string{".ts", ".tsx", ".js", ".jsx", ".vue", ".py", ".go", ".rs", ".java"}
	for _, ext := range srcExts {
		if strings.HasSuffix(lower, ext) {
			return true
		}
	}
	return false
}

// scoreArchitecture 架构兼容性评分（基于真实代码分析）
func scoreArchitecture(projects []Project, analyses []codeAnalysis) ScoreDimension {
	frameworks := map[string]bool{}
	buildTools := map[string]bool{}
	moduleSystems := map[string]bool{}
	for _, p := range projects {
		frameworks[p.Structure.Framework] = true
		buildTools[p.Structure.BuildTool] = true
		moduleSystems[p.Structure.ModuleSystem] = true
	}

	score := 100
	reasons := []string{}

	// 框架差异扣分
	if len(frameworks) > 1 && !frameworks["agnostic"] && !frameworks["unknown"] {
		score -= 20
		reasons = append(reasons, "框架差异")
	}
	if frameworks["vanilla"] && frameworks["react"] {
		score -= 15
		reasons = append(reasons, "vanilla+react 混合")
	}
	// 构建工具差异
	if len(buildTools) > 1 && !buildTools["unknown"] {
		score -= 10
		reasons = append(reasons, "构建工具差异")
	}
	// 模块系统不兼容（CJS vs ESM）
	if moduleSystems["cjs"] && moduleSystems["esm"] {
		score -= 25
		reasons = append(reasons, "CJS/ESM 混用")
	}

	// 基于真实代码：检测 import 路径兼容性
	importOverlap := 0
	totalImports := 0
	importSets := make([]map[string]bool, len(analyses))
	for i, a := range analyses {
		importSets[i] = map[string]bool{}
		for _, imp := range a.Imports {
			importSets[i][imp] = true
			totalImports++
		}
	}
	// 计算共享 import 数量
	if len(importSets) >= 2 {
		for imp := range importSets[0] {
			allHave := true
			for j := 1; j < len(importSets); j++ {
				if !importSets[j][imp] {
					allHave = false
					break
				}
			}
			if allHave {
				importOverlap++
			}
		}
	}
	// 共享 import 多说明技术栈接近
	if importOverlap > 0 && totalImports > 0 {
		ratio := importOverlap * 100 / totalImports
		if ratio > 50 {
			score += 10
			reasons = append(reasons, fmt.Sprintf("共享 %d 个依赖导入", importOverlap))
		}
	}

	score = clamp(score, 40, 100)

	fwKeys := mapKeys(frameworks)
	btKeys := mapKeys(buildTools)
	comment := "框架: " + strings.Join(fwKeys, "/") + ", 构建: " + strings.Join(btKeys, "/")
	if len(reasons) > 0 {
		comment += " | " + strings.Join(reasons, "，")
	}
	return ScoreDimension{
		Name:    "架构兼容性",
		Score:   score,
		Comment: comment,
	}
}

// scoreDependencies 依赖冲突评分（基于真实 import 分析）
func scoreDependencies(projects []Project, analyses []codeAnalysis) ScoreDimension {
	// 从 package.json 元数据
	var allDeps []string
	for _, p := range projects {
		allDeps = append(allDeps, p.Dependencies...)
	}
	depSet := map[string]bool{}
	for _, d := range allDeps {
		depSet[d] = true
	}
	overlap := len(allDeps) - len(depSet)

	// 从真实代码 import 分析
	realImportSet := map[string]bool{}
	var allRealImports []string
	for _, a := range analyses {
		for _, imp := range a.Imports {
			realImportSet[imp] = true
			allRealImports = append(allRealImports, imp)
		}
	}
	realOverlap := len(allRealImports) - len(realImportSet)

	// 综合评分：元数据 + 真实代码
	score := 50 + overlap*8 + realOverlap*12
	if score > 100 {
		score = 100
	}

	comment := fmt.Sprintf("共享依赖 %d 个（代码层 %d），去重后 %d 个",
		overlap, realOverlap, len(depSet))
	if realOverlap > 0 {
		comment += "，代码层有共同引用"
	}
	return ScoreDimension{
		Name:    "依赖冲突",
		Score:   score,
		Comment: comment,
	}
}

// scoreLicense 许可证兼容性评分
func scoreLicense(projects []Project) ScoreDimension {
	permissive := map[string]bool{"MIT": true, "Apache-2.0": true, "BSD-3-Clause": true, "ISC": true}
	var licenses []string
	allPermissive := true
	for _, p := range projects {
		licenses = append(licenses, p.License)
		if !permissive[p.License] {
			allPermissive = false
		}
	}
	allSame := true
	for _, l := range licenses {
		if l != licenses[0] {
			allSame = false
		}
	}
	score := 100
	if !allPermissive {
		score -= 30
	}
	if !allSame && allPermissive {
		score -= 5
	}
	uniqueLic := uniqueStrings(licenses)
	return ScoreDimension{
		Name:    "许可证兼容",
		Score:   score,
		Comment: "许可证: " + strings.Join(uniqueLic, " / "),
	}
}

// scoreCodeStyle 代码风格评分（基于真实代码分析）
func scoreCodeStyle(projects []Project, analyses []codeAnalysis) ScoreDimension {
	languages := map[string]bool{}
	tsCount := 0
	for _, p := range projects {
		languages[p.Language] = true
		if p.Language == "TypeScript" {
			tsCount++
		}
	}

	score := 70
	reasons := []string{}

	if len(languages) == 1 {
		score += 20
		reasons = append(reasons, "语言统一")
	}
	if tsCount == len(projects) {
		score += 10
		reasons = append(reasons, "全 TypeScript")
	}

	// 基于真实代码：复杂度分析
	totalComplexity := 0
	validCount := 0
	for _, a := range analyses {
		if a.FileCount > 0 {
			totalComplexity += a.ComplexityScore
			validCount++
		}
	}
	if validCount > 0 {
		avgComplexity := totalComplexity / validCount
		// 复杂度评分影响代码风格分
		if avgComplexity > 80 {
			score += 5
			reasons = append(reasons, "代码简洁")
		} else if avgComplexity < 50 {
			score -= 10
			reasons = append(reasons, "代码偏复杂")
		}
	}

	// 检测是否有测试
	testCount := 0
	for _, a := range analyses {
		if a.HasTests {
			testCount++
		}
	}
	if testCount == len(projects) {
		score += 5
		reasons = append(reasons, "均有测试")
	}

	if score > 100 {
		score = 100
	}
	if score < 30 {
		score = 30
	}

	langKeys := mapKeys(languages)
	tsPercent := tsCount * 100 / len(projects)
	comment := fmt.Sprintf("语言: %s, TS 占比 %d%%", strings.Join(langKeys, "/"), tsPercent)
	if len(reasons) > 0 {
		comment += " | " + strings.Join(reasons, "，")
	}
	return ScoreDimension{
		Name:    "代码风格",
		Score:   score,
		Comment: comment,
	}
}

// scoreDocs 文档完整度评分（基于真实代码分析）
func scoreDocs(projects []Project, analyses []codeAnalysis) ScoreDimension {
	withReadme := 0
	withComments := 0
	for i, p := range projects {
		if len(p.Readme) > 50 {
			withReadme++
		}
		// 检测代码注释密度
		if i < len(analyses) && analyses[i].FileCount > 0 {
			// 简单检测：README 长度 + 文件数
			if len(p.Readme) > 200 && analyses[i].FileCount > 3 {
				withComments++
			}
		}
	}

	readmeScore := withReadme * 100 / len(projects)
	// 文档分 = README 完整度 * 0.7 + 代码注释/结构 * 0.3
	commentScore := 60
	if withComments == len(projects) {
		commentScore = 100
	} else if withComments > 0 {
		commentScore = 80
	}
	score := (readmeScore*7 + commentScore*3) / 10

	comment := fmt.Sprintf("%d/%d 有 README", withReadme, len(projects))
	if withComments == len(projects) {
		comment += "，文档结构完整"
	}
	return ScoreDimension{
		Name:    "文档完整度",
		Score:   score,
		Comment: comment,
	}
}

// 工具函数
func clamp(v, min, max int) int {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

func mapKeys(m map[string]bool) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

func uniqueStrings(s []string) []string {
	seen := map[string]bool{}
	var result []string
	for _, v := range s {
		if !seen[v] {
			seen[v] = true
			result = append(result, v)
		}
	}
	return result
}
