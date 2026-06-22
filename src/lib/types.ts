// 前端类型定义 - 与后端 types.ts 对应

export type ProjectSource = 'builtin' | 'uploaded';

export interface Project {
  id: string;
  name: string;
  description: string;
  language: string;
  tags: string[];
  stars: number;
  license: string;
  readme: string;
  source: ProjectSource;
  structure: {
    framework: string;
    buildTool: string;
    packageManager: string;
    moduleSystem: string;
    testFramework: string;
  };
  dependencies: string[];
  files?: { path: string; content: string }[];
}

export interface ScoreDimension {
  name: string;
  score: number;
  comment: string;
}

export interface SecurityIssue {
  level: 'low' | 'medium' | 'high' | 'critical';
  file: string;
  description: string;
  suggestion: string;
}

export interface FileNode {
  path: string;
  type: 'file' | 'dir';
  content?: string;
  children?: FileNode[];
}

export interface LogEntry {
  time: string;
  step: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export type FusionStatus =
  | 'pending'
  | 'thinking'
  | 'reviewing'
  | 'scoring'
  | 'merging'
  | 'verifying'
  | 'done'
  | 'failed';

export type FusionStrategy = 'conservative' | 'balanced' | 'aggressive';

export interface FusionReport {
  taskId: string;
  totalScore: number;
  summary: string;
  thinkingSteps: string[];
  dimensions: ScoreDimension[];
  issues: SecurityIssue[];
  /** 融合产物安全扫描结果 */
  productScanIssues?: SecurityIssue[];
  /** 实体合并统计与详情（P1-2，冲突可视化） */
  mergeStats?: MergeStatsInfo;
  /** 依赖图分析结果（P1-4，依赖图可视化） */
  dependencyGraph?: DependencyGraphInfo;
  files: FileNode[];
  passed: boolean;
}

/** 实体合并统计 - 前端可视化用 */
export interface MergeStatsInfo {
  merged: number;
  deduplicated: number;
  renamed: number;
  details: MergeDetailInfo[];
}

/** 合并详情 - 单个实体的合并决策 */
export interface MergeDetailInfo {
  decision: 'merged' | 'deduplicated' | 'renamed' | 'no_conflict';
  reason: string;
  affectedEntities: string[];
  mergedSource?: string;
}

/** 依赖图分析结果 */
export interface DependencyGraphInfo {
  nodes: GraphNodeInfo[];
  edges: GraphEdgeInfo[];
  cycles: string[][];
  orphans: string[];
  sharedDeps: string[];
}

export interface GraphNodeInfo {
  id: string;
  label: string;
  type: 'project' | 'module' | 'external';
  project: string;
}

export interface GraphEdgeInfo {
  from: string;
  to: string;
  kind: 'import' | 'require' | 'dynamic';
}

export interface FusionTask {
  id: string;
  projectIds: string[];
  strategy: FusionStrategy;
  securityLevel: number;
  model: string;
  status: FusionStatus;
  currentStep: string;
  score?: number;
  logs: LogEntry[];
  report?: FusionReport;
  createdAt: string;
  updatedAt: string;
}

export interface PreviewScore {
  totalScore: number;
  dimensions: ScoreDimension[];
  feasible: boolean;
}
