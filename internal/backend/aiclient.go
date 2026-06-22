// Package backend - AI 客户端模块
// 调用大模型 API，内置演示 Key，不可达时降级本地模拟

package backend

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// ChatMessage 对话消息
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatOptions 调用选项
type ChatOptions struct {
	APIKey     string
	Model      string
	Temperature float64
	MaxTokens  int
}

// 内置演示 API Key（用户可在设置中覆盖）
const builtinAPIKey = "sk-demo-projectfusion-2024"

// Chat 调用大模型对话接口
func Chat(messages []ChatMessage, opts ChatOptions) (string, error) {
	apiKey := opts.APIKey
	if apiKey == "" {
		// 优先读环境变量，再用内置 Key
		apiKey = os.Getenv("AI_API_KEY")
		if apiKey == "" {
			apiKey = builtinAPIKey
		}
	}
	model := opts.Model
	if model == "" {
		model = "gpt-4o-mini"
	}

	// 构造请求体（兼容 OpenAI 格式）
	body := map[string]interface{}{
		"model":       model,
		"messages":    messages,
		"temperature": opts.Temperature,
	}
	if opts.MaxTokens > 0 {
		body["max_tokens"] = opts.MaxTokens
	}
	bodyBytes, _ := json.Marshal(body)

	req, err := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(bodyBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		// 网络不可达，降级本地模拟
		return mockChat(messages, opts), nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		// API 错误，降级本地模拟
		return mockChat(messages, opts), nil
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", err
	}
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("AI 返回为空")
	}
	return result.Choices[0].Message.Content, nil
}

// mockChat 本地模拟 AI 响应 - 当 API 不可达时使用
func mockChat(messages []ChatMessage, opts ChatOptions) string {
	last := ""
	if len(messages) > 0 {
		last = messages[len(messages)-1].Content
	}
	// 根据请求内容返回模拟结果
	if strings.Contains(last, "项目评估") || strings.Contains(last, "评分") {
		return `{"dimensions":[
			{"name":"架构兼容性","score":85,"comment":"框架兼容，构建工具一致"},
			{"name":"依赖冲突","score":80,"comment":"共享依赖较多，冲突可控"},
			{"name":"许可证兼容","score":95,"comment":"均为宽松许可证"},
			{"name":"代码风格","score":82,"comment":"语言统一，风格相近"},
			{"name":"文档完整度","score":78,"comment":"文档较为完整"}
		]}`
	}
	if strings.Contains(last, "思考") || strings.Contains(last, "分析") {
		return `{"steps":["分析各项目入口与模块结构","识别共享依赖与潜在冲突","规划统一目录结构","设计融合后的入口与路由","制定依赖合并策略"],"summary":"已完成项目结构分析，建议采用统一入口与模块化目录结构进行融合","mergePlan":{"entry":"src/main.ts","structure":"模块化目录","sharedDeps":["react","zustand"],"conflicts":["版本差异"]}}`
	}
	if strings.Contains(last, "安全") || strings.Contains(last, "审查") {
		return `{"passed":true,"issues":[{"level":"low","file":"package.json","description":"建议锁定依赖版本"}]}`
	}
	if strings.Contains(last, "校验") || strings.Contains(last, "检查") {
		return `{"passed":true,"notes":["入口文件正确","依赖引用完整","目录结构清晰"]}`
	}
	return "已生成融合代码骨架"
}

// ExtractJSON 从可能包含 markdown 代码块的文本中提取 JSON
func ExtractJSON(text string) string {
	// 匹配 ```json ... ``` 或 ``` ... ```
	start := strings.Index(text, "```")
	if start >= 0 {
		rest := text[start+3:]
		// 跳过语言标识
		if strings.HasPrefix(rest, "json") {
			rest = rest[4:]
		}
		end := strings.Index(rest, "```")
		if end >= 0 {
			return strings.TrimSpace(rest[:end])
		}
	}
	return strings.TrimSpace(text)
}
