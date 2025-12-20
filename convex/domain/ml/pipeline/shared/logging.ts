// ============================================================================
// STRUCTURED LOGGING UTILITY
// ============================================================================

import type { DataQualityMetrics, TerminalPair } from "domain/ml/types";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export class PipelineLogger {
  constructor(
    private pipelineId: string,
    private minLevel: LogLevel = LogLevel.INFO
  ) {}

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ) {
    if (level < this.minLevel) return;

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const logEntry = {
      timestamp,
      pipelineId: this.pipelineId,
      level: levelName,
      message,
      ...context,
    };

    console.log(JSON.stringify(logEntry));
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.DEBUG, message, context);
  }
  info(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.INFO, message, context);
  }
  warn(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.WARN, message, context);
  }
  error(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.ERROR, message, context);
  }
  fatal(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.FATAL, message, context);
  }

  // Specialized logging methods
  logStepStart(step: string, context?: Record<string, unknown>) {
    this.info(`Starting ${step}`, { step, ...context });
  }

  logStepEnd(
    step: string,
    duration: number,
    context?: Record<string, unknown>
  ) {
    this.info(`Completed ${step}`, { step, duration, ...context });
  }

  logBucketProcessing(
    bucket: TerminalPair,
    recordCount: number,
    context?: Record<string, unknown>
  ) {
    this.info(
      `Processing bucket ${bucket.departingTerminalAbbrev}_${bucket.arrivingTerminalAbbrev}`,
      {
        bucket: `${bucket.departingTerminalAbbrev}_${bucket.arrivingTerminalAbbrev}`,
        recordCount,
        ...context,
      }
    );
  }

  logError(
    error: Error | string,
    step: string,
    bucket?: TerminalPair,
    context?: Record<string, unknown>
  ) {
    const isErrorObject = error instanceof Error;
    const errorType = isErrorObject && "type" in error ? error.type : "unknown";
    const message = isErrorObject ? error.message : String(error);
    const recoverable =
      isErrorObject && "recoverable" in error
        ? error.recoverable !== false
        : true;

    const errorContext = {
      step,
      errorType,
      message,
      bucket: bucket
        ? `${bucket.departingTerminalAbbrev}_${bucket.arrivingTerminalAbbrev}`
        : undefined,
      recoverable,
      ...context,
    };

    if (errorType === "fatal" || !recoverable) {
      this.fatal(`Fatal error in ${step}`, errorContext);
    } else {
      this.error(`Error in ${step}`, errorContext);
    }
  }

  logQualityMetrics(metrics: DataQualityMetrics) {
    this.info("Data quality analysis complete", {
      totalRecords: metrics.totalRecords,
      completenessScore: metrics.completeness?.overallScore,
      temporalIssues: metrics.temporal?.invalidRecords,
      duplicateRecords: metrics.duplicates?.count,
    });
  }

  logPipelineComplete(stats: Record<string, unknown>, errorCount: number) {
    this.info("Pipeline completed", {
      success: errorCount === 0,
      bucketsProcessed: stats.bucketsProcessed,
      modelsTrained: stats.modelsTrained,
      totalTrainingExamples: stats.totalExamples,
      errorCount,
    });
  }
}

/**
 * Create a pipeline logger with default settings
 */
export const createPipelineLogger = (pipelineId: string): PipelineLogger => {
  return new PipelineLogger(pipelineId, LogLevel.INFO);
};
