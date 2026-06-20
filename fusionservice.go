// Package main - 融合服务编排
// 串联思考→审查→评分→拼接→校验→报告

package main

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// 任务存储（内存）
var (
	tasksMu sync.RWMutex
	tasks   = map[string]*FusionTask{}
)

// StartFusion 启动融合任务 - 异步执行完整流程
func (a *App) StartFusion(projectIDs []string, strategy string, securityLevel int, apiKey, model string) (*FusionTask, error) {
	if len(projectIDs) < 2 {
		return nil, fmt.Errorf("至少选择 2 个项目")
	}

	// 获取项目
	var projects []Project
	for _, id := range projectIDs {
		p, err := a.getProjectByID(id)
		if err != nil || p == nil {
			return nil, fmt.Errorf("项目 %s 不存在", id)
		}
		projects = append(projects, *p)
	}

	taskID := "task_" + generateID()
	task := &FusionTask{
		ID:            taskID,
		ProjectIDs:    projectIDs,
		Strategy:      strategy,
		SecurityLevel: securityLevel,
		Status:        StatusThinking,
		CurrentStep:   "AI 思考流程：分析项目结构",
		Logs:          []LogEntry{},
		CreatedAt:     time.Now().Format(time.RFC3339),
		UpdatedAt:     time.Now().Format(time.RFC3339),
	}

	tasksMu.Lock()
	tasks[taskID] = task
	tasksMu.Unlock()

	// 异步执行融合流程
	go a.executeFusion(task, projects, apiKey, model)

	return task, nil
}

// executeFusion 执行完整融合流程
func (a *App) executeFusion(task *FusionTask, projects []Project, apiKey, model string) {
	opts := ChatOptions{APIKey: apiKey, Model: model, Temperature: 0.3, MaxTokens: 800}

	defer func() {
		if r := recover(); r != nil {
			a.updateTaskStatus(task, StatusFailed, "流程异常")
			a.logTask(task, string(StatusFailed), "error", fmt.Sprintf("执行失败：%v", r))
		}
	}()

	// 阶段 1：思考流程
	a.updateTaskStatus(task, StatusThinking, "AI 思考流程：分析项目结构")
	var names []string
	for _, p := range projects {
		names = append(names, p.Name)
	}
	a.logTask(task, "thinking", "info", fmt.Sprintf("开始分析 %s", joinStrings(names, "、")))
	time.Sleep(800 * time.Millisecond)

	thinking, _ := RunThinkingProcess(projects, task.Strategy, opts)
	for _, step := range thinking.Steps {
		a.logTask(task, "thinking", "info", step)
		time.Sleep(400 * time.Millisecond)
	}
	a.logTask(task, "thinking", "success", thinking.Summary)

	// 阶段 2：安全审查
	a.updateTaskStatus(task, StatusReviewing, "安全审查：扫描代码与依赖")
	a.logTask(task, "reviewing", "info", "启动安全审查引擎")
	time.Sleep(600 * time.Millisecond)

	review, _ := RunSecurityReview(projects, task.SecurityLevel, opts)
	for _, issue := range review.Issues {
		icon := "⚠️"
		if issue.Level == "high" {
			icon = "🔴"
		}
		if issue.Level == "critical" {
			icon = "🚨"
		}
		lvl := "info"
		if issue.Level != "low" {
			lvl = "warn"
		}
		a.logTask(task, "reviewing", lvl, fmt.Sprintf("%s [%s] %s: %s", icon, issue.Level, issue.File, issue.Description))
	}
	if review.Passed {
		a.logTask(task, "reviewing", "success", "安全审查通过")
	} else {
		a.logTask(task, "reviewing", "error", "安全审查未通过，存在阻断级风险")
	}

	// 阶段 3：适配性评分
	a.updateTaskStatus(task, StatusScoring, "适配性评分：计算融合可行性")
	time.Sleep(500 * time.Millisecond)

	dimensions := a.aiScoreDimensions(projects, task.Strategy, opts)
	total := 0
	for _, d := range dimensions {
		total += d.Score
	}
	if len(dimensions) > 0 {
		total = total / len(dimensions)
	}
	task.Score = total
	lvl := "warn"
	if total > ScoreThreshold {
		lvl = "success"
	}
	a.logTask(task, "scoring", lvl, fmt.Sprintf("适配性评分：%d 分（阈值 %d）", total, ScoreThreshold))

	// 阶段 4：判断是否拼接
	if total <= ScoreThreshold {
		a.logTask(task, "scoring", "error", fmt.Sprintf("评分未超过 %d，终止拼接流程", ScoreThreshold))
		task.Report = a.buildReport(task, thinking, dimensions, review.Issues, []FileNode{}, false)
		a.updateTaskStatus(task, StatusFailed, "评分未达标，流程终止")
		return
	}

	// 阶段 5：代码拼接
	a.updateTaskStatus(task, StatusMerging, "代码拼接：生成融合项目文件")
	a.logTask(task, "merging", "info", "开始生成融合产物")
	time.Sleep(700 * time.Millisecond)

	files := RunMerge(projects, thinking.MergePlan, task.Strategy, opts)
	flatFiles := flattenFiles(files)
	a.logTask(task, "merging", "success", fmt.Sprintf("已生成 %d 个文件", len(flatFiles)))

	// 阶段 6：二次校验
	a.updateTaskStatus(task, StatusVerifying, "二次校验：运行思考流程检查融合产物")
	time.Sleep(500 * time.Millisecond)

	verify, _ := RunVerificationThinking(flatFiles, opts)
	for _, note := range verify.Notes {
		a.logTask(task, "verifying", "info", note)
	}
	if verify.Passed {
		a.logTask(task, "verifying", "success", "二次校验通过")
	} else {
		a.logTask(task, "verifying", "warn", "二次校验发现注意事项")
	}

	// 阶段 7：报告
	task.Report = a.buildReport(task, thinking, dimensions, review.Issues, files, true)
	a.updateTaskStatus(task, StatusDone, "融合完成")
	a.logTask(task, "verifying", "success", "融合任务完成，可下载产物")
}

// aiScoreDimensions AI 深度评分
func (a *App) aiScoreDimensions(projects []Project, strategy string, opts ChatOptions) []ScoreDimension {
	base := CalculatePreviewScore(projects).Dimensions

	var summaries []string
	for _, p := range projects {
		summaries = append(summaries, fmt.Sprintf(`{"name":"%s","framework":"%s","deps":%s}`,
			p.Name, p.Structure.Framework, toJSON(p.Dependencies)))
	}
	prompt := fmt.Sprintf(`你是项目评估专家。请对以下项目融合的适配性进行深度评分，返回 JSON。
项目：[%s]
策略：%s
基础评分参考：%s
返回格式：{"dimensions":[{"name":"维度名","score":0-100,"comment":"说明"}]}
维度包括：架构兼容性、依赖冲突、许可证兼容、代码风格、文档完整度
只返回 JSON。`, joinStrings(summaries, ","), strategy, toJSONDimensions(base))

	messages := []ChatMessage{
		{Role: "system", Content: "你是项目评估专家，擅长评估开源项目的融合可行性。"},
		{Role: "user", Content: prompt},
	}
	content, err := Chat(messages, opts)
	if err != nil {
		return base
	}
	var result struct {
		Dimensions []ScoreDimension `json:"dimensions"`
	}
	if json.Unmarshal([]byte(ExtractJSON(content)), &result) != nil || len(result.Dimensions) == 0 {
		return base
	}
	return result.Dimensions
}

// GetTask 获取任务状态
func (a *App) GetTask(taskID string) (*FusionTask, error) {
	tasksMu.RLock()
	defer tasksMu.RUnlock()
	task, ok := tasks[taskID]
	if !ok {
		return nil, fmt.Errorf("任务不存在")
	}
	return task, nil
}

// ListTasks 列出所有任务
func (a *App) ListTasks() []*FusionTask {
	tasksMu.RLock()
	defer tasksMu.RUnlock()
	result := make([]*FusionTask, 0, len(tasks))
	for _, t := range tasks {
		result = append(result, t)
	}
	return result
}

// updateTaskStatus 更新任务状态
func (a *App) updateTaskStatus(task *FusionTask, status FusionTaskStatus, step string) {
	tasksMu.Lock()
	task.Status = status
	task.CurrentStep = step
	task.UpdatedAt = time.Now().Format(time.RFC3339)
	tasksMu.Unlock()
}

// logTask 追加日志
func (a *App) logTask(task *FusionTask, step, level, message string) {
	tasksMu.Lock()
	task.Logs = append(task.Logs, LogEntry{
		Time:    time.Now().Format(time.RFC3339),
		Step:    step,
		Level:   level,
		Message: message,
	})
	tasksMu.Unlock()
}

// buildReport 构建报告
func (a *App) buildReport(task *FusionTask, thinking ThinkingResult, dimensions []ScoreDimension, issues []SecurityIssue, files []FileNode, passed bool) *FusionReport {
	return &FusionReport{
		TaskID:        task.ID,
		TotalScore:    task.Score,
		Summary:       thinking.Summary,
		ThinkingSteps: thinking.Steps,
		Dimensions:    dimensions,
		Issues:        issues,
		Files:         files,
		Passed:        passed,
	}
}

// flattenFiles 扁平化文件树
func flattenFiles(nodes []FileNode) []ProjectFile {
	var result []ProjectFile
	for _, n := range nodes {
		if n.Type == "file" && n.Content != "" {
			result = append(result, ProjectFile{Path: n.Path, Content: n.Content})
		}
		if len(n.Children) > 0 {
			result = append(result, flattenFiles(n.Children)...)
		}
	}
	return result
}

// joinStrings 字符串拼接工具
func joinStrings(s []string, sep string) string {
	result := ""
	for i, v := range s {
		if i > 0 {
			result += sep
		}
		result += v
	}
	return result
}

// toJSONDimensions 评分维度序列化
func toJSONDimensions(d []ScoreDimension) string {
	b, _ := json.Marshal(d)
	return string(b)
}

// generateID 生成任务 ID
func generateID() string {
	return fmt.Sprintf("%x", time.Now().UnixNano())
}
