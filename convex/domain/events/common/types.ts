/**
 * Shared domain primitives for dock-event modules.
 *
 * These types are intentionally storage-neutral so scheduled, actual, and
 * predicted event domains can share boundary vocabulary without importing one
 * another's Convex table schemas.
 */

/**
 * Dock boundary discriminator shared by scheduled, actual, and predicted rows.
 */
type DockEventType = "dep-dock" | "arv-dock";

/**
 * Neutral scheduled boundary context for actual-event reconciliation.
 *
 * Actual reconciliation needs planned boundary order and identity but should not
 * depend on the persisted eventsScheduled row shape. This type carries only the
 * context needed to align live observations with planned boundaries.
 */
type ScheduledBoundaryContext = {
  Key: string;
  VesselAbbrev: string;
  SailingDay: string;
  ScheduledDeparture: number;
  TerminalAbbrev: string;
  EventType: DockEventType;
  EventScheduledTime?: number;
};

export type { DockEventType, ScheduledBoundaryContext };
