// 通用类型定义 - 项目融合工坊

/** 项目来源 */
export type ProjectSource = 'builtin' | 'uploaded';

/** 开源项目 */
export interface Project {
  id: string;
  name: string;
  description: string;
  language: string;
  tags: string[];
  stars: number;
  license: string;
  readme: string;
  // 项目来源：内置演示或用户上传
  source: ProjectSource;
  // 项目结构特征，用于评分
  structure: {
    framework: string;       // 主框架
    buildTool: string;       // 构建工具
    packageManager: string;  // 包管理器
    moduleSystem: string;    // 模块系统
    testFramework: string;   // 测试框架
  };
  // 依赖列表
  dependencies: string[];
  // 上传项目的原始文件（路径 -> 内容），用于融合时引用
  files?: { path: string; content: string }[];
}

/** 评分维度 */
export interface ScoreDimension {
  name: string;        // 维度名称
  score: number;       // 0-100
  comment: string;     // 评分说明
}

/** 安全问题 */
export interface SecurityIssue {
  level: 'low' | 'medium' | 'high' | 'critical';
  file: string;
  description: string;
  suggestion: string;
}

/** 文件节点 */
export interface FileNode {
  path: string;
  type: 'file' | 'dir';
  content?: string;
  children?: FileNode[];
}

/** 日志条目 */
export interface LogEntry {
  time: string;        // 时间戳
  step: string;        // 所属步骤
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

/** 融合任务状态 */
export type FusionStatus =
  | 'pending'
  | 'thinking'
  | 'reviewing'
  | 'scoring'
  | 'merging'
  | 'verifying'
  | 'done'
  | 'failed';

/** 融合策略 */
export type FusionStrategy = 'conservative' | 'balanced' | 'aggressive';

/** 融合报告 */
export interface FusionReport {
  taskId: string;
  totalScore: number;
  summary: string;
  thinkingSteps: string[];
  dimensions: ScoreDimension[];
  issues: SecurityIssue[];
  /** 融合产物安全扫描结果（v0.13 新增） */
  productScanIssues?: SecurityIssue[];
  files: FileNode[];
  passed: boolean;     // 是否通过 75 分阈值
}

/** 融合任务 */
export interface FusionTask {
  id: string;
  projectIds: string[];
  strategy: FusionStrategy;
  securityLevel: number;     // 1-5
  model: string;
  status: FusionStatus;
  currentStep: string;
  score?: number;
  logs: LogEntry[];
  report?: FusionReport;
  createdAt: string;
  updatedAt: string;
}

/** 预评分结果 */
export interface PreviewScore {
  totalScore: number;
  dimensions: ScoreDimension[];
  feasible: boolean;
}

/** 创建融合任务请求 */
export interface CreateFusionRequest {
  projectIds: string[];
  strategy: FusionStrategy;
  securityLevel: number;
  apiKey?: string;
  model?: string;
}
