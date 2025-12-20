// ============================================================================
// PERFORMANCE MONITORING UTILITY
// ============================================================================

import type { PerformanceMetrics } from "domain/ml/pipeline/shared/types";

export type { PerformanceMetrics };

export class PerformanceTracker {
  private operations: Map<
    string,
    { startTime: number; context?: Record<string, unknown> }
  > = new Map();

  start(
    operation: string,
    context?: Record<string, unknown>
  ): { operation: string; startTime: number } {
    const startTime = Date.now();
    this.operations.set(operation, { startTime, context });
    return { operation, startTime };
  }

  end(
    operation: string,
    additionalStats?: Record<string, unknown>
  ): PerformanceMetrics {
    const tracker = this.operations.get(operation);
    if (!tracker) {
      throw new Error(`No tracking data found for operation: ${operation}`);
    }

    const duration = Date.now() - tracker.startTime;
    const metrics: PerformanceMetrics = {
      operation,
      duration,
      ...additionalStats,
    };

    this.operations.delete(operation);
    return metrics;
  }

  getActiveOperations(): string[] {
    return Array.from(this.operations.keys());
  }

  clear() {
    this.operations.clear();
  }
}

/**
 * Create a performance tracker instance
 */
export const createPerformanceTracker = (): PerformanceTracker => {
  return new PerformanceTracker();
};

/**
 * Measure async operation performance
 */
export const measureAsync = async <T>(
  operation: string,
  fn: () => Promise<T>,
  tracker: PerformanceTracker,
  context?: Record<string, unknown>
): Promise<{ result: T; metrics: PerformanceMetrics }> => {
  const _startData = tracker.start(operation, context);
  try {
    const result = await fn();
    const metrics = tracker.end(operation);
    return { result, metrics };
  } catch (error) {
    tracker.end(operation, { error: true });
    throw error;
  }
};

/**
 * Measure sync operation performance
 */
export const measureSync = <T>(
  operation: string,
  fn: () => T,
  tracker: PerformanceTracker,
  context?: Record<string, unknown>
): { result: T; metrics: PerformanceMetrics } => {
  const _startData = tracker.start(operation, context);
  try {
    const result = fn();
    const metrics = tracker.end(operation);
    return { result, metrics };
  } catch (error) {
    tracker.end(operation, { error: true });
    throw error;
  }
};
