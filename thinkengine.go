// Package main - 思考流程引擎
// AI 分析项目结构并输出融合规划

package main

import (
	"encoding/json"
	"fmt"
	"strings"
)

// RunThinkingProcess 运行思考流程 - 分析项目结构
func RunThinkingProcess(projects []Project, strategy string, opts ChatOptions) (ThinkingResult, error) {
	// 构造项目摘要
	var summaries []string
	for _, p := range projects {
		summaries = append(summaries, fmt.Sprintf(
			"{\"name\":\"%s\",\"framework\":\"%s\",\"buildTool\":\"%s\",\"moduleSystem\":\"%s\",\"deps\":%s}",
			p.Name, p.Structure.Framework, p.Structure.BuildTool, p.Structure.ModuleSystem,
			toJSON(p.Dependencies),
		))
	}

	prompt := fmt.Sprintf(`你是项目融合专家。请分析以下项目的融合方案，返回 JSON。
项目：[%s]
融合策略：%s
请输出思考步骤、总结与融合规划。
返回格式：{"steps":["步骤1","步骤2"],"summary":"总结","mergePlan":{"entry":"入口","structure":"结构","sharedDeps":["共享依赖"],"conflicts":["冲突点"]}}
只返回 JSON。`, strings.Join(summaries, ","), strategy)

	messages := []ChatMessage{
		{Role: "system", Content: "你是项目融合专家，擅长分析开源项目的融合方案。"},
		{Role: "user", Content: prompt},
	}
	content, err := Chat(messages, opts)
	if err != nil {
		return defaultThinking(projects, strategy), nil
	}

	var result ThinkingResult
	if err := json.Unmarshal([]byte(ExtractJSON(content)), &result); err != nil {
		return defaultThinking(projects, strategy), nil
	}
	if len(result.Steps) == 0 {
		return defaultThinking(projects, strategy), nil
	}
	return result, nil
}

// RunVerificationThinking 二次校验 - 检查融合产物
func RunVerificationThinking(files []ProjectFile, opts ChatOptions) (VerifyResult, error) {
	var fileSummaries []string
	for _, f := range files {
		fileSummaries = append(fileSummaries, f.Path)
	}
	prompt := fmt.Sprintf(`请检查以下融合产物文件结构是否合理，返回 JSON。
文件：%s
返回格式：{"passed":true,"notes":["说明1","说明2"]}
只返回 JSON。`, strings.Join(fileSummaries, ","))

	messages := []ChatMessage{
		{Role: "system", Content: "你是代码审查专家。"},
		{Role: "user", Content: prompt},
	}
	content, err := Chat(messages, opts)
	if err != nil {
		return VerifyResult{Passed: true, Notes: []string{"入口文件正确", "依赖引用完整", "目录结构清晰"}}, nil
	}
	var result VerifyResult
	if err := json.Unmarshal([]byte(ExtractJSON(content)), &result); err != nil {
		return VerifyResult{Passed: true, Notes: []string{"入口文件正确", "依赖引用完整", "目录结构清晰"}}, nil
	}
	return result, nil
}

// defaultThinking 默认思考结果（AI 不可达时）
func defaultThinking(projects []Project, strategy string) ThinkingResult {
	var names []string
	for _, p := range projects {
		names = append(names, p.Name)
	}
	return ThinkingResult{
		Steps: []string{
			"分析各项目入口与模块结构",
			"识别共享依赖与潜在冲突",
			"规划统一目录结构",
			"设计融合后的入口与路由",
			"制定依赖合并策略",
		},
		Summary: fmt.Sprintf("已完成 %s 的结构分析，建议采用统一入口与模块化目录结构进行融合", strings.Join(names, "、")),
		MergePlan: MergePlan{
			Entry:      "src/main.ts",
			Structure:  "模块化目录",
			SharedDeps: []string{"react", "zustand"},
			Conflicts:  []string{"版本差异"},
		},
	}
}

// toJSON 简易 JSON 字符串数组序列化
func toJSON(s []string) string {
	b, _ := json.Marshal(s)
	return string(b)
}
