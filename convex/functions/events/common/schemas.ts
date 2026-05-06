/**
 * Shared Convex validators for event table schemas.
 *
 * The dock boundary discriminator is common to scheduled, actual, and predicted
 * event rows. Keeping the validator outside any one table folder prevents table
 * schemas from depending on another event table's schema module.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";

/**
 * Convex validator for dock boundary event type values.
 */
const dockEventTypeSchema = v.union(
  v.literal("dep-dock"),
  v.literal("arv-dock")
);

type DockEventType = Infer<typeof dockEventTypeSchema>;

export type { DockEventType };
export { dockEventTypeSchema };
