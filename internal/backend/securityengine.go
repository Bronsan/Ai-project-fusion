// Package backend - 安全审查引擎
// 规则扫描 + AI 深度审查

package backend

import (
	"encoding/json"
	"fmt"
	"strings"
)

// RunSecurityReview 运行安全审查
func RunSecurityReview(projects []Project, level int, opts ChatOptions) (SecurityReviewResult, error) {
	var issues []SecurityIssue

	// 规则扫描：检查每个项目的文件内容
	for _, p := range projects {
		for _, f := range p.Files {
			// 检测硬编码密钥
			if containsAny(f.Content, []string{"api_key =", "apikey =", "secret =", "password ="}) {
				issues = append(issues, SecurityIssue{
					Level:       "medium",
					File:        f.Path,
					Description: "疑似硬编码密钥/密码",
				})
			}
			// 检测 eval
			if strings.Contains(f.Content, "eval(") {
				issues = append(issues, SecurityIssue{
					Level:       "high",
					File:        f.Path,
					Description: "使用 eval()，存在代码注入风险",
				})
			}
			// 检测内联事件
			if strings.Contains(f.Content, "innerHTML") {
				issues = append(issues, SecurityIssue{
					Level:       "low",
					File:        f.Path,
					Description: "使用 innerHTML，注意 XSS 风险",
				})
			}
		}
	}

	// 根据安全等级判断是否通过
	passed := true
	for _, issue := range issues {
		// 等级越高越严格：level>=3 时 medium 也阻断
		if issue.Level == "critical" || issue.Level == "high" {
			passed = false
		}
		if level >= 3 && issue.Level == "medium" {
			passed = false
		}
	}

	// AI 深度审查（可选，失败则用规则结果）
	if opts.APIKey != "" || true {
		aiResult := aiSecurityReview(projects, opts)
		if aiResult.Passed == false {
			passed = false
		}
		issues = append(issues, aiResult.Issues...)
	}

	return SecurityReviewResult{Passed: passed, Issues: issues}, nil
}

// aiSecurityReview AI 深度安全审查
func aiSecurityReview(projects []Project, opts ChatOptions) SecurityReviewResult {
	var names []string
	for _, p := range projects {
		names = append(names, p.Name)
	}
	prompt := fmt.Sprintf(`请对以下项目的融合进行安全审查，返回 JSON。
项目：%s
返回格式：{"passed":true,"issues":[{"level":"low","file":"文件","description":"说明"}]}
level 可选：low/medium/high/critical。只返回 JSON。`, strings.Join(names, ","))

	messages := []ChatMessage{
		{Role: "system", Content: "你是安全审查专家。"},
		{Role: "user", Content: prompt},
	}
	content, err := Chat(messages, opts)
	if err != nil {
		return SecurityReviewResult{Passed: true, Issues: []SecurityIssue{}}
	}
	var result SecurityReviewResult
	if err := json.Unmarshal([]byte(ExtractJSON(content)), &result); err != nil {
		return SecurityReviewResult{Passed: true, Issues: []SecurityIssue{}}
	}
	return result
}

// containsAny 检查字符串是否包含任一子串
func containsAny(s string, subs []string) bool {
	lower := strings.ToLower(s)
	for _, sub := range subs {
		if strings.Contains(lower, sub) {
			return true
		}
	}
	return false
}
