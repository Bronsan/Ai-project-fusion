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
  files: FileNode[];
  passed: boolean;
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
