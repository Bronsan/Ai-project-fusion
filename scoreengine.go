// Package main - 评分引擎
// 计算项目适配性评分，五维度加权

package main

import "fmt"
import "strings"

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
func CalculatePreviewScore(projects []Project) PreviewScore {
	if len(projects) < 2 {
		return PreviewScore{Dimensions: []ScoreDimension{}, Feasible: false}
	}

	dimensions := []ScoreDimension{
		scoreArchitecture(projects),
		scoreDependencies(projects),
		scoreLicense(projects),
		scoreCodeStyle(projects),
		scoreDocs(projects),
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
		Feasible:   totalScore >= 60, // 预评分 60 即可尝试
	}
}

// scoreArchitecture 架构兼容性评分
func scoreArchitecture(projects []Project) ScoreDimension {
	frameworks := map[string]bool{}
	buildTools := map[string]bool{}
	moduleSystems := map[string]bool{}
	for _, p := range projects {
		frameworks[p.Structure.Framework] = true
		buildTools[p.Structure.BuildTool] = true
		moduleSystems[p.Structure.ModuleSystem] = true
	}

	score := 100
	if len(frameworks) > 1 && !frameworks["agnostic"] {
		score -= 20
	}
	if frameworks["vanilla"] && frameworks["react"] {
		score -= 15
	}
	if len(buildTools) > 1 {
		score -= 10
	}
	if moduleSystems["cjs"] && moduleSystems["esm"] {
		score -= 25
	}
	score = clamp(score, 40, 100)

	fwKeys := mapKeys(frameworks)
	btKeys := mapKeys(buildTools)
	return ScoreDimension{
		Name:    "架构兼容性",
		Score:   score,
		Comment: "框架: " + strings.Join(fwKeys, "/") + ", 构建: " + strings.Join(btKeys, "/"),
	}
}

// scoreDependencies 依赖冲突评分
func scoreDependencies(projects []Project) ScoreDimension {
	var allDeps []string
	for _, p := range projects {
		allDeps = append(allDeps, p.Dependencies...)
	}
	depSet := map[string]bool{}
	for _, d := range allDeps {
		depSet[d] = true
	}
	overlap := len(allDeps) - len(depSet)
	score := 60 + overlap*8
	if score > 100 {
		score = 100
	}
	return ScoreDimension{
		Name:    "依赖冲突",
		Score:   score,
		Comment: fmt.Sprintf("共享依赖 %d 个，去重后 %d 个", overlap, len(depSet)),
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

// scoreCodeStyle 代码风格评分
func scoreCodeStyle(projects []Project) ScoreDimension {
	languages := map[string]bool{}
	tsCount := 0
	for _, p := range projects {
		languages[p.Language] = true
		if p.Language == "TypeScript" {
			tsCount++
		}
	}
	score := 70
	if len(languages) == 1 {
		score += 20
	}
	if tsCount == len(projects) {
		score += 10
	}
	if score > 100 {
		score = 100
	}
	langKeys := mapKeys(languages)
	tsPercent := tsCount * 100 / len(projects)
	return ScoreDimension{
		Name:    "代码风格",
		Score:   score,
		Comment: fmt.Sprintf("语言: %s, TS 占比 %d%%", strings.Join(langKeys, "/"), tsPercent),
	}
}

// scoreDocs 文档完整度评分
func scoreDocs(projects []Project) ScoreDimension {
	withReadme := 0
	for _, p := range projects {
		if len(p.Readme) > 50 {
			withReadme++
		}
	}
	score := withReadme * 100 / len(projects)
	return ScoreDimension{
		Name:    "文档完整度",
		Score:   score,
		Comment: fmt.Sprintf("%d/%d 项目有完整 README", withReadme, len(projects)),
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
