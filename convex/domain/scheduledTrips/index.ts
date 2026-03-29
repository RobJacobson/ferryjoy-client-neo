/**
 * Public exports for the ScheduledTrips domain.
 *
 * This domain reconstructs physical vessel movements from raw WSF schedule
 * rows so downstream consumers can reason about direct segments, journey
 * chains, and arrival estimates.
 */

/**
 * Shared fetch + transform entrypoint for schedule-driven consumers.
 */
export * from "./fetchAndTransform";

/**
 * Grouping helpers for physical departures and vessel-scoped processing.
 */
export * from "./grouping";

/**
 * Transformation pipeline for classification and estimate enrichment.
 */
export * from "./transform";
