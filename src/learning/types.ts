export interface MemorySlot {
  id?: number;
  agentRole: 'hunter' | 'healer' | 'shared';
  content: string;
  source: string;
  confidence: number;
  pinned: boolean;
  createdAt: number;
  expiresAt?: number;
}

export interface Lesson {
  title: string;
  description: string;
  confidence: number;
}

export interface ChangeAnalysis {
  file: string;
  action: 'ADOPT' | 'ADAPT' | 'SKIP';
  reasoning: string;
  affectedWorkflows: string[];
}

export interface UpdatePlan {
  syncDate: string;
  upstreamCommitHash: string;
  totalChanges: number;
  adoptions: any[];
  adaptations: any[];
  skipped: any[];
}
