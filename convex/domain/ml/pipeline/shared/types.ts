// ============================================================================
// SHARED TYPES FOR PIPELINE
// ============================================================================

/**
 * Pipeline progress tracking
 */
export type PipelineProgress = {
  pipelineId: string;
  currentStep: string;
  completedSteps: string[];
  stats: Record<string, unknown>;
  startTime: Date;
  errors: Error[];
};

/**
 * Enhanced bucket with validation
 */
export type ValidatedBucket = {
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev: string;
  isValid: boolean;
  validationErrors: string[];
  recordCount: number;
};

/**
 * Performance tracking
 */
export type PerformanceMetrics = {
  operation: string;
  duration: number;
  recordCount?: number;
  bucketCount?: number;
  modelCount?: number;
};
