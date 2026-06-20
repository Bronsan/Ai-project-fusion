// Package main - 类型定义
// 与前端 src/lib/types.ts 保持一致

package main

// ProjectSource 项目来源
type ProjectSource string

const (
	SourceBuiltin  ProjectSource = "builtin"
	SourceUploaded ProjectSource = "uploaded"
)

// Project 开源项目
type Project struct {
	ID           string         `json:"id"`
	Name         string         `json:"name"`
	Description  string         `json:"description"`
	Language     string         `json:"language"`
	Tags         []string       `json:"tags"`
	Stars        int            `json:"stars"`
	License      string         `json:"license"`
	Readme       string         `json:"readme"`
	Source       ProjectSource  `json:"source"`
	Structure    ProjectStructure `json:"structure"`
	Dependencies []string       `json:"dependencies"`
	Files        []ProjectFile  `json:"files,omitempty"`
}

// ProjectStructure 项目结构特征
type ProjectStructure struct {
	Framework      string `json:"framework"`
	BuildTool      string `json:"buildTool"`
	PackageManager string `json:"packageManager"`
	ModuleSystem   string `json:"moduleSystem"`
	TestFramework  string `json:"testFramework"`
}

// ProjectFile 项目文件
type ProjectFile struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// ScoreDimension 评分维度
type ScoreDimension struct {
	Name    string `json:"name"`
	Score   int    `json:"score"`
	Comment string `json:"comment"`
}

// PreviewScore 预评分结果
type PreviewScore struct {
	TotalScore int              `json:"totalScore"`
	Dimensions []ScoreDimension `json:"dimensions"`
	Feasible   bool             `json:"feasible"`
}

// FusionTaskStatus 任务状态
type FusionTaskStatus string

const (
	StatusThinking  FusionTaskStatus = "thinking"
	StatusReviewing FusionTaskStatus = "reviewing"
	StatusScoring   FusionTaskStatus = "scoring"
	StatusMerging   FusionTaskStatus = "merging"
	StatusVerifying FusionTaskStatus = "verifying"
	StatusDone      FusionTaskStatus = "done"
	StatusFailed    FusionTaskStatus = "failed"
)

// LogEntry 日志条目
type LogEntry struct {
	Time    string `json:"time"`
	Step    string `json:"step"`
	Level   string `json:"level"`
	Message string `json:"message"`
}

// FusionTask 融合任务
type FusionTask struct {
	ID           string           `json:"id"`
	ProjectIDs   []string         `json:"projectIds"`
	Strategy     string           `json:"strategy"`
	SecurityLevel int             `json:"securityLevel"`
	Status       FusionTaskStatus `json:"status"`
	CurrentStep  string           `json:"currentStep"`
	Score        int              `json:"score"`
	Logs         []LogEntry       `json:"logs"`
	Report       *FusionReport    `json:"report,omitempty"`
	CreatedAt    string           `json:"createdAt"`
	UpdatedAt    string           `json:"updatedAt"`
}

// FusionReport 融合报告
type FusionReport struct {
	TaskID        string           `json:"taskId"`
	TotalScore    int              `json:"totalScore"`
	Summary       string           `json:"summary"`
	ThinkingSteps []string         `json:"thinkingSteps"`
	Dimensions    []ScoreDimension `json:"dimensions"`
	Issues        []SecurityIssue  `json:"issues"`
	Files         []FileNode       `json:"files"`
	Passed        bool             `json:"passed"`
}

// SecurityIssue 安全问题
type SecurityIssue struct {
	Level       string `json:"level"`
	File        string `json:"file"`
	Description string `json:"description"`
}

// FileNode 文件树节点
type FileNode struct {
	Path     string     `json:"path"`
	Name     string     `json:"name"`
	Type     string     `json:"type"`
	Content  string     `json:"content,omitempty"`
	Children []FileNode `json:"children,omitempty"`
}

// MergePlan 融合规划
type MergePlan struct {
	Entry      string   `json:"entry"`
	Structure  string   `json:"structure"`
	SharedDeps []string `json:"sharedDeps"`
	Conflicts  []string `json:"conflicts"`
}

// ThinkingResult 思考流程结果
type ThinkingResult struct {
	Steps    []string  `json:"steps"`
	Summary  string    `json:"summary"`
	MergePlan MergePlan `json:"mergePlan"`
}

// SecurityReviewResult 安全审查结果
type SecurityReviewResult struct {
	Passed bool             `json:"passed"`
	Issues []SecurityIssue  `json:"issues"`
}

// VerifyResult 二次校验结果
type VerifyResult struct {
	Passed bool     `json:"passed"`
	Notes  []string `json:"notes"`
}

// APIResponse 统一响应（用于 HTTP 模式）
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}
