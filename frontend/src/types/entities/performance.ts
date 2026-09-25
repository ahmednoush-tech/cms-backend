export interface PerformanceCycle {
  id: string;
  companyId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface CreatePerformanceCycleInput {
  name: string;
  startDate: string;
  endDate: string;
}

export interface UpdatePerformanceCycleInput {
  name?: string;
  status?: 'open' | 'closed';
}

export interface PerformanceCriterion {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePerformanceCriterionInput {
  name: string;
  description?: string;
}

export interface UpdatePerformanceCriterionInput {
  name?: string;
  description?: string;
}

export interface EvaluationScoreInput {
  criterionId: string;
  score: number;
  comments?: string;
}

export interface PerformanceEvaluationScore {
  id: string;
  evaluationId: string;
  criterionId: string;
  score: number;
  comments: string | null;
  criterion?: PerformanceCriterion;
}

export interface PerformanceEvaluation {
  id: string;
  companyId: string;
  cycleId: string;
  employeeId: string;
  evaluatorId: string;
  overallComments: string | null;
  overallRating: string | null;
  status: 'draft' | 'finalized';
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  cycle?: PerformanceCycle;
  employee?: { id: string; firstName: string; lastName: string };
  evaluator?: { id: string; name: string };
  scores?: PerformanceEvaluationScore[];
}

export interface CreatePerformanceEvaluationInput {
  cycleId: string;
  employeeId: string;
  overallComments?: string;
  scores: EvaluationScoreInput[];
}

export interface UpdatePerformanceEvaluationInput {
  overallComments?: string;
  scores?: EvaluationScoreInput[];
}
