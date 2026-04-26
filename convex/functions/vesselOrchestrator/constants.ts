/**
 * Temporary sanity toggles for orchestrator debugging instrumentation.
 */

/**
 * Enables in-memory sanity counters for schedule and location instrumentation.
 */
export const ENABLE_ORCHESTRATOR_SANITY_METRICS = false;

/**
 * Enables one structured summary log per ping for sanity counters.
 */
export const ENABLE_ORCHESTRATOR_SANITY_SUMMARY_LOGS = false;

/**
 * Structured log event name for schedule-continuity sanity summaries.
 */
export const ORCHESTRATOR_SANITY_SCHEDULE_LOG_EVENT =
  "[VESSEL_ORCHESTRATOR_SANITY_SCHEDULE_ACCESS]";

/**
 * Structured log event name for location-dedupe sanity summaries.
 */
export const ORCHESTRATOR_SANITY_LOCATION_LOG_EVENT =
  "[VESSEL_ORCHESTRATOR_SANITY_LOCATION_DEDUPE]";
