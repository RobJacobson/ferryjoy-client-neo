/**
 * Shared Convex validators for event table schemas.
 *
 * Dock boundary rows across scheduled, actual, and predicted tables use the
 * same boundary discriminator. Keeping that primitive here avoids making one
 * event table import schema details from another.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";

/**
 * Validates dock boundary event type values shared by event tables.
 *
 * @returns Convex validator for dock boundary event type values
 */
const dockEventTypeSchema = v.union(
  v.literal("dep-dock"),
  v.literal("arv-dock")
);

type DockEventType = Infer<typeof dockEventTypeSchema>;

export type { DockEventType };
export { dockEventTypeSchema };
